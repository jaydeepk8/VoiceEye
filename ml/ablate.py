"""Compare model and feature choices under leave-one-session-out CV.

    python ml/ablate.py

Every config is scored the same way the real number is scored: hold out a whole
recording session, train from scratch, pool a clip's windows into one answer,
repeat for every session. A single split on this little data swings by nearly
ten points between folds, so anything compared on one split is noise.

Settles two questions that were guesses when the pipeline was written: whether
MediaPipe's depth estimate earns its place in the feature vector, and whether a
one-second window is long enough for a sign.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from dataset import DATA_ROOT, build_windows, discover, label_map, standardiser
from train import SignGRU, evaluate

POSE_DIM = 27
HAND_DIM = 63


def drop_z_columns(dim: int) -> list[int]:
    """Indices of everything except the z of each landmark.

    Pose z was the single worst feature in the resolution-stability check at
    the start of the project -- deviation 0.317 against a median of 0.034 --
    so it is a fair question whether it helps at all.
    """
    keep = []
    for i in range(POSE_DIM + 2 * HAND_DIM):
        if i % 3 != 2:
            keep.append(i)
    keep.extend(range(POSE_DIM + 2 * HAND_DIM, dim))  # presence flags
    return keep


def run_fold(
    train_clips, test_clips, labels, *, window, stride, hidden, layers,
    epochs, keep_columns, seed,
) -> float:
    torch.manual_seed(seed)
    train_x, train_y, _ = build_windows(train_clips, labels, window, stride)
    test_x, test_y, test_ids = build_windows(test_clips, labels, window, stride)

    if keep_columns is not None:
        train_x = train_x[:, :, keep_columns]
        test_x = test_x[:, :, keep_columns]

    mean, std = standardiser(train_x)
    train_x, test_x = (train_x - mean) / std, (test_x - mean) / std

    model = SignGRU(train_x.shape[-1], hidden, layers, len(labels))
    optimiser = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.CrossEntropyLoss()
    loader = DataLoader(
        TensorDataset(torch.from_numpy(train_x), torch.from_numpy(train_y)),
        batch_size=64, shuffle=True,
    )

    test_tensor = torch.from_numpy(test_x)
    test_labels = torch.from_numpy(test_y)
    for _ in range(epochs):
        model.train()
        for batch_x, batch_y in loader:
            optimiser.zero_grad()
            criterion(model(batch_x + torch.randn_like(batch_x) * 0.01), batch_y).backward()
            optimiser.step()

    # Score once, after a fixed number of epochs. Taking the best epoch as
    # judged by this same test set would be choosing a model with the answers
    # in hand -- a quieter version of the leakage this project exists to avoid,
    # and it flatters every config by several points.
    _, clip_accuracy, _ = evaluate(model, test_tensor, test_labels, test_ids, len(labels))
    return clip_accuracy


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DATA_ROOT)
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--out", type=Path, default=Path(__file__).parent / "ablation.json")
    args = parser.parse_args()

    clips = discover(args.root)
    labels = label_map(clips)
    sessions = sorted({c.signer for c in clips})
    print(f"{len(clips)} clips, {len(labels)} words, {len(sessions)} sessions\n")

    dim = clips[0].load().shape[1]
    configs = {
        "baseline w30 h128 L2":  dict(window=30, stride=5, hidden=128, layers=2, keep_columns=None),
        "window 20":             dict(window=20, stride=5, hidden=128, layers=2, keep_columns=None),
        "window 45":             dict(window=45, stride=5, hidden=128, layers=2, keep_columns=None),
        "hidden 64":             dict(window=30, stride=5, hidden=64,  layers=2, keep_columns=None),
        "hidden 256":            dict(window=30, stride=5, hidden=256, layers=2, keep_columns=None),
        "layers 1":              dict(window=30, stride=5, hidden=128, layers=1, keep_columns=None),
        "no z":                  dict(window=30, stride=5, hidden=128, layers=2, keep_columns=drop_z_columns(dim)),
        "no z + window 45":      dict(window=45, stride=5, hidden=128, layers=2, keep_columns=drop_z_columns(dim)),
    }

    results = {}
    for name, config in configs.items():
        scores = []
        for session in sessions:
            train_clips = [c for c in clips if c.signer != session]
            test_clips = [c for c in clips if c.signer == session]
            scores.append(run_fold(
                train_clips, test_clips, labels,
                epochs=args.epochs, seed=args.seed, **config,
            ))
        results[name] = scores
        print(f"{name:22s} mean {np.mean(scores):.3f}  sd {np.std(scores):.3f}  "
              f"folds {' '.join(f'{s:.2f}' for s in scores)}")

    args.out.write_text(json.dumps(results, indent=2))
    ranked = sorted(results.items(), key=lambda kv: -float(np.mean(kv[1])))
    print(f"\nbest: {ranked[0][0]} at {np.mean(ranked[0][1]):.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
