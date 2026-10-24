import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CompanionRuntime } from "./logic/companionRuntime";

/** At most this many hearts are on screen; extra hearts are skipped. */
const MAX_HEARTS = 4;
const LIFE_MS = 1_600;
const SPAWN = new THREE.Vector3(0, 3.05, 0.5);

type Slot = { born: number; x: number; active: boolean };

function heartShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -0.12);
  s.bezierCurveTo(-0.02, -0.08, -0.16, -0.02, -0.16, 0.06);
  s.bezierCurveTo(-0.16, 0.14, -0.06, 0.17, 0, 0.09);
  s.bezierCurveTo(0.06, 0.17, 0.16, 0.14, 0.16, 0.06);
  s.bezierCurveTo(0.16, -0.02, 0.02, -0.08, 0, -0.12);
  return s;
}

/** Small hearts that float up from the head when petting earns one. */
export function Hearts({
  runtime,
  reducedMotion,
}: {
  runtime: CompanionRuntime;
  reducedMotion: boolean;
}) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const slots = useRef<Slot[]>(
    Array.from({ length: MAX_HEARTS }, () => ({ born: 0, x: 0, active: false })),
  );
  const seen = useRef<number | null>(null);

  const resources = useMemo(() => {
    const geometry = new THREE.ExtrudeGeometry(heartShape(), {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      bevelSegments: 3,
    });
    geometry.center();
    const materials = Array.from(
      { length: MAX_HEARTS },
      () =>
        new THREE.MeshStandardMaterial({
          color: "#ff7fab",
          emissive: "#ff4f8b",
          emissiveIntensity: 0.25,
          roughness: 0.45,
          transparent: true,
          opacity: 0,
        }),
    );
    return { geometry, materials };
  }, []);

  useEffect(
    () => () => {
      resources.geometry.dispose();
      resources.materials.forEach((m) => m.dispose());
    },
    [resources],
  );

  useFrame(() => {
    const now = performance.now();
    seen.current ??= runtime.pet.hearts;
    const pending = runtime.pet.hearts - seen.current;
    seen.current = runtime.pet.hearts;
    for (let i = 0; i < pending; i += 1) {
      const slot = slots.current.find((candidate) => !candidate.active);
      if (!slot) break;
      slot.active = true;
      slot.born = now;
      slot.x = (Math.random() - 0.5) * 1.2;
    }

    slots.current.forEach((slot, index) => {
      const mesh = meshes.current[index];
      if (!mesh) return;
      const life = (now - slot.born) / LIFE_MS;
      if (!slot.active || life >= 1) {
        slot.active = false;
        mesh.visible = false;
        return;
      }
      const rise = reducedMotion ? 0 : 0.9 * (1 - (1 - life) ** 2);
      const pop = Math.min(1, life * 6);
      mesh.visible = true;
      mesh.position.set(
        SPAWN.x + slot.x,
        SPAWN.y + rise,
        SPAWN.z,
      );
      mesh.rotation.z = reducedMotion ? 0 : Math.sin(life * Math.PI * 3) * 0.2;
      mesh.scale.setScalar(pop);
      resources.materials[index].opacity = life < 0.6 ? 1 : (1 - life) / 0.4;
    });
  });

  return (
    <group>
      {resources.materials.map((material, index) => (
        <mesh
          key={index}
          ref={(node) => {
            meshes.current[index] = node;
          }}
          geometry={resources.geometry}
          material={material}
          visible={false}
        />
      ))}
    </group>
  );
}
