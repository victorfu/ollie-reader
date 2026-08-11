import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SentenceTranslation } from "../types/sentenceTranslation";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  findExistingTranslation: vi.fn(),
  addSentenceTranslation: vi.fn(),
  getUserSentenceTranslations: vi.fn(),
  deleteSentenceTranslation: vi.fn(),
  deleteAllSentenceTranslations: vi.fn(),
  searchUserSentenceTranslations: vi.fn(),
}));

vi.mock("./useAuth", () => ({ useAuth: mocks.useAuth }));
vi.mock("../services/sentenceTranslationService", () => ({
  findExistingTranslation: mocks.findExistingTranslation,
  addSentenceTranslation: mocks.addSentenceTranslation,
  getUserSentenceTranslations: mocks.getUserSentenceTranslations,
  deleteSentenceTranslation: mocks.deleteSentenceTranslation,
  deleteAllSentenceTranslations: mocks.deleteAllSentenceTranslations,
  searchUserSentenceTranslations: mocks.searchUserSentenceTranslations,
}));

import { useSentenceTranslation } from "./useSentenceTranslation";

type SentenceHook = ReturnType<typeof useSentenceTranslation>;

const makeSentence = (id: string, english: string): SentenceTranslation => ({
  id,
  userId: "user-1",
  english,
  chinese: `${english}-zh`,
  createdAt: new Date("2026-01-01T00:00:00Z"),
});

const renderHook = () => {
  let root: Root | undefined;
  let value: SentenceHook | undefined;
  const container = document.createElement("div");

  const Harness = () => {
    const hook = useSentenceTranslation();
    useEffect(() => {
      value = hook;
    });
    return null;
  };

  act(() => {
    root = createRoot(container);
    root.render(<Harness />);
  });

  return {
    get current() {
      if (!value) throw new Error("hook did not render");
      return value;
    },
    unmount() {
      act(() => root?.unmount());
      container.remove();
    },
  };
};

describe("useSentenceTranslation", () => {
  let hook: ReturnType<typeof renderHook> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({ user: { uid: "user-1" } });
  });

  afterEach(() => {
    hook?.unmount();
    hook = undefined;
  });

  it("ignores an old page after a newer refresh", async () => {
    let resolveOldPage:
      | ((value: {
          sentences: SentenceTranslation[];
          hasMore: boolean;
          lastDocId?: string;
        }) => void)
      | undefined;
    const oldPage = new Promise<{
      sentences: SentenceTranslation[];
      hasMore: boolean;
      lastDocId?: string;
    }>((resolve) => {
      resolveOldPage = resolve;
    });

    mocks.getUserSentenceTranslations
      .mockResolvedValueOnce({
        sentences: [makeSentence("a", "alpha")],
        hasMore: true,
        lastDocId: "a",
      })
      .mockReturnValueOnce(oldPage)
      .mockResolvedValueOnce({
        sentences: [makeSentence("fresh", "fresh")],
        hasMore: false,
      });

    hook = renderHook();
    await act(async () => {
      await hook?.current.loadSentences();
    });

    let oldLoad: Promise<void> | undefined;
    act(() => {
      oldLoad = hook?.current.loadMore();
    });
    await act(async () => {
      await hook?.current.loadSentences();
    });
    await act(async () => {
      resolveOldPage?.({
        sentences: [makeSentence("old", "old")],
        hasMore: false,
      });
      await oldLoad;
    });

    expect(hook.current.sentences.map((sentence) => sentence.id)).toEqual([
      "fresh",
    ]);
  });

  it("reports a delete failure and keeps the sentence visible", async () => {
    mocks.getUserSentenceTranslations.mockResolvedValue({
      sentences: [makeSentence("a", "alpha")],
      hasMore: false,
    });
    mocks.deleteSentenceTranslation.mockRejectedValue(new Error("offline"));

    hook = renderHook();
    await act(async () => {
      await hook?.current.loadSentences();
    });

    let result: { success: boolean; message?: string } | undefined;
    await act(async () => {
      result = await hook?.current.deleteSentence("a");
    });

    expect(result).toEqual({ success: false, message: "刪除失敗" });
    expect(hook.current.sentences).toHaveLength(1);
  });
});
