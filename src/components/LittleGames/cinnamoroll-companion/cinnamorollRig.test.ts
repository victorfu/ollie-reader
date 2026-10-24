/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { beforeAll, describe, expect, it } from "vitest";
import { buildCinnamorollRig, type BuiltRig } from "./cinnamorollRig";

async function loadBundledModel(): Promise<GLTF> {
  const file = readFileSync(
    resolve(process.cwd(), "src/assets/games/cinnamoroll-companion/cinnamoroll.glb"),
  );
  // GLTFLoader checks `instanceof ArrayBuffer`; Node's Buffer memory comes
  // from another realm under jsdom, so copy into this realm's ArrayBuffer.
  const data = new ArrayBuffer(file.byteLength);
  new Uint8Array(data).set(file);
  return new Promise((resolve, reject) =>
    new GLTFLoader().parse(data, "", resolve, reject),
  );
}

const worldPosition = (object: THREE.Object3D) =>
  object.getWorldPosition(new THREE.Vector3());

function visibleBounds(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  root.traverseVisible((object) => {
    if ((object as THREE.Mesh).isMesh) box.expandByObject(object, true);
  });
  return box;
}

/** Mean of a mesh's vertices in world space. */
function centroid(mesh: THREE.Mesh): THREE.Vector3 {
  const position = mesh.geometry.attributes.position;
  const sum = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    sum.add(v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
  }
  return sum.divideScalar(position.count);
}

function meshesUsing(root: THREE.Object3D, materialName: string): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && (mesh.material as THREE.Material).name === materialName) {
      found.push(mesh);
    }
  });
  return found;
}

let built: BuiltRig;

beforeAll(async () => {
  const gltf = await loadBundledModel();
  built = buildCinnamorollRig(gltf.scene);
  built.root.updateMatrixWorld(true);
});

describe("buildCinnamorollRig", () => {
  it("turns the model to face the camera with the ears spread sideways", () => {
    const [eyes] = meshesUsing(built.root, "eyescin");
    const head = worldPosition(built.parts.head!);

    expect(centroid(eyes).z).toBeGreaterThan(head.z + 0.5);
    const box = visibleBounds(built.root);
    expect(box.max.x - box.min.x).toBeCloseTo(6.34, 1);
    expect(box.max.z - box.min.z).toBeLessThan(3);
  });

  it("stands the feet on the ground", () => {
    const box = visibleBounds(built.root);

    expect(box.min.y).toBeCloseTo(0, 3);
    expect(box.max.y).toBeCloseTo(2.56, 1);
    expect(built.bounds.height).toBeCloseTo(2.56, 1);
    expect(built.bounds.width).toBeCloseTo(6.34, 1);
  });

  it("shows only one copy of the doubled head shell", () => {
    const shells: THREE.Mesh[] = [];
    built.parts.head!.traverseVisible((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry.attributes.position.count === 1740) {
        shells.push(mesh);
      }
    });

    expect(shells).toHaveLength(1);
  });

  it("finds every part the animation moves", () => {
    const { parts } = built;

    // Turning the turntable turns the whole character, head included.
    expect(parts.turntable).toBe(built.root);
    expect(parts.body).not.toBeNull();
    expect(parts.head).not.toBeNull();
    expect(parts.tail).not.toBeNull();
    expect(parts.mouth).not.toBeNull();
    expect(parts.mouthOpen).not.toBeNull();
    expect(parts.cheekMaterial).not.toBeNull();
    expect(parts.eyesOpen.length).toBeGreaterThan(0);
    expect(parts.eyesClosed).toHaveLength(2);
    expect(parts.ears[0]).not.toBeNull();
    expect(parts.ears[1]).not.toBeNull();
  });

  it("hangs each ear from the head at its root, left then right", () => {
    const head = worldPosition(built.parts.head!);
    const [left, right] = built.parts.ears.map((ear) => worldPosition(ear!));

    for (const ear of built.parts.ears) {
      let ancestor = ear!.parent;
      while (ancestor && ancestor !== built.parts.head) ancestor = ancestor.parent;
      expect(ancestor).toBe(built.parts.head);
    }
    expect(left.x).toBeLessThan(-0.4);
    expect(right.x).toBeGreaterThan(0.4);
    expect(Math.abs(left.x)).toBeLessThan(1.3);
    expect(Math.abs(right.x)).toBeLessThan(1.3);
    expect(left.y).toBeGreaterThan(head.y);
  });

  it("lets a touch on the face count but not one on an ear bulb", () => {
    const hit = built.headHit;
    hit.updateMatrixWorld(true);
    const target = new THREE.Box3().setFromObject(hit, true);
    const [eyes] = meshesUsing(built.root, "eyescin");
    const [mouth] = meshesUsing(built.root, "mouth");
    const earTip = new THREE.Box3().setFromObject(built.parts.ears[1]!, true);

    expect(target.containsPoint(centroid(eyes))).toBe(true);
    expect(target.containsPoint(centroid(mouth))).toBe(true);
    expect(target.containsPoint(new THREE.Vector3(earTip.max.x - 0.3, earTip.getCenter(new THREE.Vector3()).y, 0))).toBe(false);
  });

  it("places a closed-eye arc on each eye", () => {
    const [eyes] = meshesUsing(built.root, "eyescin");
    const centre = centroid(eyes);
    const arcs = built.parts.eyesClosed.map((arc) => worldPosition(arc!));

    expect(arcs[0].x).toBeLessThan(centre.x);
    expect(arcs[1].x).toBeGreaterThan(centre.x);
    for (const arc of arcs) {
      expect(Math.abs(arc.y - centre.y)).toBeLessThan(0.12);
      expect(arc.z).toBeGreaterThan(centre.z - 0.05);
    }
  });
});
