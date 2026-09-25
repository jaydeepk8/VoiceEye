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
        forward, up = pose.get(f"{side}Hand"), pose.get(f"{side}Hand_up")
        if forward is not None and up is not None:
            up = up - (up @ forward) * forward
            pose[f"{side}Hand_up"] = up / np.linalg.norm(up)

    rounded = {b: [round(float(x), 4) for x in v] for b, v in pose.items()}
    OUT.write_text(json.dumps(rounded, indent=1), encoding="utf-8")
    print(f"{len(rounded)} bones from {len(clips)} clips -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
