import React, { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import Header from "../Component/header/Header";

// Sign to voice. The camera runs here, the recognition runs in the Python
// service, and the browser speaks the result.
//
// Frames go out as JPEGs over a WebSocket rather than running a model in the
// page: the pipeline is MediaPipe plus a GRU in Python, and keeping one
// implementation means the thing tuned at the command line is the thing that
// ships. At this size the bandwidth is unremarkable -- a 256px JPEG is around
// 20KB, and we send twelve a second.

const SERVER = import.meta.env.VITE_SIGN_SERVER ?? "ws://127.0.0.1:8000";
const SEND_FPS = 12;
const CAPTURE_WIDTH = 256;

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
  const canvasRef = useRef(null);
  const socketRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("idle");
  const [connected, setConnected] = useState(false);
  const [word, setWord] = useState("");
  const [history, setHistory] = useState([]);

  const stop = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
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

    const socket = new WebSocket(`${SERVER}/ws/sign`);
    socket.binaryType = "arraybuffer";
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
        setWord(message.word);
        setHistory((past) => [message.word, ...past].slice(0, 8));
        speak(message.word);
      } else if (message.type === "status") {
        setStatus(
          !message.framed
            ? "step back - head, shoulders and hands must be visible"
            : message.warming
              ? "reading..."
              : `${message.top} ${message.confidence}`,
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

    const timer = setInterval(() => {
      const socket = socketRef.current;
      const video = videoRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      if (!video?.videoWidth) return;
      // Don't queue frames the socket has not drained; a backlog would make
      // the recognition lag behind the signer.
      if (socket.bufferedAmount > 0) return;

      const canvas = canvasRef.current;
      const scale = CAPTURE_WIDTH / video.videoWidth;
      canvas.width = CAPTURE_WIDTH;
      canvas.height = Math.round(video.videoHeight * scale);
      canvas
        .getContext("2d")
        .drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => blob?.arrayBuffer().then((buf) => socket.send(buf)),
        "image/jpeg",
        0.7,
      );
    }, 1000 / SEND_FPS);

    return () => clearInterval(timer);
  }, [running]);

  return (
    <Page>
      <Header />
      <Stage>
        <Video ref={videoRef} playsInline muted />
      </Stage>
      <canvas ref={canvasRef} style={{ display: "none" }} />

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
