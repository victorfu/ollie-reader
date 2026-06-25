import type { Rng } from "./rng";
import { pickWeighted } from "./weighted";

export type LootEntry = {
  itemId: string;
  quantity: number;
  weight: number;
};

export type LootTable = {
  rolls: number;
  entries: LootEntry[];
};

export type LootResult = Record<string, number>;

export function rollLoot(table: LootTable, rng: Rng): LootResult {
  const result: LootResult = {};
  for (let i = 0; i < table.rolls; i += 1) {
    const entry = pickWeighted(table.entries, rng);
    result[entry.itemId] = (result[entry.itemId] ?? 0) + entry.quantity;
  }
  return result;
}
