"""Derive the avatar's standing pose from how the signers stand at rest.

    python ml/neutral_pose.py

Every INCLUDE clip opens and closes with the signer standing still, so the
first and last frames across all clips give a real person's rest pose rather
than an invented one. It is also exactly the pose each sign starts from, so
moving in and out of a sign never jumps.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SIGNS = ROOT / "public" / "signs"
OUT = ROOT / "src" / "Component" / "model" / "neutralPose.json"
EDGE = 3


CURL = {
    "Index": (14, 36, 50),
    "Middle": (17, 42, 58),
    "Ring": (20, 48, 65),
    "Pinky": (24, 54, 72),
}
SPLAY = {"Index": 0.06, "Middle": 0.0, "Ring": -0.05, "Pinky": -0.11}


def unit(vector: np.ndarray) -> np.ndarray:
    return vector / np.linalg.norm(vector)


def relaxed_hand(side: str, forearm: np.ndarray) -> dict[str, np.ndarray]:
    """A hanging hand at rest, built rather than measured.

    Hands resting by the thighs are where the detector does worst -- small,
    half hidden, low confidence -- and the median of those detections came out
    as a slight claw. The wrist here continues the forearm, the palm faces the
    thigh, and the fingers curl in the cascade real relaxed hands show, index
    least and pinky most.
    """
    forward = unit(forearm + np.array([0.0, -0.35, 0.0]))
    toward_middle = np.array([1.0, 0.0, 0.0]) if side == "Right" else np.array([-1.0, 0.0, 0.0])
    palm = unit(toward_middle - (toward_middle @ forward) * forward)
    back_to_front = unit(np.cross(forward, palm)) if side == "Right" else unit(np.cross(palm, forward))
    across = -back_to_front
    up = unit(np.cross(forward, across))

    out: dict[str, np.ndarray] = {f"{side}Hand": forward, f"{side}Hand_up": up}
    for finger, angles in CURL.items():
        splay = SPLAY[finger] * back_to_front
        for n, degrees in enumerate(angles, start=1):
            theta = np.radians(degrees)
            out[f"{side}Hand{finger}{n}"] = unit(
                np.cos(theta) * forward + np.sin(theta) * palm + splay
            )

    thumb_base = unit(0.75 * forward + 0.45 * back_to_front + 0.35 * palm)
    for n, degrees in enumerate((0, 18, 32), start=1):
        theta = np.radians(degrees)
        out[f"{side}HandThumb{n}"] = unit(np.cos(theta) * thumb_base + np.sin(theta) * palm)
    return out


def main() -> int:
    clips = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(SIGNS.glob("*.motion.json"))]
    if not clips:
        print("no motion clips; run ml/retarget.py first")
        return 1

    bones = sorted({b for c in clips for b in c["bones"]})
    pose: dict[str, list[float]] = {}
    for bone in bones:
        samples = []
        for clip in clips:
            series = clip["bones"].get(bone, [])
            samples.extend(v for v in series[:EDGE] + series[-EDGE:] if v)
        if len(samples) < 6:
            continue
        middle = np.median(np.asarray(samples, dtype=np.float64), axis=0)
        length = float(np.linalg.norm(middle))
        if length > 1e-6:
            pose[bone] = middle / length

    for side in ("Left", "Right"):
        forearm = pose.get(f"{side}ForeArm")
        if forearm is None:
            continue
        pose.update(relaxed_hand(side, forearm))

    rounded = {b: [round(float(x), 4) for x in v] for b, v in pose.items()}
    OUT.write_text(json.dumps(rounded, indent=1), encoding="utf-8")
    print(f"{len(rounded)} bones from {len(clips)} clips -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
