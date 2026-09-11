"""Frame -> normalised landmark feature vector.

The representation deliberately drops the 468-point face mesh, which is noise
for word-level signs, and keeps upper-body pose plus both hands. Every point is
expressed relative to the shoulder midpoint and divided by shoulder width, so a
signer standing close to the camera and the same signer standing across the
room produce near-identical vectors.

Coordinate convention: features are always extracted from the RAW frame.
Mirror only for display, never before extraction. MediaPipe reports handedness
from the camera's point of view, so "left" below means the hand on the left of
the image rather than the signer's left hand -- which is harmless as long as
recording and inference agree, and they do because both call this module.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision

MODEL_DIR = Path(__file__).parent / "models"
HAND_MODEL = MODEL_DIR / "hand_landmarker.task"
POSE_MODEL = MODEL_DIR / "pose_landmarker_lite.task"

# Indices into MediaPipe's 33-point pose model: nose, shoulders, elbows,
# wrists, hips. The hips give the torso a second reference so the model can
# tell a raised arm from a leaning body.
POSE_KEEP = (0, 11, 12, 13, 14, 15, 16, 23, 24)
L_SHOULDER, R_SHOULDER = 11, 12

HAND_POINTS = 21
POSE_DIM = len(POSE_KEEP) * 3  # 27
HAND_DIM = HAND_POINTS * 3  # 63
FEATURE_DIM = POSE_DIM + 2 * HAND_DIM + 2  # 155, last two are presence flags

_EPS = 1e-6


def _isotropic(points: np.ndarray, aspect: float) -> np.ndarray:
    """Put x on the same physical scale as y.

    MediaPipe returns x and y both in [0, 1], normalised against image width
    and height separately. On a 16:9 frame that means a horizontal distance of
    0.1 is not the same real distance as a vertical 0.1, and every measurement
    we take afterwards would be skewed. z shares x's unit, so it gets the same
    correction.
    """
    out = np.asarray(points, dtype=np.float32).copy()
    out[:, 0] *= aspect
    out[:, 2] *= aspect
    return out


def normalise(
    pose: np.ndarray | None,
    left: np.ndarray | None,
    right: np.ndarray | None,
    aspect: float,
) -> np.ndarray:
    """Build the fixed-size feature vector from raw landmark arrays.

    Kept free of MediaPipe types on purpose: this is the part worth unit
    testing, and it can be exercised with synthetic arrays and no camera.

    Missing inputs are not errors. A frame where a hand left the picture is
    ordinary, and it yields zeros plus a cleared presence flag so the model can
    learn the difference between "hand absent" and "hand at the origin".
    """
    out = np.zeros(FEATURE_DIM, dtype=np.float32)
    if pose is None:
        return out

    pose = _isotropic(pose, aspect)
    origin = (pose[L_SHOULDER] + pose[R_SHOULDER]) / 2.0
    scale = float(np.linalg.norm(pose[L_SHOULDER] - pose[R_SHOULDER]))
    if scale < _EPS:
        # Shoulders on top of each other: either a bad detection or the signer
        # is edge-on. Dividing by this would explode the vector.
        return out

    out[:POSE_DIM] = ((pose[list(POSE_KEEP)] - origin) / scale).ravel()

    for slot, hand in enumerate((left, right)):
        if hand is None:
            continue
        start = POSE_DIM + slot * HAND_DIM
        out[start : start + HAND_DIM] = (
            (_isotropic(hand, aspect) - origin) / scale
        ).ravel()
        out[POSE_DIM + 2 * HAND_DIM + slot] = 1.0

    return out


@dataclass
class FrameFeatures:
    """One frame's worth of features, plus enough detail to draw an overlay."""

    vector: np.ndarray
    pose_found: bool
    hands_found: int
    pose_raw: np.ndarray | None = None
    left_raw: np.ndarray | None = None
    right_raw: np.ndarray | None = None

    @property
    def usable(self) -> bool:
        """Whether this frame carries signal worth recording or classifying."""
        return self.pose_found and self.hands_found > 0


def _visibility(landmark) -> float:
    value = getattr(landmark, "visibility", None)
    return 1.0 if value is None else float(value)


class LandmarkExtractor:
    """Wraps the two MediaPipe Tasks detectors behind one call.

    Use VIDEO mode for a webcam or a clip; it lets MediaPipe track between
    frames instead of detecting from scratch each time, which is both faster
    and steadier. Timestamps must increase monotonically in that mode.
    """

    def __init__(self, *, video_mode: bool = True, min_visibility: float = 0.5):
        missing = [p.name for p in (HAND_MODEL, POSE_MODEL) if not p.exists()]
        if missing:
            raise FileNotFoundError(
                f"missing model(s): {', '.join(missing)}\n"
                f"run: python ml/download_models.py"
            )

        mode = vision.RunningMode.VIDEO if video_mode else vision.RunningMode.IMAGE
        self._video_mode = video_mode
        self.min_visibility = min_visibility

        self._hands = vision.HandLandmarker.create_from_options(
            vision.HandLandmarkerOptions(
                base_options=BaseOptions(model_asset_path=str(HAND_MODEL)),
                running_mode=mode,
                num_hands=2,
            )
        )
        self._pose = vision.PoseLandmarker.create_from_options(
            vision.PoseLandmarkerOptions(
                base_options=BaseOptions(model_asset_path=str(POSE_MODEL)),
                running_mode=mode,
                num_poses=1,
            )
        )

    def extract(self, frame_bgr: np.ndarray, timestamp_ms: int) -> FrameFeatures:
        height, width = frame_bgr.shape[:2]
        image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB),
        )

        if self._video_mode:
            pose_result = self._pose.detect_for_video(image, timestamp_ms)
            hand_result = self._hands.detect_for_video(image, timestamp_ms)
        else:
            pose_result = self._pose.detect(image)
            hand_result = self._hands.detect(image)

        pose = None
        if pose_result.pose_landmarks:
            landmarks = pose_result.pose_landmarks[0]
            shoulders_visible = (
                min(
                    _visibility(landmarks[L_SHOULDER]),
                    _visibility(landmarks[R_SHOULDER]),
                )
                >= self.min_visibility
            )
            if shoulders_visible:
                pose = np.array(
                    [[p.x, p.y, p.z] for p in landmarks], dtype=np.float32
                )

        left = right = None
        for landmarks, handedness in zip(
            hand_result.hand_landmarks, hand_result.handedness
        ):
            points = np.array([[p.x, p.y, p.z] for p in landmarks], dtype=np.float32)
            if handedness[0].category_name == "Left":
                left = points
            else:
                right = points

        return FrameFeatures(
            vector=normalise(pose, left, right, aspect=width / height),
            pose_found=pose is not None,
            hands_found=(left is not None) + (right is not None),
            pose_raw=pose,
            left_raw=left,
            right_raw=right,
        )

    def close(self) -> None:
        self._hands.close()
        self._pose.close()

    def __enter__(self) -> "LandmarkExtractor":
        return self

    def __exit__(self, *exc) -> None:
        self.close()
