import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AUDIO_SETTINGS, normalizeSettings } from "./audio";

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/**
 * 音量設定是從 localStorage 讀進來的，等於使用者可以隨手改壞。
 * 壞掉的值一定要退回預設，不然音量可能變成 NaN，整個遊戲就沒聲音了。
 */
describe("normalizeSettings", () => {
  it("falls back to the defaults for junk", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(normalizeSettings("loud")).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it("keeps volumes that are already in range", () => {
    expect(normalizeSettings({ music: 0.25, sfx: 0.9, muted: false })).toEqual({
      music: 0.25,
      sfx: 0.9,
      muted: false,
    });
  });

  it("clamps volumes outside 0–1", () => {
    const settings = normalizeSettings({ music: 4, sfx: -2 });

    expect(settings.music).toBe(1);
    expect(settings.sfx).toBe(0);
  });

  it("replaces NaN and Infinity rather than passing them to the audio element", () => {
    const settings = normalizeSettings({
      music: Number.NaN,
      sfx: Number.POSITIVE_INFINITY,
    });

    // 這兩個不是「太大聲」，是壞掉的值，所以回預設而不是夾到 1。
    expect(settings.music).toBe(DEFAULT_AUDIO_SETTINGS.music);
    expect(settings.sfx).toBe(DEFAULT_AUDIO_SETTINGS.sfx);
  });

  it("does clamp a real number that is merely out of range", () => {
    expect(normalizeSettings({ music: 4 }).music).toBe(1);
    expect(normalizeSettings({ music: -1 }).music).toBe(0);
  });

  it("starts muted so the game never blurts out music on its own", () => {
    expect(DEFAULT_AUDIO_SETTINGS.muted).toBe(true);
    expect(normalizeSettings({}).muted).toBe(true);
    expect(normalizeSettings({ muted: "yes" }).muted).toBe(true);
  });

  it("remembers that the player turned sound on", () => {
    // 這條最重要：明確存成 false 代表玩家自己開過聲音，不能被預設值蓋回去。
    expect(normalizeSettings({ muted: false }).muted).toBe(false);
  });

  it("keeps the volumes usable so unmuting is a single tap", () => {
    // 預設靜音但音量是 0 的話，打開聲音還是沒聲音——那就等於壞掉。
    expect(DEFAULT_AUDIO_SETTINGS.music).toBeGreaterThan(0);
    expect(DEFAULT_AUDIO_SETTINGS.sfx).toBeGreaterThan(0);
  });
});

describe("music lifecycle", () => {
  it("resumes the same Vite asset after unmuting without reloading it", async () => {
    vi.useFakeTimers();
    vi.resetModules();

    class FakeAudio {
      static latest: FakeAudio | null = null;

      loop = false;
      volume = 0;
      paused = true;
      currentTime = 0;
      srcAssignments = 0;
      private source = "";

      constructor() {
        FakeAudio.latest = this;
      }

      get src() {
        return this.source ? new URL(this.source, document.baseURI).href : "";
      }

      set src(value: string) {
        this.source = value;
        this.srcAssignments += 1;
        // 瀏覽器重設 src 會把播放位置洗回開頭；這正是這條回歸測試要抓的事。
        this.currentTime = 0;
      }

      play = vi.fn(async () => {
        this.paused = false;
      });

      pause = vi.fn(() => {
        this.paused = true;
      });
    }

    vi.stubGlobal("Audio", FakeAudio);
    const audio = await import("./audio");
    const audible = { music: 0.4, sfx: 0.7, muted: false };

    audio.applyAudioSettings(audible);
    audio.playMusic("menu");
    await Promise.resolve();

    const element = FakeAudio.latest;
    expect(element).not.toBeNull();
    element!.currentTime = 23;

    audio.applyAudioSettings({ ...audible, muted: true });
    audio.applyAudioSettings(audible);
    await Promise.resolve();

    expect(element!.src).toMatch(/^http/);
    expect(element!.srcAssignments).toBe(1);
    expect(element!.currentTime).toBe(23);
    expect(element!.play).toHaveBeenCalledTimes(2);
  });
});
