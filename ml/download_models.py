"""Fetch the MediaPipe task bundles that landmarks.py needs.

They are ~13 MB together and deliberately gitignored -- binary blobs in git
history is exactly how the original repo ended up at 70 MB.
"""

from __future__ import annotations

import urllib.request
from pathlib import Path

BASE = "https://storage.googleapis.com/mediapipe-models"
MODELS = {
    "hand_landmarker.task": f"{BASE}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    # The "lite" pose bundle is the right trade here: we only use nine of its
    # points and all of them are large, easy joints. The full model costs
    # noticeably more per frame for accuracy we would immediately discard.
    "pose_landmarker_lite.task": f"{BASE}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
}

MODEL_DIR = Path(__file__).parent / "models"


def main() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in MODELS.items():
        target = MODEL_DIR / name
        if target.exists():
            print(f"  {name} already present ({target.stat().st_size:,} bytes)")
            continue
        print(f"  downloading {name} ...", flush=True)
        urllib.request.urlretrieve(url, target)
        print(f"  {name} -> {target.stat().st_size:,} bytes")
    print("models ready")


if __name__ == "__main__":
    main()
