import { describe, expect, it } from "vitest";
import { en } from "./en";
import { zhTW } from "./zh-TW";
import { interpolate, msg, translate } from "./translate";

describe("translate", () => {
  it("looks up the key in the requested language", () => {
    expect(translate("zh-TW", "settings.title")).toBe("設定");
    expect(translate("en", "settings.title")).toBe("Settings");
  });

  it("substitutes {name} params and leaves unknown placeholders alone", () => {
    expect(interpolate("{count} words for {name}", { count: 3, name: "Ollie" }))
      .toBe("3 words for Ollie");
    expect(interpolate("Hi {missing}", { name: "Ollie" })).toBe("Hi {missing}");
  });

  it("translates a msg() param into the same language as the sentence", () => {
    const params = { label: msg("nav.vocabulary") };
    expect(translate("en", "nav.moveToMoreLabel", params)).toBe("Move “Word Book” to More");
    expect(translate("zh-TW", "nav.moveToMoreLabel", params)).toBe("把「生詞本」移到更多");
  });

  it("falls back to the key when no dictionary has it", () => {
    const lookup = translate as (language: "en", key: string) => string;
    expect(lookup("en", "missing.key")).toBe("missing.key");
  });

  it("keeps both dictionaries on the same keys with non-empty text", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zhTW).sort());
    for (const value of [...Object.values(en), ...Object.values(zhTW)]) {
      expect(value.trim()).not.toBe("");
    }
  });
});
