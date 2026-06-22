import { describe, expect, it } from "vitest";
import {
  WONDER_ACADEMY_CHAPTERS,
  WONDER_ACADEMY_STARTERS,
  getChapterById,
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
      expect(starter.silhouetteAsset).toMatch(/^starters\/[a-z-]+\.png$/);
      expect(starter.portraitAsset).toMatch(/^starters\/[a-z-]+\.png$/);
      expect(starter.spriteAsset).toMatch(/^starters\/[a-z-]+\.png$/);
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

  it("looks up chapters and nodes by id", () => {
    expect(getChapterById("sparkleaf-grove")?.title).toBe("Chapter 1: Sparkleaf Grove");
    expect(getChapterById("missing")).toBeNull();
    expect(getNodeById("sparkleaf-grove", "missing")).toBeNull();
    expect(getNodeById("missing", "academy-gate")).toBeNull();
  });

  it("returns a chapter-complete objective after terminal node completion", () => {
    expect(
      getCurrentObjective({
        currentChapterId: "sparkleaf-grove",
        currentNodeId: "sparkleaf-warden",
        completedNodeIds: ["sparkleaf-warden"],
      }),
    ).toEqual({
      id: "return-academy-hub",
      label: "返回 Academy Hub",
      description: "Sparkleaf Grove 的 Bell Tone 已找回，回到 Wonder Academy 準備下一段旅程。",
      targetChapterId: "sparkleaf-grove",
      targetNodeId: "academy-gate",
    });
  });

  it("does not complete the chapter after an optional side node is completed", () => {
    expect(
      getCurrentObjective({
        currentChapterId: "sparkleaf-grove",
        currentNodeId: "hidden-burrow",
        completedNodeIds: ["hidden-burrow"],
      }),
    ).toEqual({
      id: "comfort-mossmew",
      label: "安撫迷路的 Mossmew",
      description: "完成第一場 Mood Trial，讓 Mossmew 願意靠近。",
      targetChapterId: "sparkleaf-grove",
      targetNodeId: "firefly-clearing",
    });
  });

  it("resumes the main path when an optional side node and its parent are complete", () => {
    const objective = getCurrentObjective({
      currentChapterId: "sparkleaf-grove",
      currentNodeId: "hidden-burrow",
      completedNodeIds: ["firefly-clearing", "hidden-burrow"],
    });

    expect(objective).toEqual({
      id: "repair-mossy-bridge",
      label: "找出橋上的發光藤蔓",
      description: "使用 starter field skill，清出通往森林深處的路。",
      targetChapterId: "sparkleaf-grove",
      targetNodeId: "mossy-bridge",
    });
    expect(objective.targetNodeId).not.toBe("hidden-burrow");
    expect(objective.id).not.toBe("return-academy-hub");
  });
});
