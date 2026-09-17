import { beforeEach, describe, expect, it, vi } from "vitest";

// settingsService imports firebase at module top-level; mock those so importing
// the module under test doesn't initialize a real Firebase app in jsdom.
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({ path: "userSettings/reader" })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock("../utils/firebaseUtil", () => ({
  db: {},
}));

import { getDoc, setDoc } from "firebase/firestore";
import { getUserSettings, saveUserSettings } from "./settingsService";

beforeEach(() => vi.clearAllMocks());

function storedSettings(data: Record<string, unknown>, exists = true): void {
  vi.mocked(getDoc).mockResolvedValue({
    exists: () => exists,
    data: () => data,
  } as Awaited<ReturnType<typeof getDoc>>);
}

describe("Edge-only speech settings", () => {
  it.each(["edge", "piper", "kokoro", "google", "chatterbox", "", undefined, null, 42])(
    "loads %s as Edge while preserving the user's API speech settings",
    async (ttsEngine) => {
      storedSettings({ ttsEngine, ttsMode: "api", speechRate: 1.3, readingMode: "selection" });

      expect(await getUserSettings("reader")).toMatchObject({
        userId: "reader", ttsEngine: "edge", ttsMode: "api", speechRate: 1.3, readingMode: "selection",
      });
      expect(setDoc).not.toHaveBeenCalled();
    },
  );

  it("preserves system speech for an account with a legacy engine", async () => {
    storedSettings({ ttsEngine: "piper", ttsMode: "browser" });
    expect(await getUserSettings("reader")).toMatchObject({ ttsEngine: "edge", ttsMode: "browser" });
  });

  it("replaces the stored legacy engine on the next settings update", async () => {
    storedSettings({ ttsEngine: "kokoro", ttsMode: "api" });
    await saveUserSettings("reader", { speechRate: 1.2 });

    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ttsEngine: "edge", speechRate: 1.2 }),
      { merge: true },
    );
    expect(vi.mocked(setDoc).mock.calls[0][1]).not.toHaveProperty("ttsMode");
  });

  it("creates new accounts with Edge and the requested speech mode", async () => {
    storedSettings({}, false);
    await saveUserSettings("reader", { ttsMode: "api" });
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: "reader", ttsEngine: "edge", ttsMode: "api", speechRate: 1 }),
    );
  });
});
