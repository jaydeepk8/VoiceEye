"""Stack source frames beside avatar screenshots for visual comparison.

    python tools/montage.py prefix 0.3,0.9,1.5 out.png
"""

from __future__ import annotations

import sys

import cv2
import numpy as np


def fit(image: np.ndarray, height: int) -> np.ndarray:
    return cv2.resize(image, (int(image.shape[1] * height / image.shape[0]), height))


def main() -> int:
    prefix, times, out = sys.argv[1], sys.argv[2], sys.argv[3]
    rows = []
    for t in times.split(","):
        tag = t.replace(".", "p")
        source = cv2.imread(f"{prefix}_src_{tag}.png")
        avatar = cv2.imread(f"{prefix}_{tag}.png")
        if source is None or avatar is None:
            continue
        height = 380
        pair = [fit(source, height), np.full((height, 8, 3), 30, np.uint8), fit(avatar, height)]
        row = np.hstack(pair)
        cv2.putText(row, f"t={t}s", (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        rows.append(row)
    width = max(r.shape[1] for r in rows)
    rows = [np.pad(r, ((0, 6), (0, width - r.shape[1]), (0, 0))) for r in rows]
    cv2.imwrite(out, np.vstack(rows))
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
