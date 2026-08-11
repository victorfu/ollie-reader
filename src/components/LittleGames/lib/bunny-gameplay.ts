import { GAME_CONFIG } from "./constants";
import { clamp } from "./game-utils";
import type { Platform, Player, PowerupType } from "./types";

export type BunnyRescuePosition = {
  x: number;
  y: number;
  cameraY: number;
  platformId: string | null;
};

/**
 * JavaScript's remainder keeps the sign of the dividend. Canvas animations
 * need a true modulo so left-moving arrows wrap back onto the stage.
 */
export function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

/** Keep upcoming gusts; only discard bands that have already fallen below view. */
export function shouldKeepGust(gustY: number, cameraY: number): boolean {
  return gustY <= cameraY + GAME_CONFIG.HEIGHT + 120;
}

/**
 * Move wall-clock deadlines forward by the time gameplay was paused. The
 * returned combo timestamp is adjusted with the same game-time semantics.
 */
export function compensatePausedTimers(
  activePowerups: Map<PowerupType, number>,
  lastComboTime: number,
  pausedMs: number,
): number {
  if (!Number.isFinite(pausedMs) || pausedMs <= 0) return lastComboTime;

  activePowerups.forEach((endTime, type) => {
    if (endTime > 0 && Number.isFinite(endTime)) {
      activePowerups.set(type, endTime + pausedMs);
    }
  });

  return Number.isFinite(lastComboTime)
    ? lastComboTime + pausedMs
    : lastComboTime;
}

/** Apply the critter hit immediately so it cannot be overwritten next frame. */
export function applyCritterKnockback(
  player: Player,
  critterX: number,
  deltaTime: number,
): void {
  const direction = player.x < critterX ? -1 : 1;
  player.velocity.x = direction * GAME_CONFIG.CRITTER.KNOCKBACK;
  player.x = clamp(
    player.x + player.velocity.x * deltaTime,
    0,
    GAME_CONFIG.WIDTH - player.width,
  );
}

/** Capture a checkpoint whose feet are supported by a platform. */
export function createPlatformRescuePosition(
  player: Player,
  platform: Platform,
  cameraY: number,
): BunnyRescuePosition {
  const minSupportedX = platform.x;
  const maxSupportedX = platform.x + platform.width - player.width;
  const supportedX =
    maxSupportedX >= minSupportedX
      ? clamp(player.x, minSupportedX, maxSupportedX)
      : platform.x + (platform.width - player.width) / 2;

  return {
    x: clamp(supportedX, 0, GAME_CONFIG.WIDTH - player.width),
    y: platform.y - player.height,
    cameraY,
    platformId: platform.id,
  };
}

/**
 * Resolve a stored checkpoint against the current platform positions. Moving
 * platforms can shift after capture, while recycled or broken platforms need
 * a nearby live platform instead.
 */
export function resolvePlatformRescuePosition(
  checkpoint: BunnyRescuePosition,
  platforms: Platform[],
  player: Player,
): BunnyRescuePosition | null {
  const usablePlatforms = platforms.filter(
    (platform) =>
      !platform.isBreaking &&
      platform.x + platform.width > 0 &&
      platform.x < GAME_CONFIG.WIDTH,
  );
  const capturedPlatform = checkpoint.platformId
    ? usablePlatforms.find((platform) => platform.id === checkpoint.platformId)
    : undefined;
  const platform =
    capturedPlatform ??
    usablePlatforms.reduce<Platform | null>((closest, candidate) => {
      if (!closest) return candidate;
      return Math.abs(candidate.y - checkpoint.y) <
        Math.abs(closest.y - checkpoint.y)
        ? candidate
        : closest;
    }, null);

  if (!platform) return null;
  return createPlatformRescuePosition(
    { ...player, x: checkpoint.x },
    platform,
    checkpoint.cameraY,
  );
}

/** Last-resort on-screen point for malformed state with no platform checkpoint. */
export function createShieldFallbackPosition(
  player: Player,
  cameraY: number,
): BunnyRescuePosition {
  return {
    x: clamp(player.x, 0, GAME_CONFIG.WIDTH - player.width),
    y: Math.min(player.y, cameraY + GAME_CONFIG.HEIGHT * 0.6),
    cameraY,
    platformId: null,
  };
}

export function getPowerupIndicatorY(comboVisible: boolean): number {
  return comboVisible ? 145 : 90;
}

export function getBunnyScoreSummary(
  heightScore: number,
  carrotScore: number,
  carrotCount: number,
): { totalScore: number; gemCount: number } {
  return {
    totalScore: heightScore + carrotScore,
    gemCount: carrotCount,
  };
}
