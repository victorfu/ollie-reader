import type { CompanionAction } from "../../../../types/companion";

export const ACTIONS: ReadonlyArray<{ id: CompanionAction; label: string }> = [
  { id: "leftEar", label: "摸左耳" }, { id: "rightEar", label: "摸右耳" },
  { id: "belly", label: "搔肚子" }, { id: "wave", label: "揮揮手" },
  { id: "jump", label: "跳一跳" }, { id: "twirl", label: "轉個圈" },
];
export const ACTION_MS = 1600;
export type PerformanceState = { action: CompanionAction; since: number } | null;

/** A bounded, interruptible pose. Every channel returns to rest at the end. */
export function actionPose(state: PerformanceState, now: number, reducedMotion: boolean) {
  const p = state ? Math.max(0, Math.min(1, (now - state.since) / ACTION_MS)) : 0;
  const envelope = state && p < 1 ? Math.sin(Math.PI * p) : 0;
  const motion = reducedMotion ? 0 : envelope;
  const action = state?.action;
  return {
    delight: envelope,
    lift: action === "jump" ? motion * 0.48 : 0,
    yaw: action === "twirl" && !reducedMotion && p < 1 ? p * Math.PI * 2 : 0,
    lean: action === "belly" ? -motion * 0.18 : 0,
    tilt: action === "leftEar" ? motion * 0.16 : action === "rightEar" ? -motion * 0.16 : 0,
    leftEar: action === "leftEar" ? motion * Math.sin(p * Math.PI * 6) * 0.28 : 0,
    rightEar: action === "rightEar" ? motion * Math.sin(p * Math.PI * 6) * 0.28 : 0,
    wave: action === "wave" ? motion * (0.6 + Math.sin(p * Math.PI * 8) * 0.25) : 0,
  };
}
