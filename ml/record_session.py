"""Record yourself signing the whole vocabulary in one sitting.

    python ml/record_session.py --signer jaydeep
    python ml/record_session.py --signer jaydeep --clips 8

Walks through each word in turn, calling record.py's capture loop. Watch the
avatar perform the sign at /Deaf first, then copy it.

Your clips are what makes an honest number possible. Every clip currently in
data/raw comes from INCLUDE with a signer label inferred from filenames, so no
split so far holds out a person we can point to. Yours does.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

WORDS = [
    "hello",
    "thank_you",
    "how_are_you",
    "pleased",
    "alright",
    "good_morning",
    "good_afternoon",
    "good_evening",
    "good_night",
]


def existing(word: str, signer: str) -> int:
    folder = HERE.parent / "data" / "raw" / word / signer.lower()
    return len(list(folder.glob("*.npy"))) if folder.exists() else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--signer", required=True, help="your name, lowercase")
    parser.add_argument("--clips", type=int, default=8, help="clips per word")
    parser.add_argument("--frames", type=int, default=45)
    parser.add_argument("--words", help="comma separated subset")
    parser.add_argument("--skip-done", action="store_true",
                        help="skip words that already have enough clips")
    args = parser.parse_args()

    wanted = (
        [w.strip().lower().replace(" ", "_") for w in args.words.split(",")]
        if args.words else WORDS
    )

    print(f"recording {len(wanted)} words as '{args.signer}', "
          f"{args.clips} clips each\n")
    print("  watch the sign first:  https://voice-eye.vercel.app/Deaf")
    print("  in each window: SPACE records, R redoes the last, Q moves on\n")

    for position, word in enumerate(wanted, 1):
        have = existing(word, args.signer)
        if args.skip_done and have >= args.clips:
            print(f"[{position}/{len(wanted)}] {word}: already have {have}, skipping")
            continue

        remaining = max(0, args.clips - have)
        print(f"\n[{position}/{len(wanted)}] {word.replace('_', ' ').upper()} "
              f"- have {have}, recording {remaining}")
        input("    press Enter when you are ready (Ctrl+C to stop) ")

        result = subprocess.run(
            [
                sys.executable, str(HERE / "record.py"),
                "--word", word,
                "--signer", args.signer,
                "--clips", str(remaining),
                "--frames", str(args.frames),
            ],
            cwd=str(HERE),
        )
        if result.returncode != 0:
            print(f"    record.py exited with {result.returncode}")

    print("\nsummary:")
    total = 0
    for word in wanted:
        count = existing(word, args.signer)
        total += count
        flag = "" if count >= args.clips else "   <- short"
        print(f"  {word:16s} {count:3d} clips{flag}")
    print(f"\n{total} clips recorded as '{args.signer}'")
    print(f"next: python ml/evaluate.py --signer {args.signer}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
