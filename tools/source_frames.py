"""Grab frames from the INCLUDE source clip for a word, for side-by-side checks.

    python tools/source_frames.py hello 0.3,0.9,1.5 out_prefix
"""

from __future__ import annotations

import json
import re
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

import cv2
from remotezip import RemoteZip

BASE = "https://zenodo.org/records/4010759/files/"
ARCHIVES = ("Greetings_1of2.zip", "Greetings_2of2.zip")
ROOT = Path(__file__).resolve().parent.parent


def word_of(name: str) -> str:
    folder = name.split("/")[-2]
    return re.sub(r"^\d+\.\s*", "", folder).strip().lower().replace(" ", "_")


def main() -> int:
    word, times, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
    moments = [float(t) for t in times.split(",")]
    motion = json.loads((ROOT / "data" / "motion" / f"{word}.json").read_text())

    with tempfile.TemporaryDirectory() as tmp:
        for archive in ARCHIVES:
            with RemoteZip(BASE + archive + "?download=1") as z:
                by_word = defaultdict(list)
                for info in z.infolist():
                    if info.filename.lower().endswith((".mov", ".mp4")) and not info.filename.startswith("__MACOSX"):
                        by_word[word_of(info.filename)].append((info.file_size, info.filename))
                if word not in by_word:
                    continue
                _, name = min(by_word[word])
                z.extract(name, tmp)
                capture = cv2.VideoCapture(str(Path(tmp) / name))
                fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
                for t in moments:
                    index = int(t * fps)
                    capture.set(cv2.CAP_PROP_POS_FRAMES, index)
                    ok, frame = capture.read()
                    if not ok:
                        continue
                    h, w = frame.shape[:2]
                    screen = motion["frames"][min(index, len(motion["frames"]) - 1)].get("screen")
                    if screen:
                        xs = [p[0] * w for p in screen[:25]]
                        ys = [p[1] * h for p in screen[:25]]
                        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
                        size = max(max(xs) - min(xs), max(ys) - min(ys)) * 0.75
                        x0, y0 = int(max(0, cx - size)), int(max(0, cy - size))
                        x1, y1 = int(min(w, cx + size)), int(min(h, cy + size * 0.9))
                        frame = frame[y0:y1, x0:x1]
                    frame = cv2.resize(frame, (460, int(460 * frame.shape[0] / frame.shape[1])))
                    out = f"{prefix}_src_{str(t).replace('.', 'p')}.png"
                    cv2.imwrite(out, frame)
                    print(out)
                capture.release()
                return 0
    print("word not found")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
