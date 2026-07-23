import type { EnemyKind, EnemySpec } from "../types";

/**
 * 偷糖果的怪物。
 *
 * speed 與 radius 都跟著 1280×720 的畫布放大過；路徑長度拉得比畫布更多，
 * 所以怪橫越地圖的時間仍然比改版前長。
 *
 * 第一階段沒有圖檔，renderer 依 `shape` + `palette` 用 canvas 畫出來。等 AI 生
 * 圖做好之後，只要在這裡填上 `sprite`，renderer 就會改畫圖片——邏輯、數值、
 * 波表通通不用動。
 *
 * hp 是「普通難度、第 1 波」的基準值；難度倍率與波次成長在 waves.ts 疊上去。
 */
export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  gumdrop: {
    id: "gumdrop",
    nameZh: "軟糖小兵",
    element: "leaf",
    hp: 40,
    speed: 56,
    armor: 0,
    reward: 6,
    cakeSteal: 1,
    radius: 17,
    shape: "gumdrop",
    palette: { body: "#a8e06a", shade: "#83bf46", accent: "#f4ffe3" },
  },
  marshmallow: {
    id: "marshmallow",
    nameZh: "棉花糖飛賊",
    element: "dream",
    hp: 26,
    speed: 109,
    armor: 0,
    reward: 6,
    cakeSteal: 1,
    radius: 16,
    shape: "pillow",
    palette: { body: "#ffd9e8", shade: "#f0b6cd", accent: "#fffafc" },
  },
  chocolate: {
    id: "chocolate",
    nameZh: "巧克力壯漢",
    element: "ember",
    hp: 150,
    speed: 40,
    armor: 0.35,
    reward: 16,
    cakeSteal: 2,
    radius: 24,
    shape: "block",
    palette: { body: "#8b5e3c", shade: "#65422a", accent: "#d8a679" },
  },
  soda: {
    id: "soda",
    nameZh: "汽水泡泡",
    element: "tide",
    hp: 60,
    speed: 66,
    armor: 0,
    reward: 10,
    cakeSteal: 1,
    radius: 20,
    shape: "bubble",
    palette: { body: "#7fd4f5", shade: "#4fb0d8", accent: "#e8fbff" },
    splitInto: { kind: "soda-mini", count: 2 },
  },
  "soda-mini": {
    id: "soda-mini",
    nameZh: "小汽水泡",
    element: "tide",
    hp: 22,
    speed: 90,
    armor: 0,
    reward: 3,
    cakeSteal: 1,
    radius: 12,
    shape: "bubble",
    palette: { body: "#a9e5fa", shade: "#6cc3e6", accent: "#f2fdff" },
  },
  "frosting-ghost": {
    id: "frosting-ghost",
    nameZh: "糖霜幽靈",
    element: "light",
    hp: 55,
    speed: 77,
    armor: 0,
    reward: 10,
    cakeSteal: 1,
    radius: 19,
    shape: "ghost",
    palette: { body: "#fff4d6", shade: "#e6cf9f", accent: "#fffdf5" },
    flying: true,
  },
  lollipop: {
    id: "lollipop",
    nameZh: "棒棒糖旋風",
    element: "spark",
    hp: 95,
    speed: 73,
    armor: 0.15,
    reward: 11,
    cakeSteal: 1,
    radius: 20,
    shape: "swirl",
    palette: { body: "#ff9ec4", shade: "#e5719f", accent: "#fff0f6" },
    slowImmune: true,
  },
  "pudding-king": {
    id: "pudding-king",
    nameZh: "布丁大王",
    element: "crystal",
    hp: 700,
    speed: 35,
    armor: 0.25,
    reward: 88,
    cakeSteal: 2,
    radius: 37,
    shape: "dome",
    palette: { body: "#f7c873", shade: "#cf9333", accent: "#ffeec2" },
    boss: true,
    // 這隻要走約 60 秒才到櫃檯，所以召喚間隔拉長——4.5 秒一次會在牠橫越地圖的
    // 途中丟出快 40 隻小兵，還在學怎麼蓋塔的玩家會直接被埋掉。
    summon: { kind: "gumdrop", count: 2, everyMs: 7000 },
  },
  "macaron-queen": {
    id: "macaron-queen",
    nameZh: "馬卡龍女王",
    element: "star",
    hp: 1500,
    speed: 40,
    armor: 0.2,
    reward: 128,
    cakeSteal: 2,
    radius: 37,
    shape: "tier",
    palette: { body: "#c7a3f0", shade: "#9c72cf", accent: "#f0e4ff" },
    boss: true,
    shield: { amount: 320, everyMs: 6500 },
  },
  "cake-titan": {
    id: "cake-titan",
    nameZh: "蛋糕巨人",
    element: "dream",
    hp: 2400,
    speed: 29,
    armor: 0.4,
    reward: 224,
    cakeSteal: 3,
    radius: 45,
    shape: "tier",
    palette: { body: "#ffd3e2", shade: "#e29ab4", accent: "#fff8fb" },
    boss: true,
    summon: { kind: "marshmallow", count: 4, everyMs: 5000 },
  },
};

export function getEnemy(kind: EnemyKind): EnemySpec {
  return ENEMIES[kind];
}
