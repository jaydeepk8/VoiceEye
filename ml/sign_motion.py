"""Extract 3D motion for each sign from INCLUDE, for driving the avatar.

    python ml/sign_motion.py --words hello
    python ml/sign_motion.py

Writes data/motion/<word>.json holding per-frame world landmarks.

Uses world landmarks, not the normalised ones landmarks.py feeds the
classifier. Those are image-space with an unreliable z; these are metric 3D,
which is what a skeleton needs.
"""

from __future__ import annotations

import argparse
import json
import re
import tempfile
from collections import defaultdict
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision
from remotezip import RemoteZip

ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = Path(__file__).resolve().parent / "models"
OUT_DIR = ROOT / "data" / "motion"
BASE = "https://zenodo.org/records/4010759/files/"
ARCHIVES = ("Greetings_1of2.zip", "Greetings_2of2.zip")
VIDEO_SUFFIXES = (".mov", ".mp4")


def word_of(name: str) -> str:
    folder = name.split("/")[-2]
    return re.sub(r"^\d+\.\s*", "", folder).strip().lower().replace(" ", "_")


def make_detectors():
    pose = vision.PoseLandmarker.create_from_options(
        vision.PoseLandmarkerOptions(
            base_options=BaseOptions(
                model_asset_path=str(MODEL_DIR / "pose_landmarker_lite.task")
            ),
            running_mode=vision.RunningMode.VIDEO,
            num_poses=1,
        )
    )
    hands = vision.HandLandmarker.create_from_options(
        vision.HandLandmarkerOptions(
            base_options=BaseOptions(
                model_asset_path=str(MODEL_DIR / "hand_landmarker.task")
            ),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=2,
        )
    )
    return pose, hands


def extract(path: Path, pose, hands, clock: int, max_width: int = 720):
    capture = cv2.VideoCapture(str(path))
    fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
    frames = []
    index = 0
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if frame.shape[1] > max_width:
                h = int(frame.shape[0] * max_width / frame.shape[1])
                frame = cv2.resize(frame, (max_width, h))
            image = mp.Image(
                image_format=mp.ImageFormat.SRGB,
                data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB),
            )
            stamp = clock + int(index * 1000 / fps)
            pose_result = pose.detect_for_video(image, stamp)
            hand_result = hands.detect_for_video(image, stamp)

            body = None
            if pose_result.pose_world_landmarks:
                body = [
                    [p.x, p.y, p.z] for p in pose_result.pose_world_landmarks[0]
                ]

            left = right = None
            handedness = hand_result.handedness or []
            for slot, marks in enumerate(hand_result.hand_world_landmarks or []):
                points = [[p.x, p.y, p.z] for p in marks]
                label = handedness[slot][0].category_name if slot < len(handedness) else ""
                if label == "Left":
                    left = points
                else:
                    right = points

            frames.append({"pose": body, "left": left, "right": right})
            index += 1
    finally:
        capture.release()
    return frames, fps, clock + int(index * 1000 / fps) + 2000


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--words", help="comma separated; default all")
    args = parser.parse_args()

    wanted = (
        {w.strip().lower().replace(" ", "_") for w in args.words.split(",")}
        if args.words else None
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pose, hands = make_detectors()
    clock = 0
    written = 0

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        for archive in ARCHIVES:
            with RemoteZip(BASE + archive + "?download=1") as z:
                by_word = defaultdict(list)
                for info in z.infolist():
                    if not info.filename.lower().endswith(VIDEO_SUFFIXES):
                        continue
                    if info.filename.startswith("__MACOSX"):
                        continue
                    by_word[word_of(info.filename)].append(
                        (info.file_size, info.filename)
                    )

                for word in sorted(by_word):
                    if wanted and word not in wanted:
                        continue
                    size, name = min(by_word[word])
                    print(f"  {word:16s} fetching {size/1e6:.1f} MB", flush=True)
                    z.extract(name, tmpdir)
                    source = tmpdir / name
                    frames, fps, clock = extract(source, pose, hands, clock)
                    source.unlink(missing_ok=True)

                    usable = sum(
                        1 for f in frames
                        if f["pose"] and (f["left"] or f["right"])
                    )
                    target = OUT_DIR / f"{word}.json"
                    target.write_text(
                        json.dumps({"word": word, "fps": fps, "frames": frames}),
                        encoding="utf-8",
                    )
                    written += 1
                    print(f"  {word:16s} {len(frames)} frames, "
                          f"{usable} usable, {target.stat().st_size/1024:.0f} KB")

    pose.close()
    hands.close()
    print(f"\nwrote {written} motion file(s) to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
