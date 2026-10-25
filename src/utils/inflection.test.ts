import { describe, expect, it } from "vitest";
import type { CefrTable } from "./cefr";
import { inflectionOf, inflectionRule } from "./inflection";

const TABLE: CefrTable = new Map(
  [
    "run", "running", "go", "do", "did", "be", "is", "eat", "see", "saw", "leave", "left", "leaf",
    "play", "child", "city", "box", "stop", "like", "study", "make", "die", "new", "news", "think",
    "thought", "swimming", "swim", "panic", "tie",
  ].map((word) => [word, "A1"] as const),
);

describe("inflectionOf", () => {
  it.each([
    ["ran", ["verb"], { base: "run", form: "ran", kind: "past" }],
    ["went", ["verb"], { base: "go", form: "went", kind: "past" }],
    ["eaten", ["verb"], { base: "eat", form: "eaten", kind: "pastParticiple" }],
    ["thought", ["verb"], { base: "think", form: "thought", kind: "pastAndParticiple" }],
    ["did", ["verb"], { base: "do", form: "did", kind: "past" }],
    ["is", ["verb"], { base: "be", form: "is", kind: "present" }],
    ["running", ["verb"], { base: "run", form: "running", kind: "ing" }],
    ["stopped", ["verb"], { base: "stop", form: "stopped", kind: "pastAndParticiple" }],
    ["plays", ["verb", "noun"], { base: "play", form: "plays", kind: "thirdPerson" }],
    ["leaves", ["verb"], { base: "leave", form: "leaves", kind: "thirdPerson" }],
    ["leaves", ["noun"], { base: "leaf", form: "leaves", kind: "plural" }],
    ["children", ["noun"], { base: "child", form: "children", kind: "plural" }],
    ["cities", ["noun"], { base: "city", form: "cities", kind: "plural" }],
    ["Ran.", [], { base: "run", form: "ran", kind: "past" }],
  ])("reads %s %j as a form of its base", (word, pos, expected) => {
    expect(inflectionOf(TABLE, word, pos)).toEqual(expected);
  });

  it.each([
    ["run", ["verb"]],
    ["saw", ["noun"]],
    ["left", ["adverb"]],
    ["thought", ["noun"]],
    ["swimming", ["noun"]],
    ["news", ["noun"]],
    ["saw", []],
    ["look forward to", ["phrase"]],
    ["xylophones", ["noun"]],
  ])("leaves %s %j as it is", (word, pos) => {
    expect(inflectionOf(TABLE, word, pos)).toBeNull();
  });
});

describe("inflectionRule", () => {
  it.each([
    ["run", "ran", "不規則"],
    ["play", "plays", "直接加 -s"],
    ["box", "boxes", "要加 -es"],
    ["city", "cities", "y 改成 i，再加 -es"],
    ["study", "studied", "y 改成 i，再加 -ed"],
    ["stop", "stopped", "重複字尾的子音字母 p，再加 -ed"],
    ["stop", "stopping", "重複字尾的子音字母 p，再加 -ing"],
    ["like", "liked", "只要加 -d"],
    ["make", "making", "去掉字尾的 e"],
    ["die", "dying", "ie 改成 y"],
    ["panic", "panicked", "加 k"],
    ["tie", "ties", "直接加 -s"],
  ])("explains %s → %s", (base, form, expected) => {
    expect(inflectionRule(base, form)).toContain(expected);
  });
});
