import { describe, expect, it } from "vitest";
import type { GameWord } from "../../services/gameService";
import { buildMagicBattleOptions } from "./magicBattleOptions";

const word = (value: string, definition: string): GameWord => ({
  word: value,
  def: definition,
  emoji: "✨",
});

describe("buildMagicBattleOptions", () => {
  it("removes duplicate visible definitions while preserving the answer", () => {
    const target = word("cat", "貓");
    const result = buildMagicBattleOptions(
      target,
      [
        word("kitty", " 貓 "),
        word("dog", "狗"),
        word("hound", "狗"),
        word("bird", "鳥"),
        word("fish", "魚"),
      ],
      () => 0.5,
    );

    expect(result.definitions).toHaveLength(4);
    expect(new Set(result.definitions.map((value) => value.trim())).size).toBe(4);
    expect(result.definitions[result.correctDefinitionIndex]).toBe("貓");
  });

  it("does not use another sense of the target word as a distractor", () => {
    const result = buildMagicBattleOptions(
      word("bank", "銀行"),
      [
        word("BANK", "河岸"),
        word("river", "河流"),
        word("money", "金錢"),
        word("save", "儲蓄"),
      ],
      () => 0,
    );

    expect(result.definitions).not.toContain("河岸");
    expect(result.definitions[result.correctDefinitionIndex]).toBe("銀行");
  });
});
