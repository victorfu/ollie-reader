import { describe, expect, it } from "vitest";
import {
  buildMalformedLoadoutGuestSave,
  buildWonderAcademyGuestSave,
  isKnownBenignWonderAcademyConsoleEntry,
  relevantWonderAcademyConsoleEntries,
  WONDER_ACADEMY_SMOKE_CHECKS,
} from "../../../../scripts/wonder-academy-smoke-helpers.mjs";

describe("Wonder Academy browser smoke helpers", () => {
  it("builds a malformed loadout save for UI repair smoke checks", () => {
    const save = buildMalformedLoadoutGuestSave();

    expect(save.data.team[0]).toMatchObject({
      speciesId: "lumi",
      equippedMoveIds: ["bubble-pat"],
    });
  });

  it("builds a normal single-move save for equip smoke checks", () => {
    const save = buildWonderAcademyGuestSave({
      equippedMoveIds: ["tiny-flash"],
    });

    expect(save.data.team[0]).toMatchObject({
      speciesId: "lumi",
      equippedMoveIds: ["tiny-flash"],
    });
  });

  it("ignores known Firebase App Check console noise", () => {
    expect(
      isKnownBenignWonderAcademyConsoleEntry({
        type: "error",
        text: "Failed to load resource: the server responded with a status of 403 () https://content-firebaseappcheck.googleapis.com",
      }),
    ).toBe(true);
  });

  it("ignores Chromium WebGL readback warnings caused by canvas smoke checks", () => {
    expect(
      isKnownBenignWonderAcademyConsoleEntry({
        type: "warning",
        text: "[.WebGL-0x12c00549400]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels",
      }),
    ).toBe(true);
  });

  it("ignores Kaplay repeated-init warnings caused by multi-canvas smoke checks", () => {
    expect(
      isKnownBenignWonderAcademyConsoleEntry({
        type: "warning",
        text: "KAPLAY already initialized, you are calling kaplay() multiple times, it may lead bugs!",
      }),
    ).toBe(true);
  });

  it("keeps unrelated console errors relevant", () => {
    const entries = [
      {
        type: "error",
        text: "Failed to load resource: the server responded with a status of 403 () https://content-firebaseappcheck.googleapis.com",
      },
      { type: "error", text: "TypeError: Cannot read properties of undefined" },
    ];

    expect(relevantWonderAcademyConsoleEntries(entries)).toEqual([
      { type: "error", text: "TypeError: Cannot read properties of undefined" },
    ]);
  });

  it("documents the full browser smoke coverage contract", () => {
    expect(WONDER_ACADEMY_SMOKE_CHECKS).toEqual([
      "legacy route redirects",
      "guest title loads",
      "new game reaches hub",
      "region map opens",
      "node map opens",
      "explore canvas renders",
      "battle opens from grass",
      "catch flow reaches result",
      "chest loot message appears",
      "Warden battle opens",
      "reload preserves guest hub",
      "mobile touch flow opens hub surfaces",
      "keyboard flow reaches starter selection",
      "guest hub loads",
      "malformed skills loadout repairs",
      "skill equip updates",
      "Wonderdex opens",
      "shop opens",
      "no relevant console or page errors",
    ]);
  });
});
