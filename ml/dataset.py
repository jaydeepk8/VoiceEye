"""Clip discovery, windowing, and honest train/test splits.

Two things in here matter more than the model ever will.

First, splits are grouped by signer. Sign recognition datasets leak badly: two
clips of the same person signing the same word are nearly identical, so a
random split puts near-duplicates on both sides and reports an accuracy that
says nothing about a new person. A signer-independent split is the only number
worth quoting, and split_by_signer() refuses to produce anything else unless
you explicitly ask for it.

Second, windows are cut from clips only after the split. Sliding windows from
one clip overlap heavily, so windowing first and splitting second would leak
the same frames across the boundary even with signers held out correctly.

Nothing here imports torch, so the split logic can be tested on its own.
"""

from __future__ import annotations

import json
import random
from dataclasses import dataclass
from pathlib import Path

import numpy as np

DATA_ROOT = Path(__file__).resolve().parent.parent / "data" / "raw"


@dataclass(frozen=True)
class Clip:
    path: Path
    word: str
    signer: str
    frames: int

    def load(self) -> np.ndarray:
        return np.load(self.path)


def discover(root: Path = DATA_ROOT, words: set[str] | None = None) -> list[Clip]:
    """Find every recorded clip under data/raw/<word>/<signer>/."""
    clips: list[Clip] = []
    for npy in sorted(root.glob("*/*/*.npy")):
        sidecar = npy.with_suffix(".json")
        if sidecar.exists():
            meta = json.loads(sidecar.read_text())
            word, signer = meta["word"], meta.get("signer", "unknown")
            frames = int(meta.get("frames", 0))
        else:
            # Tolerate a missing sidecar rather than silently dropping data.
            word, signer = npy.parent.parent.name, npy.parent.name
            frames = int(np.load(npy, mmap_mode="r").shape[0])
        if words and word not in words:
            continue
        clips.append(Clip(npy, word, signer, frames))
    return clips


def label_map(clips: list[Clip]) -> dict[str, int]:
    return {word: i for i, word in enumerate(sorted({c.word for c in clips}))}


def split_by_signer(
    clips: list[Clip],
    *,
    test_signers: set[str] | None = None,
    test_fraction: float = 0.25,
    seed: int = 0,
    allow_clip_split: bool = False,
) -> tuple[list[Clip], list[Clip]]:
    """Hold out whole signers, never individual clips.

    Raises when the data contains only one signer, because in that situation no
    honest generalisation estimate exists and quietly falling back to a random
    split is how inflated numbers get published. Pass allow_clip_split=True to
    override, and treat anything it reports as a training diagnostic only.
    """
    signers = sorted({c.signer for c in clips})

    if len(signers) < 2:
        if not allow_clip_split:
            raise ValueError(
                f"only one signer ({signers[0] if signers else 'none'}). A "
                "signer-independent split is impossible, and a random split "
                "would measure memorisation. Record a second signer, or pass "
                "allow_clip_split=True and do not quote the result."
            )
        shuffled = list(clips)
        random.Random(seed).shuffle(shuffled)
        cut = max(1, int(len(shuffled) * test_fraction))
        return shuffled[cut:], shuffled[:cut]

    if test_signers is None:
        count = max(1, round(len(signers) * test_fraction))
        test_signers = set(random.Random(seed).sample(signers, count))

    train = [c for c in clips if c.signer not in test_signers]
    test = [c for c in clips if c.signer in test_signers]

    if not train or not test:
        raise ValueError(f"split left a side empty; test_signers={test_signers}")

    missing = {c.word for c in train} ^ {c.word for c in test}
    if missing:
        raise ValueError(
            f"words appear on only one side of the split: {sorted(missing)}. "
            "Pick different test signers or record more coverage."
        )
    return train, test


def window_starts(length: int, size: int, stride: int) -> list[int]:
    if length <= size:
        return [0]
    return list(range(0, length - size + 1, stride))


def pad_to(sequence: np.ndarray, size: int) -> np.ndarray:
    """Repeat the final frame out to `size`; a held pose beats zero padding."""
    if len(sequence) >= size:
        return sequence[:size]
    if len(sequence) == 0:
        return np.zeros((size, sequence.shape[1]), dtype=np.float32)
    tail = np.repeat(sequence[-1:], size - len(sequence), axis=0)
    return np.concatenate([sequence, tail], axis=0)


def build_windows(
    clips: list[Clip], labels: dict[str, int], size: int = 30, stride: int = 5
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Cut clips into fixed windows.

    Returns (X, y, clip_ids). clip_ids lets evaluation pool the windows of one
    clip back into a single prediction, which is what the live system does too.
    """
    xs: list[np.ndarray] = []
    ys: list[int] = []
    ids: list[int] = []
    for clip_id, clip in enumerate(clips):
        sequence = clip.load().astype(np.float32)
        for start in window_starts(len(sequence), size, stride):
            xs.append(pad_to(sequence[start : start + size], size))
            ys.append(labels[clip.word])
            ids.append(clip_id)
    if not xs:
        raise ValueError("no windows produced; are the clips empty?")
    return (
        np.stack(xs).astype(np.float32),
        np.asarray(ys, dtype=np.int64),
        np.asarray(ids, dtype=np.int64),
    )


# Mirror of landmarks.POSE_DIM / HAND_DIM, repeated rather than imported so
# this module stays free of mediapipe and torch.
POSE_DIM = 27
HAND_DIM = 63


def feature_columns(dim: int, drop_z: bool = True) -> list[int] | None:
    """Which feature columns to train on. None means all of them.

    Dropping z measurably helps: under leave-one-session-out it moved a
    30-frame model from 0.730 to 0.793, and a 45-frame model to 0.917. That
    matches what the resolution-stability check showed at the very start --
    MediaPipe's monocular depth was by far the least repeatable part of the
    vector, and the GRU was fitting its noise.

    The clips on disk keep their z regardless. Selection happens here so the
    decision can be revisited without re-extracting anything, and the chosen
    columns travel in the checkpoint so inference applies the same ones.
    """
    if not drop_z:
        return None
    landmarks_end = POSE_DIM + 2 * HAND_DIM
    keep = [i for i in range(landmarks_end) if i % 3 != 2]
    keep.extend(range(landmarks_end, dim))  # presence flags have no z
    return keep


def standardiser(train_x: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Per-feature mean/std from TRAINING windows only.

    Computing these over the whole dataset is a quiet form of leakage: the test
    set would influence the scaling the model was fitted under.
    """
    mean = train_x.reshape(-1, train_x.shape[-1]).mean(axis=0)
    std = train_x.reshape(-1, train_x.shape[-1]).std(axis=0)
    std[std < 1e-6] = 1.0
    return mean.astype(np.float32), std.astype(np.float32)


def summarise(clips: list[Clip]) -> str:
    by_word: dict[str, set[str]] = {}
    counts: dict[str, int] = {}
    for clip in clips:
        by_word.setdefault(clip.word, set()).add(clip.signer)
        counts[clip.word] = counts.get(clip.word, 0) + 1
    lines = [f"{len(clips)} clips, {len({c.signer for c in clips})} signer(s)"]
    for word in sorted(counts):
        lines.append(f"  {counts[word]:4d}  {word:20s} signers={len(by_word[word])}")
    return "\n".join(lines)


if __name__ == "__main__":
    found = discover()
    print(summarise(found) if found else f"no clips under {DATA_ROOT}")
