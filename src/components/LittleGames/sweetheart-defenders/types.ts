// 甜心防衛隊 — 全遊戲共用型別。
// 這裡只放資料形狀，不放任何邏輯，也不 import 任何會碰到 DOM 的東西，
// 讓 engine/ 底下的模組可以在 vitest 裡直接跑（不需要 canvas）。

export const ELEMENTS = [
  "spark",
  "tide",
  "leaf",
  "light",
  "dream",
  "ember",
  "crystal",
  "star",
] as const;
export type Element = (typeof ELEMENTS)[number];

export const RARITIES = [
  "common",
  "uncommon",
  "rare",
  "warden",
  "mythling",
] as const;
export type Rarity = (typeof RARITIES)[number];

/** 元素決定塔的攻擊原型（8 元素 → 8 種打法）。 */
export type TowerArchetype =
  | "rapid" // 速射：高攻速、低單發、單體
  | "syrup" // 糖漿：減速、低傷害
  | "vine" // 藤蔓：範圍持續傷害
  | "sniper" // 狙擊：超長射程、慢、高單發
  | "lullaby" // 催眠：機率暈眩
  | "burst" // 爆裂：濺射 AoE
  | "cannon" // 重砲：高傷慢速、破甲
  | "cheer"; // 應援：不攻擊，加速周圍塔

/**
 * 副元素帶來的特性。單一元素的角色拿 "pure"（純傷害加成）。
 * 打法 × 特性 = 每隻角色的實際手感，詳見 data/traits.ts。
 */
export type TowerTrait =
  | "pure"
  | "chain"
  | "chill"
  | "toxin"
  | "focus"
  | "daze"
  | "scorch"
  | "shred"
  | "encore";

/** 攻擊的視覺樣式。每種打法長得不一樣，不是全部都射一顆彩色球。 */
export type AttackStyle =
  | "bolt" // 速射：又小又快的電光
  | "syrupBlob" // 糖漿：會晃的黏稠球
  | "groundPulse" // 藤蔓：腳邊擴散的波紋，沒有飛行物
  | "beam" // 狙擊：瞬間的光束線
  | "note" // 催眠：飄上去的音符
  | "mortar" // 爆裂：拋物線砲彈
  | "shard" // 重砲：又大又鈍的晶石
  | "aura"; // 應援：脈動的光環，沒有飛行物

export type Vec2 = { x: number; y: number };

// === 角色（塔） ===

/** 一個可以放上塔位的角色。資料來自扭蛋機，見 data/characters.ts。 */
export type TowerCharacter = {
  /** 對應扭蛋機的角色 id */
  id: string;
  /** 英文名，例：Cinnamoroll */
  name: string;
  /** 中文名，例：大耳狗喜拿 */
  nameZh: string;
  /** 第一個是主元素，決定塔的攻擊原型 */
  elements: [Element, ...Element[]];
  rarity: Rarity;
  /** 直接沿用扭蛋機的角色圖 */
  sprite: string;
};

/** 一座塔在某個等級下的實際數值（由 pet + level 算出來）。 */
export type TowerStats = {
  archetype: TowerArchetype;
  attackStyle: AttackStyle;
  element: Element;
  /** 副元素帶來的特性；單元素為 "pure" */
  trait: TowerTrait;
  /** 特性強度，隨稀有度與等級成長（1 = 基準值） */
  traitPower: number;
  /** 射程（邏輯座標 px） */
  range: number;
  /** 每次攻擊的傷害 */
  damage: number;
  /** 攻擊間隔（毫秒） */
  cooldownMs: number;
  /** burst 的濺射半徑；非 burst 為 0 */
  splashRadius: number;
  /** syrup 的減速比例（0–1）；非 syrup 為 0 */
  slowFactor: number;
  /** lullaby 的暈眩機率（0–1）；非 lullaby 為 0 */
  stunChance: number;
  /** cannon 無視的護甲比例（0–1）；非 cannon 為 0 */
  armorPierce: number;
  /** cheer 給周圍塔的攻速加成（0–1）；非 cheer 為 0 */
  cheerBonus: number;
};

// === 敵人（糖果怪） ===

export type EnemyKind =
  | "gumdrop"
  | "marshmallow"
  | "chocolate"
  | "soda"
  | "soda-mini"
  | "frosting-ghost"
  | "lollipop"
  | "pudding-king"
  | "macaron-queen"
  | "cake-titan";

/**
 * 第一階段用 canvas 程式繪製的佔位圖形。等 AI 生圖做好之後，只要在
 * EnemySpec 填上 `sprite`，renderer 就會改畫圖片，邏輯完全不用動。
 */
export type EnemyShape =
  | "gumdrop"
  | "pillow"
  | "block"
  | "bubble"
  | "ghost"
  | "swirl"
  | "dome"
  | "tier";

export type EnemySpec = {
  id: EnemyKind;
  nameZh: string;
  element: Element;
  hp: number;
  /** 沿路徑前進速度（邏輯座標 px/秒） */
  speed: number;
  /** 減傷比例 0–0.8 */
  armor: number;
  /** 擊倒掉落的糖霜 */
  reward: number;
  /** 走到櫃檯會偷走幾塊蛋糕 */
  cakeSteal: number;
  /** 繪製與命中判定半徑 */
  radius: number;
  flying?: boolean;
  slowImmune?: boolean;
  boss?: boolean;
  /** 死亡時分裂 */
  splitInto?: { kind: EnemyKind; count: number };
  /** 週期召喚小兵 */
  summon?: { kind: EnemyKind; count: number; everyMs: number };
  /** 週期上護盾 */
  shield?: { amount: number; everyMs: number };
  /** 佔位繪製用的形狀與配色 */
  shape: EnemyShape;
  palette: { body: string; shade: string; accent: string };
  /** 之後換成 AI 生圖時填這裡 */
  sprite?: string;
};

// === 關卡 ===

/** 一波裡的一組敵人：間隔 gapMs 生出 count 隻 kind。 */
export type WaveGroup = {
  kind: EnemyKind;
  count: number;
  /** 同組之間的生成間隔 */
  gapMs: number;
  /** 這一波開始後，等多久才輪到這組 */
  delayMs: number;
  /** 走哪一條路徑（對應 LevelSpec.paths 的索引） */
  pathIndex?: number;
};

export type WaveSpec = {
  groups: WaveGroup[];
  /** 打完這一波的獎金 */
  bonus: number;
};

export type LevelSpec = {
  id: string;
  nameZh: string;
  /** 敵人行進路線；每條都是一串折線點，最後一點是櫃檯 */
  paths: Vec2[][];
  /** 可以放塔的位置 */
  slots: { id: string; x: number; y: number }[];
  waves: WaveSpec[];
  startingFrosting: number;
  /** 主題配色（背景、路面） */
  theme: {
    floor: string;
    floorEdge: string;
    path: string;
    pathEdge: string;
    accent: string;
  };
  /**
   * 通關給的扭蛋代幣。角色改由扭蛋機解鎖之後，關卡給的是錢，
   * 讓玩家自己去抽想要的角色。
   */
  coinReward: { clear: number; threeStars: number };
};

export type Difficulty = "easy" | "normal" | "hard";

// === 戰鬥中的即時狀態 ===

export type LiveEnemy = {
  uid: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  shieldHp: number;
  pathIndex: number;
  /** 沿路徑已前進的距離 */
  distance: number;
  /**
   * 距離櫃檯還有多遠。由 distance 推導出來，但先算好存起來，讓塔可以直接比較
   * 「誰最接近櫃檯」——不同路徑長短不一，直接比 distance 會比錯。
   */
  remaining: number;
  x: number;
  y: number;
  /** 減速殘餘時間（毫秒），0 表示沒被減速 */
  slowMs: number;
  slowFactor: number;
  /** 暈眩殘餘時間（毫秒） */
  stunMs: number;
  /** 持續傷害：每秒扣多少血，還會扣多久 */
  dotDps: number;
  dotMs: number;
  /** 持續傷害的來源顏色，讓毒和灼燒在畫面上分得出來 */
  dotColor: string;
  /** 被碎甲削掉的護甲比例，會累積到上限 */
  armorShred: number;
  nextSummonMs: number;
  nextShieldMs: number;
  /** 受擊閃白殘餘時間（毫秒），純視覺 */
  flashMs: number;
};

export type LiveTower = {
  slotId: string;
  characterId: string;
  level: 1 | 2 | 3;
  /** 距離下次可攻擊還要多久（毫秒） */
  cooldownMs: number;
  /** 本場累積傷害，結算頁顯示 */
  totalDamage: number;
  /** 開火動畫殘餘時間（毫秒），純視覺 */
  recoilMs: number;
  /** 連擊特性用：連續打同一隻目標幾次了 */
  comboHits: number;
  comboTargetUid: number;
};

/** 飛行道具，純視覺；傷害在開火當下就結算了。 */
export type Projectile = {
  uid: number;
  style: AttackStyle;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  color: string;
  radius: number;
  /** 拋物線的高度，只有 mortar 用得到 */
  arc: number;
};

/**
 * 瞬間出現、然後淡掉的折線——狙擊的光束和連鎖的跳彈都用它。
 * 跟 Projectile 分開是因為它不會飛，只是畫一下就消失。
 */
export type Beam = {
  uid: number;
  points: Vec2[];
  color: string;
  width: number;
  ageMs: number;
  lifeMs: number;
};

/** 爆炸、命中特效，純視覺。 */
export type Effect = {
  uid: number;
  kind: "splash" | "pop" | "heal" | "steal";
  x: number;
  y: number;
  radius: number;
  ageMs: number;
  lifeMs: number;
  color: string;
};

export type BattlePhase = "prep" | "wave" | "cleared" | "lost";

export type BattleState = {
  levelId: string;
  difficulty: Difficulty;
  /** 模擬累積時間（毫秒） */
  timeMs: number;
  phase: BattlePhase;
  /** 目前正在打（或即將開始）的波次，0-based */
  waveIndex: number;
  /** 準備階段剩餘時間（毫秒） */
  prepMs: number;
  frosting: number;
  cakes: number;
  maxCakes: number;
  enemies: LiveEnemy[];
  towers: LiveTower[];
  projectiles: Projectile[];
  beams: Beam[];
  effects: Effect[];
  /** 本波還沒生出來的敵人 */
  spawnQueue: { atMs: number; kind: EnemyKind; pathIndex: number }[];
  kills: number;
  /** 被偷走的蛋糕總數 */
  leaked: number;
  speed: 1 | 2;
  /** 種子亂數的狀態，讓整場模擬可重現 */
  rngState: number;
  nextUid: number;
};

/**
 * 玩家指令。模擬層只吃指令、不碰輸入裝置，所以之後要做雙人合作時
 * 只要把對方的指令塞進同一個陣列就好。
 */
export type Command =
  | { kind: "placeTower"; slotId: string; characterId: string }
  | { kind: "upgradeTower"; slotId: string }
  | { kind: "sellTower"; slotId: string }
  | { kind: "startWave" }
  | { kind: "setSpeed"; multiplier: 1 | 2 };
