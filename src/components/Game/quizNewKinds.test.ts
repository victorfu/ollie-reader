import { describe, it, expect } from "vitest";
import {
  buildQuizQuestions,
  holdsAfterCorrect,
  isQuestionCorrect,
  ORDER_MAX_TOKENS,
  POS_OPTIONS,
} from "./quizQuestions";
import type { GameWord } from "../../services/gameService";
import type { QuizKind, Stage } from "../../types/game";
import { CLOZE_BLANK } from "../../utils/wordForms";
import { FALLBACK_GAME_WORDS } from "../../services/gameWords";

// 第四到第六章的新題型：每個字刻意只給部分資料，好測各題型的退回規則
const POOL: GameWord[] = [
  {
    word: "happy",
    def: "快樂的",
    emoji: "😊",
    example: "The happy puppy wagged its tail.",
    exampleZh: "快樂的小狗搖著尾巴。",
    pos: "adjective",
    synonyms: ["glad", "cheerful"],
    antonyms: ["sad"],
  },
  {
    word: "quickly",
    def: "快速地",
    emoji: "💨",
    example: "She ran quickly to catch the bus.",
    pos: "adverb",
    antonyms: ["slowly"],
  },
  { word: "apple", def: "蘋果", emoji: "🍎" },
  { word: "dog", def: "狗", emoji: "🐶", pos: "noun" },
  { word: "jump", def: "跳", emoji: "🦘", pos: "verb", synonyms: ["leap"] },
];

function stage(kinds: QuizKind[], questionCount = 1): Stage {
  return {
    id: "t",
    name: "測試關",
    stageNumber: 1,
    isBoss: false,
    requiredLevel: 1,
    rewardExp: 0,
    questionCount,
    questionKinds: kinds,
  };
}

/** 從 POOL 指定某個字出一題 */
function questionFor(
  word: string,
  kind: QuizKind,
  opts?: { speechSupported?: boolean },
) {
  const target = POOL.find((w) => w.word === word);
  if (!target) throw new Error(`missing ${word}`);
  const pool = [target, ...POOL.filter((w) => w !== target)];
  return buildQuizQuestions(pool, stage([kind]), opts)[0];
}

describe("dictation", () => {
  it("scrambles the word's letters and keeps the meaning for the reveal", () => {
    const q = questionFor("happy", "dictation");
    if (q.kind !== "dictation") throw new Error(`unexpected ${q.kind}`);
    expect([...q.letters].sort().join("")).toBe("happy".split("").sort().join(""));
    expect(q.hint).toBe("快樂的");
    expect(isQuestionCorrect(q, "HAPPY ")).toBe(true);
    expect(isQuestionCorrect(q, "hapy")).toBe(false);
  });

  it("becomes a spell question when speech is unavailable", () => {
    expect(questionFor("happy", "dictation", { speechSupported: false }).kind).toBe(
      "spell",
    );
  });
});

describe("typing", () => {
  it("checks the typed word ignoring case and outer spaces", () => {
    const q = questionFor("apple", "typing");
    if (q.kind !== "typing") throw new Error(`unexpected ${q.kind}`);
    expect(q.hint).toBe("蘋果");
    expect(isQuestionCorrect(q, "  Apple ")).toBe(true);
    expect(isQuestionCorrect(q, "aple")).toBe(false);
    expect(isQuestionCorrect(q, 0)).toBe(false);
  });
});

describe("synonym", () => {
  it("asks for a synonym or antonym that the word actually has", () => {
    for (let i = 0; i < 20; i++) {
      const q = questionFor("happy", "synonym");
      if (q.kind !== "synonym") throw new Error(`unexpected ${q.kind}`);
      const answer = q.options[q.correctIndex];
      if (q.relation === "same") expect(["glad", "cheerful"]).toContain(answer);
      else expect(answer).toBe("sad");
    }
  });

  it("never offers another synonym or antonym as a distractor", () => {
    for (let i = 0; i < 20; i++) {
      const q = questionFor("happy", "synonym");
      if (q.kind !== "synonym") throw new Error(`unexpected ${q.kind}`);
      const wrong = q.options.filter((_, idx) => idx !== q.correctIndex);
      for (const option of wrong) {
        expect(["happy", "glad", "cheerful", "sad"]).not.toContain(
          option.toLowerCase(),
        );
      }
      expect(new Set(q.options.map((o) => o.toLowerCase())).size).toBe(4);
    }
  });

  it("skips words that list the target as their own synonym", () => {
    const pool: GameWord[] = [
      { word: "big", def: "大的", emoji: "🐘", synonyms: ["large"] },
      // large 把 big 列為同義字 → large 這組字都不能當干擾項
      { word: "large", def: "大的", emoji: "🏔️", synonyms: ["big", "huge"] },
      { word: "apple", def: "蘋果", emoji: "🍎" },
      { word: "dog", def: "狗", emoji: "🐶" },
      { word: "cat", def: "貓", emoji: "🐱" },
    ];
    for (let i = 0; i < 20; i++) {
      const q = buildQuizQuestions(pool, stage(["synonym"]))[0];
      if (q.kind !== "synonym") throw new Error(`unexpected ${q.kind}`);
      expect(q.options).not.toContain("huge");
    }
  });

  // 同反義資料常只記一個方向：glad 記了 unhappy，happy 卻只記了 sad
  it("ignores one-way synonym data from other words", () => {
    const pool: GameWord[] = [
      { word: "happy", def: "快樂的", emoji: "😊", synonyms: ["cheerful"], antonyms: ["sad"] },
      { word: "glad", def: "高興的", emoji: "😀", synonyms: ["pleased"], antonyms: ["unhappy"] },
      { word: "happy", def: "開心", emoji: "😄", antonyms: ["gloomy"] },
      { word: "dog", def: "狗", emoji: "🐶" },
    ];
    for (let i = 0; i < 30; i++) {
      const q = buildQuizQuestions(pool, stage(["synonym"]))[0];
      if (q.kind !== "synonym") throw new Error(`unexpected ${q.kind}`);
      const wrong = q.options.filter((_, idx) => idx !== q.correctIndex);
      // 其他單字本身、同字重複條目的清單都不能當干擾項
      expect(wrong).not.toContain("glad");
      expect(wrong).not.toContain("gloomy");
      // 考反義時不能拿別的字的反義字（unhappy 也是 happy 的反義）
      if (q.relation === "opposite") expect(wrong).not.toContain("unhappy");
      // 考同義時不能拿別的字的同義字（pleased 也是 happy 的同義）
      if (q.relation === "same") expect(wrong).not.toContain("pleased");
    }
  });

  it("only uses the antonym when there is no synonym", () => {
    const q = questionFor("quickly", "synonym");
    if (q.kind !== "synonym") throw new Error(`unexpected ${q.kind}`);
    expect(q.relation).toBe("opposite");
    expect(q.options[q.correctIndex]).toBe("slowly");
  });

  it("falls back to reverse without synonyms or antonyms", () => {
    expect(questionFor("apple", "synonym").kind).toBe("reverse");
  });
});

describe("pos", () => {
  it("offers the four parts of speech in a fixed order", () => {
    const q = questionFor("quickly", "pos");
    if (q.kind !== "pos") throw new Error(`unexpected ${q.kind}`);
    expect(q.options).toEqual(POS_OPTIONS);
    expect(q.options[q.correctIndex]).toBe("adverb");
    expect(q.hint).toBe("快速地");
    expect(isQuestionCorrect(q, q.correctIndex)).toBe(true);
  });

  it("falls back to meaning when the part of speech is unknown", () => {
    expect(questionFor("apple", "pos").kind).toBe("meaning");
  });
});

describe("order", () => {
  it("scrambles the example's words and accepts the original order", () => {
    const q = questionFor("happy", "order");
    if (q.kind !== "order") throw new Error(`unexpected ${q.kind}`);
    expect(q.sentence).toBe("The happy puppy wagged its tail.");
    expect([...q.tokens].sort()).toEqual(
      ["The", "happy", "puppy", "wagged", "its", "tail."].sort(),
    );
    expect(q.translation).toBe("快樂的小狗搖著尾巴。");
    expect(isQuestionCorrect(q, "the happy  puppy wagged its tail.")).toBe(true);
    expect(isQuestionCorrect(q, "The puppy happy wagged its tail.")).toBe(false);
  });

  it("falls back to spell without a usable example", () => {
    expect(questionFor("apple", "order").kind).toBe("spell");
  });

  it("falls back to spell when the example is too long", () => {
    const long = Array.from({ length: ORDER_MAX_TOKENS }, () => "very").join(" ");
    const pool: GameWord[] = [
      { word: "tall", def: "高的", emoji: "🦒", example: `The ${long} tall giraffe.` },
      ...POOL,
    ];
    expect(buildQuizQuestions(pool, stage(["order"]))[0].kind).toBe("spell");
  });

  it("can order every built-in fallback word", () => {
    const pool = [...FALLBACK_GAME_WORDS];
    const qs = buildQuizQuestions(pool, stage(["order"], pool.length));
    expect(qs.filter((q) => q.kind !== "order").map((q) => q.word)).toEqual([]);
  });
});

describe("listenCloze", () => {
  it("blanks the word like a cloze and keeps the full sentence to read aloud", () => {
    const q = questionFor("quickly", "listenCloze");
    if (q.kind !== "listenCloze") throw new Error(`unexpected ${q.kind}`);
    expect(q.prompt).toBe(`She ran ${CLOZE_BLANK} to catch the bus.`);
    expect(q.sentence).toBe("She ran quickly to catch the bus.");
    expect(q.options[q.correctIndex]).toBe("quickly");
  });

  it("falls back to listen without a usable example", () => {
    expect(questionFor("apple", "listenCloze").kind).toBe("listen");
  });

  it("becomes a cloze question when speech is unavailable", () => {
    expect(
      questionFor("quickly", "listenCloze", { speechSupported: false }).kind,
    ).toBe("cloze");
  });
});

describe("wordOffset", () => {
  it("continues from a later word instead of restarting the pool", () => {
    const qs = buildQuizQuestions(POOL, stage(["meaning"], 2), {
      wordOffset: 3,
    });
    expect(qs.map((q) => q.word)).toEqual(["dog", "jump"]);
  });
});

describe("holdsAfterCorrect", () => {
  it("holds sentence questions so the player can read the sentence", () => {
    expect(holdsAfterCorrect("cloze")).toBe(true);
    expect(holdsAfterCorrect("listenCloze")).toBe(true);
    expect(holdsAfterCorrect("order")).toBe(true);
    expect(holdsAfterCorrect("dictation")).toBe(false);
    expect(holdsAfterCorrect("synonym")).toBe(false);
  });
});

describe("fallback word pool", () => {
  it("gives most fallback words a part of speech and synonym data", () => {
    const pool = [...FALLBACK_GAME_WORDS];
    // 只有常見多種詞性的字（experiment）不考詞性
    const pos = buildQuizQuestions(pool, stage(["pos"], pool.length));
    expect(pos.filter((q) => q.kind !== "pos").map((q) => q.word)).toEqual([
      "Experiment",
    ]);
    // 同反義題至少大部分字能出，資料不足的字才退回 reverse
    const syn = buildQuizQuestions(pool, stage(["synonym"], pool.length));
    expect(syn.filter((q) => q.kind === "synonym").length).toBeGreaterThanOrEqual(15);
  });
});
