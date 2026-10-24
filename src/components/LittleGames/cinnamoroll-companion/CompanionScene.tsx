import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { CinnamorollModel } from "./CinnamorollModel";
import { Hearts } from "./Hearts";
import type { CompanionRuntime } from "./logic/companionRuntime";
import { fitCameraDistance } from "./logic/framing";
import { MODEL_BOUNDS } from "./rig";
import { usePetInteraction } from "./usePetInteraction";

const FOV_DEG = 30;

/** Keeps the whole pet in frame and as large as allowed on any screen. */
function FramedCamera() {
  const camera = useThree((state) => state.camera as THREE.PerspectiveCamera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);

  useEffect(() => {
    const portrait = width < height;
    const distance = fitCameraDistance({
      aspect: width / Math.max(height, 1),
      fovDeg: FOV_DEG,
      width: MODEL_BOUNDS.width,
      height: MODEL_BOUNDS.height,
      widthFraction: portrait ? 0.85 : 0.8,
      heightFraction: portrait ? 0.62 : 0.8,
    });
    camera.position.set(0, MODEL_BOUNDS.centerY, distance);
    camera.lookAt(0, MODEL_BOUNDS.centerY, 0);
    camera.updateProjectionMatrix();
  }, [camera, height, width]);

  return null;
}

/**
 * Fires on the second frame: by then the first render, including the shader
 * compile that can take a second on phones, has finished.
 */
function ReadySignal({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 2) onReady();
  });
  return null;
}

function SceneContents({
  runtime,
  reducedMotion,
}: {
  runtime: CompanionRuntime;
  reducedMotion: boolean;
}) {
  const headHitRef = useRef<THREE.Mesh | null>(null);
  usePetInteraction(runtime, headHitRef);

  return (
    <>
      <FramedCamera />
      <hemisphereLight args={["#f5f9ff", "#d6e2f1", 2]} />
      <directionalLight position={[-3, 6, 7]} intensity={1.7} color="#fff6ec" />
      <directionalLight position={[4, 2, -5]} intensity={0.9} color="#cfe4ff" />
      <CinnamorollModel
        runtime={runtime}
        headHitRef={headHitRef}
        reducedMotion={reducedMotion}
      />
      <Hearts runtime={runtime} reducedMotion={reducedMotion} />
    </>
  );
}

export type CompanionSceneProps = {
  runtime: CompanionRuntime;
  reducedMotion: boolean;
  paused: boolean;
  /** Called once the first frame (and its shader compile) has finished. */
  onReady: () => void;
  onContextLost: () => void;
};

export default function CompanionScene({
  runtime,
  reducedMotion,
  paused,
  onReady,
  onContextLost,
}: CompanionSceneProps) {
  return (
    <Canvas
      className="touch-none select-none"
      camera={{ fov: FOV_DEG, near: 0.1, far: 100, position: [0, 1.5, 16] }}
      dpr={[1, 2]}
      flat
      frameloop={paused ? "never" : "always"}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          onContextLost();
        });
      }}
    >
      <SceneContents runtime={runtime} reducedMotion={reducedMotion} />
      <ReadySignal onReady={onReady} />
    </Canvas>
  );
}
