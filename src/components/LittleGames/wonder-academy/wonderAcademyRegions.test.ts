import { describe, expect, it } from "vitest";
import {
  FIRST_REGION,
  REGIONS,
  nodeKey,
  nodeUnlockHint,
  regionValidationErrors,
  type Region,
} from "./wonderAcademyRegions";

describe("nodeUnlockHint", () => {
  it("returns null for nodes without requirements", () => {
    const entry = FIRST_REGION.nodes.find((node) => node.id === "entry");

    expect(entry).toBeDefined();
    expect(nodeUnlockHint(entry!, FIRST_REGION, [])).toBeNull();
  });

  it("names the missing prerequisite for locked nodes", () => {
    const meadow = FIRST_REGION.nodes.find((node) => node.id === "meadow");

    expect(meadow).toBeDefined();
    expect(nodeUnlockHint(meadow!, FIRST_REGION, [])).toBe("先完成「林間入口」");
  });

  it("returns null once all prerequisites are cleared", () => {
    const meadow = FIRST_REGION.nodes.find((node) => node.id === "meadow");

    expect(meadow).toBeDefined();
    expect(nodeUnlockHint(meadow!, FIRST_REGION, [nodeKey(FIRST_REGION.id, "entry")])).toBeNull();
  });

  it("falls back to the raw prerequisite id when a region label is missing", () => {
    const region: Region = {
      ...FIRST_REGION,
      nodes: [
        {
          id: "mystery",
          label: "祕密地點",
          kind: "explore",
          x: 0.5,
          y: 0.5,
          requires: ["missing-node"],
        },
      ],
    };

    expect(nodeUnlockHint(region.nodes[0], region, [])).toBe("先完成「missing-node」");
  });
});

describe("regionValidationErrors", () => {
  it("accepts every shipped Wonder Academy region", () => {
    for (const region of REGIONS) {
      expect(regionValidationErrors(region), `${region.id} should be valid`).toEqual([]);
    }
  });

  it("reports malformed map and node data", () => {
    const malformed: Region = {
      ...FIRST_REGION,
      id: "broken",
      minLevel: 9,
      maxLevel: 4,
      wardenSpeciesId: "missing-warden",
      wardenLevel: 3,
      map: [
        "TTTT",
        "TP?",
        "TTTT",
      ],
      nodes: [
        { id: "entry", label: "入口", kind: "explore", x: -0.1, y: 0.5, requires: ["missing"] },
        { id: "entry", label: "重複入口", kind: "explore", x: 0.4, y: 1.2, requires: ["entry"] },
        { id: "warden", label: "守關", kind: "warden", x: 0.7, y: 0.7, requires: ["entry"] },
        { id: "warden-2", label: "第二守關", kind: "warden", x: 0.8, y: 0.8, requires: [] },
      ],
    };

    expect(regionValidationErrors(malformed)).toEqual([
      "broken: map row 1 has width 3, expected 4",
      "broken: unknown tile '?' at 2,1",
      "broken: expected exactly one start tile S, found 0",
      "broken: expected at least one exit tile X",
      "broken: minLevel 9 exceeds maxLevel 4",
      "broken: wardenLevel 3 is below maxLevel 4",
      "broken: unknown warden species 'missing-warden'",
      "broken: duplicate node id 'entry'",
      "broken: node 'entry' x must be between 0 and 1",
      "broken: node 'entry' requires unknown node 'missing'",
      "broken: node 'entry' y must be between 0 and 1",
      "broken: node 'entry' cannot require itself",
      "broken: expected exactly one warden node, found 2",
    ]);
  });
});
