import type { Rng } from "./rng";
import { pickWeighted, rollInt } from "./weighted";

export type EncounterEntry = {
  speciesId: string;
  weight: number;
};

export type EncounterTable = {
  encounterChance: number;
  entries: EncounterEntry[];
  minLevel: number;
  maxLevel: number;
};

export type WildEncounter = {
  speciesId: string;
  level: number;
};

export function rollEncounter(
  table: EncounterTable,
  rng: Rng,
): WildEncounter | null {
  if (rng() >= table.encounterChance) return null;
  const entry = pickWeighted(table.entries, rng);
  const level = rollInt(table.minLevel, table.maxLevel, rng);
  return { speciesId: entry.speciesId, level };
}
