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
  getUserTags: vi.fn(),
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
  getUserTags: mocks.getUserTags,
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
    mocks.addVocabularyWord.mockResolvedValue("word-1");
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
});
