import { describe, it, expect } from "vitest";
import {
  buildQuizQuestions,
  isQuestionCorrect,
  scrambleWord,
} from "./quizQuestions";
import type { GameWord } from "../../services/gameService";
import type { QuizKind, Stage } from "../../types/game";

const POOL: GameWord[] = [
  { word: "apple", def: "蘋果", emoji: "🍎" },
  { word: "dog", def: "狗", emoji: "🐶" },
  { word: "run", def: "跑", emoji: "🏃" },
  { word: "book", def: "書", emoji: "📖" },
  { word: "cat", def: "貓", emoji: "🐱" },
];

function makeStage(over: Partial<Stage>): Stage {
  return {
    id: "t",
    name: "測試關",
    stageNumber: 1,
    isBoss: false,
    requiredLevel: 1,
    rewardExp: 0,
    questionCount: 4,
    ...over,
  };
}

describe("buildQuizQuestions", () => {
  it("defaults to all-meaning when no questionKinds", () => {
    const qs = buildQuizQuestions(POOL, makeStage({ questionCount: 4 }));
    expect(qs).toHaveLength(4);
    expect(qs.every((q) => q.kind === "meaning")).toBe(true);
    qs.forEach((q, i) => {
      if (q.kind === "spell") throw new Error("unexpected spell");
      expect(q.word).toBe(POOL[i].word);
      expect(q.prompt).toBe(POOL[i].word); // meaning 顯示英文字
      expect(q.options).toHaveLength(4);
      expect(q.options[q.correctIndex]).toBe(POOL[i].def);
    });
  });

  it("caps question count at pool size", () => {
    const qs = buildQuizQuestions(POOL, makeStage({ questionCount: 99 }));
    expect(qs).toHaveLength(POOL.length);
  });

  it("cycles through declared question kinds", () => {
    const kinds: QuizKind[] = ["meaning", "reverse"];
    const qs = buildQuizQuestions(
      POOL,
      makeStage({ questionCount: 4, questionKinds: kinds }),
    );
    expect(qs.map((q) => q.kind)).toEqual([
      "meaning",
      "reverse",
      "meaning",
      "reverse",
    ]);
  });

  it("drops listen kind when speech is unsupported", () => {
    const qs = buildQuizQuestions(
      POOL,
      makeStage({ questionCount: 3, questionKinds: ["listen"] }),
      { speechSupported: false },
    );
    expect(qs.every((q) => q.kind === "meaning")).toBe(true);
  });

  it("keeps listen kind when speech is supported", () => {
    const qs = buildQuizQuestions(
      POOL,
      makeStage({ questionCount: 3, questionKinds: ["listen"] }),
      { speechSupported: true },
    );
    expect(qs.every((q) => q.kind === "listen")).toBe(true);
    qs.forEach((q) => {
      if (q.kind === "spell") throw new Error("unexpected spell");
      expect(q.prompt).toBe(""); // listen 不顯示文字
    });
  });

  it("reverse questions show the Chinese def and offer English options", () => {
    const qs = buildQuizQuestions(
      POOL,
      makeStage({ questionCount: 2, questionKinds: ["reverse"] }),
    );
    qs.forEach((q, i) => {
      if (q.kind === "spell") throw new Error("unexpected spell");
      expect(q.kind).toBe("reverse");
      expect(q.prompt).toBe(POOL[i].def);
      expect(q.options[q.correctIndex]).toBe(POOL[i].word);
    });
  });

  it("falls back to meaning for emoji questions without a usable emoji", () => {
    const pool: GameWord[] = [
      { word: "thing", def: "東西", emoji: "✨" }, // 預設 emoji → 無解
      { word: "star", def: "星星", emoji: "" }, // 空 emoji → 無解
    ];
    const qs = buildQuizQuestions(
      pool,
      makeStage({ questionCount: 2, questionKinds: ["emoji"] }),
    );
    expect(qs.every((q) => q.kind === "meaning")).toBe(true);
  });

  it("emoji questions use the emoji as prompt when usable", () => {
    const qs = buildQuizQuestions(
      POOL,
      makeStage({ questionCount: 2, questionKinds: ["emoji"] }),
    );
    qs.forEach((q, i) => {
      if (q.kind === "spell") throw new Error("unexpected spell");
      expect(q.kind).toBe("emoji");
      expect(q.prompt).toBe(POOL[i].emoji);
      expect(q.options[q.correctIndex]).toBe(POOL[i].def);
    });
  });

  it("spell questions scramble the word and keep the answer as the word", () => {
    const qs = buildQuizQuestions(
      POOL,
      makeStage({ questionCount: 1, questionKinds: ["spell"] }),
    );
    const q = qs[0];
    if (q.kind !== "spell") throw new Error("expected spell");
    expect([...q.letters].sort()).toEqual([...POOL[0].word].sort());
    expect(q.hint).toBe(POOL[0].def);
    expect(q.word).toBe(POOL[0].word);
  });
});

describe("scrambleWord", () => {
  it("preserves the multiset of letters and length", () => {
    const out = scrambleWord("elephant");
    expect(out).toHaveLength("elephant".length);
    expect([...out].sort()).toEqual([..."elephant"].sort());
  });

  it("handles single-character words", () => {
    expect(scrambleWord("a")).toEqual(["a"]);
  });
});

describe("isQuestionCorrect", () => {
  it("checks option index for choice questions", () => {
    const q = buildQuizQuestions(POOL, makeStage({ questionCount: 1 }))[0];
    if (q.kind === "spell") throw new Error("unexpected spell");
    expect(isQuestionCorrect(q, q.correctIndex)).toBe(true);
    expect(isQuestionCorrect(q, (q.correctIndex + 1) % 4)).toBe(false);
    expect(isQuestionCorrect(q, "apple")).toBe(false); // 選項題不吃字串
  });

  it("checks case/whitespace-insensitive string for spell questions", () => {
    const qs = buildQuizQuestions(
      POOL,
      makeStage({ questionCount: 1, questionKinds: ["spell"] }),
    );
    const q = qs[0];
    expect(isQuestionCorrect(q, "  APPLE ")).toBe(true);
    expect(isQuestionCorrect(q, "aple")).toBe(false);
    expect(isQuestionCorrect(q, 0)).toBe(false); // 拼字題不吃數字
  });
});
