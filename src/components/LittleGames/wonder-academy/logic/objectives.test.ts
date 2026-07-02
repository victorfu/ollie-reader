import { describe, expect, it } from "vitest";
import { nextWonderAcademyObjective } from "./objectives";

const base = {
  teamCount: 1,
  clearedNodes: ["sparkleaf:entry"],
  wardensDefeated: [],
  regionIds: ["sparkleaf", "tideglass", "clocktower", "sugarcloud"],
  dexCaught: 1,
  dexTotal: 8,
  charmCount: 0,
  trialWins: {},
};

describe("Wonder Academy objectives", () => {
  it("starts by asking the player to choose a starter", () => {
    expect(nextWonderAcademyObjective({ ...base, teamCount: 0 }).id).toBe("choose-starter");
  });

  it("points a new keeper at the first exploration node", () => {
    expect(nextWonderAcademyObjective({ ...base, clearedNodes: [] }).id).toBe("explore-first-node");
  });

  it("asks for the current region warden after a node is cleared", () => {
    expect(nextWonderAcademyObjective(base)).toMatchObject({
      id: "defeat-warden-sparkleaf",
      actionLabel: "挑戰守關之地",
    });
  });

  it("moves to the next region after the previous warden is cleared", () => {
    expect(nextWonderAcademyObjective({
      ...base,
      wardensDefeated: ["sparkleaf"],
    })).toMatchObject({
      id: "explore-region-tideglass",
      actionLabel: "前往下一區",
    });
  });

  it("introduces charm crafting after the region chain is complete", () => {
    expect(nextWonderAcademyObjective({
      ...base,
      wardensDefeated: base.regionIds,
      dexCaught: 3,
    }).id).toBe("craft-first-charm");
  });

  it("points completionists to the Wonderdex before postgame", () => {
    expect(nextWonderAcademyObjective({
      ...base,
      wardensDefeated: base.regionIds,
      charmCount: 1,
      dexCaught: 5,
      dexTotal: 8,
    }).id).toBe("fill-wonderdex");
  });

  it("opens postgame trials when regions, charm crafting, and dex are ready", () => {
    expect(nextWonderAcademyObjective({
      ...base,
      wardensDefeated: base.regionIds,
      charmCount: 1,
      dexCaught: 8,
      dexTotal: 8,
    })).toMatchObject({
      id: "postgame-trial",
      actionLabel: "進入試煉",
    });
  });
});
