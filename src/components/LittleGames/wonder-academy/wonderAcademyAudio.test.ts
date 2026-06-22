import { describe, expect, it } from "vitest";
import {
  defaultWonderAcademyAudioSettings,
  wonderAcademyLoopUrls,
  wonderAcademySfxUrls,
  createWonderAcademyAudio,
  normalizeAudioSettings,
  type WonderAcademyLoopId,
  type WonderAcademySfxId,
} from "./wonderAcademyAudio";

const requiredSfxIds = [
  "ui_select",
  "ui_confirm",
  "ui_back",
  "ui_locked",
  "node_unlock",
  "save_success",
  "save_pending",
  "attune_ready",
  "attune_success",
  "attune_fail_soft",
  "wonderdex_update",
  "snack_use",
  "bond_skill_ready",
] satisfies WonderAcademySfxId[];

const requiredLoopIds = [
  "hub_loop",
  "region_map_loop",
  "mood_trial_loop",
  "warden_trial_loop",
] satisfies WonderAcademyLoopId[];

describe("Wonder Academy audio settings", () => {
  it("defaults missing settings conservatively", () => {
    expect(normalizeAudioSettings()).toEqual(defaultWonderAcademyAudioSettings);
    expect(normalizeAudioSettings({})).toEqual(defaultWonderAcademyAudioSettings);
  });

  it("clamps volumes to the supported range", () => {
    expect(
      normalizeAudioSettings({
        musicVolume: 1.5,
        sfxVolume: -0.25,
        muted: false,
      }),
    ).toEqual({
      musicVolume: 1,
      sfxVolume: 0,
      muted: false,
    });
  });

  it("preserves explicit mute values while defaulting invalid fields", () => {
    expect(
      normalizeAudioSettings({
        musicVolume: Number.NaN,
        sfxVolume: Number.POSITIVE_INFINITY,
        muted: true,
      }),
    ).toEqual({
      musicVolume: 0.45,
      sfxVolume: 0.65,
      muted: true,
    });
  });
});

describe("Wonder Academy audio manifest", () => {
  it("includes every required sound effect asset URL", () => {
    expect(Object.keys(wonderAcademySfxUrls).sort()).toEqual([...requiredSfxIds].sort());

    for (const id of requiredSfxIds) {
      expect(wonderAcademySfxUrls[id]).toContain(`${id}.wav`);
    }
  });

  it("includes every required music loop asset URL", () => {
    expect(Object.keys(wonderAcademyLoopUrls).sort()).toEqual([...requiredLoopIds].sort());

    for (const id of requiredLoopIds) {
      expect(wonderAcademyLoopUrls[id]).toContain(`${id}.wav`);
    }
  });
});

describe("Wonder Academy audio manager", () => {
  it("does not create or play audio on construction", () => {
    const createdSources: string[] = [];

    const audio = createWonderAcademyAudio({
      audioFactory: (src) => {
        createdSources.push(src);

        return null;
      },
    });

    expect(createdSources).toEqual([]);
    expect(audio.getSettings()).toEqual(defaultWonderAcademyAudioSettings);
  });

  it("plays requested sound effects through an injected audio factory", () => {
    const playedSources: string[] = [];

    const audio = createWonderAcademyAudio({
      initialSettings: {
        musicVolume: 0.2,
        sfxVolume: 0.4,
        muted: false,
      },
      audioFactory: (src) => ({
        currentTime: 12,
        loop: true,
        muted: true,
        pause: () => undefined,
        play: () => {
          playedSources.push(src);

          return Promise.resolve();
        },
        preload: "none",
        src,
        volume: 0,
      }),
    });

    audio.playSfx("ui_confirm");

    expect(playedSources).toEqual([wonderAcademySfxUrls.ui_confirm]);
  });

  it("merges partial setting updates with the current manager settings", () => {
    const createdAudio: Array<{
      currentTime: number;
      loop: boolean;
      muted: boolean;
      pause: () => void;
      play: () => Promise<void>;
      preload: string;
      src: string;
      volume: number;
    }> = [];

    const audio = createWonderAcademyAudio({
      initialSettings: {
        musicVolume: 0.2,
        sfxVolume: 0.3,
        muted: false,
      },
      audioFactory: (src) => {
        const element = {
          currentTime: 0,
          loop: false,
          muted: false,
          pause: () => undefined,
          play: () => Promise.resolve(),
          preload: "none" as const,
          src,
          volume: 0,
        };

        createdAudio.push(element);

        return element;
      },
    });

    audio.playSfx("ui_select");
    audio.startLoop("hub_loop");

    expect(audio.setSettings({ muted: true })).toEqual({
      musicVolume: 0.2,
      sfxVolume: 0.3,
      muted: true,
    });
    expect(audio.getSettings()).toEqual({
      musicVolume: 0.2,
      sfxVolume: 0.3,
      muted: true,
    });
    expect(createdAudio).toHaveLength(2);
    expect(createdAudio).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          muted: true,
          src: wonderAcademySfxUrls.ui_select,
          volume: 0,
        }),
        expect.objectContaining({
          muted: true,
          src: wonderAcademyLoopUrls.hub_loop,
          volume: 0,
        }),
      ]),
    );
  });
});
