import { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import modelUrl from "../../../assets/games/cinnamoroll-companion/cinnamoroll.glb?url";
import { buildCinnamorollRig, type BuiltRig } from "./cinnamorollRig";

/**
 * Loads the bundled Cinnamoroll model (suspending until it arrives) and rigs
 * a fresh copy of it, so remounting after a lost GPU context starts clean.
 */
export function useCinnamorollRig(): BuiltRig {
  const gltf = useLoader(GLTFLoader, modelUrl);
  const built = useMemo(() => buildCinnamorollRig(gltf.scene.clone(true)), [gltf]);
  useEffect(() => () => built.dispose(), [built]);
  return built;
}
