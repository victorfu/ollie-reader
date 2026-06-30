export const MATERIAL_DEFS = {
  "glow-petal": { name: "微光花瓣", emoji: "🌿" },
  "tide-glass": { name: "潮玻璃", emoji: "🌊" },
  "clock-spring": { name: "鐘塔發條", emoji: "🕰️" },
  "sugar-crystal": { name: "糖晶", emoji: "🍬" },
  "bell-shard": { name: "鐘心碎片", emoji: "🔔" },
} as const;

export type MaterialId = keyof typeof MATERIAL_DEFS;
export type MaterialInventory = Partial<Record<MaterialId, number>>;

export type CharmEffects = {
  encounterMultiplier: number;
  rareWeightBonus: number;
  lootRollBonus: number;
  chestStardustBonus: number;
  shinyBonus: number;
  xpMultiplier: number;
};

type CharmDef = {
  name: string;
  emoji: string;
  desc: string;
  stardustCost: number;
  materialCost: MaterialInventory;
  effects: Partial<CharmEffects>;
};

export const CHARM_DEFS = {
  "lucky-lantern": {
    name: "幸運提燈",
    emoji: "🏮",
    desc: "稀有夥伴與閃光變體更容易出現",
    stardustCost: 30,
    materialCost: { "glow-petal": 2, "bell-shard": 1 },
    effects: { rareWeightBonus: 0.35, shinyBonus: 1 / 32 },
  },
  "treasure-ribbon": {
    name: "尋寶緞帶",
    emoji: "🎀",
    desc: "寶箱多一次掉落,並追加 Stardust",
    stardustCost: 35,
    materialCost: { "tide-glass": 2, "sugar-crystal": 1 },
    effects: { lootRollBonus: 1, chestStardustBonus: 8 },
  },
  "training-bell": {
    name: "練習小鈴",
    emoji: "🔔",
    desc: "戰鬥與試煉 XP 增加",
    stardustCost: 40,
    materialCost: { "clock-spring": 2, "bell-shard": 1 },
    effects: { xpMultiplier: 0.25 },
  },
  "quiet-sneakers": {
    name: "安靜軟鞋",
    emoji: "👟",
    desc: "探索時遇敵節奏更溫和",
    stardustCost: 25,
    materialCost: { "glow-petal": 1, "tide-glass": 1 },
    effects: { encounterMultiplier: -0.25 },
  },
} as const satisfies Record<string, CharmDef>;

export type CharmId = keyof typeof CHARM_DEFS;
export type CharmInventory = Partial<Record<CharmId, number>>;

const MATERIAL_IDS = new Set<string>(Object.keys(MATERIAL_DEFS));
const CHARM_IDS = new Set<string>(Object.keys(CHARM_DEFS));
export const MAX_ACTIVE_CHARMS = 2;

function normalizeKnownCounts<T extends string>(
  value: unknown,
  knownIds: Set<string>,
): Partial<Record<T, number>> {
  if (typeof value !== "object" || value === null) return {};
  const out: Partial<Record<T, number>> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!knownIds.has(id) || typeof raw !== "number" || !Number.isFinite(raw)) continue;
    const qty = Math.floor(raw);
    if (qty > 0) out[id as T] = qty;
  }
  return out;
}

function subtractCost<T extends string>(
  inventory: Partial<Record<T, number>>,
  cost: Partial<Record<T, number>>,
): Partial<Record<T, number>> {
  const next: Partial<Record<T, number>> = { ...inventory };
  for (const [id, rawQty] of Object.entries(cost) as [T, number][]) {
    const qty = (next[id] ?? 0) - rawQty;
    if (qty > 0) next[id] = qty;
    else delete next[id];
  }
  return next;
}

export function normalizeMaterials(value: unknown): MaterialInventory {
  return normalizeKnownCounts<MaterialId>(value, MATERIAL_IDS);
}

export function normalizeCharms(value: unknown): CharmInventory {
  return normalizeKnownCounts<CharmId>(value, CHARM_IDS);
}

export function normalizeActiveCharms(
  value: unknown,
  charms: CharmInventory,
): CharmId[] {
  if (!Array.isArray(value)) return [];
  const active: CharmId[] = [];
  for (const item of value) {
    if (
      typeof item === "string"
      && CHARM_IDS.has(item)
      && (charms[item as CharmId] ?? 0) > 0
      && !active.includes(item as CharmId)
    ) {
      active.push(item as CharmId);
      if (active.length >= MAX_ACTIVE_CHARMS) break;
    }
  }
  return active;
}

export function canCraftCharm(
  stardust: number,
  materials: MaterialInventory,
  charmId: string,
): charmId is CharmId {
  const def = CHARM_DEFS[charmId as CharmId];
  if (!def || stardust < def.stardustCost) return false;
  return Object.entries(def.materialCost).every(([id, qty]) =>
    (materials[id as MaterialId] ?? 0) >= qty,
  );
}

export function craftCharm({
  stardust,
  materials,
  charms,
  charmId,
}: {
  stardust: number;
  materials: MaterialInventory;
  charms: CharmInventory;
  charmId: string;
}): {
  crafted: boolean;
  stardust: number;
  materials: MaterialInventory;
  charms: CharmInventory;
} {
  const cleanMaterials = normalizeMaterials(materials);
  const cleanCharms = normalizeCharms(charms);
  if (!canCraftCharm(stardust, cleanMaterials, charmId)) {
    return { crafted: false, stardust, materials: cleanMaterials, charms: cleanCharms };
  }
  const def = CHARM_DEFS[charmId];
  return {
    crafted: true,
    stardust: stardust - def.stardustCost,
    materials: subtractCost(cleanMaterials, def.materialCost),
    charms: {
      ...cleanCharms,
      [charmId]: (cleanCharms[charmId] ?? 0) + 1,
    },
  };
}

export function toggleActiveCharm(
  activeCharms: readonly string[],
  charms: CharmInventory,
  charmId: string,
): CharmId[] {
  const active = normalizeActiveCharms(activeCharms, charms);
  if (!CHARM_IDS.has(charmId) || (charms[charmId as CharmId] ?? 0) <= 0) return active;
  const id = charmId as CharmId;
  if (active.includes(id)) return active.filter((current) => current !== id);
  if (active.length >= MAX_ACTIVE_CHARMS) return active;
  return [...active, id];
}

export function charmEffects(activeCharms: readonly string[]): CharmEffects {
  return activeCharms.reduce<CharmEffects>(
    (effects, id) => {
      const def = CHARM_DEFS[id as CharmId];
      if (!def) return effects;
      const delta: Partial<CharmEffects> = def.effects;
      return {
        encounterMultiplier: effects.encounterMultiplier + (delta.encounterMultiplier ?? 0),
        rareWeightBonus: effects.rareWeightBonus + (delta.rareWeightBonus ?? 0),
        lootRollBonus: effects.lootRollBonus + (delta.lootRollBonus ?? 0),
        chestStardustBonus: effects.chestStardustBonus + (delta.chestStardustBonus ?? 0),
        shinyBonus: effects.shinyBonus + (delta.shinyBonus ?? 0),
        xpMultiplier: effects.xpMultiplier + (delta.xpMultiplier ?? 0),
      };
    },
    {
      encounterMultiplier: 1,
      rareWeightBonus: 1,
      lootRollBonus: 0,
      chestStardustBonus: 0,
      shinyBonus: 0,
      xpMultiplier: 1,
    },
  );
}

export function lootMaterialsForTier(lootTier: number): MaterialInventory {
  if (lootTier >= 4) return { "sugar-crystal": 1, "bell-shard": 1 };
  if (lootTier === 3) return { "clock-spring": 1 };
  if (lootTier === 2) return { "tide-glass": 1 };
  return { "glow-petal": 1 };
}

export function mergeMaterials(
  current: MaterialInventory,
  incoming: MaterialInventory,
): MaterialInventory {
  const next: MaterialInventory = { ...normalizeMaterials(current) };
  for (const [id, qty] of Object.entries(normalizeMaterials(incoming)) as [MaterialId, number][]) {
    next[id] = (next[id] ?? 0) + qty;
  }
  return next;
}
