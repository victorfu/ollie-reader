import type { Rng } from "./rng";

export function pickWeighted<T extends { weight: number }>(
  entries: T[],
  rng: Rng,
): T {
  if (entries.length === 0) {
    throw new Error("pickWeighted: entries must not be empty");
  }
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let threshold = rng() * total;
  for (const entry of entries) {
    threshold -= entry.weight;
    if (threshold < 0) return entry;
  }
  return entries[entries.length - 1];
}

export function rollInt(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}
