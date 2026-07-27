import { describe, it, expect } from "vitest";
import {
  buildQuizQuestions,
  isQuestionCorrect,
  resolveDefLanguage,
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

// 每個字都有中英文釋義；defEn 刻意不含字根，避免觸發遮蔽而干擾斷言
const BILINGUAL_POOL: GameWord[] = [
  {
    word: "apple",
    def: "蘋果",
    defEn: "a round red or green fruit",
    emoji: "🍎",
  },
  { word: "dog", def: "狗", defEn: "a friendly animal that barks", emoji: "🐶" },
  { word: "run", def: "跑", defEn: "to move fast on your feet", emoji: "🏃" },
  {
    word: "book",
    def: "書",
    defEn: "pages joined together with words to read",
    emoji: "📖",
  },
  { word: "cat", def: "貓", defEn: "a small pet that says meow", emoji: "🐱" },
];

// 任何中日韓字元出現在英文題組裡就代表洩題（中文備援選項或「選項 N」補位）
const HAS_CJK = /[㐀-䶿一-鿿]/;

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

  it("fills the requested count by cycling a small pool (boss winnability)", () => {
    const smallPool = POOL.slice(0, 4);
    const qs = buildQuizQuestions(smallPool, makeStage({ questionCount: 8 }));
    expect(qs).toHaveLength(8); // 需求 8 題 > 池 4 → 循環補足，魔王才打得倒
    const poolWords = new Set(smallPool.map((w) => w.word));
    expect(qs.every((q) => poolWords.has(q.word))).toBe(true);
  });

  it("returns no questions for an empty pool", () => {
    expect(buildQuizQuestions([], makeStage({ questionCount: 5 }))).toEqual([]);
  });

  it("never produces duplicate options even when many defs are identical", () => {
    const pool = [
      { word: "real", def: "真的", emoji: "" },
      { word: "a", def: "未知定義", emoji: "" },
      { word: "b", def: "未知定義", emoji: "" },
      { word: "c", def: "未知定義", emoji: "" },
    ];
    const q = buildQuizQuestions(pool, makeStage({ questionCount: 1 }))[0];
    if (q.kind === "spell") throw new Error("unexpected spell");
    expect(q.options).toHaveLength(4);
    expect(new Set(q.options).size).toBe(4); // 無重複選項
    expect(q.options[q.correctIndex]).toBe("真的");
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

describe("resolveDefLanguage", () => {
  it("always honours a Chinese request", () => {
    expect(resolveDefLanguage(BILINGUAL_POOL, "zh")).toBe("zh");
    expect(resolveDefLanguage([], "zh")).toBe("zh");
  });

  it("uses English when enough words carry an English def", () => {
    expect(resolveDefLanguage(BILINGUAL_POOL, "en")).toBe("en");
    expect(resolveDefLanguage(BILINGUAL_POOL.slice(0, 4), "en")).toBe("en");
  });

  it("falls the whole round back to Chinese below the four-option floor", () => {
    expect(resolveDefLanguage(BILINGUAL_POOL.slice(0, 3), "en")).toBe("zh");
    expect(resolveDefLanguage(POOL, "en")).toBe("zh"); // 舊資料完全沒有 defEn
    expect(resolveDefLanguage([], "en")).toBe("zh");
  });

  it("ignores blank English defs when counting coverage", () => {
    const padded = BILINGUAL_POOL.map((w, i) =>
      i < 3 ? w : { ...w, defEn: "   " },
    );
    expect(resolveDefLanguage(padded, "en")).toBe("zh");
  });
});

describe("英文釋義模式", () => {
  it("draws prompts and options from the English defs only", () => {
    const qs = buildQuizQuestions(
      BILINGUAL_POOL,
      makeStage({ questionCount: 5 }),
      { defLanguage: "en" },
    );
    const chineseDefs = new Set(BILINGUAL_POOL.map((w) => w.def));

    qs.forEach((q, i) => {
      if (q.kind === "spell") throw new Error("unexpected spell");
      expect(q.prompt).toBe(BILINGUAL_POOL[i].word);
      expect(q.options[q.correctIndex]).toBe(BILINGUAL_POOL[i].defEn);
      // 最重要的一條：整組選項不得混入中文，否則等於直接標出答案
      q.options.forEach((option) => {
        expect(chineseDefs.has(option)).toBe(false);
        expect(HAS_CJK.test(option)).toBe(false);
      });
    });
  });

  it("keeps padded options monolingual when defs collide", () => {
    const pool: GameWord[] = [
      { word: "real", def: "真的", defEn: "actually true", emoji: "" },
      { word: "aa", def: "甲", defEn: "one shared english def", emoji: "" },
      { word: "bb", def: "乙", defEn: "one shared english def", emoji: "" },
      { word: "cc", def: "丙", defEn: "one shared english def", emoji: "" },
    ];
    const q = buildQuizQuestions(pool, makeStage({ questionCount: 1 }), {
      defLanguage: "en",
    })[0];
    if (q.kind === "spell") throw new Error("unexpected spell");
    expect(q.options).toHaveLength(4);
    expect(new Set(q.options).size).toBe(4);
    expect(q.options[q.correctIndex]).toBe("actually true");
    q.options.forEach((option) => expect(HAS_CJK.test(option)).toBe(false));
  });

  it("shows the English def as the reverse prompt", () => {
    const qs = buildQuizQuestions(
      BILINGUAL_POOL,
      makeStage({ questionCount: 2, questionKinds: ["reverse"] }),
      { defLanguage: "en" },
    );
    qs.forEach((q, i) => {
      if (q.kind === "spell") throw new Error("unexpected spell");
      expect(q.prompt).toBe(BILINGUAL_POOL[i].defEn);
      expect(q.options[q.correctIndex]).toBe(BILINGUAL_POOL[i].word);
    });
  });

  it("uses the English def as the spell hint", () => {
    const qs = buildQuizQuestions(
      BILINGUAL_POOL,
      makeStage({ questionCount: 1, questionKinds: ["spell"] }),
      { defLanguage: "en" },
    );
    const q = qs[0];
    if (q.kind !== "spell") throw new Error("expected spell");
    expect(q.hint).toBe(BILINGUAL_POOL[0].defEn);
  });

  // buildQuizQuestions 只出「該語言可用」的字。呼叫端負責先用 resolveDefLanguage
  // 決定語言；即使有人直接指定 en，也絕不會混進沒有 defEn 的字。
  it("only asks about words that have a def in the requested language", () => {
    const mixed: GameWord[] = [
      ...BILINGUAL_POOL.slice(0, 2),
      { word: "zzz", def: "只有中文", emoji: "" },
    ];
    const qs = buildQuizQuestions(mixed, makeStage({ questionCount: 6 }), {
      defLanguage: "en",
    });
    expect(qs.every((q) => q.word !== "zzz")).toBe(true);
  });

  it("masks the head word so English defs cannot give the answer away", () => {
    const pool: GameWord[] = [
      {
        word: "Perseverance",
        def: "毅力",
        defEn: "the act of persevering when things get hard",
        emoji: "💪",
      },
      ...BILINGUAL_POOL.slice(0, 3),
    ];
    const qs = buildQuizQuestions(
      pool,
      makeStage({ questionCount: 1, questionKinds: ["spell"] }),
      { defLanguage: "en" },
    );
    const q = qs[0];
    if (q.kind !== "spell") throw new Error("expected spell");
    expect(q.hint).not.toMatch(/persever/i);
    expect(q.hint).toContain("____");
  });

  it("leaves Chinese mode untouched when English defs exist", () => {
    const qs = buildQuizQuestions(
      BILINGUAL_POOL,
      makeStage({ questionCount: 5 }),
      { defLanguage: "zh" },
    );
    qs.forEach((q, i) => {
      if (q.kind === "spell") throw new Error("unexpected spell");
      expect(q.options[q.correctIndex]).toBe(BILINGUAL_POOL[i].def);
    });
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
