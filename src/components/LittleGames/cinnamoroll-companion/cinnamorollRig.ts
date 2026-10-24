import * as THREE from "three";
import type { ModelBounds, RigParts } from "./rig";

/**
 * Turns the bundled Cinnamoroll glTF (separate meshes, no skeleton) into the
 * rig the animation layer drives: it faces the model toward +z, stands it on
 * y = 0, and re-parents the parts under pivots at the neck, ear roots, eyes,
 * mouth and tail so they can move independently.
 *
 * Parts are found by material name (eyes, mouth, cheeks) and by where the
 * white meshes sit relative to the head, not by node names, which in the
 * source file are not readable.
 */

const EYE_MATERIAL = "eyescin";
const MOUTH_MATERIAL = "mouth";
const CHEEK_MATERIAL = "PINK";

/** Share of an ear's or tail's vertices nearest the body used as its root. */
const ROOT_SHARE = 0.15;

export type BuiltRig = {
  root: THREE.Group;
  parts: RigParts;
  /** Invisible target that follows the head; raycast for petting. */
  headHit: THREE.Mesh;
  bounds: ModelBounds;
  /** Frees the geometry and materials the rig created or cloned. */
  dispose: () => void;
};

type Part = { mesh: THREE.Mesh; box: THREE.Box3; center: THREE.Vector3 };

function worldVertices(mesh: THREE.Mesh): THREE.Vector3[] {
  const position = mesh.geometry.attributes.position;
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < position.count; i += 1) {
    out.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
  }
  return out;
}

function mean(points: THREE.Vector3[]): THREE.Vector3 {
  const sum = new THREE.Vector3();
  points.forEach((p) => sum.add(p));
  return sum.divideScalar(Math.max(points.length, 1));
}

/** Mean of the share of points that score lowest. */
function meanOfLowest(
  points: THREE.Vector3[],
  score: (p: THREE.Vector3) => number,
): THREE.Vector3 {
  const sorted = [...points].sort((a, b) => score(a) - score(b));
  return mean(sorted.slice(0, Math.max(1, Math.round(sorted.length * ROOT_SHARE))));
}

function materialName(mesh: THREE.Mesh): string {
  return (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name;
}

function measure(mesh: THREE.Mesh): Part {
  const box = new THREE.Box3().setFromObject(mesh, true);
  return { mesh, box, center: box.getCenter(new THREE.Vector3()) };
}

function sameShape(a: Part, b: Part): boolean {
  return (
    a.box.min.distanceTo(b.box.min) < 1e-3 && a.box.max.distanceTo(b.box.max) < 1e-3
  );
}

/** Adds an empty pivot at a root-space point. */
function pivotAt(parent: THREE.Object3D, point: THREE.Vector3): THREE.Group {
  const pivot = new THREE.Group();
  parent.add(pivot);
  pivot.updateWorldMatrix(true, false);
  pivot.position.copy(parent.worldToLocal(point.clone()));
  pivot.updateMatrixWorld(true);
  return pivot;
}

function found<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Cinnamoroll model is missing its ${what}.`);
  return value;
}

export function buildCinnamorollRig(scene: THREE.Object3D): BuiltRig {
  const createdGeometries: THREE.BufferGeometry[] = [];
  const createdMaterials: THREE.Material[] = [];

  const root = new THREE.Group();
  const orient = new THREE.Group();
  root.add(orient);
  orient.add(scene);
  root.updateMatrixWorld(true);

  const meshes: THREE.Mesh[] = [];
  scene.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh);
  });
  const byMaterial = (name: string) => meshes.filter((m) => materialName(m) === name);
  const eyes = found(byMaterial(EYE_MATERIAL)[0], "eyes");

  // Face the eyes toward the camera (+z).
  const white = meshes
    .filter((m) => ![EYE_MATERIAL, MOUTH_MATERIAL, CHEEK_MATERIAL].includes(materialName(m)))
    .map(measure);
  const eyeCenter = mean(worldVertices(eyes));
  const headShell = found(
    white.find((part) => part.box.containsPoint(eyeCenter)),
    "head",
  );
  const forward = eyeCenter.clone().sub(headShell.center).setY(0).normalize();
  orient.rotation.y = -Math.atan2(forward.x, forward.z);
  root.updateMatrixWorld(true);

  // Stand on the ground, centred under the head.
  const all = new THREE.Box3();
  meshes.forEach((m) => all.expandByObject(m, true));
  const headCenter = new THREE.Box3().setFromObject(headShell.mesh, true).getCenter(new THREE.Vector3());
  orient.position.set(-headCenter.x, -all.min.y, -headCenter.z);
  root.updateMatrixWorld(true);

  // Re-measure every white part in the final pose and sort out its role.
  const parts = white.map((part) => measure(part.mesh));
  const head = parts.find((part) => part.mesh === headShell.mesh)!;
  const duplicates = parts.filter((part) => part !== head && sameShape(part, head));
  duplicates.forEach((part) => {
    // A second, identical shell would z-fight with the first.
    part.mesh.visible = false;
  });
  let rest = parts.filter((part) => part !== head && !duplicates.includes(part));
  const ears = [...rest].sort((a, b) => Math.abs(b.center.x) - Math.abs(a.center.x)).slice(0, 2);
  const [leftEar, rightEar] = ears.sort((a, b) => a.center.x - b.center.x);
  rest = rest.filter((part) => !ears.includes(part));
  const tail = found([...rest].sort((a, b) => a.center.z - b.center.z)[0], "tail");
  rest = rest.filter((part) => part !== tail);
  const volume = (part: Part) => {
    const size = part.box.getSize(new THREE.Vector3());
    return size.x * size.y * size.z;
  };
  const body = found([...rest].sort((a, b) => volume(b) - volume(a))[0], "body");
  const paws = rest.filter((part) => part !== body);
  if (!leftEar || !rightEar) throw new Error("Cinnamoroll model is missing an ear.");

  // Brighten the white fur slightly so it reads as white under soft light,
  // and give the cheeks their own material so blush can fade in and out.
  const cloned = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  const cloneMaterial = (mesh: THREE.Mesh) => {
    const source = mesh.material as THREE.MeshStandardMaterial;
    let copy = cloned.get(source);
    if (!copy) {
      copy = source.clone();
      cloned.set(source, copy);
      createdMaterials.push(copy);
    }
    mesh.material = copy;
    return copy;
  };
  parts.forEach((part) => {
    const fur = cloneMaterial(part.mesh);
    fur.emissive.set("#eef2fb");
    fur.emissiveIntensity = 0.12;
  });
  const cheeks = byMaterial(CHEEK_MATERIAL);
  const cheekMaterial = cheeks.length > 0 ? cloneMaterial(cheeks[0]) : null;
  cheeks.forEach((mesh) => {
    mesh.material = cheekMaterial!;
  });
  if (cheekMaterial) {
    cheekMaterial.transparent = true;
    cheekMaterial.depthWrite = false;
  }

  // Body group, with the feet at its origin so breathing grows upward.
  const bodyGroup = pivotAt(root, new THREE.Vector3());
  bodyGroup.attach(body.mesh);
  paws.forEach((paw) => bodyGroup.attach(paw.mesh));
  const tailVertices = worldVertices(tail.mesh);
  const tailRoot = meanOfLowest(tailVertices, (p) => Math.hypot(p.x, p.z));
  const tailPivot = pivotAt(bodyGroup, tailRoot);
  tailPivot.attach(tail.mesh);

  // Head pivot at the neck.
  const neck = new THREE.Vector3(0, head.box.min.y, 0);
  const headPivot = pivotAt(root, neck);
  headPivot.attach(head.mesh);
  duplicates.forEach((part) => headPivot.attach(part.mesh));
  cheeks.forEach((mesh) => headPivot.attach(mesh));

  const earPivots = [leftEar, rightEar].map((ear) => {
    const rootPoint = meanOfLowest(worldVertices(ear.mesh), (p) => Math.abs(p.x));
    const pivot = pivotAt(headPivot, rootPoint);
    pivot.attach(ear.mesh);
    return pivot;
  });

  // Eyes: one mesh for both, squashed around their shared centre to blink.
  const eyeVertices = worldVertices(eyes);
  const eyesCenter = mean(eyeVertices);
  const eyesAnchor = pivotAt(headPivot, eyesCenter);
  const eyesOpen = pivotAt(eyesAnchor, eyesCenter);
  eyesOpen.attach(eyes);

  // Closed-eye arcs over each eye, laid onto the face.
  const eyeMaterial = eyes.material as THREE.MeshStandardMaterial;
  const arcMaterial = new THREE.MeshStandardMaterial({
    color: eyeMaterial.color.clone(),
    roughness: 0.45,
  });
  createdMaterials.push(arcMaterial);
  const eyeNormals = eyes.geometry.attributes.normal;
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(eyes.matrixWorld);
  const eyesClosed = [-1, 1].map((side) => {
    const indices = eyeVertices
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => (p.x - eyesCenter.x) * side > 0);
    const points = indices.map(({ p }) => p);
    const box = new THREE.Box3().setFromPoints(points);
    const size = box.getSize(new THREE.Vector3());
    const normal = new THREE.Vector3();
    indices.forEach(({ i }) => {
      normal.add(new THREE.Vector3().fromBufferAttribute(eyeNormals, i).applyMatrix3(normalMatrix));
    });
    normal.normalize();
    if (normal.z < 0) normal.negate();
    const center = mean(points);
    const radius = Math.max(size.x, 0.05) * 0.55;
    const geometry = new THREE.TorusGeometry(radius, radius * 0.22, 8, 24, Math.PI);
    createdGeometries.push(geometry);
    const arc = new THREE.Mesh(geometry, arcMaterial);
    const anchor = pivotAt(headPivot, center.clone().addScaledVector(normal, size.z * 0.5 + 0.01));
    anchor.quaternion.premultiply(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal),
    );
    anchor.add(arc);
    arc.scale.setScalar(0);
    arc.visible = false;
    return arc;
  });

  // Mouth, plus a small open mouth shown under it when smiling widely.
  const mouthMesh = found(byMaterial(MOUTH_MATERIAL)[0], "mouth");
  const mouthBox = new THREE.Box3().setFromObject(mouthMesh, true);
  const mouthCenter = mouthBox.getCenter(new THREE.Vector3());
  const mouthAnchor = pivotAt(headPivot, mouthCenter);
  const mouth = pivotAt(mouthAnchor, mouthCenter);
  mouth.attach(mouthMesh);
  const mouthWidth = mouthBox.getSize(new THREE.Vector3()).x;
  const openGeometry = new THREE.CircleGeometry(mouthWidth * 0.22, 24, Math.PI, Math.PI);
  const openMaterial = new THREE.MeshStandardMaterial({
    color: "#f48aa8",
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  createdGeometries.push(openGeometry);
  createdMaterials.push(openMaterial);
  const mouthOpen = new THREE.Mesh(openGeometry, openMaterial);
  mouthOpen.position.set(0, -mouthBox.getSize(new THREE.Vector3()).y * 0.3, 0.004);
  mouthOpen.scale.set(1, 0, 1);
  mouth.add(mouthOpen);

  // Petting target: the head shell's box, slightly padded.
  const headSize = head.box.getSize(new THREE.Vector3());
  const hitGeometry = new THREE.SphereGeometry(1, 20, 14);
  createdGeometries.push(hitGeometry);
  const headHit = new THREE.Mesh(hitGeometry);
  headHit.visible = false;
  const hitAnchor = pivotAt(headPivot, head.box.getCenter(new THREE.Vector3()));
  hitAnchor.add(headHit);
  headHit.scale.set(headSize.x * 0.55, headSize.y * 0.6, headSize.z * 0.55);

  root.updateMatrixWorld(true);
  const visible = new THREE.Box3();
  root.traverseVisible((object) => {
    if ((object as THREE.Mesh).isMesh) visible.expandByObject(object, true);
  });
  const size = visible.getSize(new THREE.Vector3());
  const centerY = visible.getCenter(new THREE.Vector3()).y;

  // Turn about the middle of the character, not its feet.
  const stage = new THREE.Group();
  stage.position.y = centerY;
  root.position.y = -centerY;
  stage.add(root);
  stage.updateMatrixWorld(true);

  return {
    root: stage,
    parts: {
      turntable: stage,
      body: bodyGroup,
      head: headPivot,
      ears: [earPivots[0], earPivots[1]],
      eyesOpen: [eyesOpen],
      eyesClosed,
      mouth,
      mouthOpen,
      tail: tailPivot,
      cheekMaterial,
    },
    headHit,
    bounds: { width: size.x, height: size.y, centerY },
    dispose: () => {
      createdGeometries.forEach((g) => g.dispose());
      createdMaterials.forEach((m) => m.dispose());
    },
  };
}
