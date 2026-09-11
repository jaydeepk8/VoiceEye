"""Capture sign clips from a webcam (or a video file) as landmark sequences.

    python ml/record.py --word hello --signer jaydeep --clips 30

Keys: SPACE records one clip, R deletes and redoes the last one, Q quits.

Each clip is saved twice: the landmark sequence we actually train on, and the
raw video. The video is the expensive part and it is tempting to skip, but
without it any change to the feature design means re-recording every clip from
scratch, which is the kind of mistake you only make once.

Framing is enforced rather than suggested. If the shoulders are not visible the
extractor has nothing to normalise against and returns an empty vector, so the
tool refuses to start a clip and says why. Catching that here costs a second;
catching it after a recording session costs the session.
"""

from __future__ import annotations

import argparse
import json
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from landmarks import FEATURE_DIM, LandmarkExtractor

DATA_ROOT = Path(__file__).resolve().parent.parent / "data" / "raw"

GREEN = (120, 220, 120)
RED = (90, 90, 240)
AMBER = (80, 190, 240)
WHITE = (240, 240, 240)


def clip_dir(word: str, signer: str) -> Path:
    return DATA_ROOT / word.lower() / signer.lower()


def next_index(directory: Path) -> int:
    existing = sorted(directory.glob("*.npy"))
    return int(existing[-1].stem) + 1 if existing else 0


def save_clip(
    vectors: np.ndarray,
    frames: list[np.ndarray],
    word: str,
    signer: str,
    fps: float,
    usable: int,
) -> Path:
    """Write one clip plus a sidecar describing how it was captured."""
    directory = clip_dir(word, signer)
    directory.mkdir(parents=True, exist_ok=True)
    stem = f"{next_index(directory):03d}"

    np.save(directory / f"{stem}.npy", vectors)

    if frames:
        height, width = frames[0].shape[:2]
        writer = cv2.VideoWriter(
            str(directory / f"{stem}.mp4"),
            cv2.VideoWriter_fourcc(*"mp4v"),
            fps,
            (width, height),
        )
        for frame in frames:
            writer.write(frame)  # raw, unmirrored, to match the features
        writer.release()

    (directory / f"{stem}.json").write_text(
        json.dumps(
            {
                "word": word.lower(),
                "signer": signer.lower(),
                "frames": int(vectors.shape[0]),
                "feature_dim": int(vectors.shape[1]),
                "usable_frames": int(usable),
                "fps": round(float(fps), 2),
                "recorded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            },
            indent=2,
        )
    )
    return directory / f"{stem}.npy"


def delete_clip(path: Path) -> None:
    for suffix in (".npy", ".mp4", ".json"):
        path.with_suffix(suffix).unlink(missing_ok=True)


def draw_overlay(frame, features, state, word, done, target, message) -> np.ndarray:
    """Mirror the frame for display and paint the status on top.

    Only the display is mirrored. Features come from the raw frame, so landmark
    x has to be flipped to line up with what the user sees.
    """
    view = cv2.flip(frame, 1)
    height, width = view.shape[:2]

    for hand in (features.left_raw, features.right_raw):
        if hand is None:
            continue
        for point in hand:
            x = int((1.0 - float(point[0])) * width)
            y = int(float(point[1]) * height)
            cv2.circle(view, (x, y), 3, GREEN, -1)

    if features.pose_raw is not None:
        left, right = features.pose_raw[11], features.pose_raw[12]
        p1 = (int((1.0 - float(left[0])) * width), int(float(left[1]) * height))
        p2 = (int((1.0 - float(right[0])) * width), int(float(right[1]) * height))
        cv2.line(view, p1, p2, AMBER, 2)

    cv2.rectangle(view, (0, 0), (width, 64), (20, 20, 20), -1)
    cv2.putText(
        view, f"{word}  {done}/{target}", (14, 28),
        cv2.FONT_HERSHEY_SIMPLEX, 0.7, WHITE, 2,
    )

    ready = features.usable
    status = message or (
        "recording" if state == "recording"
        else "ready - SPACE to record" if ready
        else "show head, shoulders and hands"
    )
    cv2.putText(
        view, status, (14, 52),
        cv2.FONT_HERSHEY_SIMPLEX, 0.55,
        GREEN if (ready or state == "recording") else RED, 1,
    )

    if state == "recording":
        cv2.circle(view, (width - 30, 32), 11, RED, -1)
    return view


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--word", required=True, help="label, e.g. hello (use 'rest' for the idle class)")
    parser.add_argument("--signer", required=True, help="who is signing; keeps splits honest later")
    parser.add_argument("--clips", type=int, default=30)
    parser.add_argument("--frames", type=int, default=45, help="frames per clip (~1.5s at 30fps)")
    parser.add_argument("--source", default="0", help="webcam index or path to a video file")
    parser.add_argument("--fps", type=float, default=30.0)
    parser.add_argument("--countdown", type=float, default=2.0)
    parser.add_argument("--auto", action="store_true", help="no window, record back to back")
    parser.add_argument("--no-video", action="store_true", help="landmarks only, skip the mp4")
    args = parser.parse_args()

    source = int(args.source) if args.source.isdigit() else args.source
    capture = cv2.VideoCapture(source)
    if not capture.isOpened():
        print(f"could not open source {args.source!r}")
        return 1

    extractor = LandmarkExtractor(video_mode=True)
    target = args.clips
    done = 0
    last_saved: Path | None = None

    state = "idle"
    countdown_until = 0.0
    message = ""
    vectors: list[np.ndarray] = []
    frames: list[np.ndarray] = []
    usable = 0
    index = 0

    print(f"recording '{args.word}' as '{args.signer}' -> {clip_dir(args.word, args.signer)}")
    if not args.auto:
        print("SPACE record   R redo last   Q quit")

    try:
        while done < target:
            ok, frame = capture.read()
            if not ok:
                if args.auto:
                    break
                print("camera stopped")
                return 1

            # MediaPipe's VIDEO mode needs timestamps that never go backwards;
            # deriving them from the frame counter guarantees that even if the
            # camera hiccups.
            timestamp = int(index * (1000.0 / args.fps))
            index += 1
            features = extractor.extract(frame, timestamp)

            if state == "idle" and args.auto and features.usable:
                state, vectors, frames, usable = "recording", [], [], 0

            if state == "countdown" and time.monotonic() >= countdown_until:
                state, vectors, frames, usable = "recording", [], [], 0

            if state == "recording":
                vectors.append(features.vector)
                usable += int(features.usable)
                if not args.no_video:
                    frames.append(frame.copy())

                if len(vectors) >= args.frames:
                    last_saved = save_clip(
                        np.asarray(vectors, dtype=np.float32),
                        frames, args.word, args.signer, args.fps, usable,
                    )
                    done += 1
                    ratio = usable / len(vectors)
                    flag = "  <- low, consider R to redo" if ratio < 0.8 else ""
                    print(f"  {last_saved.name}  {len(vectors)} frames  {ratio:.0%} usable{flag}")
                    message = f"saved {last_saved.stem} ({ratio:.0%} usable)"
                    state, vectors, frames = "idle", [], []

            if args.auto:
                continue

            if state == "countdown":
                message = f"get ready... {countdown_until - time.monotonic():.1f}"

            cv2.imshow("voiceeye - record", draw_overlay(
                frame, features, state, args.word, done, target, message,
            ))

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord(" ") and state == "idle":
                if features.usable:
                    state = "countdown"
                    countdown_until = time.monotonic() + args.countdown
                    message = ""
                else:
                    message = "cannot record - shoulders or hands not visible"
            elif key == ord("r") and state == "idle" and last_saved is not None:
                delete_clip(last_saved)
                done = max(0, done - 1)
                print(f"  deleted {last_saved.name}")
                message = f"deleted {last_saved.stem}"
                last_saved = None
    finally:
        capture.release()
        extractor.close()
        if not args.auto:
            cv2.destroyAllWindows()

    print(f"done: {done} clip(s) in {clip_dir(args.word, args.signer)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
