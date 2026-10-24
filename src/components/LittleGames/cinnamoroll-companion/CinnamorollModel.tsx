import { useMemo } from "react";
import type { BuiltRig } from "./cinnamorollRig";
import type { CompanionRuntime } from "./logic/companionRuntime";
import { useCompanionAnimation } from "./useCompanionAnimation";

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

/**
 * The rigged Cinnamoroll model standing on a small cloud, which turns with
 * it like a figurine on its stand. The model is
 * "Cinnamoroll" by fukkacumy (CC BY 4.0); see cinnamoroll.LICENSE.txt.
 */
export function CinnamorollModel({
  built,
  runtime,
  reducedMotion,
}: {
  built: BuiltRig;
  runtime: CompanionRuntime;
  reducedMotion: boolean;
}) {
  const parts = useMemo(() => ({ current: built.parts }), [built]);
  useCompanionAnimation(parts, runtime, reducedMotion);

  return (
    <primitive object={built.root}>
      {/* The stage sits at the character's middle; the cloud goes under the feet. */}
      <group position={[0, -built.bounds.centerY, 0]}>
        {CLOUD_PUFFS.map(([x, y, z, r, squash]) => (
          <mesh key={`${x}:${z}`} position={[x, y, z]} scale={[r, r * squash, r]}>
            <sphereGeometry args={[1, 32, 20]} />
            <meshStandardMaterial
              color="#f7fbff"
              emissive="#dcecff"
              emissiveIntensity={0.3}
              roughness={1}
            />
          </mesh>
        ))}
      </group>
    </primitive>
  );
}
