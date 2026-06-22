import { describe, expect, it } from "vitest";
import { createInitialWonderAcademyProgress } from "../../../services/wonderAcademyProgressService";
import {
  canFlushPendingAudioProgress,
  createWonderAcademySaveTimestampIssuer,
} from "./wonderAcademyPersistence";

describe("Wonder Academy persistence helpers", () => {
  it("issues strictly increasing timestamps when the system clock repeats", () => {
    const issueTimestamp = createWonderAcademySaveTimestampIssuer(
      () => Date.parse("2026-06-22T03:00:00.000Z"),
    );

    const first = issueTimestamp.issue();
    const second = issueTimestamp.issue();
    const third = issueTimestamp.issue();

    expect(Date.parse(second)).toBeGreaterThan(Date.parse(first));
    expect(Date.parse(third)).toBeGreaterThan(Date.parse(second));
    expect([first, second, third]).toEqual([
      "2026-06-22T03:00:00.000Z",
      "2026-06-22T03:00:00.001Z",
      "2026-06-22T03:00:00.002Z",
    ]);
  });

  it("does not move backwards when the system clock goes backwards", () => {
    const nowValues = [
      Date.parse("2026-06-22T03:00:01.000Z"),
      Date.parse("2026-06-22T03:00:00.500Z"),
    ];
    const issueTimestamp = createWonderAcademySaveTimestampIssuer(
      () => nowValues.shift() ?? Date.parse("2026-06-22T03:00:00.000Z"),
    );

    const first = issueTimestamp.issue();
    const second = issueTimestamp.issue();

    expect(Date.parse(second)).toBeGreaterThan(Date.parse(first));
    expect(second).toBe("2026-06-22T03:00:01.001Z");
  });

  it("issues after a saved progress timestamp that is ahead of the local clock", () => {
    const issueTimestamp = createWonderAcademySaveTimestampIssuer(
      () => Date.parse("2026-06-22T03:00:00.000Z"),
    );

    const issued = issueTimestamp.issueAfter("2026-06-22T03:05:00.000Z");

    expect(issued).toBe("2026-06-22T03:05:00.001Z");
  });

  it("keeps audio preview and immediate new game timestamps ordered in one millisecond", () => {
    const issueTimestamp = createWonderAcademySaveTimestampIssuer(
      () => Date.parse("2026-06-22T03:00:00.000Z"),
    );

    const audioPreviewTimestamp = issueTimestamp.issueAfter(
      "2026-06-22T03:00:00.000Z",
    );
    const newGameTimestamp = issueTimestamp.issueAfter(
      "2026-06-22T03:00:00.000Z",
    );

    expect(Date.parse(newGameTimestamp)).toBeGreaterThan(
      Date.parse(audioPreviewTimestamp),
    );
    expect([audioPreviewTimestamp, newGameTimestamp]).toEqual([
      "2026-06-22T03:00:00.001Z",
      "2026-06-22T03:00:00.002Z",
    ]);
  });

  it("ignores invalid saved progress timestamp floors", () => {
    const issueTimestamp = createWonderAcademySaveTimestampIssuer(
      () => Date.parse("2026-06-22T03:00:00.000Z"),
    );

    expect(issueTimestamp.issueAfter("not-a-date")).toBe(
      "2026-06-22T03:00:00.000Z",
    );
  });

  it("allows pending audio progress to flush for the expected previous user", () => {
    const progress = createInitialWonderAcademyProgress({
      userId: "keeper-1",
      now: "2026-06-22T03:00:00.000Z",
    });

    expect(
      canFlushPendingAudioProgress({
        activeUserId: "keeper-2",
        expectedUserId: "keeper-1",
        progress,
      }),
    ).toBe(true);
  });

  it("blocks pending audio progress for an unrelated user", () => {
    const progress = createInitialWonderAcademyProgress({
      userId: "keeper-1",
      now: "2026-06-22T03:00:00.000Z",
    });

    expect(
      canFlushPendingAudioProgress({
        activeUserId: "keeper-2",
        expectedUserId: "keeper-3",
        progress,
      }),
    ).toBe(false);
  });
});
