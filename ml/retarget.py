"""Turn extracted sign motion into bone directions the avatar can follow.

    python ml/retarget.py --words hello

Reads data/motion/<word>.json and writes public/signs/<word>.motion.json.

Emits direction vectors per bone rather than quaternions. The browser has the
live skeleton with its bind pose and parent transforms, so turning a direction
into a local rotation is a few lines there and a reimplementation of three.js
here. Directions are also inspectable: a wrong one is visible as a number.

Axes are converted from MediaPipe world space (Y down, metres, origin at the
hips) to the three.js convention of Y up.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
IN_DIR = ROOT / "data" / "motion"
OUT_DIR = ROOT / "public" / "signs"

L_SHOULDER, R_SHOULDER = 11, 12
L_ELBOW, R_ELBOW = 13, 14
L_WRIST, R_WRIST = 15, 16
MIN_HAND_COVERAGE = 0.7

ARM_CHAIN = {
    "LeftArm": (L_SHOULDER, L_ELBOW),
    "LeftForeArm": (L_ELBOW, L_WRIST),
    "RightArm": (R_SHOULDER, R_ELBOW),
    "RightForeArm": (R_ELBOW, R_WRIST),
}

FINGERS = {
    "Thumb": (1, 2, 3, 4),
    "Index": (5, 6, 7, 8),
    "Middle": (9, 10, 11, 12),
    "Ring": (13, 14, 15, 16),
    "Pinky": (17, 18, 19, 20),
}


def to_three(vector: np.ndarray) -> np.ndarray:
    out = np.asarray(vector, dtype=np.float64).copy()
    out[1] *= -1.0
    out[2] *= -1.0
    return out


def unit(vector: np.ndarray) -> list[float] | None:
    length = float(np.linalg.norm(vector))
    if length < 1e-6:
        return None
    return [round(float(v), 4) for v in (vector / length)]


def fill_gaps(series: list[list[float] | None], limit: int = 4) -> list[list[float] | None]:
    """Hold the last value across short dropouts.

    A hand that vanishes for two frames and reappears would otherwise snap to
    rest and back, which reads as a flinch rather than a sign.
    """
    out = list(series)
    last = None
    gap = 0
    for i, value in enumerate(out):
        if value is not None:
            last, gap = value, 0
        elif last is not None and gap < limit:
            out[i] = last
            gap += 1
        else:
            last = None
    return out


def smooth(series: list[list[float] | None], window: int = 7) -> list[list[float] | None]:
    known = [i for i, v in enumerate(series) if v is not None]
    if not known:
        return series
    out: list[list[float] | None] = list(series)
    half = window // 2
    for i in known:
        near = [series[j] for j in range(max(0, i - half), min(len(series), i + half + 1))
                if series[j] is not None]
        if not near:
            continue
        mean = np.mean(np.asarray(near, dtype=np.float64), axis=0)
        out[i] = unit(mean) or series[i]
    return out


def body_points(frame: dict) -> np.ndarray | None:
    """Combine image-space X/Y with world Z into one body-relative frame.

    MediaPipe's world landmarks badly understate how high an arm is raised --
    on this clip the wrist peaks 2cm above the shoulder where the image says
    17cm. Image-space X/Y is directly observed and matches the video; depth is
    only available from the world estimate. Taking each from where it is
    trustworthy, in shoulder-width units so the two agree on scale.
    """
    screen = frame.get("screen")
    world = frame.get("pose")
    if not screen or not world:
        return None

    flat = np.asarray(screen, dtype=np.float64)[:, :2].copy()
    flat[:, 0] *= float(frame.get("aspect") or 1.0)
    origin = (flat[L_SHOULDER] + flat[R_SHOULDER]) / 2.0
    span = float(np.linalg.norm(flat[L_SHOULDER] - flat[R_SHOULDER]))
    if span < 1e-6:
        return None
    flat = (flat - origin) / span

    solid = np.asarray(world, dtype=np.float64)
    depth_span = float(np.linalg.norm(solid[L_SHOULDER] - solid[R_SHOULDER]))
    if depth_span < 1e-6:
        return None
    depth = (solid[:, 2] - solid[[L_SHOULDER, R_SHOULDER], 2].mean()) / depth_span

    return np.column_stack([flat[:, 0], flat[:, 1], depth])


def arm_directions(frame: dict) -> dict[str, list[float] | None]:
    points = body_points(frame)
    if points is None:
        return {name: None for name in ARM_CHAIN}
    result = {}
    for bone, (start, end) in ARM_CHAIN.items():
        result[bone] = unit(to_three(points[end] - points[start]))
    return result


def hand_directions(hand: list[list[float]] | None, side: str) -> dict[str, list[float] | None]:
    result: dict[str, list[float] | None] = {}
    if not hand:
        for finger, joints in FINGERS.items():
            for n in range(len(joints) - 1):
                result[f"{side}Hand{finger}{n + 1}"] = None
        result[f"{side}Hand"] = None
        return result

    points = np.asarray(hand, dtype=np.float64)

    # A direction alone leaves the bone free to spin about its own axis, so the
    # palm can end up facing anywhere. Sending a second axis across the
    # knuckles pins the roll, which is what makes a handshape readable.
    forward = to_three(points[9] - points[0])
    across = to_three(points[17] - points[5])
    normal = np.cross(forward, across)
    result[f"{side}Hand"] = unit(forward)
    if np.linalg.norm(normal) > 1e-6 and result[f"{side}Hand"]:
        result[f"{side}Hand_up"] = unit(normal)
    for finger, joints in FINGERS.items():
        for n in range(len(joints) - 1):
            a, b = joints[n], joints[n + 1]
            result[f"{side}Hand{finger}{n + 1}"] = unit(to_three(points[b] - points[a]))
    return result


def build(word: str, source: Path, do_fingers: bool) -> dict:
    data = json.loads(source.read_text(encoding="utf-8"))
    frames = data["frames"]

    per_bone: dict[str, list[list[float] | None]] = {}
    for frame in frames:
        row = arm_directions(frame)
        if do_fingers:
            row.update(hand_directions(frame.get("left"), "Right"))
            row.update(hand_directions(frame.get("right"), "Left"))
        for bone, value in row.items():
            per_bone.setdefault(bone, []).append(value)

    total = len(frames)
    for side in ("Left", "Right"):
        hand_bones = [b for b in per_bone if b.startswith(f"{side}Hand")]
        if not hand_bones:
            continue
        seen = sum(1 for v in per_bone[f"{side}Hand"] if v is not None)
        if seen < total * MIN_HAND_COVERAGE:
            # A hand tracked in only part of the clip is the resting one caught
            # in glimpses. Its direction jumps between real and noise, which
            # looks like a spasm; leaving it at rest is both calmer and truer.
            for bone in hand_bones:
                per_bone[bone] = [None] * total

    for bone in per_bone:
        per_bone[bone] = smooth(fill_gaps(per_bone[bone]))

    tracked = {b: sum(1 for v in per_bone[b] if v is not None) for b in per_bone}
    return {
        "word": word,
        "fps": data.get("fps", 25),
        "frameCount": len(frames),
        "bones": per_bone,
        "tracked": tracked,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--words", help="comma separated; default all extracted")
    parser.add_argument("--no-fingers", action="store_true")
    args = parser.parse_args()

    wanted = (
        {w.strip().lower().replace(" ", "_") for w in args.words.split(",")}
        if args.words else None
    )
    sources = sorted(IN_DIR.glob("*.json"))
    if not sources:
        print(f"no motion files in {IN_DIR}; run ml/sign_motion.py first")
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    written = 0
    for source in sources:
        word = source.stem
        if wanted and word not in wanted:
            continue
        clip = build(word, source, not args.no_fingers)
        target = OUT_DIR / f"{word}.motion.json"
        target.write_text(json.dumps(clip), encoding="utf-8")
        arms = {b: c for b, c in clip["tracked"].items() if "Arm" in b}
        print(f"  {word:16s} {clip['frameCount']:3d} frames  "
              f"{len(clip['bones'])} bones  {target.stat().st_size/1024:.0f} KB")
        print(f"  {'':16s} arms tracked: {arms}")
        written += 1

    print(f"\nwrote {written} clip(s) to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
