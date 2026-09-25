import React, { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import Header from "../Component/header/Header";

const SERVER = import.meta.env.VITE_SIGN_SERVER ?? "ws://127.0.0.1:8000";
const SEND_FPS = 15;
const MIN_VISIBILITY = 0.5;
const L_SHOULDER = 11;
const R_SHOULDER = 12;

const pretty = (label) => label.replace(/_/g, " ");

const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_ROOT = "https://storage.googleapis.com/mediapipe-models";
const HAND_MODEL = `${MODEL_ROOT}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`;
const POSE_MODEL = `${MODEL_ROOT}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`;

async function buildFor(delegate) {
  const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
  const [hands, pose] = await Promise.all([
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: HAND_MODEL, delegate },
      runningMode: "VIDEO",
      numHands: 2,
    }),
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
    }),
  ]);
  return { hands, pose, delegate };
}

async function createLandmarkers() {
  let kit;
  try {
    kit = await buildFor("GPU");
  } catch {
    kit = await buildFor("CPU");
  }

  const warm = document.createElement("canvas");
  warm.width = 640;
  warm.height = 480;
  warm.getContext("2d").fillRect(0, 0, warm.width, warm.height);
  try {
    kit.pose.detectForVideo(warm, 1);
    kit.hands.detectForVideo(warm, 1);
  } catch {
    /* first GPU call compiles shaders; failures surface on the real frames */
  }
  return kit;
}

const round = (value) => Math.round(value * 100000) / 100000;
const toPoints = (marks) => marks.map((p) => [round(p.x), round(p.y), round(p.z)]);

function buildPayload(video, hands, pose, timestamp) {
  const poseResult = pose.detectForVideo(video, timestamp);
  const handResult = hands.detectForVideo(video, timestamp);

  const marks = poseResult.landmarks?.[0];
  let posePoints = null;
  if (marks?.length) {
    const visible = (index) =>
      marks[index].visibility === undefined ? 1 : marks[index].visibility;
    if (
      Math.min(visible(L_SHOULDER), visible(R_SHOULDER)) >= MIN_VISIBILITY
    ) {
      posePoints = toPoints(marks);
    }
  }

  let left = null;
  let right = null;
  const handedness = handResult.handednesses ?? handResult.handedness ?? [];
  (handResult.landmarks ?? []).forEach((marksForHand, index) => {
    const label = handedness[index]?.[0]?.categoryName;
    if (label === "Left") left = toPoints(marksForHand);
    else right = toPoints(marksForHand);
  });

  return {
    pose: posePoints,
    left,
    right,
    aspect: video.videoWidth / video.videoHeight,
  };
}

const Page = styled.div`
  min-height: 100vh;
  width: 100vw;
  background-color: #040d11;
  color: #f0f0f0;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Stage = styled.div`
  position: relative;
  margin-top: 6rem;
  width: min(720px, 90vw);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #1e2f38;
`;

const Video = styled.video`
  width: 100%;
  display: block;
  transform: scaleX(-1); /* mirror for the user; the server sees the raw frame */
  background: #000;
`;

const pulse = keyframes`
  from { opacity: 0.55; }
  to   { opacity: 1; }
`;

const Status = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  font-size: 0.85rem;
  font-weight: 200;
  color: ${({ $ok }) => ($ok ? "#78dc78" : "#d05a5a")};
  ${({ $busy }) =>
    $busy &&
    css`
      animation: ${pulse} 0.8s ease-in-out infinite alternate;
    `}
`;

const Spoken = styled.div`
  margin-top: 2rem;
  font-size: 2.6rem;
  font-weight: 300;
  letter-spacing: 0.04em;
  min-height: 3.4rem;
`;

const History = styled.div`
  margin-top: 0.5rem;
  font-size: 0.85rem;
  font-weight: 200;
  opacity: 0.55;
`;

const Button = styled.button`
  margin-top: 2rem;
  padding: 0.7rem 1.6rem;
  background: none;
  border: 1px solid #666;
  border-radius: 8px;
  color: #f0f0f0;
  font-size: 0.85rem;
  cursor: pointer;
  &:hover {
    border-color: #aaa;
  }
`;

function speak(word) {
  if (!("speechSynthesis" in window)) return;
  // Cancel anything queued: the point is to keep pace with the signer, not to
  // read out a backlog.
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(word));
}

function Blind() {
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const landmarkersRef = useRef(null);
  const busyRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("idle");
  const [connected, setConnected] = useState(false);
  const [word, setWord] = useState("");
  const [history, setHistory] = useState([]);

  const stop = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    landmarkersRef.current?.hands?.close();
    landmarkersRef.current?.pose?.close();
    landmarkersRef.current = null;
    const stream = videoRef.current?.srcObject;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
    setConnected(false);
    setStatus("stopped");
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    } catch (err) {
      setStatus(`camera blocked: ${err.message}`);
      return;
    }

    if (!landmarkersRef.current) {
      setStatus("loading landmark models...");
      try {
        landmarkersRef.current = await createLandmarkers();
      } catch (err) {
        setStatus(`could not load models: ${err.message}`);
        return;
      }
    }

    const socket = new WebSocket(`${SERVER}/ws/sign`);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      setStatus("connected");
    };
    socket.onclose = () => {
      setConnected(false);
      setStatus("disconnected");
    };
    socket.onerror = () => setStatus(`cannot reach ${SERVER}`);
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "sign") {
        const spoken = pretty(message.word);
        setWord(spoken);
        setHistory((past) => [spoken, ...past].slice(0, 8));
        speak(spoken);
      } else if (message.type === "status") {
        setStatus(
          !message.framed
            ? "step back - head, shoulders and hands must be visible"
            : message.warming
              ? "reading..."
              : `${pretty(message.top)} ${message.confidence}`,
        );
      } else if (message.type === "error") {
        setStatus(message.message);
      }
    };

    setRunning(true);
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!running) return undefined;

    let stamp = 0;
    const timer = setInterval(() => {
      const socket = socketRef.current;
      const video = videoRef.current;
      const kit = landmarkersRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      if (!video?.videoWidth || !kit) return;
      if (socket.bufferedAmount > 0) return;

      stamp += Math.round(1000 / SEND_FPS);
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        socket.send(
          JSON.stringify(buildPayload(video, kit.hands, kit.pose, stamp)),
        );
      } catch (err) {
        setStatus(`landmark error: ${err.message}`);
      } finally {
        busyRef.current = false;
      }
    }, 1000 / SEND_FPS);

    return () => clearInterval(timer);
  }, [running]);

  return (
    <Page>
      <Header />
      <Stage>
        <Video ref={videoRef} playsInline muted />
      </Stage>

      <Status $ok={connected} $busy={running && connected}>
        {status}
      </Status>

      <Spoken aria-live="polite">{word}</Spoken>
      {history.length > 1 && <History>{history.slice(1).join("  ·  ")}</History>}

      <Button onClick={running ? stop : start}>
        {running ? "stop" : "start signing"}
      </Button>
    </Page>
  );
}

export default Blind;
