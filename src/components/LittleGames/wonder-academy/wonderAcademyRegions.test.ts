import { describe, expect, it } from "vitest";
import {
  FIRST_REGION,
  nodeKey,
  nodeUnlockHint,
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
