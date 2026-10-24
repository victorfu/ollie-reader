import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { CompanionRuntime } from "./logic/companionRuntime";
import { HEAD_PIVOT_Y, type RigParts } from "./rig";
import { useCompanionAnimation } from "./useCompanionAnimation";

/**
 * Procedural stand-in for the final Cinnamoroll GLB: same rig (head, ears,
 * eyes, mouth, tail) so the interaction and animation code can be built and
 * tuned now and keep working when the real model replaces the geometry.
 *
 * Proportions follow the official look: a wide bun-shaped head, very long
 * paddle ears growing sideways from the top of the head, sky-blue oval eyes,
 * a blue "ω" mouth, a small chubby body and a cinnamon-roll tail.
 */

/** Head ellipsoid in head-group space. */
const HEAD_CENTER_Y = 0.86;
const HEAD_SEMI_AXES = new THREE.Vector3(1.32, 0.92, 1);
const HEAD_PIVOT = new THREE.Vector3(0, HEAD_PIVOT_Y, 0.05);

const EAR_LENGTH = 2.75;
/** Half-height at the widest point, and half-thickness. */
const EAR_HALF_HEIGHT = 0.4;
const EAR_HALF_THICKNESS = 0.14;
/** Fraction of the length where the ear is widest; the tip end stays round. */
const EAR_WIDEST_AT = 0.66;

function emptyRig(): RigParts {
  return {
    body: null,
    head: null,
    ears: [null, null],
    eyesOpen: [null, null],
    eyesClosed: [null, null],
    mouth: null,
    mouthOpen: null,
    tail: null,
    cheekMaterial: null,
  };
}

/** A point on the face, with the rotation that lays a feature flat on it. */
function onFace(x: number, yOffset: number, lift = 0) {
  const { x: ax, y: ay, z: az } = HEAD_SEMI_AXES;
  const rz = Math.sqrt(Math.max(0, 1 - (x / ax) ** 2 - (yOffset / ay) ** 2));
  const normal = new THREE.Vector3(
    x / ax ** 2,
    yOffset / ay ** 2,
    (rz * az) / az ** 2,
  ).normalize();
  const position = new THREE.Vector3(x, HEAD_CENTER_Y + yOffset, rz * az)
    .addScaledVector(normal, lift);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    normal,
  );
  return { position, quaternion };
}

/**
 * A long, flat ear growing along +x from its root at the origin: narrow at
 * the root, widest two-thirds out, a round tip, curving down and slightly
 * back. Built by reshaping a sphere so it stays smooth and well lit.
 */
function createEarGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(1, 72, 36);
  const position = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    const u = (v.x + 1) / 2;
    const ring = Math.sqrt(Math.max(0, 1 - v.x * v.x));
    const span = u < EAR_WIDEST_AT ? EAR_WIDEST_AT : 1 - EAR_WIDEST_AT;
    const profile = Math.sqrt(
      Math.max(0, 1 - ((u - EAR_WIDEST_AT) / span) ** 2),
    );
    const dirY = ring > 1e-6 ? v.y / ring : 0;
    const dirZ = ring > 1e-6 ? v.z / ring : 0;
    position.setXYZ(
      i,
      u * EAR_LENGTH,
      dirY * profile * EAR_HALF_HEIGHT - 0.36 * u * u,
      dirZ * profile * EAR_HALF_THICKNESS - 0.3 * u * u,
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** "ω": two small dips meeting in a point. */
class OmegaCurve extends THREE.Curve<THREE.Vector3> {
  private readonly radius: number;

  constructor(radius: number) {
    super();
    this.radius = radius;
  }

  getPoint(t: number, target = new THREE.Vector3()) {
    const r = this.radius;
    const side = t < 0.5 ? -1 : 1;
    const local = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    const angle = Math.PI + local * Math.PI;
    return target.set(side * r + Math.cos(angle) * r, Math.sin(angle) * r * 0.9, 0);
  }
}

/** Cinnamon-roll curl, wound from the inside out. */
class TailCurve extends THREE.Curve<THREE.Vector3> {
  constructor() {
    super();
  }

  getPoint(t: number, target = new THREE.Vector3()) {
    const angle = t * Math.PI * 2 * 1.55;
    const radius = 0.05 + 0.27 * t;
    return target.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.08 * t);
  }
}

function useModelResources() {
  const resources = useMemo(() => {
    const geometries = {
      sphere: new THREE.SphereGeometry(1, 48, 32),
      smallSphere: new THREE.SphereGeometry(1, 20, 14),
      ear: createEarGeometry(),
      tail: new THREE.TubeGeometry(new TailCurve(), 96, 0.105, 16, false),
      // Upper half ring: the happy "^" of closed eyes.
      eyeArc: new THREE.TorusGeometry(0.085, 0.019, 8, 24, Math.PI),
      mouthLine: new THREE.TubeGeometry(new OmegaCurve(0.06), 48, 0.015, 8, false),
      mouthOpen: new THREE.CircleGeometry(0.085, 24, Math.PI, Math.PI),
    };
    const materials = {
      fur: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: "#eef2fb",
        emissiveIntensity: 0.16,
        roughness: 0.78,
      }),
      eye: new THREE.MeshStandardMaterial({ color: "#45a6ee", roughness: 0.25 }),
      eyeShine: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      line: new THREE.MeshStandardMaterial({ color: "#3a8fd6", roughness: 0.45 }),
      mouthOpen: new THREE.MeshStandardMaterial({
        color: "#f48aa8",
        roughness: 0.6,
        side: THREE.DoubleSide,
      }),
      cheek: new THREE.MeshStandardMaterial({
        color: "#fbb3cc",
        roughness: 0.9,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
      cloud: new THREE.MeshStandardMaterial({
        color: "#f7fbff",
        emissive: "#dcecff",
        emissiveIntensity: 0.3,
        roughness: 1,
      }),
    };
    return { geometries, materials };
  }, []);

  useEffect(
    () => () => {
      Object.values(resources.geometries).forEach((g) => g.dispose());
      Object.values(resources.materials).forEach((m) => m.dispose());
    },
    [resources],
  );

  return resources;
}

const CLOUD_PUFFS: ReadonlyArray<[number, number, number, number, number]> = [
  // x, y, z, radius, vertical squash
  [0, -0.14, 0, 0.95, 0.36],
  [-0.85, -0.14, 0.1, 0.48, 0.5],
  [0.85, -0.14, 0.06, 0.5, 0.5],
  [-0.42, -0.08, 0.45, 0.42, 0.5],
  [0.45, -0.07, 0.45, 0.4, 0.5],
  [-0.4, -0.1, -0.42, 0.46, 0.5],
  [0.45, -0.1, -0.42, 0.46, 0.5],
];

type CinnamorollModelProps = {
  runtime: CompanionRuntime;
  headHitRef: RefObject<THREE.Mesh | null>;
  reducedMotion: boolean;
};

export function CinnamorollModel({
  runtime,
  headHitRef,
  reducedMotion,
}: CinnamorollModelProps) {
  const rig = useRef<RigParts>(emptyRig());
  const { geometries: g, materials: m } = useModelResources();
  useCompanionAnimation(rig, runtime, reducedMotion);
  useEffect(() => {
    rig.current.cheekMaterial = m.cheek;
  }, [m]);

  const face = useMemo(
    () => ({
      eyes: [onFace(-0.5, -0.06, 0.02), onFace(0.5, -0.06, 0.02)],
      cheeks: [onFace(-0.82, -0.27, 0.005), onFace(0.82, -0.27, 0.005)],
      mouth: onFace(0, -0.2, 0.012),
    }),
    [],
  );

  return (
    <group>
      {CLOUD_PUFFS.map(([x, y, z, r, squash]) => (
        <mesh
          key={`${x}:${z}`}
          geometry={g.sphere}
          material={m.cloud}
          position={[x, y, z]}
          scale={[r, r * squash, r]}
        />
      ))}

      <group ref={(node) => { rig.current.body = node; }}>
        <mesh geometry={g.sphere} material={m.fur} position={[0, 0.55, 0]} scale={[0.6, 0.6, 0.55]} />
        {/* Paws held up in front of the chest. */}
        {[-1, 1].map((side) => (
          <mesh
            key={`arm${side}`}
            geometry={g.smallSphere}
            material={m.fur}
            position={[side * 0.34, 0.8, 0.4]}
            rotation={[0.5, 0, side * -0.55]}
            scale={[0.14, 0.21, 0.14]}
          />
        ))}
        {[-1, 1].map((side) => (
          <mesh
            key={`foot${side}`}
            geometry={g.smallSphere}
            material={m.fur}
            position={[side * 0.26, 0.08, 0.24]}
            scale={[0.17, 0.12, 0.2]}
          />
        ))}
        <group
          ref={(node) => { rig.current.tail = node; }}
          position={[0.62, 0.42, -0.08]}
          rotation={[0, -0.3, 0]}
        >
          <mesh geometry={g.tail} material={m.fur} />
          {/* Round off the open end in the middle of the curl. */}
          <mesh
            geometry={g.smallSphere}
            material={m.fur}
            position={[0.05, 0, 0]}
            scale={0.105}
          />
        </group>
      </group>

      <group
        ref={(node) => { rig.current.head = node; }}
        position={HEAD_PIVOT}
      >
        <mesh
          geometry={g.sphere}
          material={m.fur}
          position={[0, HEAD_CENTER_Y, 0]}
          scale={HEAD_SEMI_AXES}
        />
        {/* Invisible, slightly padded head target; ears and body stay out. */}
        <mesh
          ref={headHitRef}
          geometry={g.smallSphere}
          position={[0, HEAD_CENTER_Y, 0]}
          scale={[1.37, 0.96, 1.04]}
          visible={false}
        />

        {[-1, 1].map((side, index) => (
          <group
            key={`ear${side}`}
            ref={(node) => { rig.current.ears[index] = node; }}
            position={[side * 0.52, HEAD_CENTER_Y + 0.78, -0.12]}
          >
            <mesh geometry={g.ear} material={m.fur} scale={[side, 1, 1]} />
          </group>
        ))}

        {face.eyes.map(({ position, quaternion }, index) => (
          <group key={`eye${index}`} position={position} quaternion={quaternion}>
            <group ref={(node) => { rig.current.eyesOpen[index] = node; }}>
              <mesh geometry={g.smallSphere} material={m.eye} scale={[0.11, 0.16, 0.04]} />
              <mesh
                geometry={g.smallSphere}
                material={m.eyeShine}
                position={[0.025, 0.065, 0.03]}
                scale={[0.03, 0.036, 0.02]}
              />
            </group>
            <mesh
              ref={(node) => { rig.current.eyesClosed[index] = node; }}
              geometry={g.eyeArc}
              material={m.line}
              scale={0}
            />
          </group>
        ))}

        {face.cheeks.map(({ position, quaternion }, index) => (
          <mesh
            key={`cheek${index}`}
            geometry={g.smallSphere}
            material={m.cheek}
            position={position}
            quaternion={quaternion}
            scale={[0.17, 0.1, 0.02]}
          />
        ))}

        <group position={face.mouth.position} quaternion={face.mouth.quaternion}>
          <group ref={(node) => { rig.current.mouth = node; }}>
            <mesh geometry={g.mouthLine} material={m.line} />
            <mesh
              ref={(node) => { rig.current.mouthOpen = node; }}
              geometry={g.mouthOpen}
              material={m.mouthOpen}
              position={[0, -0.03, -0.004]}
              scale={[1, 0, 1]}
            />
          </group>
        </group>
      </group>
    </group>
  );
}
