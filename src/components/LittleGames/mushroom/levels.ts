import { clamp } from "../lib/game-utils";
import type { MushroomSettings } from "../lib/types";
import { EXTRA_SECTION_BASE, EXTRA_SECTION_STEP, HEIGHT } from "./constants";
import { THEMES } from "./themes";
import type {
  Coin,
  Enemy,
  EnemyType,
  Level,
  Platform,
  Powerup,
  PowerType,
} from "./types";

// 教學關：手工腳本化、零坑洞、不經過 extendLevel（無隨機尾段）
// 區段：A 移動 → B 跳躍 → C 上平台 → D 踩蘑菇（門）→ E 金幣 → F 道具 → G 旗子
export const TUTORIAL_LEVEL: Level = {
  tutorial: true,
  theme: THEMES.grassland,
  platforms: [
    { x: 0, y: HEIGHT - 40, w: 2400, h: 40 },
    { x: 620, y: HEIGHT - 100, w: 120, h: 60 }, // B 小台階
    { x: 860, y: HEIGHT - 140, w: 130, h: 16 }, // C 低平台
    { x: 1060, y: HEIGHT - 220, w: 130, h: 16 }, // C 高平台
    { x: 1300, y: HEIGHT - 120, w: 240, h: 16 }, // D 蘑菇圈養台
    { x: 1980, y: HEIGHT - 110, w: 90, h: 16 }, // F 星星台座
  ],
  enemies: [
    // D 區教學目標：慢速、被圈養在平台上（邊緣會折返）
    {
      x: 1380,
      y: HEIGHT - 120 - 32,
      w: 36,
      h: 32,
      dir: 1,
      speed: 40,
      alive: true,
      type: "normal",
    },
    // F 區無敵示範用：慢速靠近星星
    {
      x: 2150,
      y: HEIGHT - 72,
      w: 36,
      h: 32,
      dir: -1,
      speed: 30,
      alive: true,
      type: "normal",
    },
  ],
  coins: [
    // C 區沿爬升路線鋪路
    { x: 925, y: HEIGHT - 180, r: 10, taken: false },
    { x: 1125, y: HEIGHT - 260, r: 10, taken: false },
    { x: 1190, y: HEIGHT - 270, r: 10, taken: false },
    // E 區拱形金幣
    { x: 1640, y: HEIGHT - 100, r: 10, taken: false },
    { x: 1690, y: HEIGHT - 150, r: 10, taken: false },
    { x: 1740, y: HEIGHT - 170, r: 10, taken: false },
    { x: 1790, y: HEIGHT - 150, r: 10, taken: false },
    { x: 1840, y: HEIGHT - 100, r: 10, taken: false },
  ],
  powerups: [
    { x: 2025, y: HEIGHT - 140, r: 14, type: "star", taken: false },
  ],
  flag: { x: 2280, y: HEIGHT - 180, h: 180 },
  triggers: [
    {
      id: "move",
      x: 40,
      w: 340,
      text: "用 ← → 或 A D 鍵移動，往右走吧！",
      anchorX: 230,
    },
    {
      id: "jump",
      x: 420,
      w: 190,
      text: "按 ↑、W 或空白鍵跳上小台階！",
      anchorX: 545,
    },
    {
      id: "climb",
      x: 790,
      w: 280,
      text: "一階一階跳上平台，吃到金幣！",
      anchorX: 815,
    },
    {
      id: "stomp",
      x: 1180,
      w: 320,
      text: "從上面跳下去，踩扁蘑菇怪就能開門！",
      anchorX: 1245,
    },
    {
      id: "coin",
      x: 1600,
      w: 220,
      text: "收集金幣可以加分！",
      anchorX: 1610,
    },
    {
      id: "power",
      x: 1890,
      w: 200,
      text: "吃下星星會無敵一下下，去撞撞看！",
      anchorX: 1920,
    },
    {
      id: "goal",
      x: 2140,
      w: 200,
      text: "碰到旗子就過關囉！",
      anchorX: 2200,
    },
  ],
  gates: [
    {
      id: "gate-stomp",
      x: 1580,
      hint: "踩扁蘑菇怪才能開門",
      until: "enemiesCleared",
    },
  ],
};

// === 程序化尾段的地形 pattern 系統 ===

type PatternResult = {
  plats: Platform[];
  enemies: Enemy[];
  coins: Coin[];
  powerups?: Powerup[];
  // 相對本段起點的地面覆蓋區間；省略 = 全段有地面，區間外 = 坑洞
  ground?: { start: number; end: number }[];
  advance: number; // 本段佔用寬度（下一段從 x + advance 開始）
};

type PatternDef = {
  id: string;
  minLevel: number; // 從第幾關（0-based）開始出現
  fn: (x: number, y: number, diff: number) => PatternResult;
};

const enemyAt = (
  x: number,
  y: number,
  speed: number,
  type: EnemyType = "normal",
  dir: 1 | -1 = 1,
): Enemy => ({ x, y, w: 36, h: 32, dir, speed, alive: true, type });

const coinAt = (x: number, y: number): Coin => ({ x, y, r: 10, taken: false });

const PATTERNS: PatternDef[] = [
  {
    id: "flat-run",
    minLevel: 0,
    fn: (x, y, diff) => {
      const enemies: Enemy[] = [];
      const count = 2 + Math.floor(Math.random() * (2 + diff * 0.8));
      for (let i = 0; i < count; i++) {
        let type: EnemyType = "normal";
        if (diff >= 1 && Math.random() < 0.4) type = "fast";
        if (diff >= 2 && Math.random() < 0.3) type = "jumper";
        if (diff >= 3 && Math.random() < 0.2) type = "spiked";
        enemies.push(
          enemyAt(
            x + 80 + i * 100,
            y - 32,
            80 + diff * 15 + Math.random() * 30,
            type,
            Math.random() > 0.5 ? 1 : -1,
          ),
        );
      }
      return {
        plats: [{ x, y, w: 500, h: 16 }],
        enemies,
        coins: [
          coinAt(x + 100, y - 40),
          coinAt(x + 250, y - 40),
          coinAt(x + 400, y - 40),
        ],
        advance: 550,
      };
    },
  },
  {
    id: "stairs-up",
    minLevel: 0,
    fn: (x, y, diff) => ({
      plats: [
        { x, y, w: 120, h: 16 },
        { x: x + 160, y: y - 60, w: 120, h: 16 },
        { x: x + 320, y: y - 120, w: 120, h: 16 },
      ],
      enemies: [
        enemyAt(x + 360, y - 152, 80, diff > 2 ? "jumper" : "normal"),
      ],
      coins: [
        coinAt(x + 60, y - 40),
        coinAt(x + 220, y - 100),
        coinAt(x + 380, y - 160),
      ],
      advance: 500,
    }),
  },
  {
    id: "gap-jump",
    minLevel: 1,
    fn: (x, y, diff) => ({
      plats: [
        { x, y, w: 100, h: 16 },
        { x: x + 250, y, w: 100, h: 16 },
      ],
      // 中段挖一個 200px 的坑
      ground: [
        { start: 0, end: 120 },
        { start: 320, end: 450 },
      ],
      enemies: diff > 1 ? [enemyAt(x + 270, y - 32, 120, "fast")] : [],
      coins: [coinAt(x + 175, y - 60)],
      advance: 450,
    }),
  },
  {
    id: "tunnel",
    minLevel: 3,
    fn: (x, y, diff) => ({
      plats: [
        { x, y, w: 400, h: 16 },
        { x, y: y - 100, w: 400, h: 40 }, // Ceiling
      ],
      enemies: [
        enemyAt(x + 200, y - 32, 120, diff > 3 ? "spiked" : "fast"),
      ],
      coins: [coinAt(x + 50, y - 30), coinAt(x + 350, y - 30)],
      advance: 450,
    }),
  },
  {
    id: "spring-launch",
    minLevel: 1,
    fn: (x, y) => {
      const highY = clamp(y - 150, HEIGHT - 330, HEIGHT - 210);
      const reward: Powerup[] =
        Math.random() < 0.5
          ? [
              {
                x: x + 305,
                y: highY - 40,
                r: 14,
                type: Math.random() < 0.5 ? "star" : "heart",
                taken: false,
              },
            ]
          : [];
      return {
        plats: [
          { x: x + 120, y: HEIGHT - 56, w: 60, h: 16, kind: "spring" },
          { x: x + 240, y: highY, w: 130, h: 16 },
        ],
        enemies: [],
        coins: [
          coinAt(x + 150, y - 120),
          coinAt(x + 270, highY - 40),
          coinAt(x + 340, highY - 40),
        ],
        powerups: reward,
        advance: 480,
      };
    },
  },
  {
    id: "coin-arc-gap",
    minLevel: 1,
    fn: (x) => ({
      plats: [],
      // 純跳坑：金幣拋物線引導起跳與落點
      ground: [
        { start: 0, end: 100 },
        { start: 300, end: 450 },
      ],
      enemies: [],
      coins: [
        coinAt(x + 90, HEIGHT - 120),
        coinAt(x + 145, HEIGHT - 175),
        coinAt(x + 200, HEIGHT - 195),
        coinAt(x + 255, HEIGHT - 175),
        coinAt(x + 310, HEIGHT - 120),
      ],
      advance: 450,
    }),
  },
  {
    id: "island-chain",
    minLevel: 2,
    fn: (x, y) => {
      const yy = clamp(y, HEIGHT - 240, HEIGHT - 120);
      const island = (ix: number, iy: number): Platform => ({
        x: ix,
        y: iy,
        w: 80,
        h: 16,
      });
      return {
        plats: [
          island(x + 80, yy),
          island(x + 230, yy - 40),
          island(x + 380, yy - 10),
          island(x + 530, yy - 50),
        ],
        // 幾乎整段都是坑，靠小島連跳（島距 ≤ 150，支撐間隙 ≤ 70）
        ground: [
          { start: 0, end: 60 },
          { start: 620, end: 660 },
        ],
        enemies: [],
        coins: [
          coinAt(x + 120, yy - 40),
          coinAt(x + 270, yy - 80),
          coinAt(x + 420, yy - 50),
          coinAt(x + 570, yy - 90),
        ],
        advance: 660,
      };
    },
  },
  {
    id: "stairs-down",
    minLevel: 2,
    fn: (x, y, diff) => {
      const top = clamp(y - 120, HEIGHT - 300, HEIGHT - 160);
      return {
        plats: [
          { x, y: top, w: 120, h: 16 },
          { x: x + 160, y: top + 60, w: 120, h: 16 },
          { x: x + 320, y: top + 120, w: 120, h: 16 },
        ],
        enemies: [
          enemyAt(x + 40, top - 32, 80, diff > 2 ? "fast" : "normal"),
        ],
        coins: [
          coinAt(x + 60, top - 40),
          coinAt(x + 220, top + 20),
          coinAt(x + 380, top + 80),
        ],
        advance: 500,
      };
    },
  },
  {
    id: "moving-crossing",
    minLevel: 5,
    fn: (x, y) => {
      const my = clamp(y - 60, HEIGHT - 260, HEIGHT - 140);
      return {
        plats: [
          {
            x: x + 185,
            y: my,
            w: 110,
            h: 16,
            kind: "moving",
            move: { axis: "x", range: 70, speed: 1.4 },
          },
        ],
        // 250px 的坑由移動平台擺渡
        ground: [
          { start: 0, end: 100 },
          { start: 350, end: 480 },
        ],
        enemies: [],
        coins: [coinAt(x + 240, my - 50), coinAt(x + 240, my - 90)],
        advance: 480,
      };
    },
  },
  {
    id: "bridge-gauntlet",
    minLevel: 4,
    fn: (x, _y, diff) => ({
      plats: [
        // 細橋與地面同高，走上去無縫；橋下是坑
        { x: x + 80, y: HEIGHT - 40, w: 340, h: 14 },
      ],
      ground: [
        { start: 0, end: 80 },
        { start: 420, end: 520 },
      ],
      enemies: [
        enemyAt(x + 180, HEIGHT - 72, 70 + diff * 8),
        enemyAt(x + 320, HEIGHT - 72, 70 + diff * 8, "normal", -1),
      ],
      coins: [coinAt(x + 200, HEIGHT - 120), coinAt(x + 300, HEIGHT - 120)],
      powerups: [
        {
          x: x + 470,
          y: HEIGHT - 120,
          r: 14,
          type: Math.random() < 0.5 ? "heart" : "star",
          taken: false,
        },
      ],
      advance: 520,
    }),
  },
];

// 在手工關卡後接上程序化尾段：pattern 自帶地面（可挖坑），
// 結尾保證一段平地降落帶再接旗子
export function extendLevel(
  base: Level,
  idx: number,
  settings: MushroomSettings,
): Level {
  const extraOffset = base.flag.x + 200;
  const extraLength = EXTRA_SECTION_BASE + EXTRA_SECTION_STEP * idx;
  const newFlagX = extraOffset + extraLength;

  const platforms: Platform[] = base.platforms.map((p) => ({ ...p }));
  const enemies: Enemy[] = base.enemies.map((e) => ({
    ...e,
    type: "normal" as EnemyType,
  }));
  const coins: Coin[] = base.coins.map((c) => ({ ...c }));
  const powerups: Powerup[] = base.powerups.map((p) => ({ ...p }));

  const available = PATTERNS.filter((p) => p.minLevel <= idx);

  let currentX = extraOffset;
  let currentY = HEIGHT - 160;

  // 到 newFlagX - 800 為止，保證旗子前有一段完整的平地降落帶
  while (currentX < newFlagX - 800) {
    const def = available[Math.floor(Math.random() * available.length)];
    const pat = def.fn(currentX, currentY, idx);

    // 地面：預設整段覆蓋；pattern 宣告 ground 時依區間鋪設（區間外為坑）
    const segs = pat.ground ?? [{ start: 0, end: pat.advance }];
    for (const g of segs) {
      platforms.push({
        x: currentX + g.start,
        y: HEIGHT - 40,
        w: g.end - g.start,
        h: 60,
      });
    }

    pat.plats.forEach((p) => platforms.push(p));
    pat.enemies.forEach((e) => {
      // Randomize enemy type based on level index (difficulty)
      let type: EnemyType = "normal";
      const roll = Math.random();
      if (idx >= 1 && roll < 0.3) type = "fast";
      if (idx >= 2 && roll < 0.2) type = "jumper";
      if (idx >= 3 && roll < 0.15) type = "spiked";
      if (e.type === "normal" && type !== "normal") e.type = type;
      enemies.push(e);
    });
    pat.coins.forEach((c) => coins.push(c));
    pat.powerups?.forEach((pw) => powerups.push(pw));

    // 只在無坑的段落加碼（複製敵人／地面巡邏敵），避免敵人生在坑上
    if (!pat.ground) {
      // 套用「敵人數量」設定：依倍率複製本段敵人，每段上限 5 隻
      if (pat.enemies.length > 0 && settings.enemyMultiplier > 1) {
        const target = Math.min(
          5,
          Math.round(pat.enemies.length * settings.enemyMultiplier),
        );
        for (let k = pat.enemies.length; k < target; k++) {
          const src = pat.enemies[k % pat.enemies.length];
          enemies.push({
            ...src,
            x: src.x + 50 + (k - pat.enemies.length) * 60,
            dir: (Math.random() > 0.5 ? 1 : -1) as 1 | -1,
          });
        }
      }

      // 地面巡邏敵：防止「一路衝刺通關」（乘上敵人數量設定）
      const groundEnemyChance = Math.min(
        Math.min(0.25 + idx * 0.1, 0.5) * settings.enemyMultiplier,
        0.6,
      );
      if (Math.random() < groundEnemyChance) {
        const groundEnemyCount = 1 + (idx >= 2 && Math.random() < 0.4 ? 1 : 0);
        for (let g = 0; g < groundEnemyCount; g++) {
          let groundType: EnemyType = "normal";
          const groundRoll = Math.random();
          if (idx >= 1 && groundRoll < 0.35) groundType = "fast";
          if (idx >= 2 && groundRoll < 0.25) groundType = "jumper";
          if (idx >= 3 && groundRoll < 0.18) groundType = "spiked";
          enemies.push(
            enemyAt(
              currentX + 120 + g * 180,
              HEIGHT - 72,
              70 + idx * 10 + Math.random() * 25,
              groundType,
              Math.random() > 0.5 ? 1 : -1,
            ),
          );
        }
      }
    }

    // Chance for powerup（乘上道具頻率設定）
    if (Math.random() < clamp(0.25 * settings.powerupFrequency, 0.1, 0.6)) {
      const types: PowerType[] = ["boot", "feather", "star", "heart"];
      const type = types[Math.floor(Math.random() * types.length)];
      powerups.push({
        x: currentX + 50,
        y: currentY - 80,
        r: 14,
        type,
        taken: false,
      });
    }

    currentX += pat.advance;
    currentY = clamp(
      currentY + (Math.random() > 0.5 ? 50 : -50),
      HEIGHT - 300,
      HEIGHT - 60,
    );
  }

  // 旗子前的平地降落帶
  platforms.push({
    x: currentX,
    y: HEIGHT - 40,
    w: newFlagX + 400 - currentX,
    h: 60,
  });

  return {
    ...base,
    platforms,
    enemies,
    coins,
    powerups,
    flag: { ...base.flag, x: newFlagX },
  };
}

// === 手工關卡：每關輪廓貼合主題（地面段以 h:60 鋪設，坑寬 ≤ 220） ===

export const BASE_LEVELS: Level[] = [
  // L1 草原：平緩入門，三座浮台
  {
    theme: THEMES.grassland,
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 1250, h: 60 },
      { x: 200, y: HEIGHT - 140, w: 120, h: 16 },
      { x: 420, y: HEIGHT - 210, w: 150, h: 16 },
      { x: 680, y: HEIGHT - 180, w: 160, h: 16 },
    ],
    enemies: [
      enemyAt(320, HEIGHT - 72, 70),
      enemyAt(560, HEIGHT - 72, 80, "normal", -1),
      enemyAt(840, HEIGHT - 72, 90),
    ],
    coins: [
      coinAt(250, HEIGHT - 180),
      coinAt(470, HEIGHT - 250),
      coinAt(740, HEIGHT - 220),
    ],
    powerups: [{ x: 640, y: HEIGHT - 220, r: 14, type: "boot", taken: false }],
    flag: { x: 950, y: HEIGHT - 180, h: 180 },
  },
  // L2 森林：樹樁階梯（厚台階），上下起伏
  {
    theme: THEMES.forest,
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 1580, h: 60 },
      { x: 240, y: HEIGHT - 100, w: 100, h: 60 }, // 矮樹樁
      { x: 420, y: HEIGHT - 160, w: 100, h: 120 }, // 高樹樁
      { x: 640, y: HEIGHT - 100, w: 100, h: 60 }, // 矮樹樁
      { x: 850, y: HEIGHT - 200, w: 130, h: 16 },
      { x: 1060, y: HEIGHT - 160, w: 140, h: 16 },
    ],
    enemies: [
      enemyAt(180, HEIGHT - 72, 80),
      enemyAt(560, HEIGHT - 72, 90, "normal", -1),
      enemyAt(760, HEIGHT - 72, 85),
      enemyAt(980, HEIGHT - 72, 75, "normal", -1),
      enemyAt(1180, HEIGHT - 72, 70),
    ],
    coins: [
      coinAt(290, HEIGHT - 140),
      coinAt(470, HEIGHT - 200),
      coinAt(905, HEIGHT - 240),
      coinAt(1120, HEIGHT - 200),
    ],
    powerups: [
      { x: 690, y: HEIGHT - 150, r: 14, type: "feather", taken: false },
    ],
    flag: { x: 1280, y: HEIGHT - 180, h: 180 },
  },
  // L3 湖畔：第一次出現坑洞——先給一座橋，再來一個要跳的小坑
  {
    theme: THEMES.lake,
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 620, h: 60 },
      { x: 620, y: HEIGHT - 40, w: 190, h: 14 }, // 木橋（橋下是水）
      { x: 810, y: HEIGHT - 40, w: 310, h: 60 },
      { x: 1330, y: HEIGHT - 40, w: 490, h: 60 }, // 中間留 210px 的坑
      { x: 300, y: HEIGHT - 160, w: 130, h: 16 },
      { x: 940, y: HEIGHT - 200, w: 140, h: 16 },
      { x: 1420, y: HEIGHT - 170, w: 140, h: 16 },
    ],
    enemies: [
      enemyAt(240, HEIGHT - 72, 85),
      enemyAt(470, HEIGHT - 72, 100, "normal", -1),
      enemyAt(700, HEIGHT - 72, 80), // 橋上
      enemyAt(900, HEIGHT - 72, 90, "normal", -1),
      enemyAt(1050, HEIGHT - 72, 95),
      enemyAt(1480, HEIGHT - 72, 90, "normal", -1),
      enemyAt(1650, HEIGHT - 72, 100),
    ],
    coins: [
      coinAt(350, HEIGHT - 200),
      coinAt(1160, HEIGHT - 130), // 坑上拋物線
      coinAt(1225, HEIGHT - 170),
      coinAt(1290, HEIGHT - 130),
    ],
    powerups: [{ x: 1000, y: HEIGHT - 240, r: 14, type: "star", taken: false }],
    flag: { x: 1520, y: HEIGHT - 180, h: 180 },
  },
  // L4 洞穴：低矮隧道 + 岩台，無坑（黑暗關卡保持友善）
  {
    theme: THEMES.cave,
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 2060, h: 60 },
      { x: 500, y: HEIGHT - 150, w: 320, h: 30 }, // 隧道頂 1
      { x: 900, y: HEIGHT - 220, w: 130, h: 16 },
      { x: 1200, y: HEIGHT - 150, w: 320, h: 30 }, // 隧道頂 2
      { x: 1600, y: HEIGHT - 230, w: 140, h: 16 },
      { x: 1750, y: HEIGHT - 120, w: 110, h: 80 }, // 岩塊
    ],
    enemies: [
      enemyAt(300, HEIGHT - 72, 90),
      enemyAt(600, HEIGHT - 72, 110, "normal", -1), // 隧道內
      enemyAt(760, HEIGHT - 72, 100),
      enemyAt(1000, HEIGHT - 72, 95, "normal", -1),
      enemyAt(1300, HEIGHT - 72, 105), // 隧道內
      enemyAt(1450, HEIGHT - 72, 100),
      enemyAt(1920, HEIGHT - 72, 100, "normal", -1),
    ],
    coins: [
      coinAt(560, HEIGHT - 80),
      coinAt(760, HEIGHT - 80),
      coinAt(1360, HEIGHT - 80),
      coinAt(1660, HEIGHT - 270),
    ],
    powerups: [{ x: 950, y: HEIGHT - 260, r: 14, type: "star", taken: false }],
    flag: { x: 1760, y: HEIGHT - 180, h: 180 },
  },
  // L5 沙漠：沙丘凸塊 + 兩座彈跳蘑菇上高台
  {
    theme: THEMES.desert,
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 2460, h: 60 },
      { x: 350, y: HEIGHT - 90, w: 140, h: 50 }, // 沙丘
      { x: 800, y: HEIGHT - 100, w: 160, h: 60 }, // 沙丘
      { x: 1150, y: HEIGHT - 56, w: 60, h: 16, kind: "spring" },
      { x: 1230, y: HEIGHT - 260, w: 130, h: 16 },
      { x: 1500, y: HEIGHT - 90, w: 140, h: 50 }, // 沙丘
      { x: 1900, y: HEIGHT - 56, w: 60, h: 16, kind: "spring" },
      { x: 1980, y: HEIGHT - 280, w: 130, h: 16 },
    ],
    enemies: [
      enemyAt(250, HEIGHT - 72, 95),
      enemyAt(550, HEIGHT - 72, 115, "normal", -1),
      enemyAt(700, HEIGHT - 72, 100),
      enemyAt(1000, HEIGHT - 72, 110, "normal", -1),
      enemyAt(1300, HEIGHT - 72, 105),
      enemyAt(1440, HEIGHT - 72, 120, "normal", -1),
      enemyAt(1700, HEIGHT - 72, 100),
      enemyAt(2050, HEIGHT - 72, 120, "normal", -1),
      enemyAt(2200, HEIGHT - 72, 120),
      enemyAt(2320, HEIGHT - 72, 100, "normal", -1),
    ],
    coins: [
      coinAt(410, HEIGHT - 140),
      coinAt(870, HEIGHT - 160),
      coinAt(2010, HEIGHT - 320),
      coinAt(2070, HEIGHT - 320),
      coinAt(1560, HEIGHT - 140),
    ],
    powerups: [
      { x: 1290, y: HEIGHT - 300, r: 14, type: "heart", taken: false },
    ],
    flag: { x: 2160, y: HEIGHT - 180, h: 180 },
  },
  // L6 雲端：浮島連跳 + 第一座移動平台，兩個坑
  {
    theme: THEMES.clouds,
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 700, h: 60 },
      { x: 920, y: HEIGHT - 40, w: 640, h: 60 }, // 坑1 700–920（220）
      { x: 1780, y: HEIGHT - 40, w: 1040, h: 60 }, // 坑2 1560–1780（220）
      { x: 735, y: HEIGHT - 150, w: 70, h: 16 }, // 坑1 浮島
      { x: 845, y: HEIGHT - 170, w: 70, h: 16 },
      {
        x: 1615,
        y: HEIGHT - 160,
        w: 110,
        h: 16,
        kind: "moving",
        move: { axis: "x", range: 70, speed: 1.5 },
      },
      { x: 300, y: HEIGHT - 180, w: 130, h: 16 },
      { x: 1150, y: HEIGHT - 220, w: 140, h: 16 },
      { x: 2100, y: HEIGHT - 200, w: 150, h: 16 },
      { x: 2350, y: HEIGHT - 260, w: 120, h: 16 },
    ],
    enemies: [
      enemyAt(200, HEIGHT - 72, 100),
      enemyAt(450, HEIGHT - 72, 120, "normal", -1),
      enemyAt(600, HEIGHT - 72, 95),
      enemyAt(1000, HEIGHT - 72, 110, "normal", -1),
      enemyAt(1180, HEIGHT - 72, 105),
      enemyAt(1350, HEIGHT - 72, 125, "normal", -1),
      enemyAt(1480, HEIGHT - 72, 100),
      enemyAt(1900, HEIGHT - 72, 115, "normal", -1),
      enemyAt(2100, HEIGHT - 72, 90),
      enemyAt(2250, HEIGHT - 72, 110, "normal", -1),
      enemyAt(2450, HEIGHT - 72, 120),
    ],
    coins: [
      coinAt(770, HEIGHT - 200), // 坑1 上
      coinAt(880, HEIGHT - 220),
      coinAt(1670, HEIGHT - 220), // 坑2 移動平台上方
      coinAt(1210, HEIGHT - 260),
    ],
    powerups: [
      { x: 1200, y: HEIGHT - 260, r: 14, type: "feather", taken: false },
    ],
    flag: { x: 2520, y: HEIGHT - 180, h: 180 },
  },
  // L7 雪地：大雪階金字塔 + 彈跳蘑菇上高崖
  {
    theme: THEMES.snow,
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3020, h: 60 },
      { x: 600, y: HEIGHT - 100, w: 180, h: 60 }, // 雪階
      { x: 780, y: HEIGHT - 160, w: 180, h: 120 }, // 雪階（高）
      { x: 960, y: HEIGHT - 100, w: 180, h: 60 }, // 雪階
      { x: 1400, y: HEIGHT - 56, w: 60, h: 16, kind: "spring" },
      { x: 1480, y: HEIGHT - 300, w: 140, h: 16 }, // 高崖
      { x: 1800, y: HEIGHT - 120, w: 220, h: 80 }, // 大雪塊
      { x: 2300, y: HEIGHT - 180, w: 140, h: 16 },
      { x: 2550, y: HEIGHT - 240, w: 130, h: 16 },
    ],
    enemies: [
      enemyAt(250, HEIGHT - 72, 105),
      enemyAt(450, HEIGHT - 72, 130, "normal", -1),
      enemyAt(680, HEIGHT - 132, 100), // 雪階上
      enemyAt(1100, HEIGHT - 72, 120, "normal", -1),
      enemyAt(1250, HEIGHT - 72, 110),
      enemyAt(1600, HEIGHT - 72, 135, "normal", -1),
      enemyAt(1880, HEIGHT - 152, 105), // 雪塊上
      enemyAt(2100, HEIGHT - 72, 125, "normal", -1),
      enemyAt(2250, HEIGHT - 72, 115),
      enemyAt(2500, HEIGHT - 72, 120, "normal", -1),
      enemyAt(2700, HEIGHT - 72, 130),
      enemyAt(2850, HEIGHT - 72, 140, "normal", -1),
    ],
    coins: [
      coinAt(870, HEIGHT - 200),
      coinAt(1440, HEIGHT - 160),
      coinAt(2360, HEIGHT - 220),
      coinAt(2610, HEIGHT - 280),
    ],
    powerups: [
      { x: 1540, y: HEIGHT - 340, r: 14, type: "star", taken: false },
    ],
    flag: { x: 2720, y: HEIGHT - 180, h: 180 },
  },
  // L8 黃昏：懸崖峭壁地形（可攀爬的大岩壁）+ 一個峽谷坑
  {
    theme: THEMES.dusk,
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 1500, h: 60 },
      { x: 1700, y: HEIGHT - 40, w: 1400, h: 60 }, // 峽谷 1500–1700（200）
      { x: 500, y: HEIGHT - 120, w: 240, h: 80 }, // 岩壁 1
      { x: 740, y: HEIGHT - 200, w: 240, h: 160 }, // 岩壁 2（最高）
      { x: 980, y: HEIGHT - 120, w: 240, h: 80 }, // 岩壁 3
      { x: 2100, y: HEIGHT - 140, w: 200, h: 100 }, // 對岸岩台
      { x: 2500, y: HEIGHT - 200, w: 140, h: 16 },
    ],
    enemies: [
      enemyAt(300, HEIGHT - 72, 110),
      enemyAt(850, HEIGHT - 232, 105), // 岩壁頂
      enemyAt(1100, HEIGHT - 152, 130, "normal", -1),
      enemyAt(1300, HEIGHT - 72, 115),
      enemyAt(1800, HEIGHT - 72, 145, "normal", -1),
      enemyAt(1950, HEIGHT - 72, 110),
      enemyAt(2180, HEIGHT - 172, 135), // 岩台上
      enemyAt(2400, HEIGHT - 72, 120, "normal", -1),
      enemyAt(2600, HEIGHT - 72, 120),
      enemyAt(2750, HEIGHT - 72, 140, "normal", -1),
      enemyAt(2900, HEIGHT - 72, 150),
      enemyAt(1420, HEIGHT - 72, 105),
    ],
    coins: [
      coinAt(860, HEIGHT - 240),
      coinAt(1560, HEIGHT - 130), // 峽谷上
      coinAt(1620, HEIGHT - 160),
      coinAt(2550, HEIGHT - 240),
    ],
    powerups: [{ x: 1680, y: HEIGHT - 60, r: 14, type: "boot", taken: false }],
    flag: { x: 2800, y: HEIGHT - 180, h: 180 },
  },
  // L9 夜晚：兩座垂直高塔（之字形攀爬拿獎勵）
  {
    theme: THEMES.night,
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3520, h: 60 },
      // 塔 1
      { x: 700, y: HEIGHT - 140, w: 120, h: 16 },
      { x: 860, y: HEIGHT - 220, w: 120, h: 16 },
      { x: 700, y: HEIGHT - 300, w: 120, h: 16 },
      // 塔 2
      { x: 2200, y: HEIGHT - 150, w: 120, h: 16 },
      { x: 2360, y: HEIGHT - 230, w: 120, h: 16 },
      { x: 2200, y: HEIGHT - 310, w: 120, h: 16 },
      // 中途休息點
      { x: 1400, y: HEIGHT - 180, w: 140, h: 16 },
      { x: 2800, y: HEIGHT - 200, w: 140, h: 16 },
    ],
    enemies: [
      enemyAt(300, HEIGHT - 72, 115),
      enemyAt(500, HEIGHT - 72, 150, "normal", -1),
      enemyAt(900, HEIGHT - 72, 110),
      enemyAt(1100, HEIGHT - 72, 140, "normal", -1),
      enemyAt(1300, HEIGHT - 72, 120),
      enemyAt(1460, HEIGHT - 212, 115), // 休息點上
      enemyAt(1700, HEIGHT - 72, 155, "normal", -1),
      enemyAt(1900, HEIGHT - 72, 115),
      enemyAt(2100, HEIGHT - 72, 145, "normal", -1),
      enemyAt(2500, HEIGHT - 72, 125),
      enemyAt(2700, HEIGHT - 72, 130, "normal", -1),
      enemyAt(2950, HEIGHT - 72, 130),
      enemyAt(3150, HEIGHT - 72, 150, "normal", -1),
    ],
    coins: [
      coinAt(760, HEIGHT - 340), // 塔1 頂
      coinAt(2260, HEIGHT - 350), // 塔2 頂
      coinAt(1460, HEIGHT - 220),
      coinAt(2860, HEIGHT - 240),
    ],
    powerups: [
      { x: 2260, y: HEIGHT - 350, r: 14, type: "star", taken: false },
      { x: 1460, y: HEIGHT - 220, r: 14, type: "heart", taken: false },
    ],
    flag: { x: 3220, y: HEIGHT - 180, h: 180 },
  },
  // L10 星空大結局：浮島、移動平台、彈跳蘑菇全部登場，兩個坑
  {
    theme: THEMES.starry,
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 900, h: 60 },
      { x: 1120, y: HEIGHT - 40, w: 930, h: 60 }, // 坑1 900–1120（220）
      { x: 2270, y: HEIGHT - 40, w: 1330, h: 60 }, // 坑2 2050–2270（220）
      { x: 935, y: HEIGHT - 150, w: 70, h: 16 }, // 坑1 浮島
      { x: 1040, y: HEIGHT - 180, w: 70, h: 16 },
      {
        x: 2085,
        y: HEIGHT - 170,
        w: 110,
        h: 16,
        kind: "moving",
        move: { axis: "x", range: 70, speed: 1.6 },
      },
      { x: 1600, y: HEIGHT - 56, w: 60, h: 16, kind: "spring" },
      { x: 1690, y: HEIGHT - 300, w: 140, h: 16 }, // 彈簧高台
      { x: 400, y: HEIGHT - 180, w: 130, h: 16 },
      { x: 2600, y: HEIGHT - 220, w: 140, h: 16 },
      { x: 2900, y: HEIGHT - 160, w: 130, h: 16 },
      { x: 3050, y: HEIGHT - 260, w: 120, h: 16 },
    ],
    enemies: [
      enemyAt(250, HEIGHT - 72, 120),
      enemyAt(450, HEIGHT - 72, 160, "normal", -1),
      enemyAt(650, HEIGHT - 72, 115),
      enemyAt(1200, HEIGHT - 72, 150, "normal", -1),
      enemyAt(1350, HEIGHT - 72, 125),
      enemyAt(1500, HEIGHT - 72, 165, "normal", -1),
      enemyAt(1750, HEIGHT - 72, 120),
      enemyAt(1900, HEIGHT - 72, 155, "normal", -1),
      enemyAt(2350, HEIGHT - 72, 130),
      enemyAt(2500, HEIGHT - 72, 140, "normal", -1),
      enemyAt(2700, HEIGHT - 72, 140),
      enemyAt(2850, HEIGHT - 72, 160, "normal", -1),
      enemyAt(3050, HEIGHT - 72, 170),
      enemyAt(3250, HEIGHT - 72, 180, "normal", -1),
    ],
    coins: [
      coinAt(970, HEIGHT - 200), // 坑1 上
      coinAt(1080, HEIGHT - 230),
      coinAt(2140, HEIGHT - 230), // 坑2 移動平台上
      coinAt(1750, HEIGHT - 340), // 彈簧高台
      coinAt(3110, HEIGHT - 300),
    ],
    powerups: [
      { x: 1720, y: HEIGHT - 340, r: 14, type: "feather", taken: false },
      { x: 2950, y: HEIGHT - 200, r: 14, type: "star", taken: false },
    ],
    flag: { x: 3300, y: HEIGHT - 180, h: 180 },
  },
];

export const LEVEL_COUNT = BASE_LEVELS.length;

// 每次開局重新生成（隨機尾段每輪都不同），並套用玩家設定
export function buildLevels(settings: MushroomSettings): Level[] {
  return BASE_LEVELS.map((lvl, index) => extendLevel(lvl, index, settings));
}
