import { describe, expect, it } from "vitest";
import {
  cefrRank,
  hasEdgePunctuation,
  loadCefrTable,
  lookupCefrLevel,
  practiceForm,
  practiceKey,
  resolveCefr,
  type CefrTable,
} from "./cefr";

const table: CefrTable = new Map([
  ["run", "A1"],
  ["make", "A1"],
  ["child", "A1"],
  ["evening", "A1"],
  ["even", "A2"],
  ["don't", "A1"],
  ["a.m.", "A1"],
  ["mr.", "A1"],
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
  describe("practiceForm", () => {
    it("strips punctuation at either edge and keeps the casing", () => {
      expect(practiceForm(table, "Run.")).toBe("Run");
      expect(practiceForm(table, "hello,")).toBe("hello");
      expect(practiceForm(table, '  "river!"  ')).toBe("river");
      expect(practiceForm(table, "(ice cream)")).toBe("ice cream");
      expect(practiceForm(table, "run")).toBe("run");
    });

    it("keeps punctuation inside the word", () => {
      expect(practiceForm(table, "Don’t.")).toBe("Don’t");
      expect(practiceForm(table, "well-known,")).toBe("well-known");
    });

    it("keeps an abbreviation that is a word list headword", () => {
      expect(practiceForm(table, "a.m.")).toBe("a.m.");
      expect(practiceForm(table, "Mr.")).toBe("Mr.");
      expect(practiceForm(table, " MR. ")).toBe("MR.");
    });

    it("keeps an initialism written with dots even when the list lacks it", () => {
      expect(practiceForm(table, "e.g.")).toBe("e.g.");
      expect(practiceForm(table, "U.S.")).toBe("U.S.");
    });

    it("does not keep the period of an unlisted abbreviation without inner dots", () => {
      expect(practiceForm(table, "Dr.")).toBe("Dr");
    });

    it("falls back to the trimmed text when nothing but punctuation is left", () => {
      expect(practiceForm(table, " ... ")).toBe("...");
    });
  });

  it("detects punctuation at the edge of a word", () => {
    expect(hasEdgePunctuation("run.")).toBe(true);
    expect(hasEdgePunctuation(" (run")).toBe(true);
    expect(hasEdgePunctuation("run")).toBe(false);
    expect(hasEdgePunctuation(" don't ")).toBe(false);
  });

  it("loads the generated table", async () => {
    const loaded = await loadCefrTable();
    expect(loaded.size).toBeGreaterThan(7000);
    expect(loaded.get("abandon")).toBe("B1");
    expect(loaded.get("cloak")).toBe("C1");
  });
  it("loads the table once and shares it", async () => {
    const first = loadCefrTable();
    expect(loadCefrTable()).toBe(first);
    expect(await first).toBe(await loadCefrTable());
  });
});
