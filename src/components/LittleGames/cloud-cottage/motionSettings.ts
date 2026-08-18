/**
 * Device-local animation preference for Cloud Cottage.
 *
 * The scene reads the operating system's reduce-motion setting, which is the
 * right default but leaves no way back: with it on, the pet is frozen in place
 * and the game looks broken rather than calm. "on" is an explicit, per-device
 * opt back in to her movement.
 */
export type MotionMode = "auto" | "on" | "reduced";

export const MOTION_SETTINGS_KEY = "ollie-cloud-cottage-motion-v1";

export const DEFAULT_MOTION_MODE: MotionMode = "auto";

const MOTION_MODES: readonly MotionMode[] = ["auto", "on", "reduced"];

export function isMotionMode(value: unknown): value is MotionMode {
  return typeof value === "string"
    && (MOTION_MODES as readonly string[]).includes(value);
}

export type ResolvedMotion = {
  /** Governs the character herself: her idle breathing and action animations. */
  petMotionReduced: boolean;
  /**
   * Governs decoration: confetti, panel transitions, floating effects. The
   * system preference is authoritative here, because choosing to see her move
   * is not the same as asking for the whole screen to move.
   */
  decorMotionReduced: boolean;
};

export function resolveMotion(
  mode: MotionMode,
  systemReducedMotion: boolean,
): ResolvedMotion {
  return {
    petMotionReduced: mode === "on" ? false : mode === "reduced" || systemReducedMotion,
    decorMotionReduced: systemReducedMotion || mode === "reduced",
  };
}

export function readMotionMode(): MotionMode {
  if (typeof window === "undefined") return DEFAULT_MOTION_MODE;
  try {
    const raw = window.localStorage.getItem(MOTION_SETTINGS_KEY);
    return isMotionMode(raw) ? raw : DEFAULT_MOTION_MODE;
  } catch {
    return DEFAULT_MOTION_MODE;
  }
}

export function writeMotionMode(mode: MotionMode): MotionMode {
  if (typeof window === "undefined") return mode;
  try {
    window.localStorage.setItem(MOTION_SETTINGS_KEY, mode);
  } catch {
    // A device that refuses storage still plays fine for this session.
  }
  return mode;
}
