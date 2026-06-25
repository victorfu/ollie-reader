export type DexStatus = "unseen" | "seen" | "caught" | "evolved";

const RANK: Record<DexStatus, number> = {
  unseen: 0,
  seen: 1,
  caught: 2,
  evolved: 3,
};

export type Wonderdex = Record<string, DexStatus>;

export type DexCompletion = {
  seen: number;
  caught: number;
  total: number;
  caughtRatio: number;
};

// Advances a species' status; never downgrades. Returns the same object
// reference when the status would not advance (cheap no-op for reducers).
export function recordDex(
  dex: Wonderdex,
  speciesId: string,
  status: DexStatus,
): Wonderdex {
  const current = dex[speciesId] ?? "unseen";
  if (RANK[status] <= RANK[current]) return dex;
  return { ...dex, [speciesId]: status };
}

export function dexCompletion(
  dex: Wonderdex,
  allSpeciesIds: string[],
): DexCompletion {
  let seen = 0;
  let caught = 0;
  for (const id of allSpeciesIds) {
    const rank = RANK[dex[id] ?? "unseen"];
    if (rank >= RANK.seen) seen += 1;
    if (rank >= RANK.caught) caught += 1;
  }
  const total = allSpeciesIds.length;
  return { seen, caught, total, caughtRatio: total === 0 ? 0 : caught / total };
}
