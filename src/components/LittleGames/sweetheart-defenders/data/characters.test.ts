import { describe, expect, it } from "vitest";
import { CHARACTERS, DEFAULT_ROSTER_IDS, getCharacter } from "./characters";
import { GACHA_CHARACTER_IDS } from "../../gacha-machine/gachaTypes";
import { ELEMENTS, RARITIES } from "../types";
import { getTowerStats, getTrait } from "../engine/combat";
import { getPlaceCost } from "../engine/economy";
import { LEVELS } from "./levels";

describe("the tower roster mirrors the gacha machine", () => {
  it("covers every gacha character exactly once", () => {
    expect(CHARACTERS).toHaveLength(GACHA_CHARACTER_IDS.length);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(CHARACTERS.length);
  });

  it("uses the gacha ids, so a pull maps straight to a tower", () => {
    const gachaIds = new Set<string>(GACHA_CHARACTER_IDS);

    for (const character of CHARACTERS) {
      expect(gachaIds.has(character.id), `${character.id} 不在扭蛋角色表裡`).toBe(
        true,
      );
    }
  });

  it("gives every character a name, art and valid stats", () => {
    for (const character of CHARACTERS) {
      expect(character.nameZh.length, character.id).toBeGreaterThan(0);
      expect(character.name.length, character.id).toBeGreaterThan(0);
      expect(character.sprite.length, character.id).toBeGreaterThan(0);
      expect(RARITIES, character.id).toContain(character.rarity);
      expect(character.elements.length, character.id).toBeGreaterThan(0);
      for (const element of character.elements) {
        expect(ELEMENTS, character.id).toContain(element);
      }
    }
  });

  it("never repeats an element within one character", () => {
    for (const character of CHARACTERS) {
      expect(
        new Set(character.elements).size,
        `${character.id} 的兩個元素一樣`,
      ).toBe(character.elements.length);
    }
  });
});

describe("the roster is varied enough to matter", () => {
  it("uses all eight archetypes", () => {
    const archetypes = new Set(
      CHARACTERS.map((c) => getTowerStats(c, 1).archetype),
    );

    expect(archetypes.size).toBe(8);
  });

  it("uses all nine traits", () => {
    const traits = new Set(CHARACTERS.map((c) => getTrait(c)));

    expect(traits.size).toBe(9);
  });

  it("spreads characters across archetypes instead of piling up on one", () => {
    const counts = new Map<string, number>();
    for (const character of CHARACTERS) {
      const archetype = getTowerStats(character, 1).archetype;
      counts.set(archetype, (counts.get(archetype) ?? 0) + 1);
    }

    // 57 個角色分 8 種打法，平均約 7；任何一種都不該少於 3 或多到佔掉四分之一。
    for (const [archetype, count] of counts) {
      expect(count, `${archetype} 只有 ${count} 個`).toBeGreaterThanOrEqual(3);
      expect(count, `${archetype} 有 ${count} 個，太多了`).toBeLessThan(
        CHARACTERS.length / 4,
      );
    }
  });

  it("offers plenty of distinct archetype × trait combinations", () => {
    const combos = new Set(
      CHARACTERS.map((c) => `${getTowerStats(c, 1).archetype}/${getTrait(c)}`),
    );

    // 這是「每隻手感都不一樣」的實際保障；重複太多就代表元素配得太隨便。
    expect(combos.size).toBeGreaterThanOrEqual(40);
  });
});

describe("the default roster", () => {
  it("only lists characters that exist", () => {
    for (const id of DEFAULT_ROSTER_IDS) {
      expect(getCharacter(id), `${id} 不存在`).toBeDefined();
    }
  });

  it("covers six different archetypes", () => {
    const archetypes = new Set(
      DEFAULT_ROSTER_IDS.map((id) => getTowerStats(getCharacter(id)!, 1).archetype),
    );

    expect(archetypes.size).toBe(DEFAULT_ROSTER_IDS.length);
    expect(archetypes.size).toBe(6);
  });

  it("stays affordable, so the first level is playable without any pulls", () => {
    // 全部都是最便宜的一級，開場的錢才鋪得滿入口。抽扭蛋是為了更好的選擇，
    // 不是為了「有得玩」。
    const cheapest = Math.min(
      ...CHARACTERS.map((character) => getPlaceCost(character)),
    );

    for (const id of DEFAULT_ROSTER_IDS) {
      expect(getPlaceCost(getCharacter(id)!), id).toBe(cheapest);
    }
  });

  it("lets the player fill at least two slots per entrance on level one", () => {
    const first = LEVELS[0];
    const cheapest = Math.min(
      ...DEFAULT_ROSTER_IDS.map((id) => getPlaceCost(getCharacter(id)!)),
    );

    expect(first.startingFrosting).toBeGreaterThanOrEqual(
      cheapest * 2 * first.paths.length,
    );
  });
});
