import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VocabularyWord } from "../types/vocabulary";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  addVocabularyWord: vi.fn(),
  getUserVocabulary: vi.fn(),
  getVocabularyWord: vi.fn(),
  updateVocabularyWord: vi.fn(),
  deleteVocabularyWord: vi.fn(),
  checkWordExists: vi.fn(),
  getUserWordTags: vi.fn(),
  getVocabularyForReview: vi.fn(),
  updateReviewStats: vi.fn(),
  searchUserVocabulary: vi.fn(),
  getUserVocabularyCount: vi.fn(),
  generateWordDetails: vi.fn(),
}));

vi.mock("./useAuth", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../services/vocabularyService", () => ({
  addVocabularyWord: mocks.addVocabularyWord,
  getUserVocabulary: mocks.getUserVocabulary,
  getVocabularyWord: mocks.getVocabularyWord,
  updateVocabularyWord: mocks.updateVocabularyWord,
  deleteVocabularyWord: mocks.deleteVocabularyWord,
  checkWordExists: mocks.checkWordExists,
  getUserWordTags: mocks.getUserWordTags,
  getVocabularyForReview: mocks.getVocabularyForReview,
  updateReviewStats: mocks.updateReviewStats,
  searchUserVocabulary: mocks.searchUserVocabulary,
  getUserVocabularyCount: mocks.getUserVocabularyCount,
}));

vi.mock("../services/aiService", () => ({
  generateWordDetails: mocks.generateWordDetails,
}));

import { useVocabulary } from "./useVocabulary";

type VocabularyHook = ReturnType<typeof useVocabulary>;

const makeWord = (
  id: string,
  word: string,
  tags: string[] = [],
): VocabularyWord => ({
  id,
  word,
  userId: "user-1",
  definitions: [],
  examples: [],
  synonyms: [],
  antonyms: [],
  tags,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  reviewCount: 0,
});

const renderUseVocabulary = () => {
  let root: Root | undefined;
  let value: VocabularyHook | undefined;
  const container = document.createElement("div");

  const Harness = () => {
    const vocabulary = useVocabulary();
    useEffect(() => {
      value = vocabulary;
    });
    return null;
  };

  act(() => {
    root = createRoot(container);
    root.render(<Harness />);
  });

  return {
    get current() {
      if (!value) {
        throw new Error("useVocabulary did not render");
      }
      return value;
    },
    unmount() {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
};

describe("useVocabulary", () => {
  let hook: ReturnType<typeof renderUseVocabulary> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({ user: { uid: "user-1" } });
    mocks.checkWordExists.mockResolvedValue(null);
    mocks.addVocabularyWord.mockResolvedValue({
      id: "word-1",
      created: true,
    });
  });

  afterEach(() => {
    hook?.unmount();
    hook = undefined;
  });

  it("does not add an empty vocabulary word when AI details are unavailable", async () => {
    mocks.generateWordDetails.mockResolvedValue(null);
    hook = renderUseVocabulary();

    let result: Awaited<ReturnType<VocabularyHook["addWord"]>> | undefined;
    await act(async () => {
      result = await hook?.current.addWord("orbit");
    });

    expect(result).toEqual({
      success: false,
      message: "無法取得 AI 生成的內容",
    });
    expect(mocks.addVocabularyWord).not.toHaveBeenCalled();
  });

  it("does not add a vocabulary word when AI details contain no definitions", async () => {
    mocks.generateWordDetails.mockResolvedValue({
      definitions: [],
      examples: [{ sentence: "The moon is in orbit." }],
    });
    hook = renderUseVocabulary();

    let result: Awaited<ReturnType<VocabularyHook["addWord"]>> | undefined;
    await act(async () => {
      result = await hook?.current.addWord("orbit");
    });

    expect(result).toEqual({
      success: false,
      message: "無法取得 AI 生成的內容",
    });
    expect(mocks.addVocabularyWord).not.toHaveBeenCalled();
  });

  it("does not report lookup success when a new word has no AI details", async () => {
    mocks.generateWordDetails.mockResolvedValue(null);
    hook = renderUseVocabulary();

    let result:
      | Awaited<ReturnType<VocabularyHook["lookupOrAddWord"]>>
      | undefined;
    await act(async () => {
      result = await hook?.current.lookupOrAddWord("orbit");
    });

    expect(result).toEqual({
      success: false,
      isNew: false,
      message: "無法取得 AI 生成的內容",
    });
    expect(mocks.addVocabularyWord).not.toHaveBeenCalled();
  });

  it("explains a Firestore quota error in Chinese instead of the raw message", async () => {
    mocks.checkWordExists.mockRejectedValue(
      Object.assign(new Error("Quota exceeded."), {
        code: "resource-exhausted",
      }),
    );
    hook = renderUseVocabulary();

    let result:
      | Awaited<ReturnType<VocabularyHook["lookupOrAddWord"]>>
      | undefined;
    await act(async () => {
      result = await hook?.current.lookupOrAddWord("orbit");
    });

    expect(result).toEqual({
      success: false,
      isNew: false,
      message: "雲端資料庫用量已達上限，請稍後再試",
    });
    expect(mocks.generateWordDetails).not.toHaveBeenCalled();
  });

  it("explains a Firestore quota error when saving precomputed details", async () => {
    mocks.addVocabularyWord.mockRejectedValue(
      Object.assign(new Error("Quota exceeded."), {
        code: "resource-exhausted",
      }),
    );
    hook = renderUseVocabulary();

    let result:
      | Awaited<ReturnType<VocabularyHook["addWordFromDetails"]>>
      | undefined;
    await act(async () => {
      result = await hook?.current.addWordFromDetails("give up", {
        definitions: [
          {
            partOfSpeech: "phrase",
            definition: "to stop trying",
            definitionChinese: "放棄",
          },
        ],
        examples: [],
      });
    });

    expect(result).toEqual({
      success: false,
      message: "雲端資料庫用量已達上限，請稍後再試",
    });
  });

  it("still returns an existing vocabulary word without regenerating details", async () => {
    const existingWord: VocabularyWord = {
      id: "existing-1",
      word: "orbit",
      userId: "user-1",
      definitions: [],
      examples: [],
      synonyms: [],
      antonyms: [],
      tags: [],
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      reviewCount: 0,
    };
    mocks.checkWordExists.mockResolvedValue(existingWord);
    hook = renderUseVocabulary();

    let result:
      | Awaited<ReturnType<VocabularyHook["lookupOrAddWord"]>>
      | undefined;
    await act(async () => {
      result = await hook?.current.lookupOrAddWord("orbit");
    });

    expect(result).toEqual({
      success: true,
      existingWord,
      isNew: false,
      message: "Word found in vocabulary",
    });
    expect(mocks.generateWordDetails).not.toHaveBeenCalled();
    expect(mocks.addVocabularyWord).not.toHaveBeenCalled();
  });

  it("ignores an old load-more page after a newer refresh", async () => {
    let resolveOldPage:
      | ((value: {
          words: VocabularyWord[];
          hasMore: boolean;
          lastDocId?: string;
        }) => void)
      | undefined;
    const oldPage = new Promise<{
      words: VocabularyWord[];
      hasMore: boolean;
      lastDocId?: string;
    }>((resolve) => {
      resolveOldPage = resolve;
    });

    mocks.getUserVocabulary
      .mockResolvedValueOnce({
        words: [makeWord("a", "alpha")],
        hasMore: true,
        lastDocId: "a",
      })
      .mockReturnValueOnce(oldPage)
      .mockResolvedValueOnce({
        words: [makeWord("fresh", "fresh")],
        hasMore: false,
      });

    hook = renderUseVocabulary();
    await act(async () => {
      await hook?.current.loadVocabulary();
    });

    let oldLoad: Promise<void> | undefined;
    act(() => {
      oldLoad = hook?.current.loadMore();
    });

    await act(async () => {
      await hook?.current.loadVocabulary();
    });
    await act(async () => {
      resolveOldPage?.({
        words: [makeWord("old", "old")],
        hasMore: false,
      });
      await oldLoad;
    });

    expect(hook.current.words.map((word) => word.id)).toEqual(["fresh"]);
    expect(hook.current.isLoadingMore).toBe(false);
  });
});

describe("useVocabulary tags", () => {
  let hook: ReturnType<typeof renderUseVocabulary> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({ user: { uid: "user-1" } });
    mocks.updateVocabularyWord.mockResolvedValue(undefined);
    mocks.deleteVocabularyWord.mockResolvedValue(undefined);
    mocks.getUserVocabulary.mockResolvedValue({
      words: [
        makeWord("a", "apple", ["fruit"]),
        makeWord("b", "bat", ["animal", "fruit"]),
      ],
      hasMore: true,
      lastDocId: "b",
    });
  });

  afterEach(() => {
    hook?.unmount();
    hook = undefined;
    vi.restoreAllMocks();
  });

  const loadFirstPage = async () => {
    hook = renderUseVocabulary();
    await act(async () => {
      await hook?.current.loadVocabulary();
    });
    return hook;
  };

  it("offers the loaded words' tags without reading the whole book", async () => {
    const view = await loadFirstPage();

    expect(view.current.availableTags).toEqual(["animal", "fruit"]);
    expect(mocks.getUserWordTags).not.toHaveBeenCalled();
  });

  it("reads every word's tags once, when the full list is asked for", async () => {
    mocks.getUserWordTags.mockResolvedValue(
      new Map([
        ["a", ["fruit"]],
        ["b", ["animal", "fruit"]],
        ["older", ["verbs"]],
      ]),
    );
    const view = await loadFirstPage();

    await act(async () => {
      await Promise.all([
        view.current.loadAllTags(),
        view.current.loadAllTags(),
      ]);
    });
    await act(async () => {
      await view.current.loadAllTags();
    });

    expect(mocks.getUserWordTags).toHaveBeenCalledTimes(1);
    expect(mocks.getUserWordTags).toHaveBeenCalledWith("user-1");
    expect(view.current.availableTags).toEqual(["animal", "fruit", "verbs"]);
  });

  it("keeps the tag list current after edits and deletes without rereading", async () => {
    mocks.getUserWordTags.mockResolvedValue(
      new Map([
        ["a", ["fruit"]],
        ["b", ["animal", "fruit"]],
        ["older", ["verbs"]],
      ]),
    );
    const view = await loadFirstPage();
    await act(async () => {
      await view.current.loadAllTags();
    });

    // "older" is not on a loaded page, e.g. opened from search results.
    await act(async () => {
      await view.current.updateWord("older", { tags: ["nouns"] });
    });
    expect(view.current.availableTags).toEqual(["animal", "fruit", "nouns"]);

    await act(async () => {
      await view.current.deleteWord("b");
    });
    expect(view.current.availableTags).toEqual(["fruit", "nouns"]);
    expect(mocks.getUserWordTags).toHaveBeenCalledTimes(1);
  });

  it("keeps an edit made while the full tag list is still loading", async () => {
    let resolveRead: ((tags: Map<string, string[]>) => void) | undefined;
    mocks.getUserWordTags.mockReturnValue(
      new Promise<Map<string, string[]>>((resolve) => {
        resolveRead = resolve;
      }),
    );
    const view = await loadFirstPage();

    let read: Promise<void> | undefined;
    act(() => {
      read = view.current.loadAllTags();
    });
    await act(async () => {
      await view.current.updateWord("older", { tags: [] });
    });
    await act(async () => {
      resolveRead?.(new Map([["older", ["verbs"]]]));
      await read;
    });

    expect(view.current.availableTags).toEqual(["animal", "fruit"]);
  });

  it("tries the full tag read again after it fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getUserWordTags
      .mockRejectedValueOnce(new Error("Quota exceeded."))
      .mockResolvedValueOnce(new Map([["older", ["verbs"]]]));
    const view = await loadFirstPage();

    await act(async () => {
      await view.current.loadAllTags();
    });
    expect(view.current.availableTags).toEqual(["animal", "fruit"]);

    await act(async () => {
      await view.current.loadAllTags();
    });
    expect(view.current.availableTags).toEqual(["animal", "fruit", "verbs"]);
  });
});
