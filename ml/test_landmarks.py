"""Tests for the feature normalisation.

These run without a camera, a photo, or MediaPipe loaded, because normalise()
takes plain arrays. The important one is test_invariant_to_distance: it is the
property the whole feature design rests on, and the one that fails silently if
the maths is wrong -- you would still get a trained model, just one that stops
working the moment someone sits closer to the webcam than the person who
recorded the training data.

    python ml/test_landmarks.py
"""

from __future__ import annotations

import numpy as np

from landmarks import (
    FEATURE_DIM,
    HAND_DIM,
    L_SHOULDER,
    POSE_DIM,
    R_SHOULDER,
    normalise,
)

ASPECT = 16 / 9


def make_pose(scale: float = 1.0, offset=(0.0, 0.0, 0.0), seed: int = 0) -> np.ndarray:
    """A plausible 33-point pose, optionally scaled and shifted as a whole."""
    rng = np.random.default_rng(seed)
    pose = rng.uniform(0.2, 0.8, size=(33, 3)).astype(np.float32)
    pose[L_SHOULDER] = (0.40, 0.35, 0.0)
    pose[R_SHOULDER] = (0.60, 0.35, 0.0)
    return (pose * scale + np.asarray(offset, dtype=np.float32)).astype(np.float32)


def make_hand(scale: float = 1.0, offset=(0.0, 0.0, 0.0), seed: int = 1) -> np.ndarray:
    rng = np.random.default_rng(seed)
    hand = rng.uniform(0.3, 0.7, size=(21, 3)).astype(np.float32)
    return (hand * scale + np.asarray(offset, dtype=np.float32)).astype(np.float32)


def test_shape_and_dtype():
    vector = normalise(make_pose(), make_hand(), make_hand(seed=2), ASPECT)
    assert vector.shape == (FEATURE_DIM,), vector.shape
    assert vector.dtype == np.float32
    assert np.isfinite(vector).all()


def test_invariant_to_distance():
    """Same gesture, camera twice as far away and off to one side."""
    near = normalise(make_pose(), make_hand(), make_hand(seed=2), ASPECT)
    far = normalise(
        make_pose(scale=0.5, offset=(0.15, 0.08, 0.0)),
        make_hand(scale=0.5, offset=(0.15, 0.08, 0.0)),
        make_hand(scale=0.5, offset=(0.15, 0.08, 0.0), seed=2),
        ASPECT,
    )
    assert np.allclose(near, far, atol=1e-5), np.abs(near - far).max()


def test_missing_hand_is_zeros_not_origin():
    """An absent hand must be distinguishable from a hand at the centre."""
    vector = normalise(make_pose(), None, make_hand(seed=2), ASPECT)
    left = vector[POSE_DIM : POSE_DIM + HAND_DIM]
    right = vector[POSE_DIM + HAND_DIM : POSE_DIM + 2 * HAND_DIM]
    assert np.all(left == 0.0)
    assert np.any(right != 0.0)
    assert vector[-2] == 0.0 and vector[-1] == 1.0


def test_presence_flags():
    both = normalise(make_pose(), make_hand(), make_hand(seed=2), ASPECT)
    neither = normalise(make_pose(), None, None, ASPECT)
    assert both[-2] == 1.0 and both[-1] == 1.0
    assert neither[-2] == 0.0 and neither[-1] == 0.0
    # Pose survives even with no hands in frame.
    assert np.any(neither[:POSE_DIM] != 0.0)


def test_no_pose_is_all_zeros():
    vector = normalise(None, make_hand(), make_hand(seed=2), ASPECT)
    assert vector.shape == (FEATURE_DIM,)
    assert np.all(vector == 0.0)


def test_degenerate_shoulders_do_not_explode():
    """A bad detection must not produce a vector of huge numbers."""
    pose = make_pose()
    pose[R_SHOULDER] = pose[L_SHOULDER]
    vector = normalise(pose, make_hand(), make_hand(seed=2), ASPECT)
    assert np.all(vector == 0.0)


def test_aspect_correction_actually_applies():
    """A square frame and a widescreen frame must not agree."""
    square = normalise(make_pose(), make_hand(), None, 1.0)
    wide = normalise(make_pose(), make_hand(), None, ASPECT)
    assert not np.allclose(square, wide)


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
