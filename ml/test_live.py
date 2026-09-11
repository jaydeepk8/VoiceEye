"""Tests for the segmentation logic.

Segmenter is where a working demo and a babbling one diverge, and it is pure
enough to test properly: feed it a scripted stream of probabilities and assert
exactly which words come out. No camera, no model, no torch.

    python ml/test_live.py
"""

from __future__ import annotations

import numpy as np

from live import POSE_DIM, Segmenter, motion_energy

LABELS = ["hello", "rest", "thanks"]


def probs(label: str, confidence: float = 0.95) -> np.ndarray:
    """One frame of model output favouring `label`."""
    out = np.full(len(LABELS), (1.0 - confidence) / (len(LABELS) - 1), dtype=np.float32)
    out[LABELS.index(label)] = confidence
    return out


def run(segmenter: Segmenter, script: list[tuple[str, float, bool]]) -> list[str]:
    emitted = []
    for label, confidence, moving in script:
        word = segmenter.update(probs(label, confidence), moving)
        if word:
            emitted.append(word)
    return emitted


def test_emits_after_enough_agreement():
    segmenter = Segmenter(LABELS, agree=3, cooldown=0)
    assert run(segmenter, [("hello", 0.95, True)] * 3) == ["hello"]


def test_does_not_emit_before_agreement():
    segmenter = Segmenter(LABELS, agree=5, cooldown=0)
    assert run(segmenter, [("hello", 0.95, True)] * 4) == []


def test_low_confidence_never_fires():
    segmenter = Segmenter(LABELS, agree=2, threshold=0.8, cooldown=0)
    assert run(segmenter, [("hello", 0.5, True)] * 20) == []


def test_still_hands_never_fire():
    """A confident prediction on a motionless frame is a rest pose."""
    segmenter = Segmenter(LABELS, agree=2, cooldown=0)
    assert run(segmenter, [("hello", 0.99, False)] * 20) == []


def test_rest_label_is_never_spoken():
    segmenter = Segmenter(LABELS, agree=2, cooldown=0)
    assert run(segmenter, [("rest", 0.99, True)] * 20) == []


def test_flapping_predictions_do_not_fire():
    """Alternating guesses never build a streak, which is the point."""
    segmenter = Segmenter(LABELS, agree=3, cooldown=0)
    script = [("hello", 0.95, True), ("thanks", 0.95, True)] * 10
    assert run(segmenter, script) == []


def test_near_tie_never_fires():
    """Two classes neck and neck means undecided, however often it repeats.

    This is the case raw confidence cannot catch: with a flat softmax both
    classes can clear the threshold while the model is plainly torn.
    """
    segmenter = Segmenter(LABELS, agree=2, threshold=0.3, cooldown=0, margin=0.12)
    tied = np.array([0.45, 0.10, 0.45], dtype=np.float32)
    emitted = [segmenter.update(tied, True) for _ in range(20)]
    assert not any(emitted)


def test_clear_winner_fires_on_a_flat_softmax():
    """The counterpart: a modest top score still fires if it leads clearly."""
    segmenter = Segmenter(LABELS, agree=2, threshold=0.3, cooldown=0, margin=0.12)
    decided = np.array([0.46, 0.27, 0.27], dtype=np.float32)
    emitted = [segmenter.update(decided, True) for _ in range(4)]
    assert "hello" in emitted


def test_one_sign_emits_once():
    """The whole reason cooldown exists: holding a sign must not repeat it."""
    segmenter = Segmenter(LABELS, agree=3, cooldown=10)
    assert run(segmenter, [("hello", 0.95, True)] * 12) == ["hello"]


def test_cooldown_rearms_after_stillness():
    segmenter = Segmenter(LABELS, agree=3, cooldown=4)
    script = (
        [("hello", 0.95, True)] * 3     # fires
        + [("hello", 0.95, False)] * 6  # hands drop, cooldown lapses
        + [("thanks", 0.95, True)] * 3  # next sign
    )
    assert run(segmenter, script) == ["hello", "thanks"]


def test_reset_clears_streak():
    segmenter = Segmenter(LABELS, agree=3, cooldown=0)
    run(segmenter, [("hello", 0.95, True)] * 2)
    segmenter.reset()
    assert run(segmenter, [("hello", 0.95, True)] * 2) == []


def test_motion_energy_separates_moving_from_still():
    still = np.ones((30, 155), dtype=np.float32)
    assert motion_energy(still) == 0.0

    moving = np.ones((30, 155), dtype=np.float32)
    moving[:, POSE_DIM:-2] += np.linspace(0, 5, 30)[:, None].astype(np.float32)
    assert motion_energy(moving) > motion_energy(still)

    # Pose drift alone must not read as signing.
    pose_only = np.ones((30, 155), dtype=np.float32)
    pose_only[:, :POSE_DIM] += np.linspace(0, 5, 30)[:, None].astype(np.float32)
    assert motion_energy(pose_only) == 0.0

    assert motion_energy(np.ones((1, 155), dtype=np.float32)) == 0.0


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
