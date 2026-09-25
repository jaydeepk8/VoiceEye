import React, { useEffect, useRef } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";

const MODEL = "/wireframe.glb";

function Manus({ playing = true }) {
  const group = useRef();
  const { scene, animations } = useGLTF(MODEL);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const clips = Object.values(actions).filter(Boolean);
    if (!clips.length) return undefined;
    clips.forEach((action) => {
      action.reset();
      action.paused = !playing;
      action.play();
    });
    return () => clips.forEach((action) => action.stop());
  }, [actions, playing]);

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} position={[0, -1.35, 0]} />
    </group>
  );
}

useGLTF.preload(MODEL);

export default Manus;
