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
        agree: int = 5,
        threshold: float = 0.75,
        cooldown: int = 20,
        rest_label: str = "rest",
    ):
        self.labels = labels
        self.agree = agree
        self.threshold = threshold
        self.cooldown = cooldown
        self.rest_label = rest_label
        self._streak_label: str | None = None
        self._streak = 0
        self._cooling = 0

    def reset(self) -> None:
        self._streak_label, self._streak, self._cooling = None, 0, 0

    def update(self, probabilities: np.ndarray, moving: bool) -> str | None:
        """Feed one frame's probabilities. Returns a word only when one fires."""
        if self._cooling > 0:
            self._cooling -= 1
            # Still require stillness to re-arm, otherwise a long sign would
            # immediately retrigger the moment the cooldown lapsed.
            if not moving:
                self._streak_label, self._streak = None, 0
            return None

        if not moving:
            self._streak_label, self._streak = None, 0
            return None

        index = int(np.argmax(probabilities))
        label = self.labels[index]
        confidence = float(probabilities[index])

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
        import torch

        from train import SignGRU

        blob = torch.load(checkpoint, map_location="cpu", weights_only=False)
        self.labels = [w for w, _ in sorted(blob["labels"].items(), key=lambda kv: kv[1])]
        self.window = int(blob["window"])
        self.mean = np.asarray(blob["mean"], dtype=np.float32)
        self.std = np.asarray(blob["std"], dtype=np.float32)
        self.signer_independent = bool(blob.get("signer_independent", False))
        self.clip_accuracy = blob.get("clip_accuracy")

        self._torch = torch
        self.model = SignGRU(
            int(blob["input_dim"]), int(blob["hidden"]), int(blob["layers"]),
            len(self.labels),
        )
        self.model.load_state_dict(blob["state_dict"])
        self.model.eval()
        self._buffer: deque[np.ndarray] = deque(maxlen=self.window)

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
        motion = motion_energy(window)
        normalised = (window - self.mean) / self.std
        with self._torch.no_grad():
            logits = self.model(self._torch.from_numpy(normalised[None]))
            probabilities = self._torch.softmax(logits, dim=1)[0].numpy()
        return probabilities, motion


def main() -> int:
    import cv2

    from landmarks import LandmarkExtractor

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path,
                        default=Path(__file__).parent / "checkpoints" / "sign_gru.pt")
    parser.add_argument("--source", default="0")
    parser.add_argument("--agree", type=int, default=5)
    parser.add_argument("--threshold", type=float, default=0.75)
    parser.add_argument("--cooldown", type=int, default=20)
    parser.add_argument("--motion", type=float, default=0.004,
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
