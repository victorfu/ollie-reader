import { describe, expect, it } from "vitest";
import {
  baseCandidatesOf,
  CLOZE_BLANK,
  findWordForm,
  formsOf,
  IRREGULAR_FORMS,
  makeCloze,
  redactWordForms,
  sentenceUsesWord,
} from "./wordForms";

describe("formsOf", () => {
  it.each([
    ["run", ["running", "runs", "ran", "run"]],
    ["study", ["studies", "studied", "studying"]],
    ["make", ["making", "made", "makes"]],
    ["stop", ["stopped", "stopping"]],
    ["box", ["boxes"]],
    ["child", ["children"]],
    ["go", ["went", "gone", "goes", "going"]],
  ])("%s includes %j", (word, expected) => {
    expect(formsOf(word)).toEqual(expect.arrayContaining(expected));
  });
  it("inflects only the first word of a phrase", () => {
    expect(formsOf("look forward to")).toEqual(expect.arrayContaining(["looked forward to", "looking forward to"]));
  });
});

describe("baseCandidatesOf", () => {
  it.each([
    ["ran", "run"], ["running", "run"], ["making", "make"], ["stopped", "stop"],
    ["studies", "study"], ["boxes", "box"], ["children", "child"], ["liked", "like"],
  ])("%s → %s", (word, base) => expect(baseCandidatesOf(word)).toContain(base));
  it("never strips a base shorter than three letters", () => {
    expect(baseCandidatesOf("red")).not.toContain("r");
    expect(baseCandidatesOf("bring")).not.toContain("br");
  });
});

describe("sentence matching", () => {
  it("finds inflected and irregular forms, preserving case", () => {
    expect(findWordForm("She Ran home.", "run")).toBe("Ran");
    expect(findWordForm("The runner waited.", "run")).toBeNull();
  });
  it("handles apostrophes, curly quotes, hyphens and phrases", () => {
    expect(findWordForm("I don’t know.", "don't")).toBe("don’t");
    expect(findWordForm("A well-known song.", "well-known")).toBe("well-known");
    expect(findWordForm("We are looking  forward to it.", "look forward to")).toBe("looking  forward to");
    expect(findWordForm("I know it.", "now")).toBeNull();
  });
  it("blanks every form and answers with the first occurrence", () => {
    expect(makeCloze("Run fast! He runs every day.", "run")).toEqual({
      text: `${CLOZE_BLANK} fast! He ${CLOZE_BLANK} every day.`, answer: "Run",
    });
    expect(makeCloze("No match here.", "run")).toBeNull();
  });
  it("redacts the headword inside a definition", () => {
    expect(redactWordForms("to keep running", "run", "____")).toBe("to keep ____");
  });
  it("checks that a sentence uses the word", () => {
    expect(sentenceUsesWord("My children are happy.", "child")).toBe(true);
    expect(sentenceUsesWord("I like apples.", "child")).toBe(false);
  });
});

describe("formsOf ordering and spelling rules", () => {
  it("returns lowercase, unique forms with the longest first", () => {
    const forms = formsOf("Run");
    expect(forms).toEqual([...new Set(forms)]);
    expect(forms.every((form) => form === form.toLowerCase())).toBe(true);
    expect(forms.map((form) => form.length)).toEqual([...forms.map((form) => form.length)].sort((a, b) => b - a));
    expect(forms[0]).toBe("running");
  });
  it("applies the e-drop, ie-to-ying and vowel-y rules", () => {
    expect(formsOf("hope")).toEqual(expect.arrayContaining(["hoped", "hoping", "hopes"]));
    expect(formsOf("lie")).toEqual(expect.arrayContaining(["lied", "lying", "lies"]));
    expect(formsOf("play")).toEqual(expect.arrayContaining(["played", "playing", "plays"]));
    expect(formsOf("see")).toEqual(expect.arrayContaining(["seeing", "sees", "saw", "seen"]));
    expect(formsOf("watch")).toEqual(expect.arrayContaining(["watches", "watched", "watching"]));
  });
  it("keeps both spellings for longer words that may double", () => {
    expect(formsOf("begin")).toEqual(expect.arrayContaining(["beginning", "began", "begun"]));
    expect(formsOf("visit")).toEqual(expect.arrayContaining(["visited", "visiting"]));
  });
  it("never produces forms that are other common words", () => {
    expect(formsOf("hop")).not.toContain("hoped");
    expect(formsOf("see")).not.toContain("seed");
    expect(formsOf("fee")).not.toContain("feed");
    expect(formsOf("be")).not.toContain("bed");
    expect(formsOf("be")).toEqual(expect.arrayContaining(["is", "are", "was", "were", "been", "being"]));
  });
  it("handles blank input, clitics and punctuation without throwing", () => {
    expect(formsOf("")).toEqual([]);
    expect(formsOf("   ")).toEqual([]);
    expect(formsOf("'s")).toEqual(["'s"]);
    expect(formsOf("a.m.")).toEqual(["a.m."]);
    expect(formsOf("constructor")).toEqual(expect.arrayContaining(["constructor", "constructors"]));
  });
});

describe("baseCandidatesOf details", () => {
  it("excludes the word itself and handles irregular forms of short bases", () => {
    expect(baseCandidatesOf("run")).not.toContain("run");
    expect(baseCandidatesOf("went")).toContain("go");
    expect(baseCandidatesOf("was")).toContain("be");
    expect(baseCandidatesOf("men")).toEqual(["man"]);
  });
  it("orders the irregular lookup first and prefers the likelier base", () => {
    expect(baseCandidatesOf("left")[0]).toBe("leave");
    expect(baseCandidatesOf("hoping")[0]).toBe("hope");
    expect(baseCandidatesOf("hopping")[0]).toBe("hop");
    expect(baseCandidatesOf("tapes").indexOf("tape")).toBeGreaterThanOrEqual(0);
    expect(baseCandidatesOf("tapes")).not.toContain("tap");
  });
  it("does not turn doubled s into another word", () => {
    expect(baseCandidatesOf("hissed")).not.toContain("his");
    expect(baseCandidatesOf("hissed")).toContain("hiss");
    expect(baseCandidatesOf("glass")).not.toContain("glas");
    expect(baseCandidatesOf("assessing")).not.toContain("asses");
    expect(baseCandidatesOf("called")).toContain("call");
    expect(baseCandidatesOf("controlled")).toContain("control");
  });
  it("keeps the rest of a phrase", () => {
    expect(baseCandidatesOf("looking forward to")).toContain("look forward to");
    expect(baseCandidatesOf("went home")).toContain("go home");
  });
  it("returns nothing for blank input, clitics and punctuation, without throwing", () => {
    expect(baseCandidatesOf("")).toEqual([]);
    expect(baseCandidatesOf("'s")).toEqual([]);
    expect(baseCandidatesOf("'re")).toEqual([]);
    expect(baseCandidatesOf("'m")).toEqual([]);
    expect(baseCandidatesOf("a.m.")).toEqual([]);
    expect(baseCandidatesOf("don't")).toEqual([]);
  });
});

describe("irregular table", () => {
  it("covers the required verbs and nouns", () => {
    const required = [
      "be", "go", "run", "eat", "see", "take", "make", "come", "get", "give", "write", "swim", "sing", "begin",
      "break", "buy", "bring", "think", "teach", "catch", "fly", "drive", "ride", "speak", "tell", "know", "grow",
      "draw", "fall", "feel", "find", "hold", "keep", "leave", "lose", "meet", "pay", "read", "say", "sell", "send",
      "sit", "sleep", "stand", "win", "wear", "child", "man", "woman", "mouse", "tooth", "foot", "person", "fish",
      "sheep",
    ];
    for (const base of required) expect(IRREGULAR_FORMS).toHaveProperty(base);
  });
  it("round-trips every entry through formsOf and baseCandidatesOf", () => {
    for (const [base, forms] of Object.entries(IRREGULAR_FORMS)) {
      expect(formsOf(base), base).toEqual(expect.arrayContaining([base, ...forms]));
      for (const form of forms.filter((candidate) => candidate !== base)) {
        expect(baseCandidatesOf(form), form).toContain(base);
      }
    }
  });
});

describe("matching edge cases", () => {
  it("uses whole-word boundaries", () => {
    expect(findWordForm("This is a runner.", "run")).toBeNull();
    expect(findWordForm("a well-known song", "known")).toBeNull();
    expect(findWordForm("He likes the dog's bone.", "dog")).toBeNull();
    expect(findWordForm("The children ran.", "child")).toBe("children");
    expect(findWordForm("Nothing here", "thing")).toBeNull();
  });
  it("matches either apostrophe on either side", () => {
    expect(findWordForm("I don't know.", "don’t")).toBe("don't");
    expect(findWordForm("I don’t know.", "don't")).toBe("don’t");
  });
  it("matches at the start and end of text and next to punctuation", () => {
    expect(findWordForm("Runs", "run")).toBe("Runs");
    expect(findWordForm("(running)", "run")).toBe("running");
    expect(findWordForm('She said "Run!"', "run")).toBe("Run");
  });
  it("escapes regex special characters in words", () => {
    expect(findWordForm("It starts at 9 a.m. today.", "a.m.")).toBe("a.m.");
    expect(findWordForm("It starts at 9 apm today.", "a.m.")).toBeNull();
    expect(findWordForm("I like c++ a lot.", "c++")).toBe("c++");
    expect(findWordForm("Use (parentheses) [here] {now}.", "(parentheses)")).toBe("(parentheses)");
    expect(redactWordForms("It starts at 9 a.m. today.", "a.m.", "__")).toBe("It starts at 9 __ today.");
  });
  it("does not throw or match for blank words and clitic keys", () => {
    expect(findWordForm("anything", "")).toBeNull();
    expect(findWordForm("anything", "   ")).toBeNull();
    expect(makeCloze("anything", "")).toBeNull();
    expect(sentenceUsesWord("anything", "")).toBe(false);
    expect(redactWordForms("anything", "", "__")).toBe("anything");
    for (const clitic of ["'m", "'re", "'s", "'ve", "'ll", "'d"]) {
      expect(() => formsOf(clitic)).not.toThrow();
      expect(() => baseCandidatesOf(clitic)).not.toThrow();
      expect(() => findWordForm("I'm sure they're here.", clitic)).not.toThrow();
    }
  });
  it("is case-insensitive in the word and the text, and returns the text as written", () => {
    expect(findWordForm("She RAN home.", "Run")).toBe("RAN");
    expect(makeCloze("Children play.", "CHILD")).toEqual({ text: `${CLOZE_BLANK} play.`, answer: "Children" });
  });
  it("treats a dollar sign in the blank literally", () => {
    expect(redactWordForms("to keep running", "run", "$&")).toBe("to keep $&");
  });
  it("redacts every form of a phrase", () => {
    expect(redactWordForms("We look forward to it and he looked forward to it.", "look forward to", "__")).toBe(
      "We __ it and he __ it.",
    );
  });
  it("does not leak state between calls", () => {
    for (let index = 0; index < 3; index += 1) {
      expect(findWordForm("She ran and runs.", "run")).toBe("ran");
    }
  });
});
