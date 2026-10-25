import type * as THREE from "three";

/** Parts of the model the animation layer moves each frame. */
export type RigParts = {
  /** Spins the whole character when it is dragged around. */
  turntable: THREE.Object3D | null;
  body: THREE.Object3D | null;
  character: THREE.Object3D;
  hand: THREE.Object3D;
  /** Pivots at the neck. */
  head: THREE.Object3D | null;
  /** Pivot at each ear root: [left, right] as seen from the camera. */
  ears: [THREE.Object3D | null, THREE.Object3D | null];
  /** Squashed vertically to blink; offset slightly to look around. */
  eyesOpen: THREE.Object3D[];
  /** Happy "^" arcs shown while the eyes are closed. */
  eyesClosed: THREE.Mesh[];
  mouth: THREE.Object3D | null;
  mouthOpen: THREE.Mesh | null;
  /** Pivots where the tail meets the body. */
  tail: THREE.Object3D | null;
  cheekMaterial: THREE.MeshStandardMaterial | null;
};

/** World-space size of the posed model, used for camera framing. */
export type ModelBounds = { width: number; height: number; centerY: number };

/** How far the cloud base reaches below the feet, for camera framing. */
export const CLOUD_DEPTH = 0.45;
