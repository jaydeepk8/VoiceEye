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

import asyncio
import json
import logging
import sys
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "ml"))

from landmarks import HAND_MODEL, POSE_MODEL, LandmarkExtractor, normalise  # noqa: E402
from live import Segmenter, SignRecogniser  # noqa: E402

CHECKPOINT_DIR = ROOT / "ml" / "checkpoints"


def find_checkpoint() -> Path | None:
    for name in ("sign_gru.onnx", "sign_gru.pt"):
        candidate = CHECKPOINT_DIR / name
        if candidate.exists():
            return candidate
    return None

# Consecutive undetected frames before we treat the signer as gone.
LOST_AFTER = 10

# A browser streams continuously, so a gap this long means it is gone. Render's
# proxy does not always forward the close, and without this the handler blocks
# in receive_bytes still holding the single-signer lock, locking everyone else
# out for as long as the proxy keeps the upstream socket open.
IDLE_TIMEOUT = 8.0

logger = logging.getLogger("voiceeye")

app = FastAPI(title="VoiceEye sign recognition")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # the Vite dev server and the deployed front end
    allow_methods=["*"],
    allow_headers=["*"],
)

_recogniser: SignRecogniser | None = None
_extractor: LandmarkExtractor | None = None
_clock = 0
_in_use = asyncio.Lock()
_current_stop: asyncio.Event | None = None


def from_landmarks(payload: dict) -> tuple[np.ndarray, bool]:
    def points(key, count):
        raw = payload.get(key)
        if not raw or len(raw) != count:
            return None
        return np.asarray(raw, dtype=np.float32).reshape(count, 3)

    pose = points("pose", 33)
    left = points("left", 21)
    right = points("right", 21)
    aspect = float(payload.get("aspect") or 1.0)
    vector = normalise(pose, left, right, aspect)
    return vector, bool(pose is not None and (left is not None or right is not None))


def get_extractor() -> LandmarkExtractor:
    global _extractor
    if _extractor is None:
        _extractor = LandmarkExtractor(video_mode=True)
    return _extractor


def get_recogniser() -> SignRecogniser:
    """Load the checkpoint once and share the weights across connections."""
    global _recogniser
    if _recogniser is None:
        checkpoint = find_checkpoint()
        if checkpoint is None:
            raise FileNotFoundError(f"no checkpoint in {CHECKPOINT_DIR}")
        _recogniser = SignRecogniser(checkpoint)
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
        "backend": recogniser.backend,
        "models": {
            p.name: (p.stat().st_size if p.exists() else None)
            for p in (HAND_MODEL, POSE_MODEL)
        },
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

    global _clock, _current_stop

    if _current_stop is not None:
        _current_stop.set()
    stop = asyncio.Event()
    _current_stop = stop

    async with _in_use:
        session = recogniser.session()
        segmenter = Segmenter(recogniser.labels)
        missed = 0

        await socket.send_json({"type": "ready", "labels": recogniser.labels})

        try:
            while True:
                if stop.is_set():
                    break

                receiving = asyncio.ensure_future(socket.receive())
                halting = asyncio.ensure_future(stop.wait())
                done, pending = await asyncio.wait(
                    {receiving, halting},
                    timeout=IDLE_TIMEOUT,
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for task in pending:
                    task.cancel()
                if receiving not in done:
                    break
                message = receiving.result()
                if message.get("type") == "websocket.disconnect":
                    break

                if message.get("text") is not None:
                    vector, usable = from_landmarks(json.loads(message["text"]))
                else:
                    frame = cv2.imdecode(
                        np.frombuffer(message["bytes"], np.uint8), cv2.IMREAD_COLOR
                    )
                    if frame is None:
                        continue
                    _clock += 33
                    extracted = get_extractor().extract(frame, _clock)
                    vector, usable = extracted.vector, extracted.usable

                if not usable:
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

                probabilities, motion = session.feed(vector)
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
        except Exception as exc:
            logger.exception("websocket loop failed")
            try:
                await socket.send_json(
                    {"type": "error", "message": f"{type(exc).__name__}: {exc}"}
                )
            except Exception:
                pass
        finally:
            if _current_stop is stop:
                _current_stop = None
            _clock += 1000
