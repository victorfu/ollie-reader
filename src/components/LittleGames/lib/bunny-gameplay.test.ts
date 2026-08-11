import { describe, expect, it } from "vitest";
import {
  applyCritterKnockback,
  compensatePausedTimers,
  createPlatformRescuePosition,
  createShieldFallbackPosition,
  getPowerupIndicatorY,
  positiveModulo,
  resolvePlatformRescuePosition,
  shouldKeepGust,
} from "./bunny-gameplay";
import {
  PlatformType,
  PowerupType,
  type Platform,
  type Player,
} from "./types";

const createPlayer = (overrides: Partial<Player> = {}): Player => ({
  x: 200,
  y: 300,
  width: 48,
  height: 48,
  velocity: { x: 0, y: 0 },
  onGround: false,
  ...overrides,
});

const createPlatform = (overrides: Partial<Platform> = {}): Platform => ({
  id: "safe-platform",
  x: 180,
  y: 420,
  width: 90,
  height: 18,
  velocity: { x: 0, y: 0 },
  type: PlatformType.Static,
  ...overrides,
});

describe("Bunny Jumper gameplay helpers", () => {
  it("wraps left-moving gust arrows into the canvas range", () => {
    const wrappedX = positiveModulo(-1_200, 540) - 30;

    expect(wrappedX).toBe(390);
    expect(wrappedX).toBeGreaterThanOrEqual(-30);
    expect(wrappedX).toBeLessThan(510);
  });

  it("keeps upcoming gusts while removing only bands below the camera", () => {
    expect(shouldKeepGust(-1_200, 0)).toBe(true);
    expect(shouldKeepGust(-240, 0)).toBe(true);
    expect(shouldKeepGust(921, 0)).toBe(false);
  });

  it("extends powerup and combo timers by the paused duration", () => {
    const activePowerups = new Map<PowerupType, number>([
      [PowerupType.Flight, 5_000],
      [PowerupType.Shield, -1],
    ]);

    const comboTime = compensatePausedTimers(activePowerups, 1_000, 3_000);

    expect(activePowerups.get(PowerupType.Flight)).toBe(8_000);
    expect(activePowerups.get(PowerupType.Shield)).toBe(-1);
    expect(comboTime).toBe(4_000);
  });

  it("applies side-hit knockback to position immediately", () => {
    const player = createPlayer();

    applyCritterKnockback(player, 220, 0.1);

    expect(player.velocity.x).toBe(-180);
    expect(player.x).toBe(182);
  });

  it("captures a rescue checkpoint supported by the last landed platform", () => {
    const player = createPlayer({ x: 250, y: 300 });
    const platform = createPlatform();

    const checkpoint = createPlatformRescuePosition(player, platform, -40);

    expect(checkpoint.platformId).toBe(platform.id);
    expect(checkpoint.y + player.height).toBe(platform.y);
    expect(checkpoint.x).toBeGreaterThanOrEqual(platform.x);
    expect(checkpoint.x + player.width).toBeLessThanOrEqual(
      platform.x + platform.width,
    );
    expect(checkpoint.y).not.toBe(player.y);
    expect(checkpoint.cameraY).toBe(-40);
  });

  it("re-resolves a checkpoint onto a moving platform before rescue", () => {
    const player = createPlayer();
    const platform = createPlatform();
    const checkpoint = createPlatformRescuePosition(player, platform, -40);
    platform.x = 300;

    const resolved = resolvePlatformRescuePosition(
      checkpoint,
      [platform],
      player,
    );

    expect(resolved).not.toBeNull();
    expect(resolved!.x).toBeGreaterThanOrEqual(platform.x);
    expect(resolved!.y + player.height).toBe(platform.y);
  });

  it("marks the on-screen shield fallback as unsupported", () => {
    const player = createPlayer({ x: 460, y: 760 });

    expect(createShieldFallbackPosition(player, 0)).toEqual({
      x: 432,
      y: 480,
      cameraY: 0,
      platformId: null,
    });
  });

  it("places powerup indicators below a visible combo banner", () => {
    const comboBottom = 15 + 70 + 32;
    const indicatorTop = getPowerupIndicatorY(true) - 18;

    expect(indicatorTop).toBeGreaterThan(comboBottom);
    expect(getPowerupIndicatorY(false)).toBe(90);
  });
});
