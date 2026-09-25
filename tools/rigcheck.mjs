import { readFileSync } from "node:fs";
import { Bone, Object3D, Quaternion, Vector3 } from "three";
import { applyPose, buildRig, frameAt } from "../src/Component/model/signRig.js";

const [, , glbPath, motionPath, timeArg] = process.argv;

function readGlbJson(path) {
  const buf = readFileSync(path);
  const jsonLength = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + jsonLength).toString("utf8"));
}

function buildSkeleton(doc) {
  const joints = new Set(doc.skins?.[0]?.joints ?? []);
  const objects = doc.nodes.map((node, i) => {
    const obj = joints.has(i) ? new Bone() : new Object3D();
    obj.name = (node.name || "").replace(/[\[\]\.:\/]/g, "_");
    if (node.translation) obj.position.fromArray(node.translation);
    if (node.rotation) obj.quaternion.fromArray(node.rotation);
    if (node.scale) obj.scale.fromArray(node.scale);
    return obj;
  });
  const hasParent = new Set();
  doc.nodes.forEach((node, i) => {
    (node.children || []).forEach((c) => {
      objects[i].add(objects[c]);
      hasParent.add(c);
    });
  });
  const root = new Object3D();
  objects.forEach((obj, i) => {
    if (!hasParent.has(i)) root.add(obj);
  });
  root.updateMatrixWorld(true);
  return root;
}

function find(root, name) {
  let hit = null;
  root.traverse((n) => {
    if (!hit && n.isBone && n.name.replace(/^mixamorig[:_\-.]?/i, "") === name) hit = n;
  });
  return hit;
}

function worldPos(node) {
  const v = new Vector3();
  node.getWorldPosition(v);
  return v;
}

function angle(a, b) {
  return (Math.acos(Math.max(-1, Math.min(1, a.clone().normalize().dot(b.clone().normalize())))) * 180) / Math.PI;
}

const doc = readGlbJson(glbPath);
const root = buildSkeleton(doc);
const rig = buildRig(root);
const clip = JSON.parse(readFileSync(motionPath, "utf8"));
const pose = frameAt(clip, Number(timeArg));

console.log(`rig bones mapped: ${rig ? rig.size : 0}`);
for (const [name, entry] of rig) {
  if (name.endsWith("Hand")) {
    console.log(`  ${name} restUp: ${entry.restUp ? entry.restUp.toArray().map((n) => n.toFixed(2)) : "NULL"}`);
  }
}

for (let i = 0; i < 40; i += 1) {
  applyPose(rig, pose, 1);
  root.updateMatrixWorld(true);
}

const rows = [];
for (const side of ["Left", "Right"]) {
  for (const [bone, child] of [["Arm", "ForeArm"], ["ForeArm", "Hand"], ["Hand", "HandMiddle1"]]) {
    const name = `${side}${bone}`;
    const target = pose[name];
    const b = find(root, name);
    const c = find(root, `${side}${child}`);
    if (!target || !b || !c) continue;
    const got = worldPos(c).sub(worldPos(b));
    rows.push(`${name.padEnd(14)} direction error ${angle(got, new Vector3(...target)).toFixed(1).padStart(5)} deg`);
  }
  const hand = find(root, `${side}Hand`);
  const idx = find(root, `${side}HandIndex1`);
  const pnk = find(root, `${side}HandPinky1`);
  const mid = find(root, `${side}HandMiddle1`);
  const want = pose[`${side}Hand_up`];
  if (hand && idx && pnk && mid && want) {
    const fwd = worldPos(mid).sub(worldPos(hand));
    const across = worldPos(pnk).sub(worldPos(idx));
    const normal = new Vector3().crossVectors(fwd, across);
    rows.push(`${`${side}Hand_up`.padEnd(14)} palm normal error ${angle(normal, new Vector3(...want)).toFixed(1).padStart(5)} deg   got=${normal.normalize().toArray().map((n) => n.toFixed(2))} want=${want.map((n) => n.toFixed(2))}`);
  }
}
rows.forEach((r) => console.log("  " + r));
