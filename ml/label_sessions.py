"""Recover recording-session groups for ingested INCLUDE clips.

    python ml/label_sessions.py

INCLUDE ships no signer field, which leaves no honest way to split it: a random
split puts the same person's near-identical takes on both sides and reports
memorisation. But the source filenames carry camera numbering, and it clusters
sharply -- every word in the Greetings set falls into exactly five groups, with
matching group sizes and matching number bands across all five words. Five
independent recording sources is the only ordinary explanation.

So this rewrites each clip's sidecar with the session it came from, letting
dataset.py hold out a whole session.

What this is NOT: proof of signer identity. A session might be one person, or a
day, or a camera. What it is: strictly harder than a random split, because
whatever varies between sessions is held out entirely. Treat a score from it as
a floor on honest accuracy, and use your own recordings for the real test.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

DATA_ROOT = Path(__file__).resolve().parent.parent / "data" / "raw"
GAP = 8  # a jump larger than this starts a new session


def cluster(numbers: list[int], gap: int = GAP) -> list[list[int]]:
    numbers = sorted(numbers)
    if not numbers:
        return []
    groups, current = [], [numbers[0]]
    for previous, this in zip(numbers, numbers[1:]):
        if this - previous > gap:
            groups.append(current)
            current = []
        current.append(this)
    groups.append(current)
    return groups


def main() -> int:
    sidecars = [
        j for j in DATA_ROOT.glob("*/*/*.json")
        if json.loads(j.read_text()).get("signer", "").startswith("include")
    ]
    if not sidecars:
        print("no include clips found; run ingest_include.py first")
        return 1

    by_word: dict[str, list[tuple[int, Path]]] = defaultdict(list)
    for path in sidecars:
        meta = json.loads(path.read_text())
        match = re.search(r"(\d+)", Path(meta["source"]).stem)
        if not match:
            print(f"  no number in {meta['source']}; leaving unlabelled")
            continue
        by_word[meta["word"]].append((int(match.group(1)), path))

    counts = {word: len(cluster([n for n, _ in items])) for word, items in by_word.items()}
    if len(set(counts.values())) != 1:
        print(f"inconsistent cluster counts across words: {counts}")
        print("the numbering assumption does not hold; not relabelling")
        return 1
    sessions = next(iter(counts.values()))
    print(f"{sessions} sessions, consistent across {len(by_word)} words")

    tally: dict[str, int] = defaultdict(int)
    for word, items in by_word.items():
        groups = cluster([n for n, _ in items])
        rank = {n: i for i, group in enumerate(groups) for n in group}
        for number, path in items:
            meta = json.loads(path.read_text())
            label = f"include_s{rank[number]}"
            meta["signer"] = label
            meta["signer_inferred"] = True
            path.write_text(json.dumps(meta, indent=2))
            tally[label] += 1

    for label in sorted(tally):
        print(f"  {tally[label]:4d}  {label}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
