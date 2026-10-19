import { describe, expect, it } from "vitest";
import { cefrRank, loadCefrTable, lookupCefrLevel, practiceKey, resolveCefr, type CefrTable } from "./cefr";

const table: CefrTable = new Map([
  ["run", "A1"],
  ["make", "A1"],
  ["child", "A1"],
  ["evening", "A1"],
  ["even", "A2"],
  ["don't", "A1"],
  ["a.m.", "A1"],
] as const);

describe("cefr", () => {
  it("ranks levels", () => expect(cefrRank("A1")).toBeLessThan(cefrRank("C2")));
  it("normalizes keys", () => {
    expect(practiceKey("  Run. ")).toBe("run");
    expect(practiceKey("Don’t")).toBe("don't");
  });
  it("prefers an exact match, then base candidates", () => {
    expect(lookupCefrLevel(table, "evening")).toBe("A1");
    expect(lookupCefrLevel(table, "Ran")).toBe("A1");
    expect(lookupCefrLevel(table, "making")).toBe("A1");
    expect(lookupCefrLevel(table, "children")).toBe("A1");
    expect(lookupCefrLevel(table, "xyzzy")).toBeNull();
  });
  it("finds keys that end in punctuation and still strips it when needed", () => {
    expect(lookupCefrLevel(table, "a.m.")).toBe("A1");
    expect(lookupCefrLevel(table, "A.M.")).toBe("A1");
    expect(lookupCefrLevel(table, "Run.")).toBe("A1");
    expect(lookupCefrLevel(table, "Don’t")).toBe("A1");
  });
  it("falls back to AI estimates by practice key", () => {
    expect(resolveCefr(table, {}, "run")).toEqual({ level: "A1", source: "list" });
    expect(resolveCefr(table, { "bona fide": "C2" }, "Bona  Fide")).toEqual({ level: "C2", source: "ai" });
    expect(resolveCefr(table, {}, "bona fide")).toBeNull();
  });
  it("loads the generated table", async () => {
    const loaded = await loadCefrTable();
    expect(loaded.size).toBeGreaterThan(7000);
    expect(loaded.get("abandon")).toBe("B1");
    expect(loaded.get("cloak")).toBe("C1");
  });
});
