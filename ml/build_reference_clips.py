"""Pull one INCLUDE clip per word and encode it small enough to ship.

    python ml/build_reference_clips.py

Writes public/signs/<word>.mp4 so the page can show a signer performing each
word next to the camera. Nobody can use a sign recogniser without knowing the
signs, and the reference has to be the same signs the model was trained on.

Only the chosen clips are fetched, using HTTP range requests against the Zenodo
archives, so this costs about 100MB rather than the 2.8GB the two Greetings
archives weigh.

INCLUDE is CC-BY-4.0. Attribution lives in public/signs/ATTRIBUTION.txt.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
from collections import defaultdict
from pathlib import Path

import imageio_ffmpeg
from remotezip import RemoteZip

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "signs"
BASE = "https://zenodo.org/records/4010759/files/"
ARCHIVES = ("Greetings_1of2.zip", "Greetings_2of2.zip")
VIDEO_SUFFIXES = (".mov", ".mp4")


def word_of(name: str) -> str:
    folder = name.split("/")[-2]
    return re.sub(r"^\d+\.\s*", "", folder).strip().lower().replace(" ", "_")


def signer_box(source: Path, samples: int = 10) -> tuple[int, int, int, int] | None:
    """Pixel crop box around the signer's upper body and hands.

    INCLUDE frames the signer full-body against a classroom wall, so most of
    the picture is floor and blackboard. Shown at a couple of hundred pixels
    wide that leaves the handshape unreadable, which defeats the point.
    """
    import cv2
    import numpy as np

    from landmarks import LandmarkExtractor

    capture = cv2.VideoCapture(str(source))
    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    if total < 2:
        capture.release()
        return None

    xs: list[float] = []
    ys: list[float] = []
    with LandmarkExtractor(video_mode=False) as extractor:
        for index in np.linspace(0, total - 1, samples).astype(int):
            capture.set(cv2.CAP_PROP_POS_FRAMES, int(index))
            ok, frame = capture.read()
            if not ok:
                continue
            found = extractor.extract(frame, 0)
            for block in (found.pose_raw, found.left_raw, found.right_raw):
                if block is None:
                    continue
                points = block[:25] if block is found.pose_raw else block
                xs.extend(points[:, 0].tolist())
                ys.extend(points[:, 1].tolist())
    capture.release()
    if not xs:
        return None

    x0, x1 = min(xs) * width, max(xs) * width
    y0, y1 = min(ys) * height, max(ys) * height
    margin_x = (x1 - x0) * 0.30
    margin_y = (y1 - y0) * 0.22
    x0, x1 = x0 - margin_x, x1 + margin_x
    y0, y1 = y0 - margin_y, y1 + margin_y

    box_w = max(80.0, x1 - x0)
    box_h = max(80.0, y1 - y0)
    target_ratio = 3 / 4
    if box_w / box_h > target_ratio:
        box_h = box_w / target_ratio
    else:
        box_w = box_h * target_ratio

    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    left = int(max(0, min(width - box_w, cx - box_w / 2)))
    top = int(max(0, min(height - box_h, cy - box_h / 2)))
    return int(min(box_w, width)) // 2 * 2, int(min(box_h, height)) // 2 * 2, left, top


def encode(
    source: Path,
    target: Path,
    width: int,
    seconds: float,
    box: tuple[int, int, int, int] | None,
) -> None:
    chain = f"crop={box[0]}:{box[1]}:{box[2]}:{box[3]}," if box else ""
    subprocess.run(
        [
            imageio_ffmpeg.get_ffmpeg_exe(),
            "-y", "-loglevel", "error",
            "-i", str(source),
            "-t", str(seconds),
            "-vf", f"{chain}scale={width}:-2",
            "-an",
            "-c:v", "libx264",
            "-preset", "slow",
            "-crf", "30",
            "-movflags", "+faststart",
            "-pix_fmt", "yuv420p",
            str(target),
        ],
        check=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--width", type=int, default=300)
    parser.add_argument("--seconds", type=float, default=4.0)
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {}

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        for archive in ARCHIVES:
            with RemoteZip(BASE + archive + "?download=1") as z:
                by_word = defaultdict(list)
                for info in z.infolist():
                    name = info.filename
                    if not name.lower().endswith(VIDEO_SUFFIXES):
                        continue
                    if name.startswith("__MACOSX"):
                        continue
                    by_word[word_of(name)].append((info.file_size, name))

                for word in sorted(by_word):
                    size, name = min(by_word[word])
                    print(f"  {word:16s} fetching {size/1e6:5.1f} MB ...", flush=True)
                    z.extract(name, tmpdir)
                    source = tmpdir / name
                    target = OUT_DIR / f"{word}.mp4"
                    box = signer_box(source)
                    encode(source, target, args.width, args.seconds, box)
                    source.unlink(missing_ok=True)
                    manifest[word] = target.name
                    print(f"  {word:16s} -> {target.name} "
                          f"({target.stat().st_size/1024:.0f} KB)")

    (OUT_DIR / "ATTRIBUTION.txt").write_text(
        "Reference clips are from the INCLUDE dataset, used under CC-BY-4.0.\n\n"
        "Advaith Sridhar, Rohith Gandhi Ganesan, Pratyush Kumar, Mitesh Khapra.\n"
        "INCLUDE: A Large Scale Dataset for Indian Sign Language Recognition.\n"
        "ACM Multimedia 2020. https://zenodo.org/records/4010759\n\n"
        "Clips are resized and shortened; no other modification.\n",
        encoding="utf-8",
    )
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    total = sum((OUT_DIR / n).stat().st_size for n in manifest.values())
    print(f"\n{len(manifest)} clips, {total/1024:.0f} KB total")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
