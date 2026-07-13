import { clamp } from "../lib/game-utils";
import type { MushroomSettings } from "../lib/types";
import { EXTRA_SECTION_BASE, EXTRA_SECTION_STEP, HEIGHT } from "./constants";
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
  sky: { top: "#c8f7e1", bottom: "#e8f3ff" },
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

export function extendLevel(
  base: Level,
  idx: number,
  settings: MushroomSettings,
): Level {
  const extraOffset = base.flag.x + 200;
  const extraLength = EXTRA_SECTION_BASE + EXTRA_SECTION_STEP * idx;
  const newFlagX = extraOffset + extraLength;

  // Patterns
  const patterns = [
    // Pattern 0: Flat run with enemies (增加地面敵人)
    (x: number, y: number, diff: number) => {
      const enemies: Enemy[] = [];
      // 大幅增加敵人數量
      const count = 2 + Math.floor(Math.random() * (2 + diff * 0.8));
      for (let i = 0; i < count; i++) {
        // 根據難度選擇敵人類型
        let type: EnemyType = "normal";
        if (diff >= 1 && Math.random() < 0.4) type = "fast";
        if (diff >= 2 && Math.random() < 0.3) type = "jumper";
        if (diff >= 3 && Math.random() < 0.2) type = "spiked";

        const speed = 80 + diff * 15 + Math.random() * 30;
        enemies.push({
          x: x + 80 + i * 100,
          y: y - 32,
          w: 36,
          h: 32,
          dir: (Math.random() > 0.5 ? 1 : -1) as 1 | -1,
          speed,
          alive: true,
          type,
        });
      }
      return {
        plats: [{ x, y, w: 500, h: 16 }],
        enemies,
        coins: [
          { x: x + 100, y: y - 40, r: 10, taken: false },
          { x: x + 250, y: y - 40, r: 10, taken: false },
          { x: x + 400, y: y - 40, r: 10, taken: false },
        ],
      };
    },
    // Pattern 1: Stairs up
    (x: number, y: number, diff: number) => ({
      plats: [
        { x, y, w: 120, h: 16 },
        { x: x + 160, y: y - 60, w: 120, h: 16 },
        { x: x + 320, y: y - 120, w: 120, h: 16 },
      ],
      enemies: [
        {
          x: x + 360,
          y: y - 120 - 32,
          w: 36,
          h: 32,
          dir: 1,
          speed: 80,
          alive: true,
          type: diff > 2 ? "jumper" : "normal",
        },
      ],
      coins: [
        { x: x + 60, y: y - 40, r: 10, taken: false },
        { x: x + 220, y: y - 100, r: 10, taken: false },
        { x: x + 380, y: y - 160, r: 10, taken: false },
      ],
    }),
    // Pattern 2: Gap jump
    (x: number, y: number, diff: number) => ({
      plats: [
        { x, y, w: 100, h: 16 },
        { x: x + 250, y: y, w: 100, h: 16 },
      ],
      enemies:
        diff > 1
          ? [
              {
                x: x + 270,
                y: y - 32,
                w: 36,
                h: 32,
                dir: 1,
                speed: 120,
                alive: true,
                type: "fast",
              },
            ]
          : [],
      coins: [{ x: x + 175, y: y - 60, r: 10, taken: false }],
    }),
    // Pattern 3: Tunnel (low ceiling)
    (x: number, y: number, diff: number) => ({
      plats: [
        { x, y, w: 400, h: 16 },
        { x, y: y - 100, w: 400, h: 40 }, // Ceiling
      ],
      enemies: [
        {
          x: x + 200,
          y: y - 32,
          w: 36,
          h: 32,
          dir: 1,
          speed: 120,
          alive: true,
          type: diff > 3 ? "spiked" : "fast",
        },
      ],
      coins: [
        { x: x + 50, y: y - 30, r: 10, taken: false },
        { x: x + 350, y: y - 30, r: 10, taken: false },
      ],
    }),
  ];

  const platforms = base.platforms.map((p, i) =>
    i === 0 ? { ...p, w: Math.max(p.w, newFlagX + 400) } : { ...p },
  );

  const enemies: Enemy[] = base.enemies.map((e) => ({
    ...e,
    type: "normal" as EnemyType,
  }));
  const coins: Coin[] = base.coins.map((c) => ({ ...c }));
  const powerups: Powerup[] = base.powerups.map((p) => ({ ...p }));

  let currentX = extraOffset;
  let currentY = HEIGHT - 160;

  while (currentX < newFlagX - 200) {
    // Difficulty scaling
    // Level 0: Pattern 0 only
    // Level 1: Pattern 0, 1
    // Level 2: Pattern 0, 1, 2
    // Level 3+: All patterns
    const availablePatterns = Math.min(patterns.length, idx + 1);
    const patIdx = Math.floor(Math.random() * availablePatterns);

    const pat = patterns[patIdx](currentX, currentY, idx);

    // Add pattern elements
    pat.plats.forEach((p) => platforms.push(p as Platform));
    pat.enemies.forEach((e) => {
      // Randomize enemy type based on level index (difficulty)
      let type: EnemyType = "normal";
      const roll = Math.random();
      if (idx >= 1 && roll < 0.3) type = "fast";
      if (idx >= 2 && roll < 0.2) type = "jumper";
      if (idx >= 3 && roll < 0.15) type = "spiked";
      // Override if pattern specified a type, otherwise use random
      if (e.type === "normal" && type !== "normal") e.type = type;

      enemies.push(e as Enemy);
    });
    // 套用「敵人數量」設定：依倍率複製本段敵人，每段上限 5 隻
    if (pat.enemies.length > 0 && settings.enemyMultiplier > 1) {
      const target = Math.min(
        5,
        Math.round(pat.enemies.length * settings.enemyMultiplier),
      );
      for (let k = pat.enemies.length; k < target; k++) {
        const src = pat.enemies[k % pat.enemies.length];
        enemies.push({
          ...(src as Enemy),
          x: src.x + 50 + (k - pat.enemies.length) * 60,
          dir: (Math.random() > 0.5 ? 1 : -1) as 1 | -1,
        });
      }
    }
    pat.coins.forEach((c) => coins.push(c as Coin));

    // Add ground-level enemies to prevent "just run through" strategy
    // Spawn chance increases with difficulty level（乘上敵人數量設定）
    const groundEnemyChance = Math.min(
      Math.min(0.25 + idx * 0.1, 0.5) * settings.enemyMultiplier,
      0.6,
    );
    if (Math.random() < groundEnemyChance) {
      // Spawn 1-2 ground enemies per segment
      const groundEnemyCount = 1 + (idx >= 2 && Math.random() < 0.4 ? 1 : 0);
      for (let g = 0; g < groundEnemyCount; g++) {
        // Randomize enemy type based on difficulty
        let groundType: EnemyType = "normal";
        const groundRoll = Math.random();
        if (idx >= 1 && groundRoll < 0.35) groundType = "fast";
        if (idx >= 2 && groundRoll < 0.25) groundType = "jumper";
        if (idx >= 3 && groundRoll < 0.18) groundType = "spiked";

        const groundSpeed = 70 + idx * 10 + Math.random() * 25;
        enemies.push({
          x: currentX + 120 + g * 180, // Spread enemies with 180px gap
          y: HEIGHT - 72, // Ground level (same as BASE_LEVELS enemies)
          w: 36,
          h: 32,
          dir: (Math.random() > 0.5 ? 1 : -1) as 1 | -1,
          speed: groundSpeed,
          alive: true,
          type: groundType,
        });
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

    currentX += 450;
    // Randomize Y slightly for next segment, keep within bounds
    // Expanded range to allow patterns closer to ground (HEIGHT - 60)
    currentY = clamp(
      currentY + (Math.random() > 0.5 ? 50 : -50),
      HEIGHT - 300,
      HEIGHT - 60,
    );
  }

  return {
    ...base,
    platforms,
    enemies,
    coins,
    powerups,
    flag: { ...base.flag, x: newFlagX },
  };
}

export const BASE_LEVELS: Level[] = [
  {
    sky: { top: "#c8f7e1", bottom: "#e8f3ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 2400, h: 40 },
      { x: 200, y: HEIGHT - 140, w: 120, h: 16 },
      { x: 420, y: HEIGHT - 210, w: 150, h: 16 },
      { x: 680, y: HEIGHT - 180, w: 160, h: 16 },
    ],
    enemies: [
      {
        x: 260,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 70,
        alive: true,
        type: "normal",
      },
      {
        x: 450,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 80,
        alive: true,
        type: "normal",
      },
      {
        x: 650,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 90,
        alive: true,
        type: "fast",
      },
    ],
    coins: [
      { x: 160, y: HEIGHT - 200, r: 10, taken: false },
      { x: 420, y: HEIGHT - 260, r: 10, taken: false },
      { x: 720, y: HEIGHT - 220, r: 10, taken: false },
    ],
    powerups: [{ x: 640, y: HEIGHT - 220, r: 14, type: "boot", taken: false }],
    flag: { x: 950, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#d9f0ff", bottom: "#eef6ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 2600, h: 40 },
      { x: 240, y: HEIGHT - 170, w: 140, h: 16 },
      { x: 520, y: HEIGHT - 240, w: 180, h: 16 },
      { x: 840, y: HEIGHT - 180, w: 160, h: 16 },
      { x: 1120, y: HEIGHT - 130, w: 160, h: 16 },
    ],
    enemies: [
      {
        x: 300,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 80,
        alive: true,
        type: "normal",
      },
      {
        x: 500,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 90,
        alive: true,
        type: "fast",
      },
      {
        x: 750,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 85,
        alive: true,
        type: "normal",
      },
      {
        x: 1000,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 75,
        alive: true,
        type: "jumper",
      },
      {
        x: 880,
        y: HEIGHT - 212,
        w: 36,
        h: 32,
        dir: -1,
        speed: 70,
        alive: true,
        type: "normal",
      },
    ],
    coins: [
      { x: 250, y: HEIGHT - 210, r: 10, taken: false },
      { x: 520, y: HEIGHT - 280, r: 10, taken: false },
      { x: 1120, y: HEIGHT - 170, r: 10, taken: false },
    ],
    powerups: [
      { x: 980, y: HEIGHT - 220, r: 14, type: "feather", taken: false },
    ],
    flag: { x: 1280, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#f7e9ff", bottom: "#f2f9ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 2600, h: 40 },
      { x: 300, y: HEIGHT - 160, w: 120, h: 16 },
      { x: 520, y: HEIGHT - 220, w: 140, h: 16 },
      { x: 780, y: HEIGHT - 260, w: 160, h: 16 },
      { x: 1040, y: HEIGHT - 200, w: 160, h: 16 },
      { x: 1300, y: HEIGHT - 150, w: 160, h: 16 },
    ],
    enemies: [
      {
        x: 200,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 85,
        alive: true,
        type: "normal",
      },
      {
        x: 400,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 100,
        alive: true,
        type: "fast",
      },
      {
        x: 650,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 80,
        alive: true,
        type: "jumper",
      },
      {
        x: 900,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 90,
        alive: true,
        type: "normal",
      },
      {
        x: 1150,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 95,
        alive: true,
        type: "spiked",
      },
      {
        x: 560,
        y: HEIGHT - 252,
        w: 36,
        h: 32,
        dir: 1,
        speed: 90,
        alive: true,
        type: "jumper",
      },
      {
        x: 1320,
        y: HEIGHT - 182,
        w: 36,
        h: 32,
        dir: -1,
        speed: 100,
        alive: true,
        type: "fast",
      },
    ],
    coins: [
      { x: 320, y: HEIGHT - 200, r: 10, taken: false },
      { x: 780, y: HEIGHT - 300, r: 10, taken: false },
      { x: 1300, y: HEIGHT - 190, r: 10, taken: false },
    ],
    powerups: [{ x: 900, y: HEIGHT - 320, r: 14, type: "star", taken: false }],
    flag: { x: 1520, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#e4f7e7", bottom: "#f5fff2" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 2800, h: 40 },
      { x: 260, y: HEIGHT - 200, w: 140, h: 16 },
      { x: 520, y: HEIGHT - 140, w: 140, h: 16 },
      { x: 760, y: HEIGHT - 190, w: 140, h: 16 },
      { x: 1000, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 1280, y: HEIGHT - 180, w: 160, h: 16 },
      { x: 1520, y: HEIGHT - 130, w: 180, h: 16 },
    ],
    enemies: [
      {
        x: 180,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 90,
        alive: true,
        type: "normal",
      },
      {
        x: 380,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 110,
        alive: true,
        type: "fast",
      },
      {
        x: 540,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 100,
        alive: true,
        type: "jumper",
      },
      {
        x: 850,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 95,
        alive: true,
        type: "normal",
      },
      {
        x: 1100,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 105,
        alive: true,
        type: "spiked",
      },
      {
        x: 1400,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 100,
        alive: true,
        type: "fast",
      },
      {
        x: 1300,
        y: HEIGHT - 212,
        w: 36,
        h: 32,
        dir: 1,
        speed: 100,
        alive: true,
        type: "jumper",
      },
    ],
    coins: [
      { x: 280, y: HEIGHT - 240, r: 10, taken: false },
      { x: 760, y: HEIGHT - 230, r: 10, taken: false },
      { x: 1280, y: HEIGHT - 220, r: 10, taken: false },
      { x: 1520, y: HEIGHT - 170, r: 10, taken: false },
    ],
    powerups: [{ x: 1180, y: HEIGHT - 280, r: 14, type: "boot", taken: false }],
    flag: { x: 1760, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#d9f0ff", bottom: "#eef6ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3000, h: 40 },
      { x: 280, y: HEIGHT - 160, w: 160, h: 16 },
      { x: 560, y: HEIGHT - 200, w: 140, h: 16 },
      { x: 840, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 1120, y: HEIGHT - 280, w: 140, h: 16 },
      { x: 1400, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 1680, y: HEIGHT - 200, w: 140, h: 16 },
      { x: 1960, y: HEIGHT - 160, w: 160, h: 16 },
    ],
    enemies: [
      {
        x: 200,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 95,
        alive: true,
        type: "normal",
      },
      {
        x: 400,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 115,
        alive: true,
        type: "fast",
      },
      {
        x: 700,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 100,
        alive: true,
        type: "jumper",
      },
      {
        x: 1000,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 110,
        alive: true,
        type: "spiked",
      },
      {
        x: 1300,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 105,
        alive: true,
        type: "normal",
      },
      {
        x: 1550,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 120,
        alive: true,
        type: "fast",
      },
      {
        x: 1850,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 100,
        alive: true,
        type: "jumper",
      },
      {
        x: 620,
        y: HEIGHT - 232,
        w: 36,
        h: 32,
        dir: -1,
        speed: 120,
        alive: true,
        type: "fast",
      },
      {
        x: 1420,
        y: HEIGHT - 272,
        w: 36,
        h: 32,
        dir: 1,
        speed: 120,
        alive: true,
        type: "jumper",
      },
      {
        x: 1980,
        y: HEIGHT - 192,
        w: 36,
        h: 32,
        dir: -1,
        speed: 100,
        alive: true,
        type: "spiked",
      },
    ],
    coins: [
      { x: 560, y: HEIGHT - 240, r: 10, taken: false },
      { x: 1120, y: HEIGHT - 320, r: 10, taken: false },
      { x: 1680, y: HEIGHT - 240, r: 10, taken: false },
      { x: 1960, y: HEIGHT - 200, r: 10, taken: false },
    ],
    powerups: [{ x: 1520, y: HEIGHT - 300, r: 14, type: "star", taken: false }],
    flag: { x: 2160, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#f7e9ff", bottom: "#f2f9ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3200, h: 40 },
      { x: 260, y: HEIGHT - 120, w: 160, h: 16 },
      { x: 620, y: HEIGHT - 180, w: 180, h: 16 },
      { x: 900, y: HEIGHT - 220, w: 140, h: 16 },
      { x: 1180, y: HEIGHT - 260, w: 140, h: 16 },
      { x: 1460, y: HEIGHT - 210, w: 160, h: 16 },
      { x: 1740, y: HEIGHT - 180, w: 180, h: 16 },
      { x: 2020, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 2300, y: HEIGHT - 200, w: 180, h: 16 },
    ],
    enemies: [
      {
        x: 180,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 100,
        alive: true,
        type: "normal",
      },
      {
        x: 400,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 120,
        alive: true,
        type: "fast",
      },
      {
        x: 650,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 95,
        alive: true,
        type: "jumper",
      },
      {
        x: 950,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 110,
        alive: true,
        type: "spiked",
      },
      {
        x: 1200,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 105,
        alive: true,
        type: "normal",
      },
      {
        x: 1500,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 125,
        alive: true,
        type: "fast",
      },
      {
        x: 1800,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 100,
        alive: true,
        type: "jumper",
      },
      {
        x: 2100,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 115,
        alive: true,
        type: "spiked",
      },
      {
        x: 280,
        y: HEIGHT - 152,
        w: 36,
        h: 32,
        dir: -1,
        speed: 90,
        alive: true,
        type: "normal",
      },
      {
        x: 960,
        y: HEIGHT - 252,
        w: 36,
        h: 32,
        dir: 1,
        speed: 110,
        alive: true,
        type: "fast",
      },
      {
        x: 1760,
        y: HEIGHT - 212,
        w: 36,
        h: 32,
        dir: -1,
        speed: 120,
        alive: true,
        type: "jumper",
      },
    ],
    coins: [
      { x: 620, y: HEIGHT - 220, r: 10, taken: false },
      { x: 1180, y: HEIGHT - 300, r: 10, taken: false },
      { x: 1740, y: HEIGHT - 220, r: 10, taken: false },
      { x: 2020, y: HEIGHT - 280, r: 10, taken: false },
    ],
    powerups: [
      { x: 1320, y: HEIGHT - 320, r: 14, type: "feather", taken: false },
    ],
    flag: { x: 2520, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#e4f7e7", bottom: "#f5fff2" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3400, h: 40 },
      { x: 320, y: HEIGHT - 200, w: 160, h: 16 },
      { x: 620, y: HEIGHT - 140, w: 140, h: 16 },
      { x: 900, y: HEIGHT - 220, w: 160, h: 16 },
      { x: 1160, y: HEIGHT - 260, w: 140, h: 16 },
      { x: 1440, y: HEIGHT - 220, w: 180, h: 16 },
      { x: 1720, y: HEIGHT - 180, w: 160, h: 16 },
      { x: 2000, y: HEIGHT - 160, w: 140, h: 16 },
      { x: 2240, y: HEIGHT - 220, w: 160, h: 16 },
      { x: 2500, y: HEIGHT - 260, w: 140, h: 16 },
    ],
    enemies: [
      {
        x: 200,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 105,
        alive: true,
        type: "normal",
      },
      {
        x: 450,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 130,
        alive: true,
        type: "fast",
      },
      {
        x: 750,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 100,
        alive: true,
        type: "jumper",
      },
      {
        x: 1050,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 120,
        alive: true,
        type: "spiked",
      },
      {
        x: 1350,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 110,
        alive: true,
        type: "normal",
      },
      {
        x: 1600,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 135,
        alive: true,
        type: "fast",
      },
      {
        x: 1900,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 105,
        alive: true,
        type: "jumper",
      },
      {
        x: 2150,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 125,
        alive: true,
        type: "spiked",
      },
      {
        x: 2400,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 115,
        alive: true,
        type: "fast",
      },
      {
        x: 360,
        y: HEIGHT - 232,
        w: 36,
        h: 32,
        dir: 1,
        speed: 120,
        alive: true,
        type: "jumper",
      },
      {
        x: 1480,
        y: HEIGHT - 252,
        w: 36,
        h: 32,
        dir: -1,
        speed: 130,
        alive: true,
        type: "spiked",
      },
      {
        x: 2260,
        y: HEIGHT - 252,
        w: 36,
        h: 32,
        dir: 1,
        speed: 140,
        alive: true,
        type: "fast",
      },
    ],
    coins: [
      { x: 320, y: HEIGHT - 240, r: 10, taken: false },
      { x: 900, y: HEIGHT - 260, r: 10, taken: false },
      { x: 1720, y: HEIGHT - 220, r: 10, taken: false },
      { x: 2500, y: HEIGHT - 300, r: 10, taken: false },
    ],
    powerups: [{ x: 1860, y: HEIGHT - 320, r: 14, type: "star", taken: false }],
    flag: { x: 2720, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#d9f0ff", bottom: "#eef6ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3600, h: 40 },
      { x: 360, y: HEIGHT - 160, w: 160, h: 16 },
      { x: 680, y: HEIGHT - 210, w: 160, h: 16 },
      { x: 940, y: HEIGHT - 250, w: 160, h: 16 },
      { x: 1200, y: HEIGHT - 190, w: 160, h: 16 },
      { x: 1460, y: HEIGHT - 150, w: 160, h: 16 },
      { x: 1720, y: HEIGHT - 200, w: 180, h: 16 },
      { x: 2000, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 2280, y: HEIGHT - 200, w: 160, h: 16 },
      { x: 2560, y: HEIGHT - 160, w: 160, h: 16 },
    ],
    enemies: [
      {
        x: 200,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 110,
        alive: true,
        type: "normal",
      },
      {
        x: 480,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 140,
        alive: true,
        type: "fast",
      },
      {
        x: 800,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 105,
        alive: true,
        type: "jumper",
      },
      {
        x: 1100,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 130,
        alive: true,
        type: "spiked",
      },
      {
        x: 1400,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 115,
        alive: true,
        type: "normal",
      },
      {
        x: 1650,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 145,
        alive: true,
        type: "fast",
      },
      {
        x: 1950,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 110,
        alive: true,
        type: "jumper",
      },
      {
        x: 2200,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 135,
        alive: true,
        type: "spiked",
      },
      {
        x: 2450,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 120,
        alive: true,
        type: "fast",
      },
      {
        x: 380,
        y: HEIGHT - 192,
        w: 36,
        h: 32,
        dir: -1,
        speed: 120,
        alive: true,
        type: "jumper",
      },
      {
        x: 1220,
        y: HEIGHT - 222,
        w: 36,
        h: 32,
        dir: 1,
        speed: 140,
        alive: true,
        type: "spiked",
      },
      {
        x: 2020,
        y: HEIGHT - 272,
        w: 36,
        h: 32,
        dir: -1,
        speed: 150,
        alive: true,
        type: "fast",
      },
    ],
    coins: [
      { x: 360, y: HEIGHT - 200, r: 10, taken: false },
      { x: 940, y: HEIGHT - 290, r: 10, taken: false },
      { x: 1720, y: HEIGHT - 240, r: 10, taken: false },
      { x: 2280, y: HEIGHT - 240, r: 10, taken: false },
    ],
    powerups: [
      { x: 1340, y: HEIGHT - 280, r: 14, type: "feather", taken: false },
    ],
    flag: { x: 2800, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#f7e9ff", bottom: "#f2f9ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3800, h: 40 },
      { x: 380, y: HEIGHT - 140, w: 160, h: 16 },
      { x: 720, y: HEIGHT - 200, w: 160, h: 16 },
      { x: 1040, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 1320, y: HEIGHT - 280, w: 160, h: 16 },
      { x: 1600, y: HEIGHT - 220, w: 180, h: 16 },
      { x: 1880, y: HEIGHT - 180, w: 180, h: 16 },
      { x: 2160, y: HEIGHT - 220, w: 160, h: 16 },
      { x: 2440, y: HEIGHT - 260, w: 160, h: 16 },
      { x: 2720, y: HEIGHT - 200, w: 180, h: 16 },
      { x: 3000, y: HEIGHT - 160, w: 180, h: 16 },
    ],
    enemies: [
      {
        x: 220,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 115,
        alive: true,
        type: "normal",
      },
      {
        x: 520,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 150,
        alive: true,
        type: "fast",
      },
      {
        x: 850,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 110,
        alive: true,
        type: "jumper",
      },
      {
        x: 1150,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 140,
        alive: true,
        type: "spiked",
      },
      {
        x: 1450,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 120,
        alive: true,
        type: "normal",
      },
      {
        x: 1750,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 155,
        alive: true,
        type: "fast",
      },
      {
        x: 2050,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 115,
        alive: true,
        type: "jumper",
      },
      {
        x: 2350,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 145,
        alive: true,
        type: "spiked",
      },
      {
        x: 2650,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 125,
        alive: true,
        type: "fast",
      },
      {
        x: 2900,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 130,
        alive: true,
        type: "jumper",
      },
      {
        x: 760,
        y: HEIGHT - 232,
        w: 36,
        h: 32,
        dir: -1,
        speed: 130,
        alive: true,
        type: "spiked",
      },
      {
        x: 1620,
        y: HEIGHT - 252,
        w: 36,
        h: 32,
        dir: 1,
        speed: 150,
        alive: true,
        type: "fast",
      },
      {
        x: 2460,
        y: HEIGHT - 292,
        w: 36,
        h: 32,
        dir: -1,
        speed: 160,
        alive: true,
        type: "jumper",
      },
    ],
    coins: [
      { x: 720, y: HEIGHT - 240, r: 10, taken: false },
      { x: 1320, y: HEIGHT - 320, r: 10, taken: false },
      { x: 1880, y: HEIGHT - 220, r: 10, taken: false },
      { x: 2720, y: HEIGHT - 240, r: 10, taken: false },
    ],
    powerups: [{ x: 2100, y: HEIGHT - 300, r: 14, type: "star", taken: false }],
    flag: { x: 3220, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#e4f7e7", bottom: "#f5fff2" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 4000, h: 40 },
      { x: 420, y: HEIGHT - 190, w: 160, h: 16 },
      { x: 760, y: HEIGHT - 140, w: 160, h: 16 },
      { x: 1080, y: HEIGHT - 220, w: 160, h: 16 },
      { x: 1360, y: HEIGHT - 260, w: 160, h: 16 },
      { x: 1640, y: HEIGHT - 220, w: 180, h: 16 },
      { x: 1920, y: HEIGHT - 200, w: 180, h: 16 },
      { x: 2200, y: HEIGHT - 240, w: 180, h: 16 },
      { x: 2480, y: HEIGHT - 280, w: 160, h: 16 },
      { x: 2760, y: HEIGHT - 240, w: 180, h: 16 },
      { x: 3040, y: HEIGHT - 200, w: 180, h: 16 },
    ],
    enemies: [
      // 地面怪物 - 最終關卡最具挑戰性
      {
        x: 250,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 120,
        alive: true,
        type: "normal",
      },
      {
        x: 550,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 160,
        alive: true,
        type: "fast",
      },
      {
        x: 900,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 115,
        alive: true,
        type: "jumper",
      },
      {
        x: 1200,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 150,
        alive: true,
        type: "spiked",
      },
      {
        x: 1500,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 125,
        alive: true,
        type: "normal",
      },
      {
        x: 1800,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 165,
        alive: true,
        type: "fast",
      },
      {
        x: 2100,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 120,
        alive: true,
        type: "jumper",
      },
      {
        x: 2400,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 155,
        alive: true,
        type: "spiked",
      },
      {
        x: 2700,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 130,
        alive: true,
        type: "fast",
      },
      {
        x: 3000,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 140,
        alive: true,
        type: "jumper",
      },
      // 平台怪物
      {
        x: 440,
        y: HEIGHT - 222,
        w: 36,
        h: 32,
        dir: 1,
        speed: 140,
        alive: true,
        type: "spiked",
      },
      {
        x: 1100,
        y: HEIGHT - 252,
        w: 36,
        h: 32,
        dir: -1,
        speed: 160,
        alive: true,
        type: "fast",
      },
      {
        x: 2220,
        y: HEIGHT - 272,
        w: 36,
        h: 32,
        dir: 1,
        speed: 170,
        alive: true,
        type: "jumper",
      },
      {
        x: 2780,
        y: HEIGHT - 272,
        w: 36,
        h: 32,
        dir: -1,
        speed: 180,
        alive: true,
        type: "spiked",
      },
    ],
    coins: [
      { x: 420, y: HEIGHT - 230, r: 10, taken: false },
      { x: 1080, y: HEIGHT - 260, r: 10, taken: false },
      { x: 1920, y: HEIGHT - 240, r: 10, taken: false },
      { x: 2760, y: HEIGHT - 280, r: 10, taken: false },
    ],
    powerups: [
      { x: 1680, y: HEIGHT - 300, r: 14, type: "feather", taken: false },
    ],
    flag: { x: 3300, y: HEIGHT - 180, h: 180 },
  },
];

export const LEVEL_COUNT = BASE_LEVELS.length;

// 每次開局重新生成（隨機尾段每輪都不同），並套用玩家設定
export function buildLevels(settings: MushroomSettings): Level[] {
  return BASE_LEVELS.map((lvl, index) => extendLevel(lvl, index, settings));
}
