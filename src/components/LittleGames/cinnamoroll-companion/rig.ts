import type * as THREE from "three";

/** Neck pivot height in model space. */
export const HEAD_PIVOT_Y = 1.06;

/** World-space bounds used for camera framing (ears included). */
export const MODEL_BOUNDS = { width: 6.5, height: 3.4, centerY: 1.3 };

/** Parts of the model the animation layer moves each frame. */
export type RigParts = {
  body: THREE.Group | null;
  head: THREE.Group | null;
  ears: [THREE.Group | null, THREE.Group | null];
  eyesOpen: [THREE.Group | null, THREE.Group | null];
  eyesClosed: [THREE.Mesh | null, THREE.Mesh | null];
  mouth: THREE.Group | null;
  mouthOpen: THREE.Mesh | null;
  tail: THREE.Group | null;
  cheekMaterial: THREE.MeshStandardMaterial | null;
};
