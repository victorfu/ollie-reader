import { describe, expect, it } from "vitest";
import {
  buildMalformedLoadoutGuestSave,
  buildWonderAcademyGuestSave,
  isKnownBenignWonderAcademyConsoleEntry,
  relevantWonderAcademyConsoleEntries,
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
});
