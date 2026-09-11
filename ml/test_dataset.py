"""Tests for clip discovery, splitting and windowing.

The split tests are the point of this file. A model that trains is easy to get;
a split that does not leak is the thing that decides whether any number we
report means anything.

    python ml/test_dataset.py
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import numpy as np

from dataset import (
    build_windows,
    discover,
    label_map,
    pad_to,
    split_by_signer,
    standardiser,
    window_starts,
)

FEATURES = 155


def make_tree(root: Path, spec: dict[str, dict[str, int]], frames: int = 60) -> None:
    """spec = {word: {signer: n_clips}}"""
    rng = np.random.default_rng(0)
    for word, signers in spec.items():
        for signer, count in signers.items():
            directory = root / word / signer
            directory.mkdir(parents=True, exist_ok=True)
            for i in range(count):
                data = rng.normal(size=(frames, FEATURES)).astype(np.float32)
                np.save(directory / f"{i:03d}.npy", data)
                (directory / f"{i:03d}.json").write_text(
                    json.dumps({"word": word, "signer": signer, "frames": frames})
                )


def test_discover_reads_sidecars():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        make_tree(root, {"hello": {"amit": 2}, "thanks": {"amit": 3}})
        clips = discover(root)
        assert len(clips) == 5, len(clips)
        assert {c.word for c in clips} == {"hello", "thanks"}
        assert all(c.signer == "amit" for c in clips)
        assert all(c.frames == 60 for c in clips)


def test_discover_word_filter():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        make_tree(root, {"hello": {"amit": 2}, "thanks": {"amit": 2}})
        assert {c.word for c in discover(root, {"hello"})} == {"hello"}


def test_split_holds_out_whole_signers():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        make_tree(root, {
            "hello": {"amit": 3, "bina": 3, "chetan": 3},
            "thanks": {"amit": 3, "bina": 3, "chetan": 3},
        })
        train, test = split_by_signer(discover(root), test_signers={"chetan"})
        train_signers = {c.signer for c in train}
        test_signers = {c.signer for c in test}
        assert test_signers == {"chetan"}
        # The property that matters: no overlap at all.
        assert not (train_signers & test_signers)
        assert len(test) == 6 and len(train) == 12


def test_single_signer_refuses_to_split():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        make_tree(root, {"hello": {"amit": 4}, "thanks": {"amit": 4}})
        try:
            split_by_signer(discover(root))
        except ValueError as exc:
            assert "one signer" in str(exc)
        else:
            raise AssertionError("should have refused a single-signer split")


def test_single_signer_split_available_on_request():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        make_tree(root, {"hello": {"amit": 4}, "thanks": {"amit": 4}})
        train, test = split_by_signer(discover(root), allow_clip_split=True)
        assert len(train) + len(test) == 8
        assert test and train


def test_split_rejects_class_missing_from_one_side():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        # chetan never signed "thanks", so holding chetan out leaves the test
        # set without that class.
        make_tree(root, {
            "hello": {"amit": 2, "chetan": 2},
            "thanks": {"amit": 2},
        })
        try:
            split_by_signer(discover(root), test_signers={"chetan"})
        except ValueError as exc:
            assert "only one side" in str(exc)
        else:
            raise AssertionError("should have rejected the lopsided split")


def test_window_starts_and_padding():
    assert window_starts(60, 30, 5) == list(range(0, 31, 5))
    assert window_starts(30, 30, 5) == [0]
    assert window_starts(10, 30, 5) == [0]  # short clip still yields one window

    short = np.ones((4, FEATURES), dtype=np.float32)
    padded = pad_to(short, 10)
    assert padded.shape == (10, FEATURES)
    # Padding repeats the last frame rather than inserting zeros.
    assert np.all(padded[4:] == short[-1])


def test_build_windows_tracks_clip_identity():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        make_tree(root, {"hello": {"amit": 2}, "thanks": {"amit": 2}}, frames=60)
        clips = discover(root)
        labels = label_map(clips)
        x, y, ids = build_windows(clips, labels, size=30, stride=5)
        assert x.shape[1:] == (30, FEATURES)
        assert len(x) == len(y) == len(ids)
        assert len(np.unique(ids)) == 4  # one id per clip
        # Every window of a clip carries that clip's single label.
        for clip_id in np.unique(ids):
            assert len(set(y[ids == clip_id].tolist())) == 1


def test_standardiser_uses_only_what_it_is_given():
    train = np.ones((4, 30, FEATURES), dtype=np.float32) * 2.0
    mean, std = standardiser(train)
    assert np.allclose(mean, 2.0)
    # Constant features must not produce a divide-by-zero.
    assert np.all(std == 1.0)
    assert mean.shape == (FEATURES,) and std.shape == (FEATURES,)


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failures = 0
    for test in tests:
        try:
            test()
        except AssertionError as exc:
            failures += 1
            print(f"FAIL  {test.__name__}: {exc}")
        else:
            print(f"pass  {test.__name__}")
    print(f"\n{len(tests) - failures}/{len(tests)} passed")
    raise SystemExit(1 if failures else 0)
