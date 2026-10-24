import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { CinnamorollModel } from "./CinnamorollModel";
import { Hearts } from "./Hearts";
import type { CompanionRuntime } from "./logic/companionRuntime";
import { fitCameraDistance } from "./logic/framing";
import { CLOUD_DEPTH, type ModelBounds } from "./rig";
import { useCinnamorollRig } from "./useCinnamorollRig";
import { usePetInteraction } from "./usePetInteraction";

const FOV_DEG = 30;

/** Keeps the whole pet in frame and as large as allowed on any screen. */
function FramedCamera({ bounds }: { bounds: ModelBounds }) {
  const camera = useThree((state) => state.camera as THREE.PerspectiveCamera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);

  useEffect(() => {
    const portrait = width < height;
    // Include the cloud under the feet.
    const subjectHeight = bounds.height + CLOUD_DEPTH;
    const centerY = bounds.centerY - CLOUD_DEPTH / 2;
    const distance = fitCameraDistance({
      aspect: width / Math.max(height, 1),
      fovDeg: FOV_DEG,
      width: bounds.width,
      height: subjectHeight,
      widthFraction: portrait ? 0.85 : 0.8,
      heightFraction: portrait ? 0.62 : 0.8,
    });
    camera.position.set(0, centerY, distance);
    camera.lookAt(0, centerY, 0);
    camera.updateProjectionMatrix();
  }, [bounds, camera, height, width]);

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
  const built = useCinnamorollRig();
  const headHitRef = useMemo(() => ({ current: built.headHit }), [built]);
  usePetInteraction(runtime, headHitRef);

  return (
    <>
      <FramedCamera bounds={built.bounds} />
      <hemisphereLight args={["#f5f9ff", "#d6e2f1", 2]} />
      <directionalLight position={[-3, 6, 7]} intensity={1.7} color="#fff6ec" />
      <directionalLight position={[4, 2, -5]} intensity={0.9} color="#cfe4ff" />
      <CinnamorollModel built={built} runtime={runtime} reducedMotion={reducedMotion} />
      <Hearts
        runtime={runtime}
        reducedMotion={reducedMotion}
        spawnY={built.bounds.height + 0.2}
      />
    </>
  );
}

export type CompanionSceneProps = {
  runtime: CompanionRuntime;
  reducedMotion: boolean;
  paused: boolean;
  /** Called once the model has loaded and its first frame has rendered. */
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
      {/* The model streams in; frames only count once it is on screen. */}
      <Suspense fallback={null}>
        <SceneContents runtime={runtime} reducedMotion={reducedMotion} />
        <ReadySignal onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
