vi.mock("../utils/firebaseUtil", () => ({ db: {} }));
import { describe, it, expect, vi } from "vitest";
import { STAGES, LEVEL_EXP_TABLE } from "./gameProgressService";
import { CHAPTERS, getChapterForStageIndex } from "../constants/chapters";
import {
  BOSS_EMOJI,
  BOSS_PHASE_EMOJI,
  SCENE_THEMES,
  bossSceneId,
} from "../constants/sceneThemes";
import type { QuizKind, Stage } from "../types/game";

// 各題型第一次出現的章節；之前的章節不能用到
const KIND_INTRODUCED_IN: Record<QuizKind, string> = {
  meaning: "ch1",
  listen: "ch2",
  emoji: "ch2",
  reverse: "ch2",
  spell: "ch2",
  cloze: "ch3",
  dictation: "ch4",
  synonym: "ch4",
  pos: "ch5",
  order: "ch5",
  typing: "ch6",
  listenCloze: "ch6",
};
const QUIZ_KINDS = Object.keys(KIND_INTRODUCED_IN);

/** 關卡所有會出現的題型（含多階段魔王每階段） */
const kindsOf = (stage: Stage): QuizKind[] => [
  ...(stage.questionKinds ?? []),
  ...(stage.bossPhases ?? []).flat(),
];
const chapterIndex = (id: string | undefined) =>
  CHAPTERS.findIndex((c) => c.id === (id ?? "ch1"));

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
      for (const kind of kindsOf(stage)) {
        expect(QUIZ_KINDS).toContain(kind);
      }
    }
  });

  it("uses each question kind only from the chapter that introduces it", () => {
    for (const stage of STAGES) {
      for (const kind of kindsOf(stage)) {
        expect(
          chapterIndex(stage.chapterId),
          `${stage.id} uses ${kind}`,
        ).toBeGreaterThanOrEqual(chapterIndex(KIND_INTRODUCED_IN[kind]));
      }
    }
  });

  it("every stage after chapter 1 has a scene theme and every boss an emoji", () => {
    for (const stage of STAGES.filter((s) => s.chapterId)) {
      expect(SCENE_THEMES[stage.id], stage.id).toBeDefined();
      if (stage.isBoss) expect(BOSS_EMOJI[stage.id], stage.id).toBeDefined();
    }
  });

  it("stage ids are unique", () => {
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(STAGES.length);
  });

  it("the level table keeps rising", () => {
    for (let i = 1; i < LEVEL_EXP_TABLE.length; i++) {
      expect(LEVEL_EXP_TABLE[i]).toBeGreaterThan(LEVEL_EXP_TABLE[i - 1]);
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
    expect(getChapterForStageIndex(32).id).toBe("ch3");
    expect(getChapterForStageIndex(33).id).toBe("ch4");
    expect(getChapterForStageIndex(43).id).toBe("ch5");
    expect(getChapterForStageIndex(53).id).toBe("ch6");
    expect(getChapterForStageIndex(63).id).toBe("ch7");
    expect(getChapterForStageIndex(STAGES.length - 1).id).toBe("ch7");
  });

  it("every stage's chapterId matches the chapter its index falls in", () => {
    STAGES.forEach((stage, index) => {
      expect(getChapterForStageIndex(index).id, stage.id).toBe(
        stage.chapterId ?? "ch1",
      );
    });
  });
});

describe("chapters 3 to 7", () => {
  it("has 75 stages ending with the cosmic king", () => {
    expect(STAGES).toHaveLength(75);
    expect(STAGES[32].id).toBe("boss-11");
    expect(STAGES[74].id).toBe("boss-24");
  });

  it("chapters 3 to 6 have 7 stages and 3 bosses, chapter 7 has 8 and 4", () => {
    for (const id of ["ch3", "ch4", "ch5", "ch6", "ch7"]) {
      const stages = STAGES.filter((s) => s.chapterId === id);
      const bosses = stages.filter((s) => s.isBoss).length;
      const expected = id === "ch7" ? [8, 4] : [7, 3];
      expect([stages.length - bosses, bosses], id).toEqual(expected);
      expect(stages[stages.length - 1].isBoss, id).toBe(true);
    }
  });

  it("raises the level cap to 40", () => {
    expect(LEVEL_EXP_TABLE).toHaveLength(40);
  });

  it("every chapter 7 boss has phases and a shield; the last one has three phases", () => {
    const bosses = STAGES.filter((s) => s.chapterId === "ch7" && s.isBoss);
    for (const boss of bosses) {
      expect(boss.bossPhases?.length, boss.id).toBeGreaterThanOrEqual(2);
      expect(boss.bossShield, boss.id).toBe(true);
      // 第一階段的題型要和 questionKinds 一致，地圖顯示才不會騙人
      expect(boss.questionKinds, boss.id).toEqual(boss.bossPhases?.[0]);
    }
    expect(bosses[bosses.length - 1].bossPhases).toHaveLength(3);
  });

  it("only chapter 7 bosses use phases or a shield", () => {
    for (const stage of STAGES.filter((s) => s.chapterId !== "ch7")) {
      expect(stage.bossPhases, stage.id).toBeUndefined();
      expect(stage.bossShield, stage.id).toBeUndefined();
    }
  });

  it("every later boss phase has its own look and scene", () => {
    for (const boss of STAGES.filter((s) => s.bossPhases)) {
      const phases = boss.bossPhases ?? [];
      expect(BOSS_PHASE_EMOJI[boss.id], boss.id).toHaveLength(phases.length);
      for (let phase = 1; phase < phases.length; phase++) {
        expect(bossSceneId(boss.id, phase), boss.id).not.toBe(boss.id);
      }
    }
  });
});
