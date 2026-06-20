export const GAME_CONFIG = {
  WIDTH: 480,
  HEIGHT: 800,
  GRAVITY: 1000,
  MOVE_SPEED: 280,
  JUMP_FORCE: 750,
  MARGIN_X: 30,

  PLAYER: {
    WIDTH: 48,
    HEIGHT: 48,
    BOUNCE: 0.1,
    START_Y_RATIO: 0.8,
  },

  PLATFORM: {
    WIDTH: 90,
    HEIGHT: 18,
    MOVING_RANGE: { MIN: 80, MAX: 140 },
    MOVING_SPEED: { MIN: 50, MAX: 90 },
    BREAK_DELAY: 250,
  },

  COLLECTIBLE: {
    CARROT_SIZE: 28,
    CARROT_OFFSET_Y: 45,
    SPAWN_CHANCE: 0.35,
  },

  POWERUP: {
    SIZE: 36,
    OFFSET_Y: 55,
    SPAWN_CHANCE: 0.03,
    DURATIONS: {
      FLIGHT: 3000,
      SUPER_JUMP: 8000,
      MAGNET: 6000,
      SHIELD: -1,
    },
    MAGNET_RANGE: 150,
    MAGNET_SPEED: 200,
    FLIGHT_SPEED: -200,
    SUPER_JUMP_MULTIPLIER: 1.5,
  },

  SCORING: {
    HEIGHT_FACTOR: 0.5,
    CARROT_POINTS: 50,
    BEST_SCORE_KEY: "bunnyJumperBestScore",
    COMBO_WINDOW_MS: 2500,
  },

  DIFFICULTY: {
    EASY: {
      HEIGHT_THRESHOLD: 1500,
      GAP_Y: { MIN: 70, MAX: 110 },
      PLATFORM_DISTRIBUTION: {
        STATIC: 0.75,
        MOVING: 0.15,
        BREAKABLE: 0.05,
        VANISHING: 0.05,
      },
    },
    MEDIUM: {
      HEIGHT_THRESHOLD: 3500,
      GAP_Y: { MIN: 85, MAX: 125 },
      PLATFORM_DISTRIBUTION: {
        STATIC: 0.55,
        MOVING: 0.25,
        BREAKABLE: 0.1,
        VANISHING: 0.1,
      },
    },
    HARD: {
      HEIGHT_THRESHOLD: Infinity,
      GAP_Y: { MIN: 95, MAX: 135 },
      PLATFORM_DISTRIBUTION: {
        STATIC: 0.45,
        MOVING: 0.3,
        BREAKABLE: 0.15,
        VANISHING: 0.1,
      },
    },
  },

  GUST: {
    SPAWN_CHANCE: 0.18,
    HEIGHT: 140,
    STRENGTH: 220,
  },

  CRITTER: {
    SPAWN_CHANCE: 0.16,
    WIDTH: 28,
    HEIGHT: 22,
    BOUNCE_MULTIPLIER: 1.2,
    KNOCKBACK: 180,
  },

  INITIAL_PLATFORMS: 18,
} as const;

// === 森林蘑菇冒險設定 ===
export const MUSHROOM_CONFIG = {
  COMBO_WINDOW_MS: 2000, // 連擊判定時間窗口（毫秒）
  MAX_PARTICLES: 50, // 粒子數量上限
  SETTINGS_KEY: "mushroom-adventure-settings",
  BEST_SCORE_KEY: "mushroom-adventure-best",

  DEFAULT_SETTINGS: {
    difficultyScale: 1.0,
    enemyMultiplier: 1,
    powerupFrequency: 1.0,
    enableParticles: true,
  },

  // 連擊分數計算
  STOMP_BASE_SCORE: 50,
  COMBO_BONUS_PER_HIT: 25,

  // 螢幕震動
  SHAKE_INTENSITY: 8,
  SHAKE_DURATION: 0.3,

  // 粒子效果
  PARTICLE_COUNT_MIN: 8,
  PARTICLE_COUNT_MAX: 12,
  PARTICLE_LIFE: 0.8,
} as const;
