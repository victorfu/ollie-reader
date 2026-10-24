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
 * Proportions follow front/back/side/top reference turnarounds: a domed,
 * flat-bottomed head; thick club-shaped ears that swell into round bulbs;
 * large blue oval eyes; a wavy blue mouth low on the face; a bell-shaped
 * body ending in two foot bumps; nub paws; and a curl tail on the back.
 */

/** Head superellipsoid in head-group space. */
const HEAD_CENTER_Y = 0.86;
const HEAD_HALF_WIDTH = 1.32;
const HEAD_HALF_DEPTH = 0.98;
const HEAD_TOP = 0.95;
const HEAD_BOTTOM = 0.8;
const HEAD_PIVOT = new THREE.Vector3(0, HEAD_PIVOT_Y, 0.05);

const EAR_LENGTH = 2.45;
/** Radius of the narrow stem by the head and of the bulb at the end. */
const EAR_STEM = 0.29;
const EAR_BULB = 0.53;
/** Cross-section is nearly round; slightly flatter front to back. */
const EAR_DEPTH = 0.82;
/** Ear root, sunk into the upper side of the head. */
const EAR_ROOT = new THREE.Vector3(0.72, HEAD_CENTER_Y + 0.42, -0.22);

const TAIL_RADIUS = 0.13;

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

/**
 * Head surface for a unit direction from the head center. A superellipsoid:
 * a round dome on top and a boxier, flatter bottom, which gives the bun
 * silhouette with a nearly straight lower edge seen from the front.
 */
function headSurface(dir: THREE.Vector3, target = new THREE.Vector3()) {
  const lower = THREE.MathUtils.smoothstep(-dir.y, -0.1, 0.6);
  const n = 2 + 1.5 * lower;
  const halfHeight = dir.y >= 0 ? HEAD_TOP : HEAD_BOTTOM;
  const s =
    (Math.abs(dir.x / HEAD_HALF_WIDTH) ** n +
      Math.abs(dir.y / halfHeight) ** n +
      Math.abs(dir.z / HEAD_HALF_DEPTH) ** n) **
    (-1 / n);
  return target.copy(dir).multiplyScalar(s);
}

function reshapeSphere(
  segments: [number, number],
  shape: (unit: THREE.Vector3, target: THREE.Vector3) => THREE.Vector3,
): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(1, segments[0], segments[1]);
  const position = geometry.attributes.position;
  const unit = new THREE.Vector3();
  const out = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    unit.fromBufferAttribute(position, i);
    shape(unit, out);
    position.setXYZ(i, out.x, out.y, out.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

const headDirection = (azimuth: number, elevation: number) =>
  new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  );

/**
 * A point on the face given by angles from the front (azimuth to the side,
 * elevation up), with the rotation that lays a flat feature onto the surface.
 */
function onHead(azimuth: number, elevation: number, lift = 0) {
  const e = 1e-3;
  const p = headSurface(headDirection(azimuth, elevation));
  const alongAzimuth = headSurface(headDirection(azimuth + e, elevation)).sub(
    headSurface(headDirection(azimuth - e, elevation)),
  );
  const alongElevation = headSurface(headDirection(azimuth, elevation + e)).sub(
    headSurface(headDirection(azimuth, elevation - e)),
  );
  const normal = alongAzimuth.cross(alongElevation).normalize();
  if (normal.dot(p) < 0) normal.negate();
  const position = p.addScaledVector(normal, lift);
  position.y += HEAD_CENTER_Y;
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    normal,
  );
  return { position, quaternion };
}

/**
 * A thick club-shaped ear growing along +x from its root at the origin: a
 * narrow stem by the head swelling into a big round bulb, sagging slightly
 * toward the tip. Built by reshaping a sphere so it stays smooth.
 */
function createEarGeometry(): THREE.BufferGeometry {
  const capStart = 1 - EAR_BULB / EAR_LENGTH;
  const rootCap = 0.12;
  return reshapeSphere([72, 40], (v, out) => {
    const u = (v.x + 1) / 2;
    const ring = Math.sqrt(Math.max(0, 1 - v.x * v.x));
    let radius = THREE.MathUtils.lerp(
      EAR_STEM,
      EAR_BULB,
      THREE.MathUtils.smoothstep(u, 0.42, capStart - 0.06),
    );
    if (u > capStart) {
      radius *= Math.sqrt(Math.max(0, 1 - ((u - capStart) / (1 - capStart)) ** 2));
    } else if (u < rootCap) {
      radius *= Math.sqrt(Math.max(0, 1 - ((rootCap - u) / rootCap) ** 2));
    }
    const dirY = ring > 1e-6 ? v.y / ring : 0;
    const dirZ = ring > 1e-6 ? v.z / ring : 0;
    return out.set(
      u * EAR_LENGTH,
      dirY * radius - 0.26 * u * u,
      dirZ * radius * EAR_DEPTH - 0.1 * u * u,
    );
  });
}

/** Marshmallow body: a rounded box with nearly straight sides. */
function createBodyGeometry(): THREE.BufferGeometry {
  const n = 3;
  return reshapeSphere([48, 32], (v, out) => {
    const s =
      (Math.abs(v.x / 0.68) ** n + Math.abs(v.y / 0.55) ** n + Math.abs(v.z / 0.56) ** n) **
      (-1 / n);
    return out.copy(v).multiplyScalar(s);
  });
}

/** The wavy "〰" mouth: a center peak, two dips and upturned ends. */
class WaveCurve extends THREE.Curve<THREE.Vector3> {
  private readonly width: number;
  private readonly height: number;

  constructor(width: number, height: number) {
    super();
    this.width = width;
    this.height = height;
  }

  getPoint(t: number, target = new THREE.Vector3()) {
    const u = (t - 0.5) * 2.2;
    return target.set(
      (u / 2.2) * this.width,
      (this.height / 2) * Math.cos(Math.PI * 2 * u),
      0,
    );
  }
}

/** Cinnamon-roll curl, wound from the inside out; the center sticks out. */
class TailCurve extends THREE.Curve<THREE.Vector3> {
  constructor() {
    super();
  }

  getPoint(t: number, target = new THREE.Vector3()) {
    const angle = t * Math.PI * 2 * 1.5;
    const radius = 0.07 + 0.17 * t;
    return target.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.24 * t);
  }
}

/** A plump tail tube that thins toward the middle of the curl. */
function createTailGeometry(curve: TailCurve): THREE.TubeGeometry {
  const tubular = 120;
  const radial = 18;
  const geometry = new THREE.TubeGeometry(curve, tubular, TAIL_RADIUS, radial, false);
  const position = geometry.attributes.position;
  const v = new THREE.Vector3();
  const center = new THREE.Vector3();
  for (let ring = 0; ring <= tubular; ring += 1) {
    const t = ring / tubular;
    curve.getPointAt(t, center);
    const taper = 0.5 + 0.5 * t;
    for (let k = 0; k <= radial; k += 1) {
      const i = ring * (radial + 1) + k;
      v.fromBufferAttribute(position, i).sub(center).multiplyScalar(taper).add(center);
      position.setXYZ(i, v.x, v.y, v.z);
    }
  }
  return geometry;
}

function useModelResources() {
  const resources = useMemo(() => {
    const tailCurve = new TailCurve();
    const geometries = {
      sphere: new THREE.SphereGeometry(1, 48, 32),
      smallSphere: new THREE.SphereGeometry(1, 20, 14),
      head: reshapeSphere([80, 56], (v, out) => headSurface(v, out)),
      body: createBodyGeometry(),
      limb: new THREE.CapsuleGeometry(1, 1, 8, 16),
      ear: createEarGeometry(),
      tail: createTailGeometry(tailCurve),
      // Upper half ring: the happy "^" of closed eyes.
      eyeArc: new THREE.TorusGeometry(0.11, 0.022, 8, 24, Math.PI),
      mouthLine: new THREE.TubeGeometry(new WaveCurve(0.52, 0.11), 64, 0.019, 8, false),
      mouthOpen: new THREE.CircleGeometry(0.1, 24, Math.PI, Math.PI),
    };
    const materials = {
      fur: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: "#eef2fb",
        emissiveIntensity: 0.16,
        roughness: 0.78,
      }),
      eye: new THREE.MeshStandardMaterial({ color: "#3ea7ec", roughness: 0.35 }),
      line: new THREE.MeshStandardMaterial({ color: "#3a9ee0", roughness: 0.45 }),
      mouthOpen: new THREE.MeshStandardMaterial({
        color: "#f48aa8",
        roughness: 0.6,
        side: THREE.DoubleSide,
      }),
      cheek: new THREE.MeshStandardMaterial({
        color: "#f9adc6",
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
    const tailTip = tailCurve.getPointAt(0);
    return { geometries, materials, tailTip };
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
  [0, -0.26, 0, 0.95, 0.36],
  [-0.85, -0.26, 0.1, 0.48, 0.5],
  [0.85, -0.26, 0.06, 0.5, 0.5],
  [-0.42, -0.2, 0.45, 0.42, 0.5],
  [0.45, -0.19, 0.45, 0.4, 0.5],
  [-0.4, -0.22, -0.42, 0.46, 0.5],
  [0.45, -0.22, -0.42, 0.46, 0.5],
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
  const { geometries: g, materials: m, tailTip } = useModelResources();
  useCompanionAnimation(rig, runtime, reducedMotion);
  useEffect(() => {
    rig.current.cheekMaterial = m.cheek;
  }, [m]);

  const face = useMemo(
    () => ({
      eyes: [onHead(-0.56, -0.1, 0.01), onHead(0.56, -0.1, 0.01)],
      cheeks: [onHead(-0.86, -0.5, 0.005), onHead(0.86, -0.5, 0.005)],
      mouth: onHead(0, -0.46, 0.012),
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
        <mesh geometry={g.body} material={m.fur} position={[0, 0.72, 0]} />
        {/* Two short legs under the body, with a notch between them. */}
        {[-1, 1].map((side) => (
          <mesh
            key={`foot${side}`}
            geometry={g.smallSphere}
            material={m.fur}
            position={[side * 0.31, 0.2, 0.04]}
            scale={[0.26, 0.22, 0.3]}
          />
        ))}
        {/* Nub paws sloping down and out from the top corners of the body. */}
        {[-1, 1].map((side) => (
          <mesh
            key={`arm${side}`}
            geometry={g.limb}
            material={m.fur}
            position={[side * 0.76, 0.98, 0.04]}
            rotation={[0, 0, side * 0.8]}
            scale={[0.12, 0.13, 0.11]}
          />
        ))}
        <group
          ref={(node) => { rig.current.tail = node; }}
          position={[0, 0.42, -0.8]}
        >
          <mesh geometry={g.tail} material={m.fur} />
          {/* Round off the thin open end in the middle of the curl. */}
          <mesh
            geometry={g.smallSphere}
            material={m.fur}
            position={tailTip}
            scale={TAIL_RADIUS * 0.5}
          />
        </group>
      </group>

      <group
        ref={(node) => { rig.current.head = node; }}
        position={HEAD_PIVOT}
      >
        <mesh
          geometry={g.head}
          material={m.fur}
          position={[0, HEAD_CENTER_Y, 0]}
        />
        {/* Invisible, slightly padded head target; ears and body stay out. */}
        <mesh
          ref={headHitRef}
          geometry={g.smallSphere}
          position={[0, HEAD_CENTER_Y - 0.06, 0]}
          scale={[1.42, 0.94, 1.06]}
          visible={false}
        />

        {[-1, 1].map((side, index) => (
          <group
            key={`ear${side}`}
            ref={(node) => { rig.current.ears[index] = node; }}
            position={[side * EAR_ROOT.x, EAR_ROOT.y, EAR_ROOT.z]}
          >
            <mesh geometry={g.ear} material={m.fur} scale={[side, 1, 1]} />
          </group>
        ))}

        {face.eyes.map(({ position, quaternion }, index) => (
          <group key={`eye${index}`} position={position} quaternion={quaternion}>
            <group ref={(node) => { rig.current.eyesOpen[index] = node; }}>
              <mesh geometry={g.smallSphere} material={m.eye} scale={[0.125, 0.19, 0.025]} />
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
            scale={[0.18, 0.11, 0.02]}
          />
        ))}

        <group position={face.mouth.position} quaternion={face.mouth.quaternion}>
          <group ref={(node) => { rig.current.mouth = node; }}>
            <mesh geometry={g.mouthLine} material={m.line} />
            <mesh
              ref={(node) => { rig.current.mouthOpen = node; }}
              geometry={g.mouthOpen}
              material={m.mouthOpen}
              position={[0, -0.04, -0.004]}
              scale={[1, 0, 1]}
            />
          </group>
        </group>
      </group>
    </group>
  );
}
