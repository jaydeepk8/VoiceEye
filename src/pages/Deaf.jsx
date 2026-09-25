import "regenerator-runtime/runtime";
import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import styled, { css, keyframes } from "styled-components";
import Header from "../Component/header/Header";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import Manus from "../Component/model/Manus";

const KNOWN = [
  "good_morning",
  "good_afternoon",
  "good_evening",
  "good_night",
  "how_are_you",
  "thank_you",
  "hello",
  "alright",
  "pleased",
];

function parseSigns(text) {
  const clean = ` ${String(text).toLowerCase().replace(/[^a-z]+/g, " ").trim()} `;
  const hits = [];
  KNOWN.forEach((word) => {
    const phrase = ` ${word.replace(/_/g, " ")} `;
    let from = 0;
    for (;;) {
      const at = clean.indexOf(phrase, from);
      if (at === -1) break;
      hits.push({ at, word, len: phrase.length });
      from = at + 1;
    }
  });
  hits.sort((a, b) => a.at - b.at || b.len - a.len);
  const chosen = [];
  let reached = -1;
  hits.forEach((hit) => {
    if (hit.at >= reached) {
      chosen.push(hit.word);
      reached = hit.at + hit.len - 1;
    }
  });
  return chosen;
}

const StyledDeaf = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: #040d11;
  align-items: center;
  justify-content: center;
`;

const Stage = styled.div`
  position: absolute;
  inset: 0;
`;

const Debug = styled.div`
  position: absolute;
  top: 6rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.72rem;
  font-weight: 200;
  color: #7f95a1;
  font-family: monospace;
`;

const Note = styled.div`
  position: absolute;
  bottom: 12rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.8rem;
  font-weight: 200;
  color: #8fb7a4;
  letter-spacing: 0.04em;
`;

const InputContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: absolute;
  bottom: 8rem; // Adjust this value for bottom padding
  left: 50%;
  transform: translateX(-50%);
  padding: 10px;
  background: none;
  border-radius: 10px;
  border: 1px solid #666;
  height: 50px;
  width: 40%; // Adjust this value as needed
`;

const Input = styled.input`
  flex-grow: 1;
  background: none;
  border: none;
  color: white;
  font-size: 0.8em; // Increase the height of text
  font-weight: 200; // Set font weight to 200
  ::placeholder {
    color: white;
  }
  &:focus {
    outline: none;
  }
`;

const brighten = keyframes`
  0% {
    opacity: 0.6;
  }
  100% {
    opacity: 1;
  }
`;

const Button = styled.button`
  background-color: ${({ isListening }) => (isListening ? "yellow" : "black")};
  color: ${({ isListening }) => (isListening ? "black" : "white")};
  border: none;
  border-radius: 5px;
  padding: 5px 10px;
  margin-left: 10px;

  svg {
    fill: currentColor;
    opacity: 0.6;
    transition: opacity 0.3s ease;
  }

  &:hover svg {
    opacity: 0.8;
  }

  ${({ isListening }) =>
    isListening &&
    css`
      svg {
        animation: ${brighten} 0.3s ease-in-out infinite alternate;
      }
    `}
`;

function Deaf() {
  const [isListening, setIsListening] = useState(false);
  const [typed, setTyped] = useState("");
  const [queue, setQueue] = useState([]);
  const [note, setNote] = useState("");
  const [debug, setDebug] = useState("");
  const { transcript, listening, resetTranscript } = useSpeechRecognition();

  useEffect(() => {
    if (transcript) setTyped(transcript);
  }, [transcript]);

  const [freezeAt, setFreezeAt] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const faceCam = useMemo(
    () => new URLSearchParams(window.location.search).get("cam") === "face",
    [],
  );
  const [forceGaze, setForceGaze] = useState(null);
  const [forceBlink, setForceBlink] = useState(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShowDebug(params.get("debug") === "1");
    if (params.get("gaze")) setForceGaze(params.get("gaze").split(",").map(Number));
    if (params.get("blink") !== null) setForceBlink(Number(params.get("blink")));
    const fixed = params.get("sign");
    const at = params.get("t");
    if (fixed) {
      setQueue([fixed]);
      if (at !== null) setFreezeAt(Number(at));
    }
  }, []);

  const playNext = useCallback(() => {
    setQueue((rest) => rest.slice(1));
  }, []);

  const handleVoiceButtonClick = () => {
    if (listening) {
      SpeechRecognition.stopListening();
      setIsListening(false);
    } else {
      SpeechRecognition.startListening();
      setIsListening(true);
    }
  };

  const handleSubmitButtonClick = () => {
    const found = parseSigns(typed);
    if (!found.length) {
      setNote(`no known sign in that - try: ${KNOWN.slice(0, 4).map((w) => w.replace(/_/g, " ")).join(", ")}`);
      return;
    }
    setNote(found.map((w) => w.replace(/_/g, " ")).join("  ->  "));
    setQueue(found);
  };

  return (
    <StyledDeaf>
      <Header />

      <Stage>
        <Canvas camera={faceCam ? { position: [0, 0.31, 0.62], fov: 26 } : { position: [0, 0.2, 3.2], fov: 42 }}>
          <color attach="background" args={["#040d11"]} />
          <ambientLight intensity={1.6} />
          <directionalLight position={[2, 4, 3]} intensity={1.4} />
          <Suspense fallback={null}>
            <Manus sign={queue[0] ?? null} onFinished={playNext} onDebug={setDebug} freezeAt={freezeAt} forceGaze={forceGaze} forceBlink={forceBlink} />
          </Suspense>
          <OrbitControls enablePan={false} target={faceCam ? [0, 0.3, 0] : [0, 0.1, 0]} />
        </Canvas>
      </Stage>
      {note && <Note>{note}</Note>}
      {showDebug && debug && <Debug>{debug}</Debug>}

      <InputContainer>
        <Input
          placeholder="Convert Voice to ISL..."
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSubmitButtonClick();
          }}
        />
        <Button onClick={handleSubmitButtonClick}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M16 12.001H5M16 12.001L12 8M16 12.001L12 16.002M19 5V19.001"
              stroke="currentColor"
              stroke-opacity="0.5"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </Button>
        <Button isListening={isListening} onClick={handleVoiceButtonClick}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="21"
            viewBox="0 0 24 21"
            fill="none"
          >
            <path
              d="M8.77136 6.73173H10.7205M8.77136 8.91954H10.7205M18.1272 9.34035V10.0219C18.1272 12.9914 15.3783 15.3989 11.9874 15.3989M11.9874 15.3989C8.59652 15.3989 5.84766 12.9914 5.84766 10.0219V9.34035M11.9874 15.3989L11.9872 17.6708M9.35571 17.6708H14.6184M11.9876 13.1269C10.0501 13.1269 8.47918 11.7705 8.47918 10.0976V5.55368C8.47918 3.88077 10.0501 2.52441 11.9876 2.52441C13.9252 2.52441 15.4961 3.88077 15.4961 5.55368V10.0976C15.4961 11.7705 13.9252 13.1269 11.9876 13.1269Z"
              stroke="currentColor"
              stroke-opacity="0.6"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </Button>
      </InputContainer>
    </StyledDeaf>
  );
}

export default Deaf;
