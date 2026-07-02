import { describe, expect, it } from "vitest";
import { REGIONS } from "../wonderAcademyRegions";
import {
  POSTGAME_TRIALS,
  awardTrialWin,
  isPostgameUnlocked,
  postgameTrialById,
} from "./postgameTrials";

const regionIds = REGIONS.map((region) => region.id);

describe("Wonder Academy postgame trials", () => {
  it("locks postgame trials until every region warden is defeated", () => {
    expect(isPostgameUnlocked(regionIds, [])).toBe(false);
    expect(isPostgameUnlocked(regionIds, regionIds.slice(0, -1))).toBe(false);
    expect(isPostgameUnlocked(regionIds, regionIds)).toBe(true);
  });

  it("defines a rematch trial and the Bellheart capstone trial", () => {
    expect(POSTGAME_TRIALS.map((trial) => trial.id)).toEqual([
      "warden-rematch",
      "bellheart-trial",
    ]);
    expect(postgameTrialById("bellheart-trial")).toMatchObject({
      speciesId: "silent-bellheart",
      level: 50,
    });
    expect(postgameTrialById("missing")).toBeUndefined();
  });

  it("records trial wins and pays first-win rewards", () => {
    const result = awardTrialWin({
      trialId: "warden-rematch",
      stardust: 10,
      materials: { "glow-petal": 1 },
      trialWins: {},
    });

    expect(result.won).toBe(true);
    expect(result.trialWins).toEqual({ "warden-rematch": 1 });
    expect(result.stardust).toBe(70);
    expect(result.materials).toEqual({
      "glow-petal": 1,
      "clock-spring": 2,
      "bell-shard": 1,
    });
  });

  it("pays repeat rewards without the first-win bonus", () => {
    const result = awardTrialWin({
      trialId: "warden-rematch",
      stardust: 10,
      materials: {},
      trialWins: { "warden-rematch": 1 },
    });

    expect(result.won).toBe(true);
    expect(result.trialWins).toEqual({ "warden-rematch": 2 });
    expect(result.stardust).toBe(45);
  });
});
