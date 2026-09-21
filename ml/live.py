"""Real-time sign recognition from a webcam.

    python ml/live.py --checkpoint ml/checkpoints/sign_gru.pt

The classifier is the easy half. The hard half is deciding *when* a sign
happened: the model emits a prediction for every frame, roughly thirty times a
second, and naively speaking each one would produce a stream of babble. So
Segmenter sits between the model and the output and only lets a word through
when the evidence actually holds up:

  - the hands have to be moving (a still frame is a rest pose, not a sign)
  - the model has to be confident
  - it has to say the same thing several frames running
  - and then it shuts up for a cooldown, so one sign emits one word

SignRecogniser and Segmenter are deliberately free of camera and UI code. The
FastAPI server imports these same two classes, so what runs in the browser is
what was tuned here rather than a second implementation that drifts.
"""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np

POSE_DIM = 27  # keep in step with landmarks.POSE_DIM


class Segmenter:
    """Turns a stream of per-frame probabilities into discrete words."""

    def __init__(
        self,
        labels: list[str],
        *,
        agree: int = 3,
        threshold: float = 0.40,
        cooldown: int = 20,
        smooth: int = 8,
        margin: float = 0.12,
        rest_label: str = "rest",
    ):
        self.labels = labels
        self.agree = agree
        self.threshold = threshold
        self.margin = margin
        self.cooldown = cooldown
        self.rest_label = rest_label
        self._history: deque[np.ndarray] = deque(maxlen=max(1, smooth))
        self._streak_label: str | None = None
        self._streak = 0
        self._cooling = 0

    def reset(self) -> None:
        self._streak_label, self._streak, self._cooling = None, 0, 0
        self._history.clear()

    def update(self, probabilities: np.ndarray, moving: bool) -> str | None:
        """Feed one frame's probabilities. Returns a word only when one fires."""
        if self._cooling > 0:
            self._cooling -= 1
            # Still require stillness to re-arm, otherwise a long sign would
            # immediately retrigger the moment the cooldown lapsed.
            if not moving:
                self._streak_label, self._streak = None, 0
                self._history.clear()
            return None

        if not moving:
            self._streak_label, self._streak = None, 0
            self._history.clear()
            return None

        # Average recent frames before deciding. Offline evaluation pools every
        # window of a clip and scores far better than any single window does;
        # this is the streaming equivalent of that pooling, and without it the
        # live path throws away predictions the model actually got right.
        self._history.append(probabilities)
        smoothed = np.mean(self._history, axis=0)

        order = np.argsort(smoothed)[::-1]
        index = int(order[0])
        label = self.labels[index]
        confidence = float(smoothed[index])

        # Require the leader to actually beat the runner-up. This model's
        # softmax is flat -- a correct, stable prediction sits around 0.46 --
        # so raw confidence cannot separate "decided" from "torn between two".
        # A margin can: averaging two alternating guesses leaves them nearly
        # tied, which is precisely the case that must not fire.
        margin = confidence - float(smoothed[int(order[1])]) if len(order) > 1 else 1.0
        if margin < self.margin:
            self._streak_label, self._streak = None, 0
            return None

        if confidence < self.threshold or label == self.rest_label:
            self._streak_label, self._streak = None, 0
            return None

        if label == self._streak_label:
            self._streak += 1
        else:
            self._streak_label, self._streak = label, 1

        if self._streak >= self.agree:
            self._cooling = self.cooldown
            self._streak_label, self._streak = None, 0
            return label
        return None


def motion_energy(window: np.ndarray) -> float:
    """How much the hands moved across a window.

    Uses the hand block only. Pose barely shifts while signing, so including it
    would dilute the signal with a near-constant term.
    """
    if len(window) < 2:
        return 0.0
    hands = window[:, POSE_DIM:-2]
    return float(np.abs(np.diff(hands, axis=0)).mean())


class SignRecogniser:
    """Loads a checkpoint and classifies a rolling window of frames."""

    def __init__(self, checkpoint: Path):
        checkpoint = Path(checkpoint)
        if checkpoint.suffix == ".onnx":
            self._load_onnx(checkpoint)
        else:
            self._load_torch(checkpoint)
        self._buffer: deque[np.ndarray] = deque(maxlen=self.window)

    def _apply_meta(self, meta: dict, labels: list[str]) -> None:
        self.labels = labels
        self.window = int(meta["window"])
        self.mean = np.asarray(meta["mean"], dtype=np.float32)
        self.std = np.asarray(meta["std"], dtype=np.float32)
        self.signer_independent = bool(meta.get("signer_independent", False))
        self.clip_accuracy = meta.get("clip_accuracy")
        self.cv_mean = meta.get("cv_mean")
        self.keep_columns = meta.get("keep_columns")

    def _load_torch(self, checkpoint: Path) -> None:
        import torch

        from train import SignGRU

        blob = torch.load(checkpoint, map_location="cpu", weights_only=False)
        self._apply_meta(
            blob, [w for w, _ in sorted(blob["labels"].items(), key=lambda kv: kv[1])]
        )
        self.backend = "torch"
        self._torch = torch
        self.model = SignGRU(
            int(blob["input_dim"]), int(blob["hidden"]), int(blob["layers"]),
            len(self.labels),
        )
        self.model.load_state_dict(blob["state_dict"])
        self.model.eval()

    def _load_onnx(self, checkpoint: Path) -> None:
        import json

        import onnxruntime

        meta_path = checkpoint.with_suffix(".meta.json")
        if not meta_path.exists():
            raise FileNotFoundError(f"missing {meta_path.name} beside {checkpoint.name}")
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        self._apply_meta(meta, list(meta["labels"]))
        self.backend = "onnx"
        self._session = onnxruntime.InferenceSession(
            str(checkpoint), providers=["CPUExecutionProvider"]
        )
        self._input_name = self._session.get_inputs()[0].name

    def reset(self) -> None:
        self._buffer.clear()

    def session(self) -> "SignRecogniser":
        """A recogniser with its own frame buffer over the same weights.

        The server needs one buffer per connection -- two viewers sharing a
        window would interleave their hands into one sequence -- but reloading
        the checkpoint per connection would be wasteful.
        """
        clone = object.__new__(SignRecogniser)
        clone.__dict__.update(self.__dict__)
        clone._buffer = deque(maxlen=self.window)
        return clone

    def feed(self, vector: np.ndarray) -> tuple[np.ndarray | None, float]:
        """Add one frame. Returns (probabilities, motion) once the window fills."""
        self._buffer.append(vector.astype(np.float32))
        if len(self._buffer) < self.window:
            return None, 0.0

        window = np.stack(self._buffer)
        # Motion is measured on the full vector, before column selection, so
        # the gate does not change when the feature set does.
        motion = motion_energy(window)
        if self.keep_columns is not None:
            window = window[:, self.keep_columns]
        normalised = ((window - self.mean) / self.std)[None].astype(np.float32)

        if self.backend == "onnx":
            logits = self._session.run(None, {self._input_name: normalised})[0][0]
            shifted = np.exp(logits - logits.max())
            return (shifted / shifted.sum()).astype(np.float32), motion

        with self._torch.no_grad():
            output = self.model(self._torch.from_numpy(normalised))
            probabilities = self._torch.softmax(output, dim=1)[0].numpy()
        return probabilities, motion


def main() -> int:
    import cv2

    from landmarks import LandmarkExtractor

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path,
                        default=Path(__file__).parent / "checkpoints" / "sign_gru.pt")
    parser.add_argument("--source", default="0")
    parser.add_argument("--agree", type=int, default=3)
    parser.add_argument("--threshold", type=float, default=0.40)
    parser.add_argument("--cooldown", type=int, default=20)
    parser.add_argument("--motion", type=float, default=0.02,
                        help="minimum hand motion to count as signing")
    parser.add_argument("--speak", action="store_true", help="say words via pyttsx3 if installed")
    args = parser.parse_args()

    if not args.checkpoint.exists():
        print(f"no checkpoint at {args.checkpoint} -- train one first")
        return 1

    recogniser = SignRecogniser(args.checkpoint)
    if not recogniser.signer_independent:
        print("WARNING: this checkpoint was trained on a same-signer split.")
    print(f"labels: {', '.join(recogniser.labels)}")

    segmenter = Segmenter(
        recogniser.labels, agree=args.agree,
        threshold=args.threshold, cooldown=args.cooldown,
    )

    speaker = None
    if args.speak:
        try:
            import pyttsx3
            speaker = pyttsx3.init()
        except Exception as exc:
            print(f"speech unavailable ({exc}); printing instead")

    source = int(args.source) if args.source.isdigit() else args.source
    capture = cv2.VideoCapture(source)
    if not capture.isOpened():
        print(f"could not open source {args.source!r}")
        return 1

    index = 0
    try:
        with LandmarkExtractor(video_mode=True) as extractor:
            while True:
                ok, frame = capture.read()
                if not ok:
                    break
                features = extractor.extract(frame, int(index * 33.3))
                index += 1

                word = None
                probabilities, motion = (None, 0.0)
                if features.usable:
                    probabilities, motion = recogniser.feed(features.vector)
                    if probabilities is not None:
                        word = segmenter.update(probabilities, motion > args.motion)
                else:
                    recogniser.reset()

                if word:
                    print(f"  -> {word}")
                    if speaker:
                        speaker.say(word)
                        speaker.runAndWait()

                view = cv2.flip(frame, 1)
                status = (
                    f"{recogniser.labels[int(np.argmax(probabilities))]} "
                    f"{float(np.max(probabilities)):.2f}  motion {motion:.4f}"
                    if probabilities is not None else "warming up"
                )
                cv2.putText(view, status, (14, 30), cv2.FONT_HERSHEY_SIMPLEX,
                            0.6, (240, 240, 240), 2)
                if word:
                    cv2.putText(view, word, (14, 70), cv2.FONT_HERSHEY_SIMPLEX,
                                1.1, (120, 220, 120), 3)
                cv2.imshow("voiceeye - live", view)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
    finally:
        capture.release()
        cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
