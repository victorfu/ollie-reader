export type GameState = "menu" | "settings" | "playing" | "win" | "dead";
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
export type Level = {
  platforms: Platform[];
  enemies: Enemy[];
  coins: Coin[];
  powerups: Powerup[];
  flag: Flag;
  sky: { top: string; bottom: string };
};
export type FloatingText = {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
};
