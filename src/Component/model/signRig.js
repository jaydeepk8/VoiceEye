import { Quaternion, Vector3 } from "three";

const PREFIX = /^mixamorig[:_\-.]?/i;

const CHILD_OF = {
  LeftArm: "LeftForeArm",
  LeftForeArm: "LeftHand",
  LeftHand: "LeftHandMiddle1",
  RightArm: "RightForeArm",
  RightForeArm: "RightHand",
  RightHand: "RightHandMiddle1",
};

for (const side of ["Left", "Right"]) {
  for (const finger of ["Thumb", "Index", "Middle", "Ring", "Pinky"]) {
    for (let n = 1; n <= 3; n += 1) {
      CHILD_OF[`${side}Hand${finger}${n}`] = `${side}Hand${finger}${n + 1}`;
    }
  }
}

export function buildRig(scene) {
  const bones = new Map();
  scene.traverse((node) => {
    if (node.isBone) bones.set(node.name.replace(PREFIX, ""), node);
  });
  if (!bones.size) return null;

  scene.updateMatrixWorld(true);

  const rig = new Map();
  for (const [name, childName] of Object.entries(CHILD_OF)) {
    const bone = bones.get(name);
    const child = bones.get(childName);
    if (!bone || !child) continue;

    const boneWorld = new Vector3();
    const childWorld = new Vector3();
    bone.getWorldPosition(boneWorld);
    child.getWorldPosition(childWorld);

    const restDir = childWorld.clone().sub(boneWorld);
    if (restDir.lengthSq() < 1e-10) continue;
    restDir.normalize();

    const bindWorldQuat = new Quaternion();
    bone.getWorldQuaternion(bindWorldQuat);

    let restUp = null;
    if (name === "LeftHand" || name === "RightHand") {
      const side = name.startsWith("Left") ? "Left" : "Right";
      const index = bones.get(`${side}HandIndex1`);
      const pinky = bones.get(`${side}HandPinky1`);
      const middle = bones.get(`${side}HandMiddle1`);
      if (index && pinky && middle) {
        const at = (node) => {
          const v = new Vector3();
          node.getWorldPosition(v);
          return v;
        };
        const forward = at(middle).sub(boneWorld);
        const across = at(pinky).sub(at(index));
        const normal = new Vector3().crossVectors(forward, across);
        if (normal.lengthSq() > 1e-12) {
          restUp = normal
            .normalize()
            .applyQuaternion(bindWorldQuat.clone().invert());
        }
      }
    }

    rig.set(name, {
      bone,
      restDir,
      bindWorldQuat,
      restUp,
      restLocalQuat: bone.quaternion.clone(),
    });
  }
  return rig;
}

const rotation = new Quaternion();
const parentQuat = new Quaternion();
const targetWorld = new Quaternion();
const roll = new Quaternion();
const targetDir = new Vector3();
const bindUp = new Vector3();
const wantUp = new Vector3();

export function applyPose(rig, pose, weight = 1) {
  if (!rig) return;
  for (const [name, entry] of rig) {
    const direction = pose?.[name];
    if (!direction) {
      entry.bone.quaternion.slerp(entry.restLocalQuat, weight);
      continue;
    }
    targetDir.set(direction[0], direction[1], direction[2]);
    if (targetDir.lengthSq() < 1e-8) continue;
    targetDir.normalize();

    rotation.setFromUnitVectors(entry.restDir, targetDir);
    targetWorld.copy(rotation).multiply(entry.bindWorldQuat);

    const up = pose[`${name}_up`];
    if (up && entry.restUp) {
      bindUp.copy(entry.restUp).applyQuaternion(targetWorld);
      wantUp.set(up[0], up[1], up[2]);
      wantUp.addScaledVector(targetDir, -wantUp.dot(targetDir)).normalize();
      bindUp.addScaledVector(targetDir, -bindUp.dot(targetDir)).normalize();
      if (bindUp.lengthSq() > 1e-8 && wantUp.lengthSq() > 1e-8) {
        roll.setFromUnitVectors(bindUp, wantUp);
        targetWorld.premultiply(roll);
      }
    }

    if (entry.bone.parent) {
      entry.bone.parent.getWorldQuaternion(parentQuat);
      targetWorld.premultiply(parentQuat.invert());
    }
    entry.bone.quaternion.slerp(targetWorld, weight);
  }
}

export function restPose(rig, weight = 1) {
  if (!rig) return;
  for (const [, entry] of rig) {
    entry.bone.quaternion.slerp(entry.restLocalQuat, weight);
  }
}

export function frameAt(clip, seconds) {
  if (!clip?.bones) return null;
  const index = Math.min(
    clip.frameCount - 1,
    Math.max(0, Math.floor(seconds * clip.fps)),
  );
  const pose = {};
  for (const [bone, series] of Object.entries(clip.bones)) {
    pose[bone] = series[index];
  }
  return pose;
}
