export type GameState =
  | "menu"
  | "settings"
  | "playing"
  | "paused"
  | "win"
  | "dead"
  | "tutorialComplete";
export type Platform = { x: number; y: number; w: number; h: number };
export type EnemyType = "normal" | "fast" | "jumper" | "spiked";
export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};
export type Enemy = {
  x: number;
  y: number;
  w: number;
  h: number;
  dir: 1 | -1;
  speed: number;
  alive: boolean;
  vy?: number;
  type: EnemyType;
  jumpTimer?: number;
  // 行為狀態
  baseSpeed?: number; // 原始速度
  isCharging?: boolean; // 是否正在衝刺
  chargeTimer?: number; // 衝刺/暫停計時器
  pauseTimer?: number; // spiked 暫停計時器
};
export type Coin = { x: number; y: number; r: number; taken: boolean };
export type Flag = { x: number; y: number; h: number };
export type PowerType = "star" | "feather" | "boot" | "heart";
export type Powerup = {
  x: number;
  y: number;
  r: number;
  type: PowerType;
  taken: boolean;
};
// 教學關：進入 [x, x+w] 區間時顯示 text 的告示（告示牌立在 anchorX 的地面上）
export type TutorialTrigger = {
  id: string;
  x: number;
  w: number;
  text: string;
  anchorX: number;
};
// 教學關：條件達成前擋路的門
export type TutorialGate = {
  id: string;
  x: number;
  hint: string;
  until: "enemiesCleared" | "coinsCollected";
};
export type Level = {
  platforms: Platform[];
  enemies: Enemy[];
  coins: Coin[];
  powerups: Powerup[];
  flag: Flag;
  sky: { top: string; bottom: string };
  tutorial?: boolean; // 教學關：不扣生命、旗子改為完成教學
  triggers?: TutorialTrigger[];
  gates?: TutorialGate[];
};
export type MushroomProgress = {
  version: 1;
  highestUnlocked: number; // 0-based 已解鎖的最高關卡索引
  tutorialDone: boolean;
};
export type FloatingText = {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
};
