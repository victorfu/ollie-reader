import { describe, expect, it } from "vitest";
import {
  equipMoveForCreature,
  equippedMovesFor,
  unequipMoveForCreature,
} from "./moveLoadout";
import { speciesById, type OwnedCreature } from "../wonderAcademyCreatures";

const lumi = speciesById("lumi");

function ownedLumi(overrides: Partial<OwnedCreature> = {}): OwnedCreature {
  return {
    ownedId: "owned-lumi",
    speciesId: "lumi",
    nickname: "Lumi",
    level: 5,
    xp: 0,
    bond: 0,
    stage: 0,
    ...overrides,
  };
}

describe("Wonder Academy move loadouts", () => {
  it("rejects moves outside the species learnable pool", () => {
    const owned = ownedLumi({ equippedMoveIds: ["tiny-flash"] });

    expect(equipMoveForCreature(owned, lumi, "bubble-pat")).toBe(owned);
  });

  it("rejects moves that are still level locked", () => {
    const owned = ownedLumi({ level: 1, equippedMoveIds: ["tiny-flash"] });

    expect(equipMoveForCreature(owned, lumi, "wink-feint")).toBe(owned);
  });

  it("equips an unlocked learnable move when there is room", () => {
    const owned = ownedLumi({ level: 9, equippedMoveIds: ["tiny-flash"] });

    expect(equipMoveForCreature(owned, lumi, "aurora-parade")).toEqual({
      ...owned,
      equippedMoveIds: ["tiny-flash", "aurora-parade"],
    });
  });

  it("keeps loadouts capped at four moves", () => {
    const owned = ownedLumi({
      level: 9,
      equippedMoveIds: ["tiny-flash", "zip-spark", "wink-feint", "starstep-dash"],
    });

    expect(equipMoveForCreature(owned, lumi, "aurora-parade")).toBe(owned);
  });

  it("prevents removing the last equipped move", () => {
    const owned = ownedLumi({ equippedMoveIds: ["tiny-flash"] });

    expect(unequipMoveForCreature(owned, lumi, "tiny-flash")).toBe(owned);
  });

  it("removes an equipped move when at least one move remains", () => {
    const owned = ownedLumi({ equippedMoveIds: ["tiny-flash", "zip-spark"] });

    expect(unequipMoveForCreature(owned, lumi, "zip-spark")).toEqual({
      ...owned,
      equippedMoveIds: ["tiny-flash"],
    });
  });

  it("repairs known saved moves from another species", () => {
    const owned = ownedLumi({ equippedMoveIds: ["bubble-pat"] });

    expect(equippedMovesFor(owned, lumi)).toEqual([
      "tiny-flash",
      "zip-spark",
      "wink-feint",
      "starstep-dash",
    ]);
  });

  it("repairs locked high-tier saved moves", () => {
    const owned = ownedLumi({ level: 1, equippedMoveIds: ["aurora-parade"] });

    expect(equippedMovesFor(owned, lumi)).toEqual([
      "tiny-flash",
      "zip-spark",
      "wink-feint",
      "starstep-dash",
    ]);
  });

  it("drops invalid saved moves when equipping a valid move", () => {
    const owned = ownedLumi({
      level: 9,
      equippedMoveIds: ["bubble-pat", "tiny-flash"],
    });

    expect(equipMoveForCreature(owned, lumi, "aurora-parade")).toEqual({
      ...owned,
      equippedMoveIds: ["tiny-flash", "aurora-parade"],
    });
  });
});
