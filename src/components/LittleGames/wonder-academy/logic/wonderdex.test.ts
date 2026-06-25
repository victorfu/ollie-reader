import { describe, expect, it } from "vitest";
import type { Wonderdex } from "./wonderdex";
import { dexCompletion, recordDex } from "./wonderdex";

describe("recordDex", () => {
  it("upgrades an unseen species to the new status", () => {
    expect(recordDex({}, "lumi", "seen")).toEqual({ lumi: "seen" });
  });

  it("advances through the ranks", () => {
    let dex: Wonderdex = {};
    dex = recordDex(dex, "lumi", "seen");
    dex = recordDex(dex, "lumi", "caught");
    dex = recordDex(dex, "lumi", "evolved");
    expect(dex.lumi).toBe("evolved");
  });

  it("never downgrades and returns the same reference when unchanged", () => {
    const dex: Wonderdex = { lumi: "caught" };
    const next = recordDex(dex, "lumi", "seen");
    expect(next).toBe(dex);
    expect(next.lumi).toBe("caught");
  });

  it("does not mutate the input", () => {
    const dex: Wonderdex = { lumi: "seen" };
    recordDex(dex, "lumi", "caught");
    expect(dex.lumi).toBe("seen");
  });
});

describe("dexCompletion", () => {
  const all = ["lumi", "momo", "pico", "nibi"];

  it("counts seen and caught across all species", () => {
    const dex: Wonderdex = { lumi: "evolved", momo: "caught", pico: "seen" };
    expect(dexCompletion(dex, all)).toEqual({
      seen: 3,
      caught: 2,
      total: 4,
      caughtRatio: 0.5,
    });
  });

  it("treats missing species as unseen", () => {
    expect(dexCompletion({}, all)).toEqual({
      seen: 0,
      caught: 0,
      total: 4,
      caughtRatio: 0,
    });
  });

  it("avoids division by zero for an empty species list", () => {
    expect(dexCompletion({}, []).caughtRatio).toBe(0);
  });
});
