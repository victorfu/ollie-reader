import { createPortal } from "@react-three/fiber";
import { useMemo } from "react";
import { Shape } from "three";
import type { CompanionAccessory, CompanionOutfit } from "../../../types/companion";
import type { BuiltRig } from "./cinnamorollRig";

function Ball({ position, scale, color }: { position: [number, number, number]; scale: [number, number, number]; color: string }) {
  return <mesh position={position} scale={scale}><sphereGeometry args={[1, 20, 12]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>;
}

function Star({ x }: { x: number }) {
  const shape = useMemo(() => {
    const s = new Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + i * Math.PI / 5;
      const r = i % 2 === 0 ? 0.25 : 0.13;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    return s;
  }, []);
  return <mesh position={[x, 0, 0]}><extrudeGeometry args={[shape, { depth: 0.035, bevelEnabled: false }]} /><meshStandardMaterial color="#f6c84e" metalness={0.3} roughness={0.4} /></mesh>;
}

/** Original procedural 3D accessories; no external image/model assets. */
function Accessory({ id }: { id: CompanionAccessory }) {
  if (id === "bow") return <group position={[0.45, 0.02, 0.3]} rotation={[0, 0, -0.15]}>
    <Ball position={[-0.2, 0, 0]} scale={[0.25, 0.18, 0.12]} color="#65b9f4" />
    <Ball position={[0.2, 0, 0]} scale={[0.25, 0.18, 0.12]} color="#65b9f4" />
    <Ball position={[0, 0, 0.08]} scale={[0.11, 0.13, 0.12]} color="#2389d6" />
  </group>;
  if (id === "hat") return <group>
    <Ball position={[0, 0.04, 0]} scale={[0.65, 0.09, 0.48]} color="#f2a1bf" />
    <Ball position={[0, 0.18, -0.03]} scale={[0.43, 0.25, 0.36]} color="#ffc3d9" />
    <Ball position={[0, 0.4, -0.03]} scale={[0.07, 0.06, 0.07]} color="#e78aad" />
  </group>;
  if (id === "crown") return <group>
    <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.4, 0.38, 0.2, 24, 1, true]} /><meshStandardMaterial color="#f5cc55" metalness={0.45} roughness={0.3} side={2} /></mesh>
    {[-0.28, 0, 0.28].map((x) => <mesh key={x} position={[x, 0.29, 0.25]}><coneGeometry args={[0.14, 0.3, 4]} /><meshStandardMaterial color="#f5cc55" metalness={0.45} roughness={0.3} /></mesh>)}
    <Ball position={[0, 0.16, 0.39]} scale={[0.07, 0.09, 0.04]} color="#e981ab" />
  </group>;
  if (id === "glasses") return <group>
    <Star x={-0.48} /><Star x={0.48} />
    <mesh><boxGeometry args={[0.5, 0.04, 0.035]} /><meshStandardMaterial color="#f6c84e" /></mesh>
  </group>;
  if (id === "scarf") return <group>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.53, 0.13, 12, 32]} /><meshStandardMaterial color="#ef94b5" /></mesh>
    <Ball position={[0.25, -0.23, 0.51]} scale={[0.13, 0.35, 0.09]} color="#ef94b5" />
  </group>;
  return <group position={[0, -0.12, 0.14]} scale={0.65}>
    <Ball position={[0, 0, 0]} scale={[0.24, 0.28, 0.18]} color="#c69c75" />
    <Ball position={[0, 0.32, 0]} scale={[0.25, 0.22, 0.19]} color="#dcb78e" />
    {[-1, 1].map((side) => <group key={side}>
      <Ball position={[side * 0.19, 0.5, 0]} scale={[0.1, 0.1, 0.08]} color="#c69c75" />
      <Ball position={[side * 0.09, 0.35, 0.18]} scale={[0.025, 0.025, 0.02]} color="#49372f" />
      <Ball position={[side * 0.2, -0.2, 0]} scale={[0.12, 0.1, 0.12]} color="#c69c75" />
    </group>)}
  </group>;
}

export function Accessories({ built, outfit }: { built: BuiltRig; outfit: CompanionOutfit }) {
  return <>{(Object.keys(built.anchors) as Array<keyof CompanionOutfit>).map((slot) => {
    const id = outfit[slot];
    return id ? createPortal(<Accessory key={id} id={id} />, built.anchors[slot]) : null;
  })}</>;
}
