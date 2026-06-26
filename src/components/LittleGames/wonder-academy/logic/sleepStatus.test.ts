import { describe, expect, it } from "vitest";
import type { BattleCombatant } from "./battleLogic";
import { playerAttack, startBattle, type WildInfo } from "./battleSession";

function combatant(over: Partial<BattleCombatant> = {}): BattleCombatant {
  return {
    ownedId: "p1",
    speciesId: "lumi",
    name: "Lumi",
    elements: ["light"],
    level: 10,
    maxHp: 200,
    hp: 200,
    attack: 4,
    moveIds: ["nap-song", "tiny-flash"],
    ...over,
  };
}

function wild(over: Partial<BattleCombatant> = {}): WildInfo {
  return {
    combatant: {
      ownedId: "w1",
      speciesId: "mossmew",
      name: "Mossmew",
      elements: ["leaf"],
      level: 6,
      maxHp: 200,
      hp: 200,
      attack: 8,
      moveIds: ["mossy-tackle"],
      ...over,
    },
    rarity: "common",
    favoriteSnack: "clover-macaron",
  };
}

describe("sleep status", () => {
  it("a lullaby move lulls the wild to sleep and it skips its turn", () => {
    const s = startBattle([combatant()], wild());
    const after = playerAttack(s, "nap-song");
    // Active took no retaliation damage — the wild snoozed.
    expect(after.active.hp).toBe(200);
    expect(after.wild.asleep).toBe(1); // set to 2, decremented once on the skipped turn
    expect(after.log.some((e) => e.kind === "wildSlept")).toBe(true);
    expect(after.log.some((e) => e.kind === "wildAsleep")).toBe(true);
    expect(after.log.some((e) => e.kind === "wildMove")).toBe(false);
  });

  it("the wild wakes after two skipped turns and retaliates again", () => {
    let s = startBattle([combatant()], wild());
    s = playerAttack(s, "nap-song"); // asleep 2 -> 1 (skip)
    s = playerAttack(s, "tiny-flash"); // asleep 1 -> 0 (skip)
    expect(s.wild.asleep).toBe(0);
    expect(s.active.hp).toBe(200);
    s = playerAttack(s, "tiny-flash"); // awake -> retaliates
    expect(s.active.hp).toBeLessThan(200);
    expect(s.log.some((e) => e.kind === "wildMove")).toBe(true);
  });

  it("a non-lullaby move does not inflict sleep", () => {
    const s = startBattle([combatant()], wild());
    const after = playerAttack(s, "tiny-flash");
    expect(after.wild.asleep ?? 0).toBe(0);
    expect(after.active.hp).toBeLessThan(200); // wild retaliated normally
  });

  it("re-casting a lullaby on an already-asleep wild does not stack", () => {
    let s = startBattle([combatant()], wild());
    s = playerAttack(s, "nap-song"); // asleep -> 1
    s = playerAttack(s, "nap-song"); // still asleep, no re-sleep; 1 -> 0
    expect(s.wild.asleep).toBe(0);
    const sleptEvents = s.log.filter((e) => e.kind === "wildSlept").length;
    expect(sleptEvents).toBe(1);
  });
});
