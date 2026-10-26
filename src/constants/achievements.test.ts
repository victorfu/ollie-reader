vi.mock("../utils/firebaseUtil", () => ({ db: {} }));
import { describe, expect, it, vi } from "vitest";
import { ACHIEVEMENTS } from "./achievements";
import { DEFAULT_PLAYER_PROGRESS } from "../services/gameProgressService";
import type { PlayerProgress } from "../types/game";
import { adventureZh } from "../i18n/messages/adventure";

const unlocked = (id: string, over: Partial<PlayerProgress>) => {
  const achievement = ACHIEVEMENTS.find((a) => a.id === id);
  if (!achievement) throw new Error(`missing achievement ${id}`);
  return achievement.requirement({
    ...DEFAULT_PLAYER_PROGRESS,
    ...over,
  } as PlayerProgress);
};

describe("achievements", () => {
  it("chapter2-clear unlocks after the dream queen", () => {
    expect(unlocked("chapter2-clear", { currentStageIndex: 23 })).toBe(true);
    expect(unlocked("chapter2-clear", { currentStageIndex: 22 })).toBe(false);
  });

  it("chapter3-clear unlocks after the whale king", () => {
    expect(unlocked("chapter3-clear", { currentStageIndex: 33 })).toBe(true);
    expect(unlocked("chapter3-clear", { currentStageIndex: 32 })).toBe(false);
  });

  it("level-max still unlocks at 15", () => {
    expect(unlocked("level-max", { level: 15 })).toBe(true);
    expect(unlocked("level-max", { level: 14 })).toBe(false);
  });

  it("level-20 unlocks at 20", () => {
    expect(unlocked("level-20", { level: 20 })).toBe(true);
    expect(unlocked("level-20", { level: 19 })).toBe(false);
  });

  it("boss-conqueror still needs 8 boss wins", () => {
    expect(unlocked("boss-conqueror", { totalBossDefeated: 8 })).toBe(true);
    expect(unlocked("boss-conqueror", { totalBossDefeated: 7 })).toBe(false);
  });

  it("every achievement has a translated description", () => {
    for (const { id } of ACHIEVEMENTS) {
      expect(Object.keys(adventureZh), id).toContain(`adventure.achievement.${id}`);
    }
  });
});
