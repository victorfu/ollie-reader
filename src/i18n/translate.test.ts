import { describe, expect, it } from "vitest";
import { en } from "./en";
import { zhTW } from "./zh-TW";
import { interpolate, languageForMode, translate } from "./translate";

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

  it("maps every mode to the language it displays", () => {
    expect(languageForMode("zh-TW")).toBe("zh-TW");
    expect(languageForMode("en")).toBe("en");
    expect(languageForMode("en-hint")).toBe("en");
  });
});
