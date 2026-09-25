import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SRGBColorSpace,
  SphereGeometry,
  Vector3,
} from "three";

const PREFIX = /^mixamorig[:_\-.]?/i;
const LID_SPAN = Math.PI * 0.72;
const LID_SCALE = 1.2;
const SCLERA_REACH = 0.0215;
const LID_BANDS = [
  [0.0, [95, 60, 50]],
  [0.18, [113, 74, 63]],
  [0.8, [116, 77, 66]],
  [0.93, [105, 67, 57]],
  [0.965, [58, 40, 37]],
  [1.0, [40, 28, 26]],
];

function lidColour(t) {
  for (let i = 1; i < LID_BANDS.length; i += 1) {
    const [end, to] = LID_BANDS[i];
    const [start, from] = LID_BANDS[i - 1];
    if (t <= end) {
      const k = (t - start) / (end - start);
      return from.map((c, j) => c + (to[j] - c) * k);
    }
  }
  return LID_BANDS[LID_BANDS.length - 1][1];
}
export const LID_OPEN = 1.35;

function isEyeVertex(pos, uv, i) {
  const x = pos.getX(i);
  const y = pos.getY(i);
  const z = pos.getZ(i);
  const u = uv.getX(i);
  const v = uv.getY(i);
  return (
    y > 1.6 && y < 1.71 && z > 0.06 && Math.abs(x) < 0.07 &&
    u > 0.4 && u < 0.51 && v < 0.17
  );
}

function solve4(A, b) {
  const m = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 4; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < 4; r += 1) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < 4; r += 1) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      for (let k = col; k <= 4; k += 1) m[r][k] -= f * m[col][k];
    }
  }
  return m.map((row, i) => row[4] / row[i]);
}

function fitSphere(points) {
  const A = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  const b = [0, 0, 0, 0];
  for (const p of points) {
    const row = [2 * p.x, 2 * p.y, 2 * p.z, 1];
    const rhs = p.lengthSq();
    for (let i = 0; i < 4; i += 1) {
      b[i] += row[i] * rhs;
      for (let j = 0; j < 4; j += 1) A[i][j] += row[i] * row[j];
    }
  }
  const s = solve4(A, b);
  const center = new Vector3(s[0], s[1], s[2]);
  return { center, radius: Math.sqrt(s[3] + center.lengthSq()) };
}

const lidMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });

function makeLid(radius) {
  const size = radius * LID_SCALE;
  const geometry = new SphereGeometry(size, 32, 28, 0, Math.PI, 0, LID_SPAN);
  const position = geometry.attributes.position;
  const colours = new Float32Array(position.count * 3);
  const colour = new Color();
  for (let i = 0; i < position.count; i += 1) {
    const polar = Math.acos(Math.max(-1, Math.min(1, position.getY(i) / size)));
    const [r, g, b] = lidColour(polar / LID_SPAN);
    colour.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
    colours.set([colour.r, colour.g, colour.b], i * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(colours, 3));
  const lid = new Mesh(geometry, lidMaterial);
  lid.visible = false;
  lid.rotation.x = -LID_OPEN;
  return lid;
}

export function buildEyes(scene) {
  if (scene.userData.voiceEyeEyes !== undefined) return scene.userData.voiceEyeEyes;
  scene.userData.voiceEyeEyes = null;

  let best = null;
  scene.traverse((node) => {
    if (!node.isSkinnedMesh || !node.geometry.index) return;
    const { position, uv } = node.geometry.attributes;
    if (!position || !uv) return;
    let count = 0;
    for (let i = 0; i < position.count; i += 1) if (isEyeVertex(position, uv, i)) count += 1;
    if (count > 50 && (!best || count > best.count)) best = { mesh: node, count };
  });
  if (!best) return null;

  const body = best.mesh;
  const geometry = body.geometry;
  const { position, uv } = geometry.attributes;
  const bones = body.skeleton.bones;
  const headIndex = bones.findIndex((b) => b.name.replace(PREFIX, "") === "Head");
  if (headIndex < 0) return null;
  const head = bones[headIndex];
  const toHead = new Matrix4().multiplyMatrices(
    body.skeleton.boneInverses[headIndex],
    body.bindMatrix,
  );

  const index = geometry.index.array;
  const keep = [];
  const sides = { Left: [], Right: [] };
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t];
    const b = index[t + 1];
    const c = index[t + 2];
    if (isEyeVertex(position, uv, a) && isEyeVertex(position, uv, b) && isEyeVertex(position, uv, c)) {
      (position.getX(a) > 0 ? sides.Left : sides.Right).push(a, b, c);
    } else {
      keep.push(a, b, c);
    }
  }
  if (!sides.Left.length || !sides.Right.length) return null;

  const meshUp = new Vector3(0, 1, 0).transformDirection(toHead);
  const eyes = {};
  for (const [side, triangles] of Object.entries(sides)) {
    const used = [...new Set(triangles)];
    const remap = new Map(used.map((v, i) => [v, i]));
    const local = used.map((v) =>
      new Vector3(position.getX(v), position.getY(v), position.getZ(v)).applyMatrix4(toHead),
    );
    const { center, radius } = fitSphere(local);
    const centroid = local.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(local.length);
    const gaze = centroid.clone().sub(center).normalize();
    const up = meshUp.clone().addScaledVector(gaze, -meshUp.dot(gaze)).normalize();
    const right = new Vector3().crossVectors(up, gaze).normalize();

    let uvCenterU = 0;
    let uvCenterV = 0;
    used.forEach((v) => {
      uvCenterU += uv.getX(v);
      uvCenterV += uv.getY(v);
    });
    uvCenterU /= used.length;
    uvCenterV /= used.length;

    const positions = new Float32Array(used.length * 3);
    const normals = new Float32Array(used.length * 3);
    const uvs = new Float32Array(used.length * 2);
    used.forEach((v, i) => {
      const p = local[i].clone().sub(center);
      const n = p.clone().normalize();
      positions.set([p.x, p.y, p.z], i * 3);
      normals.set([n.x, n.y, n.z], i * 3);
      let du = uv.getX(v) - uvCenterU;
      let dv = uv.getY(v) - uvCenterV;
      const reach = Math.hypot(du, dv);
      if (reach > SCLERA_REACH) {
        du *= SCLERA_REACH / reach;
        dv *= SCLERA_REACH / reach;
      }
      uvs.set([uvCenterU + du, uvCenterV + dv], i * 2);
    });
    const eyeGeometry = new BufferGeometry();
    eyeGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    eyeGeometry.setAttribute("normal", new BufferAttribute(normals, 3));
    eyeGeometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    eyeGeometry.setIndex(triangles.map((v) => remap.get(v)));

    const eyeball = new Mesh(eyeGeometry, body.material);
    eyeball.position.copy(center);
    head.add(eyeball);

    const pivot = new Object3D();
    pivot.position.copy(center);
    pivot.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(right, up, gaze));
    const lid = makeLid(radius);
    pivot.add(lid);
    head.add(pivot);

    eyes[side] = { eyeball, lid, up, right, radius };
  }

  geometry.setIndex(keep);
  scene.userData.voiceEyeEyes = eyes;
  return eyes;
}

const yawTurn = new Quaternion();
const pitchTurn = new Quaternion();

export function aimEyes(eyes, yaw, pitch, closed) {
  if (!eyes) return;
  const angle = -LID_OPEN * (1 - closed);
  for (const eye of Object.values(eyes)) {
    yawTurn.setFromAxisAngle(eye.up, yaw);
    pitchTurn.setFromAxisAngle(eye.right, pitch);
    eye.eyeball.quaternion.copy(yawTurn).multiply(pitchTurn);
    eye.lid.rotation.x = angle;
    eye.lid.visible = closed > 0.02;
  }
}
