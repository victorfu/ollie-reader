import { describe, expect, it } from "vitest";
import type { PetWish } from "../types";
import {
  applyWishAction,
  createDailyWish,
  refreshDailyWish,
  selectDailyWish,
} from "./wish";

describe("daily wish selection", () => {
  it("is stable for the same uid and local date", () => {
    const first = selectDailyWish("reader-42", "2026-07-30", ["ball"]);
    const second = selectDailyWish("reader-42", "2026-07-30", ["ball"]);

    expect(second.id).toBe(first.id);
  });

  it("never selects a toy wish without an owned toy", () => {
    for (let index = 0; index < 1_000; index += 1) {
      expect(
        selectDailyWish(`reader-${index}`, "2026-07-30", []).kind,
      ).not.toBe("toy");
    }
  });

  it("keeps the authored 70/30 free-to-snack weighting", () => {
    let snackCount = 0;
    const sampleSize = 10_000;
    for (let index = 0; index < sampleSize; index += 1) {
      if (selectDailyWish(`weight-${index}`, "2026-07-30", []).kind === "snack") {
        snackCount += 1;
      }
    }

    expect(snackCount / sampleSize).toBeGreaterThan(0.27);
    expect(snackCount / sampleSize).toBeLessThan(0.33);
  });

  it("refreshes on a new day and preserves today's progress", () => {
    const current = createDailyWish("reader-42", "2026-07-30", []);
    const progressed = { ...current, progress: 1 };
    expect(refreshDailyWish(progressed, "reader-42", "2026-07-30", [])).toBe(
      progressed,
    );

    const tomorrow = refreshDailyWish(
      progressed,
      "reader-42",
      "2026-07-31",
      [],
    );
    expect(tomorrow.date).toBe("2026-07-31");
    expect(tomorrow.progress).toBe(0);
    expect(tomorrow.fulfilled).toBe(false);
  });

  it("falls a same-day toy wish back to petting when that toy is not owned", () => {
    const unavailableToyWish: PetWish = {
      date: "2026-07-30",
      wishId: "play-ball",
      fulfilled: false,
      progress: 0,
      target: 1,
    };

    expect(
      refreshDailyWish(
        unavailableToyWish,
        "reader-42",
        "2026-07-30",
        [],
      ),
    ).toEqual({
      date: "2026-07-30",
      wishId: "pet-five",
      fulfilled: false,
      progress: 0,
      target: 5,
    });
  });
});

describe("wish progress", () => {
  const petWish: PetWish = {
    date: "2026-07-30",
    wishId: "pet-five",
    fulfilled: false,
    progress: 0,
    target: 5,
  };

  it("tracks multi-step progress and emits its reward exactly once", () => {
    let wish = petWish;
    for (let count = 1; count <= 4; count += 1) {
      const result = applyWishAction(wish, { type: "pet" });
      wish = result.wish;
      expect(result.bondReward).toBe(0);
      expect(wish.progress).toBe(count);
    }

    const fulfilled = applyWishAction(wish, { type: "pet" });
    expect(fulfilled.newlyFulfilled).toBe(true);
    expect(fulfilled.bondReward).toBe(10);
    expect(fulfilled.wish.fulfilled).toBe(true);

    const repeated = applyWishAction(fulfilled.wish, { type: "pet" });
    expect(repeated.progressed).toBe(false);
    expect(repeated.bondReward).toBe(0);
  });

  it("ignores a non-matching action", () => {
    const result = applyWishAction(petWish, { type: "bath" });
    expect(result.matched).toBe(false);
    expect(result.wish).toBe(petWish);
  });
});
