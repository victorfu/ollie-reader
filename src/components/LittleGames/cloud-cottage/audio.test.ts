import { beforeEach, describe, expect, it } from "vitest";
import {
  AUDIO_SETTINGS_KEY,
  DEFAULT_AUDIO_SETTINGS,
  applyAudioSettings,
  normalizeAudioSettings,
  playSfx,
  readAudioSettings,
} from "./audio";

describe("Cloud Cottage audio settings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    applyAudioSettings(DEFAULT_AUDIO_SETTINGS);
    window.localStorage.clear();
  });

  it("starts muted while keeping speech as an independent preference", () => {
    expect(DEFAULT_AUDIO_SETTINGS).toMatchObject({
      muted: true,
      speechEnabled: true,
    });
    expect(DEFAULT_AUDIO_SETTINGS.sfx).toBeGreaterThan(0);
  });

  it("normalizes persisted values independently", () => {
    expect(
      normalizeAudioSettings({
        sfx: 0.25,
        muted: false,
        speechEnabled: false,
      }),
    ).toEqual({ sfx: 0.25, muted: false, speechEnabled: false });

    expect(
      normalizeAudioSettings({
        sfx: 4,
        muted: "yes",
        speechEnabled: "no",
      }),
    ).toEqual({
      sfx: 1,
      muted: DEFAULT_AUDIO_SETTINGS.muted,
      speechEnabled: DEFAULT_AUDIO_SETTINGS.speechEnabled,
    });
  });

  it("falls back for malformed or non-finite volume values", () => {
    expect(normalizeAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(normalizeAudioSettings({ sfx: Number.NaN }).sfx).toBe(
      DEFAULT_AUDIO_SETTINGS.sfx,
    );
    expect(
      normalizeAudioSettings({ sfx: Number.POSITIVE_INFINITY }).sfx,
    ).toBe(DEFAULT_AUDIO_SETTINGS.sfx);
  });

  it("round-trips settings through localStorage", () => {
    const expected = {
      sfx: 0.4,
      muted: false,
      speechEnabled: false,
    };

    applyAudioSettings(expected);

    expect(JSON.parse(window.localStorage.getItem(AUDIO_SETTINGS_KEY) ?? "")).toEqual(
      expected,
    );
    expect(readAudioSettings()).toEqual(expected);
  });

  it("ignores malformed localStorage and unavailable WebAudio", () => {
    window.localStorage.setItem(AUDIO_SETTINGS_KEY, "not-json");
    expect(readAudioSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);

    applyAudioSettings({
      ...DEFAULT_AUDIO_SETTINGS,
      muted: false,
    });
    expect(() => playSfx("heart")).not.toThrow();
  });
});
