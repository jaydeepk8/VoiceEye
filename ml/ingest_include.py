"""Turn INCLUDE videos into landmark sequences, one .npy per clip.

    python ml/ingest_include.py --zip data/Greetings_1of2.zip --dry-run
    python ml/ingest_include.py --zip data/Greetings_1of2.zip --max-per-word 40

Videos are pulled out of the zip one at a time and deleted straight after, so
peak disk stays near the size of a single clip rather than the whole archive.
That matters here: the full INCLUDE corpus is 56 GB and the target drive has
under 6 GB free.

Unlike record.py this keeps each clip at its natural length. Signs vary in
duration and throwing that away at ingest time would be destroying information
we cannot get back; dataset.py decides on windows later, where the choice is
cheap to revisit.
"""

from __future__ import annotations

import argparse
import re
import json
import tempfile
import zipfile
from collections import Counter
from pathlib import Path

import cv2
import numpy as np

from landmarks import LandmarkExtractor

DATA_ROOT = Path(__file__).resolve().parent.parent / "data" / "raw"
VIDEO_SUFFIXES = {".mov", ".mp4", ".avi", ".mpeg", ".mkv"}


def video_entries(archive: zipfile.ZipFile) -> list[str]:
    return [
        n for n in archive.namelist()
        if Path(n).suffix.lower() in VIDEO_SUFFIXES and not n.startswith("__MACOSX")
    ]


def parse_entry(name: str) -> tuple[str, str]:
    """Derive (word, signer) from a path inside the archive.

    INCLUDE nests clips as <Category>/<Word>/<file>, so the parent directory is
    the label. There is no signer field in the path, which is a real problem for
    honest evaluation -- see the note printed by --dry-run.
    """
    parts = Path(name).parts
    word = parts[-2] if len(parts) >= 2 else "unknown"
    # INCLUDE numbers its word folders ("2. Hello"); the number is an index
    # into the category, not part of the label.
    word = re.sub(r"^\d+\.\s*", "", word.strip())
    return word.lower().replace(" ", "_"), Path(name).stem


def extract_sequence(
    path: Path, extractor: LandmarkExtractor, width: int, clock: int
) -> tuple[np.ndarray, int, int]:
    """Run every frame of one video through the extractor.

    `clock` is a running millisecond counter shared by every video in the run.
    MediaPipe's VIDEO mode tracks timestamps per extractor instance, not per
    file, so restarting at zero for each clip makes it reject the second one.
    Returns the clock value the next video should start from.
    """
    capture = cv2.VideoCapture(str(path))
    vectors: list[np.ndarray] = []
    usable = 0
    index = 0
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if width and frame.shape[1] > width:
                # Downscaling to roughly webcam resolution is both faster and a
                # closer match to what the model will see at inference time.
                height = int(frame.shape[0] * width / frame.shape[1])
                frame = cv2.resize(frame, (width, height))
            features = extractor.extract(frame, clock + int(index * 33.3))
            vectors.append(features.vector)
            usable += int(features.usable)
            index += 1
    finally:
        capture.release()
    # Leave a gap so tracking state from one clip cannot bleed into the next.
    next_clock = clock + int(index * 33.3) + 1000
    if not vectors:
        return np.empty((0, 0), dtype=np.float32), 0, next_clock
    return np.asarray(vectors, dtype=np.float32), usable, next_clock


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip", required=True, type=Path)
    parser.add_argument("--words", help="comma separated filter, e.g. hello,thank_you")
    parser.add_argument("--max-per-word", type=int, default=0, help="0 = no cap")
    parser.add_argument("--width", type=int, default=640, help="downscale before detection")
    parser.add_argument("--min-usable", type=float, default=0.5,
                        help="drop clips where fewer than this fraction of frames are usable")
    parser.add_argument("--dry-run", action="store_true",
                        help="report the archive layout and exit without processing")
    args = parser.parse_args()

    if not args.zip.exists():
        print(f"no such file: {args.zip}")
        return 1

    wanted = (
        {w.strip().lower().replace(" ", "_") for w in args.words.split(",")}
        if args.words else None
    )

    with zipfile.ZipFile(args.zip) as archive:
        entries = video_entries(archive)
        if not entries:
            print("no video files found in the archive")
            print("first few entries:", archive.namelist()[:5])
            return 1

        counts = Counter(parse_entry(n)[0] for n in entries)

        if args.dry_run:
            print(f"{len(entries)} videos across {len(counts)} words\n")
            print("example paths:")
            for name in entries[:3]:
                print(f"  {name}")
            print("\nclips per word:")
            for word, count in sorted(counts.items(), key=lambda kv: -kv[1]):
                print(f"  {count:4d}  {word}")
            print(
                "\nnote: no signer id in these paths. Without one, a random"
                "\ntrain/test split leaks the same person across both sides and"
                "\ninflates accuracy. Resolve before trusting any number."
            )
            return 0

        selected = [n for n in entries if wanted is None or parse_entry(n)[0] in wanted]
        if not selected:
            print(f"nothing matched --words {args.words!r}. available: {sorted(counts)}")
            return 1

        per_word: Counter[str] = Counter()
        written = skipped = 0
        clock = 0

        with LandmarkExtractor(video_mode=True) as extractor, \
                tempfile.TemporaryDirectory() as tmp:
            tmpdir = Path(tmp)
            for name in sorted(selected):
                word, stem = parse_entry(name)
                if args.max_per_word and per_word[word] >= args.max_per_word:
                    continue

                target = tmpdir / Path(name).name
                with archive.open(name) as src, open(target, "wb") as dst:
                    dst.write(src.read())
                try:
                    vectors, usable, clock = extract_sequence(
                        target, extractor, args.width, clock
                    )
                finally:
                    target.unlink(missing_ok=True)

                if vectors.size == 0:
                    print(f"  skip {name}: unreadable")
                    skipped += 1
                    continue

                ratio = usable / len(vectors)
                if ratio < args.min_usable:
                    print(f"  skip {name}: only {ratio:.0%} of frames usable")
                    skipped += 1
                    continue

                out_dir = DATA_ROOT / word / "include"
                out_dir.mkdir(parents=True, exist_ok=True)
                np.save(out_dir / f"{stem}.npy", vectors)
                (out_dir / f"{stem}.json").write_text(json.dumps({
                    "word": word,
                    "signer": "include:unknown",
                    "source": name,
                    "frames": int(vectors.shape[0]),
                    "feature_dim": int(vectors.shape[1]),
                    "usable_frames": int(usable),
                    "width": args.width,
                }, indent=2))

                per_word[word] += 1
                written += 1
                print(f"  {word:20s} {stem:24s} {vectors.shape[0]:4d} frames  {ratio:.0%} usable")

    print(f"\nwrote {written} clip(s), skipped {skipped}")
    for word, count in sorted(per_word.items()):
        print(f"  {count:4d}  {word}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
