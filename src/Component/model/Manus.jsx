import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { applyPose, buildRig, frameAt, restPose } from "./signRig";

const MODEL = "/aniavatar.glb";
const BLEND = 0.35;

function Manus({ sign = null, onFinished }) {
  const group = useRef();
  const { scene, animations } = useGLTF(MODEL);
  const { actions } = useAnimations(animations, group);
  const [clip, setClip] = useState(null);
  const elapsed = useRef(0);

  const rig = useMemo(() => buildRig(scene), [scene]);

  useEffect(() => {
    const idle = Object.values(actions).filter(Boolean);
    if (clip) {
      idle.forEach((action) => action.stop());
    } else {
      idle.forEach((action) => action.reset().play());
    }
  }, [actions, clip]);

  useEffect(() => {
    let cancelled = false;
    if (!sign) {
      setClip(null);
      return () => {};
    }
    elapsed.current = 0;
    fetch(`/signs/${sign}.motion.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setClip(data);
      })
      .catch(() => {
        if (!cancelled) setClip(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sign]);

  useFrame((_, delta) => {
    if (!rig || !clip) return;
    elapsed.current += delta;
    const duration = clip.frameCount / clip.fps;
    if (elapsed.current >= duration) {
      restPose(rig, BLEND);
      if (onFinished) onFinished();
      return;
    }
    applyPose(rig, frameAt(clip, elapsed.current), BLEND);
  }, 1);

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} position={[0, -1.35, 0]} />
    </group>
  );
}

useGLTF.preload(MODEL);

export default Manus;
