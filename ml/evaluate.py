"""Score the model against a signer it has never seen.

    python ml/evaluate.py --signer jaydeep

Trains on every other clip and tests only on that person's. This is the number
the project exists to produce: everything reported so far holds out a recording
*source* guessed from INCLUDE filenames, which is strictly harder than a random
split but is not a person we can name.

Prints per-word accuracy and a confusion matrix, because an average hides which
signs actually work.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from dataset import DATA_ROOT, build_windows, discover, feature_columns, label_map, standardiser
from train import SignGRU, evaluate as pooled_evaluate


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--signer", required=True)
    parser.add_argument("--root", type=Path, default=DATA_ROOT)
    parser.add_argument("--window", type=int, default=45)
    parser.add_argument("--stride", type=int, default=5)
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--hidden", type=int, default=128)
    parser.add_argument("--layers", type=int, default=2)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--keep-z", action="store_true")
    parser.add_argument("--out", type=Path, help="write results as json")
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    clips = discover(args.root)
    held = [c for c in clips if c.signer == args.signer.lower()]
    rest = [c for c in clips if c.signer != args.signer.lower()]

    if not held:
        signers = sorted({c.signer for c in clips})
        print(f"no clips for signer '{args.signer}'. found: {signers}")
        print("record some first:  python ml/record_session.py --signer <name>")
        return 1

    labels = label_map(clips)
    held_words = sorted({c.word for c in held})
    missing = [w for w in labels if w not in held_words]

    print(f"train on {len(rest)} clips from {len(set(c.signer for c in rest))} other source(s)")
    print(f"test  on {len(held)} clips from '{args.signer}', {len(held_words)} word(s)")
    if missing:
        print(f"  not recorded, so untested: {', '.join(missing)}")
    print()

    train_x, train_y, _ = build_windows(rest, labels, args.window, args.stride)
    test_x, test_y, test_ids = build_windows(held, labels, args.window, args.stride)

    keep = feature_columns(train_x.shape[-1], drop_z=not args.keep_z)
    if keep is not None:
        train_x, test_x = train_x[:, :, keep], test_x[:, :, keep]

    mean, std = standardiser(train_x)
    train_x, test_x = (train_x - mean) / std, (test_x - mean) / std

    model = SignGRU(train_x.shape[-1], args.hidden, args.layers, len(labels))
    optimiser = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.CrossEntropyLoss()
    loader = DataLoader(
        TensorDataset(torch.from_numpy(train_x), torch.from_numpy(train_y)),
        batch_size=64, shuffle=True,
    )

    for epoch in range(args.epochs):
        model.train()
        for batch_x, batch_y in loader:
            optimiser.zero_grad()
            criterion(model(batch_x + torch.randn_like(batch_x) * 0.01), batch_y).backward()
            optimiser.step()

    window_accuracy, clip_accuracy, confusion = pooled_evaluate(
        model,
        torch.from_numpy(test_x),
        torch.from_numpy(test_y),
        test_ids,
        len(labels),
    )

    names = [w for w, _ in sorted(labels.items(), key=lambda kv: kv[1])]
    print(f"SIGNER-INDEPENDENT CLIP ACCURACY: {clip_accuracy:.3f}")
    print(f"  (window-level {window_accuracy:.3f}, chance {1/len(labels):.3f})\n")

    print("per word:")
    per_word = {}
    for index, name in enumerate(names):
        total = int(confusion[index].sum())
        if not total:
            continue
        correct = int(confusion[index, index])
        per_word[name] = correct / total
        bar = "#" * int(round(correct / total * 20))
        print(f"  {name:16s} {correct:2d}/{total:2d}  {correct/total:.2f}  {bar}")

    print("\nconfusion (rows = what you signed, cols = what it heard)")
    header = "".join(f"{n[:6]:>7s}" for n in names)
    print(f"{'':17s}{header}")
    for index, name in enumerate(names):
        if not confusion[index].sum():
            continue
        row = "".join(f"{int(v):7d}" for v in confusion[index])
        print(f"  {name:15s}{row}")

    if args.out:
        args.out.write_text(json.dumps({
            "signer": args.signer,
            "clip_accuracy": clip_accuracy,
            "window_accuracy": window_accuracy,
            "per_word": per_word,
            "test_clips": len(held),
            "train_clips": len(rest),
            "untested_words": missing,
        }, indent=2), encoding="utf-8")
        print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
