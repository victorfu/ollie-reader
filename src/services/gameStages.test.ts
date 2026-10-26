vi.mock("../utils/firebaseUtil", () => ({ db: {} }));
import { describe, it, expect, vi } from "vitest";
import { STAGES, LEVEL_EXP_TABLE } from "./gameProgressService";
import { CHAPTERS, getChapterForStageIndex } from "../constants/chapters";
import { BOSS_EMOJI, SCENE_THEMES } from "../constants/sceneThemes";

const QUIZ_KINDS = ["meaning", "listen", "spell", "reverse", "emoji", "cloze"];

describe("STAGES data integrity", () => {
  it("stage numbers are strictly increasing", () => {
    for (let i = 1; i < STAGES.length; i++) {
      expect(STAGES[i].stageNumber).toBeGreaterThan(STAGES[i - 1].stageNumber);
    }
  });

  it("required level never decreases", () => {
    for (let i = 1; i < STAGES.length; i++) {
      expect(STAGES[i].requiredLevel).toBeGreaterThanOrEqual(
        STAGES[i - 1].requiredLevel,
      );
    }
  });

  it("every boss has HP defined", () => {
    for (const stage of STAGES.filter((s) => s.isBoss)) {
      expect(stage.bossHp, stage.id).toBeGreaterThan(0);
    }
  });

  it("declares only valid question kinds", () => {
    for (const stage of STAGES) {
      for (const kind of stage.questionKinds ?? []) {
        expect(QUIZ_KINDS).toContain(kind);
      }
    }
  });

  it("required levels stay within the level cap", () => {
    const maxLevel = LEVEL_EXP_TABLE.length;
    for (const stage of STAGES) {
      expect(stage.requiredLevel).toBeLessThanOrEqual(maxLevel);
    }
  });
});

describe("chapters", () => {
  it("chapter start indices are valid and ordered", () => {
    for (let i = 0; i < CHAPTERS.length; i++) {
      expect(CHAPTERS[i].firstStageIndex).toBeLessThan(STAGES.length);
      if (i > 0) {
        expect(CHAPTERS[i].firstStageIndex).toBeGreaterThan(
          CHAPTERS[i - 1].firstStageIndex,
        );
      }
    }
  });

  it("maps stage indices to the right chapter", () => {
    expect(getChapterForStageIndex(0).id).toBe("ch1");
    expect(getChapterForStageIndex(12).id).toBe("ch1");
    expect(getChapterForStageIndex(13).id).toBe("ch2");
    expect(getChapterForStageIndex(22).id).toBe("ch2");
    expect(getChapterForStageIndex(23).id).toBe("ch3");
    expect(getChapterForStageIndex(STAGES.length - 1).id).toBe("ch3");
  });
});

describe("chapter 3", () => {
  const ch3 = STAGES.filter((s) => s.chapterId === "ch3");

  it("has 33 stages ending with the deep sea whale king", () => {
    expect(STAGES).toHaveLength(33);
    expect(STAGES[32].id).toBe("boss-11");
    expect(ch3).toHaveLength(10);
  });

  it("only chapter 3 uses cloze", () => {
    for (const stage of STAGES) {
      if (stage.questionKinds?.includes("cloze")) {
        expect(stage.chapterId, stage.id).toBe("ch3");
      }
    }
  });

  it("every chapter 3 stage has a scene theme and every boss an emoji", () => {
    for (const stage of ch3) {
      expect(SCENE_THEMES[stage.id], stage.id).toBeDefined();
      if (stage.isBoss) expect(BOSS_EMOJI[stage.id], stage.id).toBeDefined();
    }
  });
});
