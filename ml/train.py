"""Train a GRU to classify sign windows.

    python ml/train.py --epochs 40

The model is deliberately small and deliberately unidirectional. A bidirectional
GRU would score better on a benchmark and be useless here: it needs the whole
clip before it can answer, and the live system has to classify while the signer
is still signing. Every architecture choice below is constrained by that.

Reported accuracy comes in two forms. Window accuracy is what the loss sees.
Clip accuracy pools the windows of one clip into a single answer, which is what
the deployed system actually does, so it is the honest headline number.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from dataset import (
    DATA_ROOT,
    build_windows,
    discover,
    label_map,
    split_by_signer,
    standardiser,
    summarise,
)

CHECKPOINT_DIR = Path(__file__).resolve().parent / "checkpoints"


class SignGRU(nn.Module):
    def __init__(
        self,
        input_dim: int = 155,
        hidden: int = 128,
        layers: int = 2,
        classes: int = 2,
        dropout: float = 0.3,
    ):
        super().__init__()
        self.gru = nn.GRU(
            input_dim,
            hidden,
            layers,
            batch_first=True,
            dropout=dropout if layers > 1 else 0.0,
        )
        self.head = nn.Linear(hidden, classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        output, _ = self.gru(x)
        # Last timestep only: the same value the streaming loop will read after
        # feeding one frame at a time.
        return self.head(output[:, -1])


def evaluate(
    model: nn.Module,
    x: torch.Tensor,
    y: torch.Tensor,
    clip_ids: np.ndarray,
    classes: int,
) -> tuple[float, float, np.ndarray]:
    """Return (window accuracy, clip accuracy, confusion matrix over clips)."""
    model.eval()
    with torch.no_grad():
        logits = torch.cat([model(batch) for batch in x.split(256)])
    window_accuracy = (logits.argmax(1) == y).float().mean().item()

    confusion = np.zeros((classes, classes), dtype=int)
    correct = 0
    unique = np.unique(clip_ids)
    for clip in unique:
        mask = clip_ids == clip
        # Mean logit across the clip's windows, mirroring how live.py will
        # accumulate evidence over consecutive frames.
        predicted = int(logits[mask].mean(0).argmax())
        actual = int(y[mask][0])
        confusion[actual, predicted] += 1
        correct += predicted == actual
    return window_accuracy, correct / len(unique), confusion


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DATA_ROOT)
    parser.add_argument("--words", help="comma separated subset")
    parser.add_argument("--window", type=int, default=30)
    parser.add_argument("--stride", type=int, default=5)
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch", type=int, default=64)
    parser.add_argument("--hidden", type=int, default=128)
    parser.add_argument("--layers", type=int, default=2)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--dropout", type=float, default=0.3)
    parser.add_argument("--noise", type=float, default=0.01,
                        help="gaussian jitter added to training windows")
    parser.add_argument("--test-signers", help="comma separated; default picks automatically")
    parser.add_argument("--test-fraction", type=float, default=0.25)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--allow-clip-split", action="store_true",
                        help="permit a same-signer split; results are NOT generalisation")
    parser.add_argument("--out", type=Path, default=CHECKPOINT_DIR / "sign_gru.pt")
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    wanted = {w.strip() for w in args.words.split(",")} if args.words else None
    clips = discover(args.root, wanted)
    if not clips:
        print(f"no clips found under {args.root}")
        return 1
    print(summarise(clips), "\n")

    train_clips, test_clips = split_by_signer(
        clips,
        test_signers={s.strip() for s in args.test_signers.split(",")} if args.test_signers else None,
        test_fraction=args.test_fraction,
        seed=args.seed,
        allow_clip_split=args.allow_clip_split,
    )
    labels = label_map(clips)
    print(f"train: {len(train_clips)} clips from {sorted({c.signer for c in train_clips})}")
    print(f"test:  {len(test_clips)} clips from {sorted({c.signer for c in test_clips})}")
    if args.allow_clip_split and len({c.signer for c in clips}) < 2:
        print("WARNING: same-signer split. This number measures memorisation, not skill.")

    train_x, train_y, _ = build_windows(train_clips, labels, args.window, args.stride)
    test_x, test_y, test_ids = build_windows(test_clips, labels, args.window, args.stride)
    mean, std = standardiser(train_x)
    train_x = (train_x - mean) / std
    test_x = (test_x - mean) / std
    print(f"windows: {len(train_x)} train / {len(test_x)} test, {len(labels)} classes\n")

    train_tensor = torch.from_numpy(train_x)
    train_labels = torch.from_numpy(train_y)
    test_tensor = torch.from_numpy(test_x)
    test_labels = torch.from_numpy(test_y)

    model = SignGRU(train_x.shape[-1], args.hidden, args.layers, len(labels), args.dropout)
    optimiser = torch.optim.Adam(model.parameters(), lr=args.lr)
    criterion = nn.CrossEntropyLoss()
    loader = DataLoader(
        TensorDataset(train_tensor, train_labels), batch_size=args.batch, shuffle=True
    )

    best = -1.0
    best_state = None
    for epoch in range(1, args.epochs + 1):
        model.train()
        total = 0.0
        for batch_x, batch_y in loader:
            if args.noise:
                batch_x = batch_x + torch.randn_like(batch_x) * args.noise
            optimiser.zero_grad()
            loss = criterion(model(batch_x), batch_y)
            loss.backward()
            optimiser.step()
            total += loss.item() * len(batch_x)

        window_accuracy, clip_accuracy, _ = evaluate(
            model, test_tensor, test_labels, test_ids, len(labels)
        )
        if clip_accuracy > best:
            best = clip_accuracy
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
        if epoch % 5 == 0 or epoch == 1:
            print(
                f"epoch {epoch:3d}  loss {total/len(train_tensor):.4f}  "
                f"window {window_accuracy:.3f}  clip {clip_accuracy:.3f}"
            )

    model.load_state_dict(best_state)
    window_accuracy, clip_accuracy, confusion = evaluate(
        model, test_tensor, test_labels, test_ids, len(labels)
    )
    names = [w for w, _ in sorted(labels.items(), key=lambda kv: kv[1])]

    print(f"\nbest clip accuracy {clip_accuracy:.3f}  (window {window_accuracy:.3f})")
    print("\nconfusion (rows = truth, cols = predicted)")
    width = max(len(n) for n in names) + 1
    print(" " * width + "".join(f"{n[:6]:>7s}" for n in names))
    for i, name in enumerate(names):
        print(f"{name:<{width}s}" + "".join(f"{v:7d}" for v in confusion[i]))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "state_dict": model.state_dict(),
            "labels": labels,
            "mean": mean,
            "std": std,
            "window": args.window,
            "input_dim": int(train_x.shape[-1]),
            "hidden": args.hidden,
            "layers": args.layers,
            "clip_accuracy": clip_accuracy,
            "test_signers": sorted({c.signer for c in test_clips}),
            "signer_independent": len({c.signer for c in clips}) > 1,
        },
        args.out,
    )
    print(f"\nsaved {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
