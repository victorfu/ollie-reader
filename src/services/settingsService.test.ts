import { describe, expect, it, vi } from "vitest";

// settingsService imports firebase at module top-level; mock those so importing
// the module under test doesn't initialize a real Firebase app in jsdom.
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock("../utils/firebaseUtil", () => ({
  db: {},
}));

import { normalizeTtsEngine } from "./settingsService";

describe("normalizeTtsEngine", () => {
  it("accepts every supported engine", () => {
    expect(normalizeTtsEngine("piper")).toBe("piper");
    expect(normalizeTtsEngine("kokoro")).toBe("kokoro");
    expect(normalizeTtsEngine("edge")).toBe("edge");
  });

  it("falls back to piper for legacy/unknown/empty values", () => {
    expect(normalizeTtsEngine("google")).toBe("piper");
    expect(normalizeTtsEngine("")).toBe("piper");
    expect(normalizeTtsEngine(undefined)).toBe("piper");
    expect(normalizeTtsEngine(null)).toBe("piper");
    expect(normalizeTtsEngine(42)).toBe("piper");
  });

  // 已移除的引擎必須被正規化掉，否則舊存檔選過 chatterbox 的人會卡在
  // 打不到的端點上（Firestore 裡還留著 ttsEngine: "chatterbox"）
  it("migrates the removed chatterbox engine to piper", () => {
    expect(normalizeTtsEngine("chatterbox")).toBe("piper");
  });
});
