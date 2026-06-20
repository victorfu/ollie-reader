import { GAME_CONFIG } from "./constants";
import { generateId, randomRange, randomInt } from "./game-utils";
import {
  type Platform,
  PlatformType,
  type Collectible,
  CollectibleType,
  type Powerup,
  PowerupType,
  type Critter,
  type Gust,
} from "./types";

export function createPlatform(
  x: number,
  y: number,
  type: PlatformType,
): Platform {
  const platform: Platform = {
    id: generateId(),
    x,
    y,
    width: GAME_CONFIG.PLATFORM.WIDTH,
    height: GAME_CONFIG.PLATFORM.HEIGHT,
    type,
    velocity: { x: 0, y: 0 },
    isBreaking: false,
  };

  if (type === PlatformType.Vanishing) {
    platform.remainingUses = 1;
  }

  if (type === PlatformType.Moving) {
    const range = randomInt(
      GAME_CONFIG.PLATFORM.MOVING_RANGE.MIN,
      GAME_CONFIG.PLATFORM.MOVING_RANGE.MAX,
    );
    const speed = randomRange(
      GAME_CONFIG.PLATFORM.MOVING_SPEED.MIN,
      GAME_CONFIG.PLATFORM.MOVING_SPEED.MAX,
    );

    platform.movingData = {
      baseX: x,
      range,
      speed,
      direction: Math.random() > 0.5 ? 1 : -1,
    };
  }

  return platform;
}

export function createCarrot(x: number, y: number): Collectible {
  return {
    id: generateId(),
    x,
    y: y - GAME_CONFIG.COLLECTIBLE.CARROT_OFFSET_Y,
    width: GAME_CONFIG.COLLECTIBLE.CARROT_SIZE,
    height: GAME_CONFIG.COLLECTIBLE.CARROT_SIZE,
    type: CollectibleType.Carrot,
    velocity: { x: 0, y: 0 },
    collected: false,
  };
}

export function createPowerup(x: number, y: number): Powerup {
  const types = [
    PowerupType.Flight,
    PowerupType.SuperJump,
    PowerupType.Magnet,
    PowerupType.Shield,
  ];
  const randomType = types[Math.floor(Math.random() * types.length)];

  return {
    id: generateId(),
    x,
    y: y - GAME_CONFIG.POWERUP.OFFSET_Y,
    width: GAME_CONFIG.POWERUP.SIZE,
    height: GAME_CONFIG.POWERUP.SIZE,
    type: randomType,
    velocity: { x: 0, y: 0 },
    collected: false,
  };
}

export function createCritter(platform: Platform): Critter {
  return {
    id: generateId(),
    platformId: platform.id,
    x:
      platform.x +
      platform.width / 2 -
      GAME_CONFIG.CRITTER.WIDTH / 2,
    y: platform.y - GAME_CONFIG.CRITTER.HEIGHT - 2,
    width: GAME_CONFIG.CRITTER.WIDTH,
    height: GAME_CONFIG.CRITTER.HEIGHT,
    velocity: { x: 0, y: 0 },
    stomped: false,
  };
}

export function createGust(y: number): Gust {
  return {
    id: generateId(),
    y,
    height: GAME_CONFIG.GUST.HEIGHT,
    strength: GAME_CONFIG.GUST.STRENGTH,
    direction: Math.random() > 0.5 ? 1 : -1,
  };
}

export function selectPlatformType(heightProgress: number): PlatformType {
  let distribution: {
    STATIC: number;
    MOVING: number;
    BREAKABLE: number;
    VANISHING: number;
  };

  if (heightProgress < GAME_CONFIG.DIFFICULTY.EASY.HEIGHT_THRESHOLD) {
    distribution = GAME_CONFIG.DIFFICULTY.EASY.PLATFORM_DISTRIBUTION;
  } else if (heightProgress < GAME_CONFIG.DIFFICULTY.MEDIUM.HEIGHT_THRESHOLD) {
    distribution = GAME_CONFIG.DIFFICULTY.MEDIUM.PLATFORM_DISTRIBUTION;
  } else {
    distribution = GAME_CONFIG.DIFFICULTY.HARD.PLATFORM_DISTRIBUTION;
  }

  const rand = Math.random();

  if (rand < distribution.STATIC) {
    return PlatformType.Static;
  } else if (rand < distribution.STATIC + distribution.MOVING) {
    return PlatformType.Moving;
  } else if (rand < distribution.STATIC + distribution.MOVING + distribution.BREAKABLE) {
    return PlatformType.Breakable;
  } else {
    return PlatformType.Vanishing;
  }
}

export function getGapRange(heightProgress: number): {
  min: number;
  max: number;
} {
  return getGapRangeWithScale(heightProgress, 1);
}

export function getGapRangeWithScale(
  heightProgress: number,
  gapScale: number,
): { min: number; max: number } {
  if (heightProgress < GAME_CONFIG.DIFFICULTY.EASY.HEIGHT_THRESHOLD) {
    return scaleRange(GAME_CONFIG.DIFFICULTY.EASY.GAP_Y, gapScale);
  } else if (heightProgress < GAME_CONFIG.DIFFICULTY.MEDIUM.HEIGHT_THRESHOLD) {
    return scaleRange(GAME_CONFIG.DIFFICULTY.MEDIUM.GAP_Y, gapScale);
  } else {
    return scaleRange(GAME_CONFIG.DIFFICULTY.HARD.GAP_Y, gapScale);
  }
}

const scaleRange = (
  range: { MIN: number; MAX: number },
  gapScale: number,
) => ({
  min: Math.round(range.MIN * gapScale),
  max: Math.round(range.MAX * gapScale),
});
