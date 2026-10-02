"""Search for settings that lift nine-word accuracy.

    python ml/improve.py
    python ml/improve.py --only baseline,warp

Every configuration is scored by leave-one-session-out, the same way the
headline number is, so results here are comparable to it.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from dataset import DATA_ROOT, discover, feature_columns, label_map, standardiser

POSE_DIM = 27
HAND_DIM = 63
LANDMARK_END = POSE_DIM + 2 * HAND_DIM


class SignNet(nn.Module):
    def __init__(self, input_dim, hidden, layers, classes, dropout=0.3, bidirectional=False):
        super().__init__()
        self.gru = nn.GRU(
            input_dim, hidden, layers, batch_first=True,
            dropout=dropout if layers > 1 else 0.0,
            bidirectional=bidirectional,
        )
        self.head = nn.Linear(hidden * (2 if bidirectional else 1), classes)

    def forward(self, x):
        output, _ = self.gru(x)
        return self.head(output[:, -1])


def time_warp(clip: np.ndarray, factor: float) -> np.ndarray:
    length = max(8, int(round(len(clip) * factor)))
    source = np.linspace(0, len(clip) - 1, length)
    base = np.arange(len(clip))
    return np.stack([np.interp(source, base, clip[:, c]) for c in range(clip.shape[1])], axis=1)


def spatial_jitter(clip: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    out = clip.copy()
    angle = rng.normal(0, 0.05)
    scale = 1.0 + rng.normal(0, 0.06)
    shift = rng.normal(0, 0.02, size=2)
    cos, sin = np.cos(angle), np.sin(angle)
    for start in range(0, LANDMARK_END, 3):
        x = out[:, start].copy()
        y = out[:, start + 1].copy()
        out[:, start] = (cos * x - sin * y) * scale + shift[0]
        out[:, start + 1] = (sin * x + cos * y) * scale + shift[1]
        out[:, start + 2] *= scale
    return out


def windows_from(clip: np.ndarray, size: int, stride: int):
    if len(clip) < size:
        pad = np.repeat(clip[-1:], size - len(clip), axis=0)
        clip = np.concatenate([clip, pad], axis=0)
    return [clip[i: i + size] for i in range(0, len(clip) - size + 1, stride)]


def build(clips, labels, size, stride, augment, rng, copies):
    xs, ys, ids = [], [], []
    clip_id = 0
    for item in clips:
        raw = item.load()
        variants = [raw]
        if augment:
            for _ in range(copies):
                v = raw
                if "warp" in augment:
                    v = time_warp(v, float(rng.uniform(0.8, 1.25)))
                if "jitter" in augment:
                    v = spatial_jitter(v, rng)
                variants.append(v.astype(np.float32))
        for v in variants:
            for w in windows_from(v, size, stride):
                xs.append(w)
                ys.append(labels[item.word])
                ids.append(clip_id)
            clip_id += 1
    return (
        np.asarray(xs, dtype=np.float32),
        np.asarray(ys, dtype=np.int64),
        np.asarray(ids),
    )


def score(model, x, y, ids, classes, pooling):
    model.eval()
    with torch.no_grad():
        logits = torch.cat([model(b) for b in x.split(256)])
    correct = 0
    for clip in np.unique(ids):
        mask = ids == clip
        block = logits[mask]
        if pooling == "max":
            pooled = block.max(0).values
        elif pooling == "last":
            pooled = block[-1]
        else:
            pooled = block.mean(0)
        correct += int(pooled.argmax()) == int(y[mask][0])
    return correct / len(np.unique(ids))


def run_fold(train_clips, test_clips, labels, cfg, seed):
    rng = np.random.default_rng(seed)
    torch.manual_seed(seed)

    train_x, train_y, _ = build(
        train_clips, labels, cfg["window"], cfg["stride"],
        cfg.get("augment"), rng, cfg.get("copies", 2),
    )
    test_x, test_y, test_ids = build(test_clips, labels, cfg["window"], cfg["stride"], None, rng, 0)

    keep = feature_columns(train_x.shape[-1], drop_z=True)
    if keep is not None:
        train_x, test_x = train_x[:, :, keep], test_x[:, :, keep]

    mean, std = standardiser(train_x)
    train_x, test_x = (train_x - mean) / std, (test_x - mean) / std

    model = SignNet(
        train_x.shape[-1], cfg.get("hidden", 128), cfg.get("layers", 2),
        len(labels), bidirectional=cfg.get("bidirectional", False),
    )
    optimiser = torch.optim.Adam(model.parameters(), lr=cfg.get("lr", 1e-3))
    criterion = nn.CrossEntropyLoss()
    loader = DataLoader(
        TensorDataset(torch.from_numpy(train_x), torch.from_numpy(train_y)),
        batch_size=64, shuffle=True,
    )
    for _ in range(cfg.get("epochs", 30)):
        model.train()
        for bx, by in loader:
            optimiser.zero_grad()
            criterion(model(bx + torch.randn_like(bx) * 0.01), by).backward()
            optimiser.step()

    return score(
        model, torch.from_numpy(test_x), torch.from_numpy(test_y),
        test_ids, len(labels), cfg.get("pooling", "mean"),
    )


CONFIGS = {
    "baseline": {"window": 45, "stride": 5},
    "maxpool": {"window": 45, "stride": 5, "pooling": "max"},
    "warp": {"window": 45, "stride": 5, "augment": ["warp"], "copies": 3},
    "jitter": {"window": 45, "stride": 5, "augment": ["jitter"], "copies": 3},
    "warp+jitter": {"window": 45, "stride": 5, "augment": ["warp", "jitter"], "copies": 3},
    "bidir": {"window": 45, "stride": 5, "bidirectional": True},
    "warp+jitter+bidir": {
        "window": 45, "stride": 5, "augment": ["warp", "jitter"],
        "copies": 3, "bidirectional": True,
    },
    "big+aug": {
        "window": 45, "stride": 3, "augment": ["warp", "jitter"], "copies": 5,
        "hidden": 192, "bidirectional": True, "epochs": 40,
    },
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DATA_ROOT)
    parser.add_argument("--only", help="comma separated config names")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--out", type=Path, default=Path(__file__).parent / "improve.json")
    args = parser.parse_args()

    clips = discover(args.root)
    labels = label_map(clips)
    sessions = sorted({c.signer for c in clips})
    print(f"{len(clips)} clips, {len(labels)} words, {len(sessions)} sessions\n")

    wanted = args.only.split(",") if args.only else list(CONFIGS)
    results = {}
    for name in wanted:
        cfg = CONFIGS[name]
        folds = []
        for session in sessions:
            folds.append(run_fold(
                [c for c in clips if c.signer != session],
                [c for c in clips if c.signer == session],
                labels, cfg, args.seed,
            ))
        results[name] = folds
        print(f"{name:20s} mean {np.mean(folds):.3f}  sd {np.std(folds):.3f}  "
              f"folds {' '.join(f'{f:.2f}' for f in folds)}", flush=True)

    args.out.write_text(json.dumps(results, indent=2), encoding="utf-8")
    best = max(results.items(), key=lambda kv: float(np.mean(kv[1])))
    print(f"\nbest: {best[0]} at {np.mean(best[1]):.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
