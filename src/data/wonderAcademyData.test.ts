import { describe, expect, it } from "vitest";
import {
  WONDER_ACADEMY_CHAPTERS,
  WONDER_ACADEMY_STARTERS,
  getCurrentObjective,
  getNodeById,
  getStarterById,
} from "./wonderAcademyData";

describe("Wonder Academy data", () => {
  it("defines exactly four nicknameable starters", () => {
    expect(WONDER_ACADEMY_STARTERS.map((starter) => starter.speciesId)).toEqual([
      "lumi",
      "momo",
      "pico",
      "nibi",
    ]);
    for (const starter of WONDER_ACADEMY_STARTERS) {
      expect(starter.speciesName).toMatch(/^[A-Z]/);
      expect(starter.growthStages.length).toBe(4);
      expect(starter.fieldSkillId).toBeTruthy();
      expect(starter.learnableSkillIds.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("builds Sparkleaf Grove as adjacent node movement", () => {
    const chapter = WONDER_ACADEMY_CHAPTERS[0];
    expect(chapter.id).toBe("sparkleaf-grove");
    expect(chapter.nodes.length).toBeGreaterThanOrEqual(6);
    expect(chapter.nodes.length).toBeLessThanOrEqual(10);
    expect(getNodeById("sparkleaf-grove", "academy-gate")?.adjacentNodeIds).toContain(
      "firefly-clearing",
    );
    expect(getNodeById("sparkleaf-grove", "sparkleaf-warden")?.kind).toBe("warden");
  });

  it("exposes a clear current objective", () => {
    expect(
      getCurrentObjective({
        currentChapterId: "sparkleaf-grove",
        currentNodeId: "academy-gate",
        completedNodeIds: [],
      }),
    ).toEqual({
      id: "go-firefly-clearing",
      label: "前往 Firefly Clearing",
      description: "從 Academy Gate 出發，沿著發光葉子找到第一個森林節點。",
      targetChapterId: "sparkleaf-grove",
      targetNodeId: "firefly-clearing",
    });
  });

  it("looks up starters by id", () => {
    expect(getStarterById("lumi")?.speciesName).toBe("Lumi");
    expect(getStarterById("missing")).toBeNull();
  });
});
