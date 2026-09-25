import { Bone, Vector3 } from "three";
import { applyPose, buildRig } from "./signRig.js";

function chain(sep = ":") {
  const root = new Bone();
  root.name = `mixamorig${sep}Hips`;

  const arm = new Bone();
  arm.name = `mixamorig${sep}LeftArm`;
  arm.position.set(0, 0, 0);

  const fore = new Bone();
  fore.name = `mixamorig${sep}LeftForeArm`;
  fore.position.set(0, -1, 0);

  const hand = new Bone();
  hand.name = `mixamorig${sep}LeftHand`;
  hand.position.set(0, -1, 0);

  const mid = new Bone();
  mid.name = `mixamorig${sep}LeftHandMiddle1`;
  mid.position.set(0, -0.2, 0);

  hand.add(mid);
  fore.add(hand);
  arm.add(fore);
  root.add(arm);
  root.updateMatrixWorld(true);
  return { root, arm, fore, hand };
}

function worldDir(from, to) {
  const a = new Vector3();
  const b = new Vector3();
  from.getWorldPosition(a);
  to.getWorldPosition(b);
  return b.sub(a).normalize();
}

function check(label, got, want, tol = 1e-3) {
  const delta = got.distanceTo(want);
  const ok = delta < tol;
  console.log(
    `${ok ? "pass" : "FAIL"}  ${label.padEnd(34)} got=[${got.toArray().map((n) => n.toFixed(3))}] want=[${want.toArray().map((n) => n.toFixed(3))}] d=${delta.toFixed(4)}`,
  );
  return ok;
}

let failures = 0;

{
  const { root, arm, fore } = chain();
  const rig = buildRig(root);
  console.log(`rig bones: ${[...rig.keys()].join(", ")}`);
  if (!rig.has("LeftArm")) {
    console.log("FAIL  rig did not map LeftArm");
    failures += 1;
  }
  const rest = rig.get("LeftArm").restDir.clone();
  if (!check("bind direction is -Y", rest, new Vector3(0, -1, 0))) failures += 1;

  applyPose(rig, { LeftArm: [1, 0, 0] }, 1);
  root.updateMatrixWorld(true);
  if (!check("LeftArm -> +X", worldDir(arm, fore), new Vector3(1, 0, 0))) failures += 1;
}

{
  const { root, arm, fore } = chain();
  const rig = buildRig(root);
  applyPose(rig, { LeftArm: [0, 1, 0] }, 1);
  root.updateMatrixWorld(true);
  if (!check("LeftArm -> +Y (raised)", worldDir(arm, fore), new Vector3(0, 1, 0))) failures += 1;
}

{
  const { root, arm, fore, hand } = chain();
  const rig = buildRig(root);
  applyPose(rig, { LeftArm: [1, 0, 0], LeftForeArm: [0, 1, 0] }, 1);
  root.updateMatrixWorld(true);
  const armOk = check("chained: arm -> +X", worldDir(arm, fore), new Vector3(1, 0, 0));
  const foreOk = check("chained: forearm -> +Y", worldDir(fore, hand), new Vector3(0, 1, 0));
  if (!armOk) failures += 1;
  if (!foreOk) failures += 1;
}

for (const sep of ["_", "", "-", "."]) {
  const { root, arm, fore } = chain(sep);
  const rig = buildRig(root);
  const mapped = rig ? rig.size : 0;
  const ok = Boolean(rig && rig.has("LeftArm"));
  console.log(`${ok ? "pass" : "FAIL"}  name separator '${sep}' -> mapped=${mapped}`);
  if (!ok) {
    failures += 1;
    continue;
  }
  applyPose(rig, { LeftArm: [0, 1, 0] }, 1);
  root.updateMatrixWorld(true);
  if (!check(`  '${sep}' arm -> +Y`, worldDir(arm, fore), new Vector3(0, 1, 0))) {
    failures += 1;
  }
}

console.log(failures ? `\n${failures} failure(s)` : "\nall passed");
process.exit(failures ? 1 : 0);
