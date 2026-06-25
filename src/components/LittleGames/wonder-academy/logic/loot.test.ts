import { describe, expect, it } from "vitest";
import type { Rng } from "./rng";
import type { LootTable } from "./loot";
import { rollLoot } from "./loot";

const seq = (values: number[]): Rng => {
  let i = 0;
  return () => values[i++];
};

const table: LootTable = {
  rolls: 3,
  entries: [
    { itemId: "starberry-cookie", quantity: 1, weight: 1 },
    { itemId: "stardust", quantity: 5, weight: 1 },
  ],
};

describe("rollLoot", () => {
  it("returns an empty result for zero rolls", () => {
    expect(rollLoot({ ...table, rolls: 0 }, seq([]))).toEqual({});
  });

  it("accumulates quantity when the same item is rolled repeatedly", () => {
    // total weight 2; r<1 -> first entry. rng 0,0.1,0.4 all map to entry 0
    expect(rollLoot(table, seq([0, 0.1, 0.4]))).toEqual({
      "starberry-cookie": 3,
    });
  });

  it("accumulates separate items independently", () => {
    // rng 0 -> entry0 (cookie x1); rng 0.9 -> r=1.8 -> entry1 (stardust x5); rng 0 -> entry0 (cookie x1)
    expect(rollLoot(table, seq([0, 0.9, 0]))).toEqual({
      "starberry-cookie": 2,
      stardust: 5,
    });
  });
});
