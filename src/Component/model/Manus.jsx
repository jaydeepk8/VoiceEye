import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Euler, Quaternion } from "three";
import { applyPose, buildRig, frameAt } from "./signRig";
import { aimEyes, buildEyes } from "./eyes";
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

function Manus({ sign = null, onFinished, onDebug, freezeAt = null, forceGaze = null, forceBlink = null }) {
  const group = useRef();
  const { scene } = useGLTF(MODEL);
  const [clip, setClip] = useState(null);
  const elapsed = useRef(0);
  const clock = useRef(0);
  const settled = useRef(false);
  const ticks = useRef(0);
  const liveliness = useRef(1);
  const glance = useRef({ yaw: 0, pitch: 0, toYaw: 0, toPitch: 0, next: 1.5 });
  const gaze = useRef({ yaw: 0, pitch: 0, toYaw: 0, toPitch: 0, jitterYaw: 0, jitterPitch: 0, nextJitter: 0.6 });
  const blink = useRef({ start: -1, next: 1.2, count: 0 });

  const rig = useMemo(() => buildRig(scene), [scene]);
  const idle = useMemo(() => collectIdleBones(scene), [scene]);
  const eyes = useMemo(() => buildEyes(scene), [scene]);

  useEffect(() => {
    if (!onDebug) return;
    onDebug(`rig=${rig ? rig.size : "null"} idle=${Object.keys(idle).length} eyes=${eyes ? Object.keys(eyes).length : 0}`);
  }, [rig, idle, eyes, onDebug]);

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
        `rig=${rig.size} idle=${Object.keys(idle).length} eyes=${eyes ? Object.keys(eyes).length : 0} clip=${clip ? clip.word : "none"} ` +
        `frames=${clip ? clip.frameCount : 0} t=${elapsed.current.toFixed(1)}s ticks=${ticks.current} blinks=${blink.current.count} clock=${clock.current.toFixed(1)}s`,
      );
    }

    const staged = forceGaze !== null || forceBlink !== null;
    if (freezeAt === null) {
      clock.current += step;
      const t = clock.current;
      const wanted = clip ? 0.3 : 1;
      liveliness.current += (wanted - liveliness.current) * (1 - Math.exp(-step * 3));
      const amp = liveliness.current;

      const g = glance.current;
      if (t > g.next) {
        const wide = Math.random() < 0.25;
        const reach = wide ? 0.42 : 0.24;
        g.toYaw = Math.random() < 0.3 ? 0 : (Math.random() * 2 - 1) * reach;
        g.toPitch = (Math.random() * 2 - 1) * 0.09 - 0.02;
        g.next = t + 1.2 + Math.random() * 2.6;
        gaze.current.toYaw = g.toYaw + (Math.random() * 2 - 1) * 0.06;
        gaze.current.toPitch = g.toPitch + (Math.random() * 2 - 1) * 0.03;
      }
      const ease = 1 - Math.exp(-step * 5.5);
      g.yaw += (g.toYaw - g.yaw) * ease;
      g.pitch += (g.toPitch - g.pitch) * ease;

      const breath = Math.sin((t * 2 * Math.PI) / 4.2);
      const drift = Math.sin(t * 0.31) + 0.5 * Math.sin(t * 0.73 + 1.3);

      const e = gaze.current;
      if (t > e.nextJitter) {
        e.jitterYaw = (Math.random() * 2 - 1) * 0.05;
        e.jitterPitch = (Math.random() * 2 - 1) * 0.025;
        e.nextJitter = t + 0.4 + Math.random() * 1.4;
      }
      const snap = 1 - Math.exp(-step * 28);
      e.yaw += (e.toYaw + e.jitterYaw - e.yaw) * snap;
      e.pitch += (e.toPitch + e.jitterPitch - e.pitch) * snap;
      const clampEye = (v, limit) => Math.max(-limit, Math.min(limit, v));
      let eyeYaw = clampEye((e.yaw - g.yaw) * amp, 0.35);
      let eyePitch = clampEye((e.pitch - g.pitch) * amp, 0.2);

      const b = blink.current;
      if (b.start < 0 && t > b.next) {
        b.start = t;
        b.count += 1;
      }
      let closed = 0;
      if (b.start >= 0) {
        const k = (t - b.start) / 0.16;
        if (k >= 1) {
          b.start = -1;
          b.next = t + (Math.random() < 0.18 ? 0.22 : 2 + Math.random() * 4);
        } else {
          closed = Math.sin(Math.PI * k) ** 0.6;
        }
      }
      if (forceGaze) [eyeYaw, eyePitch] = forceGaze;
      if (forceBlink !== null) closed = forceBlink;
      aimEyes(eyes, eyeYaw, eyePitch, closed);

      if (staged) {
        tilt(idle.Hips, 0, 0, 0);
        tilt(idle.Spine1, 0, 0, 0);
        tilt(idle.Spine2, 0, 0, 0);
        tilt(idle.Neck, 0, 0, 0);
        tilt(idle.Head, 0, 0, 0);
      } else {
      tilt(idle.Hips, 0, 0.025 * Math.sin(t * 0.17) * amp, 0.015 * Math.sin(t * 0.21 + 0.4) * amp);
      tilt(idle.Spine1, -0.01 * breath, 0.08 * g.yaw * amp, 0);
      tilt(idle.Spine2, -0.02 * breath, 0.1 * g.yaw * amp, 0);
      tilt(idle.Neck, 0.006 * breath, (g.yaw * 0.35 + 0.015 * drift) * amp, 0);
      tilt(
        idle.Head,
        (g.pitch + 0.02 * Math.sin(t * 0.37 + 0.5)) * amp,
        (g.yaw * 0.55 + 0.025 * drift) * amp,
        (0.015 * Math.sin(t * 0.23 + 2.1) - 0.12 * g.yaw) * amp,
      );
      }
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
