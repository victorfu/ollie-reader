import { describe, expect, it } from "vitest";
import {
  bossPhaseForHp,
  initialBossState,
  nextBossState,
} from "./bossMechanics";
import type { Stage } from "../../types/game";

const stage = (over: Partial<Stage> = {}): Stage => ({
  id: "boss",
  name: "魔王",
  stageNumber: 1,
  isBoss: true,
  requiredLevel: 1,
  rewardExp: 0,
  questionCount: 1,
  bossHp: 9,
  ...over,
});

describe("bossPhaseForHp", () => {
  it("splits HP evenly across phases", () => {
    expect([9, 7, 6, 4, 3, 1, 0].map((hp) => bossPhaseForHp(hp, 9, 3))).toEqual(
      [0, 0, 1, 1, 2, 2, 2],
    );
  });

  it("stays at phase 0 for a single-phase boss", () => {
    expect(bossPhaseForHp(1, 9, 1)).toBe(0);
  });
});

describe("nextBossState", () => {
  const threePhase = initialBossState(
    stage({ bossPhases: [["meaning"], ["reverse"], ["spell"]] }),
    9,
  );

  it("starts at full HP in phase 0", () => {
    expect(threePhase).toMatchObject({
      bossHp: 9,
      bossMaxHp: 9,
      phase: 0,
      phaseCount: 3,
      shielded: false,
    });
  });

  it("deals a critical hit from a 3 combo and can skip a phase", () => {
    const hit = nextBossState({ ...threePhase, bossHp: 7 }, true, 3, false);
    expect(hit.bossHp).toBe(5);
    expect(hit.phase).toBe(1);
    expect(hit.enteredPhase).toBe(true);
    // HP 5 → 4 仍在第二階段
    expect(nextBossState(hit, true, 1, false).enteredPhase).toBe(false);
    const jump = nextBossState({ ...threePhase, bossHp: 4, phase: 1 }, true, 4, false);
    expect(jump.phase).toBe(2);
  });

  it("raises a shield only when the boss has one", () => {
    const once = nextBossState(threePhase, false, 0, true);
    expect(once.shielded).toBe(false);
    expect(nextBossState(once, false, 0, true).shielded).toBe(true);
    expect(nextBossState(once, false, 0, false).shielded).toBe(false);
  });

  it("breaks the shield without damage, then deals damage again", () => {
    const shielded = { ...threePhase, shielded: true, wrongStreak: 2 };
    const broken = nextBossState(shielded, true, 1, true);
    expect(broken).toMatchObject({
      bossHp: 9,
      shielded: false,
      wrongStreak: 0,
      lastHit: "shield",
    });
    expect(nextBossState(broken, true, 2, true).bossHp).toBe(8);
  });

  it("keeps the shield up while the player keeps missing", () => {
    const shielded = { ...threePhase, shielded: true, wrongStreak: 2 };
    expect(nextBossState(shielded, false, 0, true).shielded).toBe(true);
  });
});
