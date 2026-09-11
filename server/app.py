"""WebSocket inference service for the browser.

    uvicorn server.app:app --reload --port 8000

The browser sends JPEG frames as binary messages; this replies with JSON, and
only when a sign actually fires. Recognition is not reimplemented here -- it
imports SignRecogniser and Segmenter from ml/live.py, so what the browser gets
is what was tuned at the command line.

Every connection gets its own recogniser and segmenter. The frame buffer and
the streak counter are per-signer state, and sharing them across viewers would
have two people's hands feeding one window.
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "ml"))

from landmarks import LandmarkExtractor  # noqa: E402
from live import Segmenter, SignRecogniser  # noqa: E402

CHECKPOINT = ROOT / "ml" / "checkpoints" / "sign_gru.pt"

# Consecutive undetected frames before we treat the signer as gone.
LOST_AFTER = 10

app = FastAPI(title="VoiceEye sign recognition")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # the Vite dev server and the deployed front end
    allow_methods=["*"],
    allow_headers=["*"],
)

_recogniser: SignRecogniser | None = None


def get_recogniser() -> SignRecogniser:
    """Load the checkpoint once and share the weights across connections."""
    global _recogniser
    if _recogniser is None:
        if not CHECKPOINT.exists():
            raise FileNotFoundError(f"no checkpoint at {CHECKPOINT}")
        _recogniser = SignRecogniser(CHECKPOINT)
    return _recogniser


@app.get("/health")
def health() -> dict:
    try:
        recogniser = get_recogniser()
    except FileNotFoundError as exc:
        return {"ready": False, "error": str(exc)}
    return {
        "ready": True,
        "labels": recogniser.labels,
        "window": recogniser.window,
        "signer_independent": recogniser.signer_independent,
        "clip_accuracy": recogniser.clip_accuracy,
        "cv_mean": recogniser.cv_mean,
    }


@app.websocket("/ws/sign")
async def sign_socket(socket: WebSocket) -> None:
    await socket.accept()
    try:
        recogniser = get_recogniser()
    except FileNotFoundError as exc:
        await socket.send_json({"type": "error", "message": str(exc)})
        await socket.close()
        return

    session = recogniser.session()
    segmenter = Segmenter(recogniser.labels)
    extractor = LandmarkExtractor(video_mode=True)
    index = 0
    missed = 0

    await socket.send_json({"type": "ready", "labels": recogniser.labels})

    try:
        while True:
            payload = await socket.receive_bytes()
            frame = cv2.imdecode(np.frombuffer(payload, np.uint8), cv2.IMREAD_COLOR)
            if frame is None:
                continue

            features = extractor.extract(frame, int(index * 33.3))
            index += 1

            if not features.usable:
                # A frame here and there loses the hands -- motion blur, a hand
                # leaving the picture for an instant. Dropping the frame is
                # right; dropping the whole window is not, because rebuilding
                # it takes a second and the sign is over by then. Only give up
                # once the subject has genuinely gone.
                missed += 1
                if missed >= LOST_AFTER:
                    session.reset()
                    segmenter.reset()
                await socket.send_json({"type": "status", "framed": False})
                continue
            missed = 0

            probabilities, motion = session.feed(features.vector)
            if probabilities is None:
                await socket.send_json({"type": "status", "framed": True, "warming": True})
                continue

            word = segmenter.update(probabilities, motion > 0.02)
            if word:
                await socket.send_json({"type": "sign", "word": word})
            else:
                best = int(np.argmax(probabilities))
                await socket.send_json({
                    "type": "status",
                    "framed": True,
                    "top": recogniser.labels[best],
                    "confidence": round(float(probabilities[best]), 3),
                })
    except WebSocketDisconnect:
        pass
    finally:
        extractor.close()
