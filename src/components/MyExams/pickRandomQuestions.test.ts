import { describe, expect, it } from "vitest";
import { makeQuestion } from "../../testing/questionBankFixtures";
import { seededRng } from "../../testing/seededRng";
import { pickRandomQuestions } from "./pickRandomQuestions";

const pool = Array.from({ length: 10 }, (_, index) => makeQuestion({ id: `q${index}` }));
const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

describe("pickRandomQuestions", () => {
  it("picks the requested number of distinct questions from the pool", () => {
    const picked = pickRandomQuestions(pool, 4, seededRng(1));
    expect(picked).toHaveLength(4);
    expect(new Set(ids(picked)).size).toBe(4);
    expect(ids(picked).every((id) => ids(pool).includes(id))).toBe(true);
  });

  it("never picks excluded questions", () => {
    const excluded = new Set(["q0", "q1", "q2", "q3", "q4", "q5", "q6", "q7"]);
    expect(ids(pickRandomQuestions(pool, 5, seededRng(2), excluded)).sort()).toEqual(["q8", "q9"]);
  });

  it("returns everything available when asked for more", () => {
    expect(pickRandomQuestions(pool, 50, seededRng(3))).toHaveLength(10);
  });

  it("returns nothing for a zero or negative count", () => {
    expect(pickRandomQuestions(pool, 0, seededRng(4))).toEqual([]);
    expect(pickRandomQuestions(pool, -3, seededRng(4))).toEqual([]);
  });

  it("is reproducible for the same seed and does not mutate the pool", () => {
    const snapshot = ids(pool);
    expect(ids(pickRandomQuestions(pool, 5, seededRng(7)))).toEqual(ids(pickRandomQuestions(pool, 5, seededRng(7))));
    expect(ids(pool)).toEqual(snapshot);
  });
});
