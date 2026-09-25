import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Euler, Quaternion } from "three";
import { applyPose, buildRig, frameAt } from "./signRig";
import neutralPose from "./neutralPose.json";

const MODEL = "/aniavatar.glb";
const BLEND = 0.35;
const IDLE_BONES = ["Hips", "Spine1", "Spine2", "Neck", "Head"];

function collectIdleBones(scene) {
  scene.updateMatrixWorld(true);
  const found = {};
  scene.traverse((node) => {
    if (!node.isBone) return;
    const name = node.name.replace(/^mixamorig[:_\-.]?/i, "");
    if (!IDLE_BONES.includes(name)) return;
    const world = new Quaternion();
    const parentWorld = new Quaternion();
    node.getWorldQuaternion(world);
    if (node.parent) node.parent.getWorldQuaternion(parentWorld);
    found[name] = { bone: node, world, parentInverse: parentWorld.invert() };
  });
  return found;
}

const euler = new Euler();
const offset = new Quaternion();

function tilt(entry, pitch, yaw, roll) {
  if (!entry) return;
  euler.set(pitch, yaw, roll, "YXZ");
  offset.setFromEuler(euler);
  entry.bone.quaternion.copy(entry.parentInverse).multiply(offset).multiply(entry.world);
}

function Manus({ sign = null, onFinished, onDebug, freezeAt = null }) {
  const group = useRef();
  const { scene } = useGLTF(MODEL);
  const [clip, setClip] = useState(null);
  const elapsed = useRef(0);
  const clock = useRef(0);
  const settled = useRef(false);
  const ticks = useRef(0);
  const liveliness = useRef(1);
  const glance = useRef({ yaw: 0, pitch: 0, toYaw: 0, toPitch: 0, next: 1.5 });

  const rig = useMemo(() => buildRig(scene), [scene]);
  const idle = useMemo(() => collectIdleBones(scene), [scene]);

  useEffect(() => {
    if (!onDebug) return;
    onDebug(`rig=${rig ? rig.size : "null"} idle=${Object.keys(idle).length}`);
  }, [rig, idle, onDebug]);

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
        if (onDebug && !data) onDebug(`fetch of /signs/${sign}.motion.json returned nothing`);
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
    if (!rig) return;
    const step = Math.min(delta, 0.1);
    ticks.current += 1;
    if (onDebug && ticks.current % 30 === 0) {
      onDebug(
        `rig=${rig.size} idle=${Object.keys(idle).length} clip=${clip ? clip.word : "none"} ` +
        `frames=${clip ? clip.frameCount : 0} t=${elapsed.current.toFixed(1)}s ticks=${ticks.current}`,
      );
    }

    if (freezeAt === null) {
      clock.current += step;
      const t = clock.current;
      const wanted = clip ? 0.3 : 1;
      liveliness.current += (wanted - liveliness.current) * (1 - Math.exp(-step * 3));
      const amp = liveliness.current;

      const g = glance.current;
      if (t > g.next) {
        g.toYaw = (Math.random() * 2 - 1) * 0.08;
        g.toPitch = (Math.random() * 2 - 1) * 0.035;
        g.next = t + 2.5 + Math.random() * 4;
      }
      const ease = 1 - Math.exp(-step * 2.2);
      g.yaw += (g.toYaw - g.yaw) * ease;
      g.pitch += (g.toPitch - g.pitch) * ease;

      const breath = Math.sin((t * 2 * Math.PI) / 4.2);
      const drift = Math.sin(t * 0.31) + 0.5 * Math.sin(t * 0.73 + 1.3);

      tilt(idle.Hips, 0, 0.012 * Math.sin(t * 0.17) * amp, 0.008 * Math.sin(t * 0.21 + 0.4) * amp);
      tilt(idle.Spine1, -0.006 * breath, 0, 0);
      tilt(idle.Spine2, -0.012 * breath, 0, 0);
      tilt(idle.Neck, 0.004 * breath, (g.yaw * 0.35 + 0.012 * drift) * amp, 0);
      tilt(
        idle.Head,
        (g.pitch + 0.015 * Math.sin(t * 0.37 + 0.5)) * amp,
        (g.yaw * 0.65 + 0.02 * drift) * amp,
        0.012 * Math.sin(t * 0.23 + 2.1) * amp,
      );
    }

    if (!settled.current) {
      applyPose(rig, neutralPose, 1);
      settled.current = true;
    }

    if (!clip) {
      applyPose(rig, neutralPose, BLEND);
      return;
    }
    if (freezeAt !== null) {
      applyPose(rig, frameAt(clip, freezeAt), BLEND);
      return;
    }
    elapsed.current += step;
    const duration = clip.frameCount / clip.fps;
    if (elapsed.current >= duration) {
      applyPose(rig, neutralPose, BLEND);
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
