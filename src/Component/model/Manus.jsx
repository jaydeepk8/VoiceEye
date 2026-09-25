import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { applyPose, buildRig, frameAt, restPose } from "./signRig";

const MODEL = "/aniavatar.glb";
const BLEND = 0.35;

function Manus({ sign = null, onFinished, onDebug, freezeAt = null }) {
  const group = useRef();
  const { scene, animations } = useGLTF(MODEL);
  const { actions } = useAnimations(animations, group);
  const [clip, setClip] = useState(null);
  const elapsed = useRef(0);

  const rig = useMemo(() => buildRig(scene), [scene]);
  const ticks = useRef(0);

  useEffect(() => {
    if (!onDebug) return;
    const found = [];
    let bones = 0;
    scene.traverse((node) => {
      if (node.isBone) {
        bones += 1;
        if (found.length < 4) found.push(node.name);
      }
    });
    onDebug(
      `rig=${rig ? rig.size : "null"} sceneBones=${bones} sample=[${found.join("|")}]`,
    );
  }, [rig, onDebug, scene]);

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
        if (cancelled) return;
        if (onDebug) {
          onDebug(
            data
              ? `loaded ${data.word}: ${data.frameCount} frames, ${Object.keys(data.bones || {}).length} bones`
              : `fetch of /signs/${sign}.motion.json returned nothing`,
          );
        }
        setClip(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (onDebug) onDebug(`fetch failed: ${err.message}`);
        setClip(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sign]);

  useFrame((_, delta) => {
    ticks.current += 1;
    if (onDebug && ticks.current % 30 === 0) {
      onDebug(
        `rig=${rig ? rig.size : "null"} clip=${clip ? clip.word : "none"} ` +
        `frames=${clip ? clip.frameCount : 0} t=${elapsed.current.toFixed(1)}s ticks=${ticks.current}`,
      );
    }
    if (!rig || !clip) return;
    if (freezeAt !== null) {
      applyPose(rig, frameAt(clip, freezeAt), BLEND);
      return;
    }
    elapsed.current += delta;
    const duration = clip.frameCount / clip.fps;
    if (elapsed.current >= duration) {
      restPose(rig, BLEND);
      if (onFinished) onFinished();
      return;
    }
    applyPose(rig, frameAt(clip, elapsed.current), BLEND);
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} position={[0, -1.35, 0]} />
    </group>
  );
}

useGLTF.preload(MODEL);

export default Manus;
