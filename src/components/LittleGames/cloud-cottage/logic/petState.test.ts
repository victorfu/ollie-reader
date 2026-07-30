import { describe, expect, it } from "vitest";
import { DAY_MS, HOUR_MS } from "../constants";
import type { PetSaveV1 } from "../types";
import {
  applyCareActionWithWish,
  bathePet,
  comparePetSaveFreshness,
  createInitialPetSave,
  deriveStats,
  feedPet,
  getNextWakeAt,
  getSleepSessionDate,
  isPetSaveNewer,
  isSleepWindow,
  isSleeping,
  normalizePetSave,
  petPet,
  playWithToy,
  preparePetVisit,
  putPetToSleep,
  restockFreeFood,
  wakePet,
} from "./petState";

const LOCAL_DATE = "2026-07-30";
const NOON = new Date(2026, 6, 30, 12, 0, 0, 0).getTime();

function withStats(
  save: PetSaveV1,
  stats: Partial<PetSaveV1["stats"]>,
): PetSaveV1 {
  return { ...save, stats: { ...save.stats, ...stats } };
}

describe("createInitialPetSave and deriveStats", () => {
  it("starts gently above every floor while allowing first-visit care", () => {
    const initial = createInitialPetSave(NOON, LOCAL_DATE);
    expect(initial.stats).toEqual({
      fullness: 70,
      clean: 75,
      mood: 85,
      statsAt: NOON,
    });
    expect(initial.freeFood).toEqual({
      milk: 2,
      cookie: 2,
      restockDate: LOCAL_DATE,
    });
  });

  it("decays linearly to the three gentle floors", () => {
    const full = {
      fullness: 100,
      clean: 100,
      mood: 100,
      statsAt: NOON,
    };
    const halfway = deriveStats(full, NOON + 6 * HOUR_MS);
    expect(halfway.fullness).toBeCloseTo(80);
    expect(halfway.clean).toBeCloseTo(100 - 70 / 12);
    expect(halfway.mood).toBeCloseTo(80);

    const floors = deriveStats(full, NOON + 4 * DAY_MS);
    expect(floors).toMatchObject({ fullness: 20, clean: 30, mood: 60 });
  });

  it("does not increase stats when the clock moves backward", () => {
    const initial = createInitialPetSave(NOON, LOCAL_DATE);
    expect(deriveStats(initial, NOON - HOUR_MS)).toEqual({
      ...initial.stats,
      statsAt: NOON,
    });
  });
});

describe("food and care transitions", () => {
  it("refuses food at 90 fullness without consuming it", () => {
    const initial = withStats(createInitialPetSave(NOON, LOCAL_DATE), {
      fullness: 90,
    });
    const result = feedPet(initial, "milk", NOON, LOCAL_DATE);

    expect(result).toMatchObject({ applied: false, reason: "full", phraseId: "full" });
    expect(result.save.freeFood.milk).toBe(2);
    expect(result.save.bond.total).toBe(0);
  });

  it("feeds free food and awards bond from a derived snapshot", () => {
    const initial = withStats(createInitialPetSave(NOON, LOCAL_DATE), {
      fullness: 50,
      clean: 80,
      mood: 80,
    });
    const result = feedPet(initial, "milk", NOON, LOCAL_DATE);

    expect(result.applied).toBe(true);
    expect(result.save.stats.fullness).toBe(80);
    expect(result.save.freeFood.milk).toBe(1);
    expect(result.bondAwarded).toBe(3);
  });

  it("atomically consumes a paid snack with its enhanced effects", () => {
    const initial = withStats(createInitialPetSave(NOON, LOCAL_DATE), {
      fullness: 30,
      mood: 70,
    });
    const stocked: PetSaveV1 = {
      ...initial,
      inventory: {
        ...initial.inventory,
        snacks: { "cloud-cake": 1 },
      },
    };
    const result = feedPet(stocked, "cloud-cake", NOON, LOCAL_DATE);

    expect(result.applied).toBe(true);
    expect(result.save.inventory.snacks["cloud-cake"]).toBeUndefined();
    expect(result.save.stats).toMatchObject({ fullness: 75, mood: 80 });
    expect(result.bondAwarded).toBe(6);
  });

  it("lets a clean pet enjoy bubbles without farming bond", () => {
    const clean = withStats(createInitialPetSave(NOON, LOCAL_DATE), { clean: 95 });
    const result = bathePet(clean, NOON, LOCAL_DATE);
    expect(result.applied).toBe(true);
    expect(result.save.stats.clean).toBe(100);
    expect(result.bondAwarded).toBe(0);

    const ready = withStats(clean, { clean: 89 });
    expect(bathePet(ready, NOON, LOCAL_DATE).bondAwarded).toBe(6);
  });

  it("supports petting and owned toys but rejects an unowned toy", () => {
    const initial = withStats(createInitialPetSave(NOON, LOCAL_DATE), { mood: 60 });
    expect(petPet(initial, NOON, LOCAL_DATE).save.stats.mood).toBe(65);
    expect(playWithToy(initial, "ball", NOON, LOCAL_DATE)).toMatchObject({
      applied: false,
      reason: "toy-not-owned",
    });

    const withBall = {
      ...initial,
      inventory: { ...initial.inventory, toys: ["ball" as const] },
    };
    const played = playWithToy(withBall, "ball", NOON, LOCAL_DATE);
    expect(played.save.stats.mood).toBe(75);
    expect(played.bondAwarded).toBe(2);
  });
});

describe("daily stock", () => {
  it("tops up to two on a new date without deleting extras", () => {
    const initial = createInitialPetSave(NOON, "2026-07-29");
    const used = {
      ...initial,
      freeFood: { milk: 0, cookie: 5, restockDate: "2026-07-29" },
    };
    expect(restockFreeFood(used, LOCAL_DATE, NOON).freeFood).toEqual({
      milk: 2,
      cookie: 5,
      restockDate: LOCAL_DATE,
    });
  });

  it("does nothing when a clock rollback makes the stored date future", () => {
    const initial = createInitialPetSave(NOON, "2026-07-31");
    const used = {
      ...initial,
      freeFood: { milk: 0, cookie: 0, restockDate: "2026-07-31" },
    };
    expect(restockFreeFood(used, LOCAL_DATE, NOON)).toBe(used);
  });
});

describe("sleep rules", () => {
  it("uses a 19:00–07:00 window with a 07:00 session boundary", () => {
    const evening = new Date(2026, 6, 30, 19, 0);
    const early = new Date(2026, 6, 31, 1, 0);
    const boundary = new Date(2026, 6, 31, 7, 0);
    expect(isSleepWindow(evening)).toBe(true);
    expect(isSleepWindow(early)).toBe(true);
    expect(isSleepWindow(boundary)).toBe(false);
    expect(getSleepSessionDate(evening)).toBe("2026-07-30");
    expect(getSleepSessionDate(early)).toBe("2026-07-30");
    expect(getNextWakeAt(evening)).toBe(boundary.getTime());
  });

  it("allows one bedtime per evening and supports a gentle early wake-up", () => {
    const bedtime = new Date(2026, 6, 30, 21, 0).getTime();
    const initial = createInitialPetSave(bedtime, LOCAL_DATE);
    const slept = putPetToSleep(initial, bedtime, LOCAL_DATE);
    expect(slept.applied).toBe(true);
    expect(slept.bondAwarded).toBe(4);
    expect(isSleeping(slept.save, bedtime + HOUR_MS)).toBe(true);

    const repeated = putPetToSleep(
      slept.save,
      new Date(2026, 6, 31, 1).getTime(),
      "2026-07-31",
    );
    expect(repeated).toMatchObject({ applied: false, reason: "already-slept" });

    const awake = wakePet(slept.save, bedtime + HOUR_MS);
    expect(awake.applied).toBe(true);
    expect(awake.save.sleepingUntil).toBeNull();
  });
});

describe("normalization and freshness", () => {
  it("backfills malformed partial data into a JSON-safe schema", () => {
    const normalized = normalizePetSave(
      {
        revision: 4.9,
        stats: { fullness: -1, clean: 999, mood: "bad", statsAt: NOON },
        bond: { total: -5, earnedToday: 999 },
        freeFood: { milk: -2, cookie: 4, restockDate: "2099-01-01" },
        inventory: {
          snacks: { apple: 2.9, bogus: 99, pudding: -1 },
          toys: ["ball", "ball", "bogus"],
        },
        equipped: { head: "bogus" },
        room: { wallpaperId: "bogus", floorId: "bogus", placed: [{}] },
        wish: { date: LOCAL_DATE, wishId: "pet-five", progress: 9, target: 5 },
      },
      NOON,
      LOCAL_DATE,
    );

    expect(normalized).toMatchObject({
      schemaVersion: 1,
      revision: 4,
      clientUpdatedAt: 0,
      stats: { fullness: 20, clean: 100, mood: 85 },
      bond: { total: 0, earnedToday: 0, earnedDate: LOCAL_DATE },
      freeFood: { milk: 0, cookie: 4, restockDate: "2099-01-01" },
      wish: { progress: 5, target: 5, fulfilled: true },
    });
    expect(normalized.inventory.snacks).toEqual({ apple: 2 });
    expect(normalized.inventory.toys).toEqual(["ball"]);
    expect(normalized.inventory.furniture).toContain("cloud-bed");
    expect(() => JSON.stringify(normalized)).not.toThrow();
  });

  it("sanitizes personalization, then grants legacy gifts in the touched visit", () => {
    const normalized = normalizePetSave(
      {
        bond: { total: 1_190, earnedToday: 0, earnedDate: LOCAL_DATE },
        inventory: {
          outfits: ["red-ribbon", "bogus"],
          furniture: ["cloud-bed", "picture", "bogus"],
          wallpapers: ["cloud-blue", "starry-night"],
          floors: ["cream-wood", "cloud-carpet"],
        },
        equipped: { head: "red-ribbon", neck: "red-ribbon" },
        room: {
          wallpaperId: "starry-night",
          floorId: "cloud-carpet",
          placed: [
            { id: "picture", x: -25, y: 130, zone: "floor" },
            { id: "picture", x: 50, y: 50, zone: "wall" },
            { id: "sofa", x: 40, y: 40, zone: "floor" },
          ],
        },
      },
      NOON,
      LOCAL_DATE,
    );

    expect(normalized.inventory.furniture).toEqual(["cloud-bed", "picture"]);
    expect(normalized.inventory.outfits).toEqual(["red-ribbon"]);
    expect(normalized.equipped).toEqual({ neck: "red-ribbon" });
    expect(normalized.room).toEqual({
      wallpaperId: "starry-night",
      floorId: "cloud-carpet",
      placed: [{ id: "picture", x: 50, y: 50, zone: "wall" }],
    });

    const prepared = preparePetVisit(normalized, "legacy-reader", NOON + 1, LOCAL_DATE);
    expect(prepared.grantedGifts.map((gift) => gift.id)).toEqual([
      "flower-gift",
      "clover-plant",
      "star-hanging",
      "rainbow-picture",
      "golden-bow",
    ]);
    expect(prepared.save.revision).toBe(normalized.revision + 1);
    expect(prepared.save.inventory.outfits).toContain("golden-bow");
  });

  it("orders saves by revision and then clientUpdatedAt", () => {
    const current = createInitialPetSave(NOON, LOCAL_DATE);
    const timestampOnly = { ...current, clientUpdatedAt: NOON + 1 };
    const nextRevision = { ...current, revision: 1, clientUpdatedAt: NOON - 1 };
    expect(comparePetSaveFreshness(timestampOnly, current)).toBe(1);
    expect(comparePetSaveFreshness(nextRevision, timestampOnly)).toBe(1);
    expect(isPetSaveNewer(current, nextRevision)).toBe(false);
  });
});

describe("canonical visit and wish orchestration", () => {
  it("refreshes a wish on visit and grants the missed-you bonus once", () => {
    const initial = createInitialPetSave(NOON - 49 * HOUR_MS, "2026-07-28");
    const first = preparePetVisit(initial, "reader", NOON, LOCAL_DATE);
    expect(first.missed).toBe(true);
    expect(first.bondAwarded).toBe(10);
    expect(first.save.wish.date).toBe(LOCAL_DATE);

    const second = preparePetVisit(first.save, "reader", NOON + 1, LOCAL_DATE);
    expect(second.missed).toBe(false);
    expect(second.bondAwarded).toBe(0);
  });

  it("fulfills a wish only after successful care and routes +10 through the cap", () => {
    const initial = withStats(createInitialPetSave(NOON, LOCAL_DATE), {
      fullness: 40,
    });
    const ready: PetSaveV1 = {
      ...initial,
      bond: { total: 39, earnedToday: 39, earnedDate: LOCAL_DATE },
      wish: {
        date: LOCAL_DATE,
        wishId: "drink-milk",
        fulfilled: false,
        progress: 0,
        target: 1,
      },
    };

    const result = applyCareActionWithWish(
      ready,
      "reader",
      { type: "feed", foodId: "milk" },
      NOON,
      LOCAL_DATE,
    );
    expect(result.applied).toBe(true);
    expect(result.newlyFulfilled).toBe(true);
    expect(result.save.wish.fulfilled).toBe(true);
    expect(result.totalBondAwarded).toBe(1);
    expect(result.wishBondAwarded).toBe(0);
    expect(result.save.bond.earnedToday).toBe(40);
  });
});
