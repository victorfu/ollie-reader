import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VocabularyWord } from "../../types/vocabulary";
import type { SentenceTranslation } from "../../types/sentenceTranslation";

const makeWord = (id: string, word: string): VocabularyWord => ({
  id,
  word,
  userId: "user-1",
  definitions: [{ partOfSpeech: "noun", definition: `meaning of ${word}` }],
  examples: [],
  synonyms: [],
  antonyms: [],
  tags: [],
  createdAt: new Date(0),
  updatedAt: new Date(0),
  reviewCount: 0,
});

const SENTENCE: SentenceTranslation = {
  id: "sentence-1",
  userId: "user-1",
  english: "I like fruit.",
  chinese: "我喜歡水果。",
  createdAt: new Date(0),
};

// Stable identities: VocabularyBook lists these in effect dependencies.
const mocks = vi.hoisted(() => {
  const resolved = <T,>(value: T) => vi.fn().mockResolvedValue(value);
  return {
    vocabulary: {
      words: [] as VocabularyWord[],
      loading: false,
      isLoadingMore: false,
      hasMore: false,
      loadVocabulary: resolved(undefined),
      loadMore: resolved(undefined),
      deleteWord: resolved({ success: true }),
      addWord: resolved({ success: true }),
      lookupOrAddWord: vi.fn(),
      findExistingWord: resolved(null),
      addWordFromDetails: resolved({ success: true }),
      updateWord: resolved({ success: true }),
      regenerateWordDetails: resolved({ success: true }),
      updateReview: resolved(undefined),
      loadWordsForReview: resolved([]),
      searchWords: resolved([]),
      getTags: resolved([]),
      getWordCount: resolved(0),
    },
    sentences: {
      sentences: [] as SentenceTranslation[],
      isLoading: false,
      hasMore: false,
      loadSentences: resolved(undefined),
      loadMore: resolved(undefined),
      findExistingSentence: resolved(null),
      addTranslatedSentence: resolved(null),
      deleteSentence: resolved({ success: true }),
      searchSentences: resolved([]),
    },
    speech: { speak: vi.fn(), isSpeaking: false, stopSpeaking: vi.fn() },
    cefr: { ready: true, levelOf: () => null },
  };
});

vi.mock("../../hooks/useVocabulary", () => ({
  useVocabulary: () => mocks.vocabulary,
}));
vi.mock("../../hooks/useSentenceTranslation", () => ({
  useSentenceTranslation: () => mocks.sentences,
}));
vi.mock("../../hooks/useSpeechState", () => ({
  useSpeechState: () => mocks.speech,
}));
vi.mock("../../hooks/useCefrLevels", () => ({
  useCefrLevels: () => mocks.cefr,
}));
vi.mock("../../hooks/useSettings", () => ({
  useSettings: () => ({ showChineseTranslation: false }),
}));
vi.mock("../../services/aiService", () => ({ smartLookup: vi.fn() }));

import { VocabularyBook } from "./VocabularyBook";

const SEARCH_DEBOUNCE_MS = 300;

let root: Root | null;
let host: HTMLDivElement | null;

async function renderBook() {
  root = createRoot(host as HTMLDivElement);
  await act(async () => {
    root?.render(<VocabularyBook />);
  });
  return host as HTMLDivElement;
}

/** The toolbar has exactly one text field for both searching and adding. */
function getField(container: HTMLElement): HTMLInputElement {
  const fields = container.querySelectorAll<HTMLInputElement>(
    'input[type="text"]',
  );
  expect(fields).toHaveLength(1);
  return fields[0];
}

function getSubmitButton(field: HTMLInputElement): HTMLButtonElement {
  const button = field.form?.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );
  if (!button) throw new Error("field has no submit button");
  return button;
}

async function typeInto(field: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function waitForSearch() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 50));
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  mocks.vocabulary.words = [makeWord("w-1", "apple"), makeWord("w-2", "banana")];
  mocks.sentences.sentences = [SENTENCE];
  mocks.vocabulary.lookupOrAddWord.mockReset();
  mocks.vocabulary.searchWords.mockClear();
  root = null;
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  vi.unstubAllGlobals();
});

describe("VocabularyBook search-or-add field", () => {
  it("filters the list as the user types", async () => {
    const container = await renderBook();
    const field = getField(container);

    await typeInto(field, "app");
    await waitForSearch();

    expect(container.textContent).toContain("apple");
    expect(container.textContent).not.toContain("banana");
  });

  it("searches words by prefix with a limit instead of downloading the whole book", async () => {
    const container = await renderBook();
    const field = getField(container);

    await typeInto(field, "app");
    await waitForSearch();

    expect(mocks.vocabulary.searchWords).toHaveBeenCalledTimes(1);
    const [text, options] = mocks.vocabulary.searchWords.mock.calls[0];
    expect(text).toBe("app");
    expect(options.mode).toBe("prefix");
    expect(typeof options.limit).toBe("number");
    expect(options.limit).toBeGreaterThan(0);
  });

  it("looks up and adds the typed word on Enter", async () => {
    mocks.vocabulary.lookupOrAddWord.mockResolvedValue({
      success: true,
      existingWord: makeWord("w-3", "river"),
      isNew: true,
    });
    const container = await renderBook();
    const field = getField(container);

    await typeInto(field, "river");
    await act(async () => {
      field.form?.requestSubmit();
    });

    expect(mocks.vocabulary.lookupOrAddWord).toHaveBeenCalledTimes(1);
    expect(mocks.vocabulary.lookupOrAddWord.mock.calls[0][0]).toBe("river");
  });

  it("searches Chinese translations but does not offer to add them", async () => {
    const container = await renderBook();
    const field = getField(container);

    await typeInto(field, "水果");
    await waitForSearch();

    expect(container.textContent).toContain("I like fruit.");
    expect(container.textContent).not.toContain("apple");
    expect(getSubmitButton(field).disabled).toBe(true);
  });

  it("shows the full list again as soon as the field is cleared", async () => {
    const container = await renderBook();
    const field = getField(container);
    await typeInto(field, "app");
    await waitForSearch();
    expect(container.textContent).not.toContain("banana");

    await typeInto(field, "");

    expect(container.textContent).toContain("banana");
  });
});
