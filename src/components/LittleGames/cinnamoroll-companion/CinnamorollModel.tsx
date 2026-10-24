import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { CompanionRuntime } from "./logic/companionRuntime";
import { HEAD_PIVOT_Y, type RigParts } from "./rig";
import { useCompanionAnimation } from "./useCompanionAnimation";

/**
 * Procedural stand-in for the final Cinnamoroll GLB: same rig (head, ears,
 * eyes, mouth, tail) so the interaction and animation code can be built and
 * tuned now and keep working when the real model replaces the geometry.
 */

/** Head ellipsoid in head-group space. */
const HEAD_CENTER_Y = 0.9;
const HEAD_SEMI_AXES = new THREE.Vector3(1.2, 0.96, 1);
const HEAD_PIVOT = new THREE.Vector3(0, HEAD_PIVOT_Y, 0.05);

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

/** Cinnamon-roll curl, wound from the inside out. */
class TailCurve extends THREE.Curve<THREE.Vector3> {
  constructor() {
    super();
  }

  getPoint(t: number, target = new THREE.Vector3()) {
    const angle = t * Math.PI * 2 * 1.6;
    const radius = 0.05 + 0.2 * t;
    return target.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.05 * t);
  }
}

function useModelResources() {
  const resources = useMemo(() => {
    const geometries = {
      sphere: new THREE.SphereGeometry(1, 48, 32),
      smallSphere: new THREE.SphereGeometry(1, 20, 14),
      tail: new THREE.TubeGeometry(new TailCurve(), 64, 0.075, 12, false),
      // Upper half ring: the happy "^" of closed eyes.
      eyeArc: new THREE.TorusGeometry(0.085, 0.02, 8, 24, Math.PI),
      // Lower half ring: the smile line.
      mouthArc: new THREE.TorusGeometry(0.075, 0.017, 8, 24, Math.PI),
      mouthOpen: new THREE.CircleGeometry(0.07, 24, Math.PI, Math.PI),
    };
    const materials = {
      fur: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: "#e8f0ff",
        emissiveIntensity: 0.18,
        roughness: 0.82,
      }),
      eye: new THREE.MeshStandardMaterial({ color: "#3f6fc0", roughness: 0.3 }),
      eyeShine: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      line: new THREE.MeshStandardMaterial({ color: "#2f5596", roughness: 0.5 }),
      mouthOpen: new THREE.MeshStandardMaterial({
        color: "#f28fab",
        roughness: 0.6,
        side: THREE.DoubleSide,
      }),
      cheek: new THREE.MeshStandardMaterial({
        color: "#f9a9c6",
        roughness: 0.9,
        transparent: true,
        opacity: 0.45,
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
  [0, -0.12, 0, 0.95, 0.36],
  [-0.85, -0.12, 0.1, 0.48, 0.5],
  [0.85, -0.12, 0.06, 0.5, 0.5],
  [-0.42, -0.06, 0.45, 0.42, 0.5],
  [0.45, -0.05, 0.45, 0.4, 0.5],
  [-0.4, -0.08, -0.42, 0.46, 0.5],
  [0.45, -0.08, -0.42, 0.46, 0.5],
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
      eyes: [onFace(-0.42, -0.1, 0.02), onFace(0.42, -0.1, 0.02)],
      cheeks: [onFace(-0.72, -0.34, 0.005), onFace(0.72, -0.34, 0.005)],
      mouth: onFace(0, -0.3, 0.01),
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
        <mesh geometry={g.sphere} material={m.fur} position={[0, 0.6, 0]} scale={[0.68, 0.56, 0.6]} />
        {[-1, 1].map((side) => (
          <mesh
            key={`arm${side}`}
            geometry={g.smallSphere}
            material={m.fur}
            position={[side * 0.58, 0.68, 0.28]}
            rotation={[0, 0, side * 0.6]}
            scale={[0.17, 0.21, 0.17]}
          />
        ))}
        {[-1, 1].map((side) => (
          <mesh
            key={`foot${side}`}
            geometry={g.smallSphere}
            material={m.fur}
            position={[side * 0.32, 0.1, 0.3]}
            scale={[0.23, 0.13, 0.27]}
          />
        ))}
        <group
          ref={(node) => { rig.current.tail = node; }}
          position={[0.3, 0.62, -0.55]}
          rotation={[0, Math.PI * 0.8, 0]}
        >
          <mesh geometry={g.tail} material={m.fur} />
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
          scale={[1.24, 1.02, 1.06]}
          visible={false}
        />

        {[-1, 1].map((side, index) => (
          <group
            key={`ear${side}`}
            ref={(node) => { rig.current.ears[index] = node; }}
            position={[side * 0.55, 1.7, -0.05]}
          >
            <mesh
              geometry={g.sphere}
              material={m.fur}
              position={[side * 0.95, 0, 0]}
              rotation={[0, side * 0.15, 0]}
              scale={[1, 0.36, 0.14]}
            />
          </group>
        ))}

        {face.eyes.map(({ position, quaternion }, index) => (
          <group key={`eye${index}`} position={position} quaternion={quaternion}>
            <group ref={(node) => { rig.current.eyesOpen[index] = node; }}>
              <mesh geometry={g.smallSphere} material={m.eye} scale={[0.1, 0.14, 0.04]} />
              <mesh
                geometry={g.smallSphere}
                material={m.eyeShine}
                position={[0.03, 0.05, 0.03]}
                scale={0.032}
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
            scale={[0.14, 0.085, 0.02]}
          />
        ))}

        <group position={face.mouth.position} quaternion={face.mouth.quaternion}>
          <group ref={(node) => { rig.current.mouth = node; }}>
            <mesh geometry={g.mouthArc} material={m.line} rotation={[0, 0, Math.PI]} />
            <mesh
              ref={(node) => { rig.current.mouthOpen = node; }}
              geometry={g.mouthOpen}
              material={m.mouthOpen}
              position={[0, 0, -0.005]}
              scale={[1, 0, 1]}
            />
          </group>
        </group>
      </group>
    </group>
  );
}
