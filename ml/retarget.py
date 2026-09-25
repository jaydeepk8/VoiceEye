"""Turn extracted sign motion into bone directions for the avatar.

    python ml/retarget.py
    python ml/retarget.py --words hello
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
MIN_HAND_COVERAGE = 0.6

SEGMENTS = {
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


def body_frame(frame: dict):
    screen = frame.get("screen")
    if not screen:
        return None
    flat = np.asarray(screen, dtype=np.float64)[:, :2].copy()
    aspect = float(frame.get("aspect") or 1.0)
    flat[:, 0] *= aspect
    origin = (flat[L_SHOULDER] + flat[R_SHOULDER]) / 2.0
    span = float(np.linalg.norm(flat[L_SHOULDER] - flat[R_SHOULDER]))
    if span < 1e-6:
        return None
    return origin, span, aspect


def body_points(frame: dict, ref) -> np.ndarray:
    origin, span, aspect = ref
    flat = np.asarray(frame["screen"], dtype=np.float64)[:, :2].copy()
    flat[:, 0] *= aspect
    return (flat - origin) / span


def hand_points(hand: list, ref) -> np.ndarray:
    origin, span, aspect = ref
    raw = np.asarray(hand, dtype=np.float64)
    flat = raw[:, :2].copy()
    flat[:, 0] *= aspect
    flat = (flat - origin) / span
    depth = raw[:, 2] * aspect / span
    return np.column_stack([flat, depth])


def segment_lengths(frames: list) -> dict[str, float | None]:
    seen: dict[str, list[float]] = {name: [] for name in SEGMENTS}
    for frame in frames:
        ref = body_frame(frame)
        if ref is None:
            continue
        points = body_points(frame, ref)
        for name, (a, b) in SEGMENTS.items():
            seen[name].append(float(np.linalg.norm(points[b] - points[a])))
    return {
        name: float(np.percentile(values, 95)) if values else None
        for name, values in seen.items()
    }


def depth_signs(frames: list, window: int = 3) -> dict[str, list[float]]:
    raw: dict[str, list[float]] = {name: [] for name in SEGMENTS}
    for frame in frames:
        world = frame.get("pose")
        for name, (a, b) in SEGMENTS.items():
            raw[name].append(world[b][2] - world[a][2] if world else np.nan)
    smoothed: dict[str, list[float]] = {}
    for name, series in raw.items():
        values = np.asarray(series, dtype=np.float64)
        out = []
        for i in range(len(values)):
            near = values[max(0, i - window): i + window + 1]
            near = near[~np.isnan(near)]
            out.append(float(near.mean()) if len(near) else 0.0)
        smoothed[name] = out
    return smoothed


def arm_row(frame: dict, index: int, lengths: dict, signs: dict) -> dict:
    row: dict = {name: None for name in SEGMENTS}
    ref = body_frame(frame)
    if ref is None:
        return row
    points = body_points(frame, ref)
    for name, (a, b) in SEGMENTS.items():
        true_length = lengths.get(name)
        if not true_length:
            continue
        planar = points[b] - points[a]
        flat_length = float(np.linalg.norm(planar))
        depth = np.sqrt(max(0.0, true_length * true_length - flat_length * flat_length))
        lifted = np.array([planar[0], planar[1], np.sign(signs[name][index]) * depth])
        row[name] = unit(to_three(lifted))
    return row


def hand_keys(side: str) -> list[str]:
    keys = [f"{side}Hand", f"{side}Hand_up"]
    for finger in FINGERS:
        keys.extend(f"{side}Hand{finger}{n}" for n in (1, 2, 3))
    return keys


def hand_row(hand: list | None, frame: dict, side: str) -> dict:
    row: dict = {key: None for key in hand_keys(side)}
    ref = body_frame(frame)
    if not hand or ref is None:
        return row
    points = hand_points(hand, ref)
    forward = to_three(points[9] - points[0])
    across = to_three(points[17] - points[5])
    row[f"{side}Hand"] = unit(forward)
    row[f"{side}Hand_up"] = unit(np.cross(forward, across))
    for finger, joints in FINGERS.items():
        for n in range(3):
            row[f"{side}Hand{finger}{n + 1}"] = unit(
                to_three(points[joints[n + 1]] - points[joints[n]])
            )
    return row


def fill_gaps(series: list, limit: int = 4) -> list:
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


def smooth(series: list, window: int = 5) -> list:
    out = list(series)
    half = window // 2
    for i, value in enumerate(series):
        if value is None:
            continue
        near = [
            series[j]
            for j in range(max(0, i - half), min(len(series), i + half + 1))
            if series[j] is not None
        ]
        mean = np.mean(np.asarray(near, dtype=np.float64), axis=0)
        out[i] = unit(mean) or value
    return out


def build(word: str, source: Path) -> dict:
    data = json.loads(source.read_text(encoding="utf-8"))
    frames = data["frames"]
    lengths = segment_lengths(frames)
    signs = depth_signs(frames)

    per_bone: dict[str, list] = {}
    for index, frame in enumerate(frames):
        row = arm_row(frame, index, lengths, signs)
        row.update(hand_row(frame.get("lhand"), frame, "Left"))
        row.update(hand_row(frame.get("rhand"), frame, "Right"))
        for bone, value in row.items():
            per_bone.setdefault(bone, []).append(value)

    total = len(frames)
    for side in ("Left", "Right"):
        root = f"{side}Hand"
        seen = sum(1 for v in per_bone.get(root, []) if v is not None)
        if seen < total * MIN_HAND_COVERAGE:
            for bone in per_bone:
                if bone.startswith(root):
                    per_bone[bone] = [None] * total

    for bone in per_bone:
        per_bone[bone] = smooth(fill_gaps(per_bone[bone]))

    for side in ("Left", "Right"):
        forward_series = per_bone.get(f"{side}Hand", [])
        up_series = per_bone.get(f"{side}Hand_up", [])
        for i, (forward, up) in enumerate(zip(forward_series, up_series)):
            if forward is None or up is None:
                continue
            f = np.asarray(forward, dtype=np.float64)
            u = np.asarray(up, dtype=np.float64)
            up_series[i] = unit(u - (u @ f) * f)

    return {
        "word": word,
        "fps": data.get("fps", 25),
        "frameCount": total,
        "bones": per_bone,
        "lengths": {k: round(v, 3) if v else None for k, v in lengths.items()},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--words", help="comma separated; default all extracted")
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
    for source in sources:
        word = source.stem
        if wanted and word not in wanted:
            continue
        clip = build(word, source)
        lengths = {len(v) for v in clip["bones"].values()}
        target = OUT_DIR / f"{word}.motion.json"
        target.write_text(json.dumps(clip), encoding="utf-8")
        hands = [
            side for side in ("Left", "Right")
            if any(v for v in clip["bones"][f"{side}Hand"])
        ]
        print(f"  {word:16s} {clip['frameCount']:3d} frames  "
              f"series lengths {sorted(lengths)}  hands {hands}  "
              f"{target.stat().st_size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
