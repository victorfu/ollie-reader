import { useCallback, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  readMotionMode,
  resolveMotion,
  writeMotionMode,
  type MotionMode,
  type ResolvedMotion,
} from "./motionSettings";

export type MotionControls = ResolvedMotion & {
  mode: MotionMode;
  setMode: (mode: MotionMode) => void;
  systemReducedMotion: boolean;
};

/** React adapter for the device-local Cloud Cottage animation preference. */
export function useMotionSettings(): MotionControls {
  const systemReducedMotion = Boolean(useReducedMotion());
  const [mode, setModeState] = useState<MotionMode>(readMotionMode);

  const setMode = useCallback((next: MotionMode) => {
    setModeState(writeMotionMode(next));
  }, []);

  return {
    ...resolveMotion(mode, systemReducedMotion),
    mode,
    setMode,
    systemReducedMotion,
  };
}
