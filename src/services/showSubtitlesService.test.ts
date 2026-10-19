import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { SEASONS, fetchEpisodeTranscript } from "./showSubtitlesService";

afterEach(() => vi.unstubAllGlobals());

describe("show catalog", () => {
  it("lists all 14 seasons and 90 episodes in order", () => {
    expect(SEASONS.map((s) => s.number)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(SEASONS.map((s) => s.episodes.length)).toEqual([10, 8, 7, 8, 6, 6, 6, 7, 6, 6, 6, 5, 5, 4]);
    for (const season of SEASONS) {
      expect(season.episodes.map((e) => e.number)).toEqual(
        Array.from({ length: season.episodes.length }, (_, i) => i + 1),
      );
      expect(new Set(season.episodes.map((e) => e.slug)).size).toBe(season.episodes.length);
    }
  });

  it("has a bundled asset for every selectable episode", () => {
    const available = SEASONS.flatMap((s) => s.episodes
      .filter((e) => e.transcriptAvailable !== false)
      .map((e) => resolve("public", "transcripts", `season-${s.number}`, `${e.slug}.json`)));
    expect(available).toHaveLength(72);
    for (const path of available) expect(existsSync(path), path).toBe(true);
  });

  it("does not request missing transcript assets", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    let unavailable = 0;
    for (const season of SEASONS) {
      for (const episode of season.episodes) {
        if (episode.transcriptAvailable !== false) continue;
        unavailable++;
        await expect(fetchEpisodeTranscript(season.number, episode.slug))
          .rejects.toThrow("此集字幕尚未提供");
      }
    }
    expect(unavailable).toBe(18);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still loads a bundled episode and forwards cancellation", async () => {
    const lines = [{ index: 0, text: "Test fixture" }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => lines });
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await expect(fetchEpisodeTranscript(1, "episode-1-Spaceship", controller.signal))
      .resolves.toEqual({ seasonNumber: 1, episodeNumber: 1, title: "Spaceship", lines });
    expect(fetchMock).toHaveBeenCalledWith("/transcripts/season-1/episode-1-Spaceship.json", {
      signal: controller.signal,
    });
  });
});
