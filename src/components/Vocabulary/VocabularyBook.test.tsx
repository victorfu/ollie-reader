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
      availableTags: [] as string[],
      loadAllTags: resolved(undefined),
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

import { smartLookup } from "../../services/aiService";
import { VocabularyBook } from "./VocabularyBook";

const smartLookupMock = vi.mocked(smartLookup);

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
    'input[type="search"]',
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

async function submit(field: HTMLInputElement) {
  await act(async () => {
    field.form?.requestSubmit();
  });
}

/** Word names of the rows currently listed, in order. */
function listedWords(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll("aside button[type='button'] .font-semibold"),
    (node) => node.textContent ?? "",
  );
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.includes(text),
  );
  if (!button) throw new Error(`no button containing "${text}"`);
  return button;
}

/** The mobile detail sheet (jsdom has no matchMedia, so the book is "mobile"). */
function detailSheet(): HTMLElement | null {
  return document.querySelector(".modal-open");
}

function stubDesktop() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
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
  mocks.vocabulary.searchWords.mockReset().mockResolvedValue([]);
  mocks.vocabulary.findExistingWord.mockReset().mockResolvedValue(null);
  mocks.vocabulary.addWordFromDetails.mockReset();
  mocks.vocabulary.loadVocabulary.mockClear();
  mocks.vocabulary.availableTags = [];
  mocks.vocabulary.loadAllTags.mockClear();
  mocks.sentences.findExistingSentence.mockReset().mockResolvedValue(null);
  mocks.sentences.addTranslatedSentence.mockReset().mockResolvedValue(null);
  mocks.sentences.searchSentences.mockReset().mockResolvedValue([]);
  smartLookupMock.mockReset();
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

  it("filters loaded items on the first keystroke, before the remote search", async () => {
    const container = await renderBook();
    const field = getField(container);

    await typeInto(field, "ban");

    expect(listedWords(container)).toEqual(["banana"]);
    expect(mocks.vocabulary.searchWords).not.toHaveBeenCalled();
  });

  it("lists exact matches first, then prefix matches, then the rest", async () => {
    mocks.vocabulary.words = [
      makeWord("w-1", "incurious"),
      makeWord("w-2", "curiously"),
      makeWord("w-3", "curious"),
    ];
    const container = await renderBook();

    await typeInto(getField(container), "curious");

    expect(listedWords(container)).toEqual(["curious", "curiously", "incurious"]);
  });

  it("opens a saved result without adding it or asking AI", async () => {
    mocks.vocabulary.words = [makeWord("w-1", "curious"), makeWord("w-2", "apple")];
    const container = await renderBook();
    await typeInto(getField(container), "cur");

    await act(async () => {
      findButton(container, "curious").click();
    });

    expect(detailSheet()?.textContent).toContain("curious");
    expect(mocks.vocabulary.lookupOrAddWord).not.toHaveBeenCalled();
    expect(smartLookupMock).not.toHaveBeenCalled();
  });

  it("opens an already saved word on Enter without a lookup", async () => {
    mocks.vocabulary.words = [makeWord("w-1", "curious")];
    const container = await renderBook();
    const field = getField(container);

    await typeInto(field, "Curious!");
    await submit(field);

    expect(detailSheet()?.textContent).toContain("curious");
    expect(container.textContent).toContain("已經在生詞本裡了");
    expect(mocks.vocabulary.lookupOrAddWord).not.toHaveBeenCalled();
    expect(smartLookupMock).not.toHaveBeenCalled();
    expect(field.value).toBe("Curious!");
  });

  it("adds a new word straight away and clears the field without opening it", async () => {
    mocks.vocabulary.lookupOrAddWord.mockResolvedValue({
      success: true,
      existingWord: makeWord("w-3", "river"),
      isNew: true,
    });
    const container = await renderBook();
    const field = getField(container);

    await typeInto(field, "river");
    await submit(field);

    expect(detailSheet()).toBeNull();
    expect(container.textContent).toContain("已加入生詞本");
    expect(field.value).toBe("");
    expect(mocks.vocabulary.loadVocabulary).toHaveBeenCalledTimes(2);
  });

  it("submits only once when Enter is pressed again while looking up", async () => {
    const lookup = deferred<unknown>();
    mocks.vocabulary.lookupOrAddWord.mockReturnValue(lookup.promise);
    const container = await renderBook();
    const field = getField(container);

    await typeInto(field, "river");
    await act(async () => {
      field.form?.requestSubmit();
      field.form?.requestSubmit();
    });
    await submit(field);

    expect(mocks.vocabulary.lookupOrAddWord).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("正在查詢並加入「river」");

    await act(async () => {
      lookup.resolve({
        success: true,
        existingWord: makeWord("w-3", "river"),
        isNew: true,
      });
    });
    expect(container.textContent).not.toContain("正在查詢並加入");
  });

  it("keeps the text and explains the failure so the user can retry", async () => {
    mocks.vocabulary.lookupOrAddWord.mockResolvedValueOnce({
      success: false,
      isNew: false,
      message: "無法取得 AI 生成的內容",
    });
    const container = await renderBook();
    const field = getField(container);

    await typeInto(field, "river");
    await submit(field);

    expect(field.value).toBe("river");
    expect(container.textContent).toContain("按 Enter 再試一次");

    mocks.vocabulary.lookupOrAddWord.mockResolvedValueOnce({
      success: true,
      existingWord: makeWord("w-3", "river"),
      isNew: true,
    });
    await submit(field);

    expect(mocks.vocabulary.lookupOrAddWord).toHaveBeenCalledTimes(2);
    expect(field.value).toBe("");
  });

  it("drops the message's own final punctuation before the retry hint", async () => {
    mocks.vocabulary.lookupOrAddWord.mockResolvedValue({
      success: false,
      isNew: false,
      message: "Something broke.",
    });
    const container = await renderBook();
    const field = getField(container);

    await typeInto(field, "river");
    await submit(field);

    expect(container.querySelector("#smart-query-status")?.textContent).toBe(
      "Something broke，按 Enter 再試一次",
    );
  });

  it("does not ask to retry twice when the message already says so", async () => {
    mocks.vocabulary.lookupOrAddWord.mockResolvedValue({
      success: false,
      isNew: false,
    });
    const container = await renderBook();
    const field = getField(container);

    await typeInto(field, "river");
    await submit(field);

    expect(container.querySelector("#smart-query-status")?.textContent).toBe(
      "查詢失敗，按 Enter 再試一次",
    );
  });

  it("saves a phrase classified by AI as a word", async () => {
    smartLookupMock.mockResolvedValue({
      kind: "word",
      details: {
        definitions: [
          {
            partOfSpeech: "phrase",
            definition: "to stop trying",
            definitionChinese: "放棄",
          },
        ],
        examples: [],
      },
    });
    mocks.vocabulary.addWordFromDetails.mockResolvedValue({
      success: true,
      word: makeWord("w-9", "give up"),
    });
    const container = await renderBook();
    const field = getField(container);

    await typeInto(field, "  Give   up! ");
    await submit(field);

    expect(mocks.vocabulary.findExistingWord).toHaveBeenCalledWith("Give up");
    expect(mocks.vocabulary.addWordFromDetails.mock.calls[0][0]).toBe("Give up");
    expect(mocks.sentences.addTranslatedSentence).not.toHaveBeenCalled();
    expect(field.value).toBe("");
  });

  it("saves a sentence classified by AI as a sentence", async () => {
    smartLookupMock.mockResolvedValue({
      kind: "sentence",
      chinese: "我喜歡蘋果。",
      keyWords: [],
    });
    mocks.sentences.addTranslatedSentence.mockResolvedValue({
      ...SENTENCE,
      id: "sentence-2",
      english: "I like apples.",
      chinese: "我喜歡蘋果。",
    });
    const container = await renderBook();
    const field = getField(container);

    await typeInto(field, "I like apples.");
    await submit(field);

    expect(mocks.sentences.addTranslatedSentence.mock.calls[0].slice(0, 2)).toEqual([
      "I like apples.",
      "我喜歡蘋果。",
    ]);
    expect(mocks.vocabulary.addWordFromDetails).not.toHaveBeenCalled();
    expect(detailSheet()).toBeNull();
  });

  it("finds a saved sentence typed without its punctuation instead of adding it again", async () => {
    mocks.sentences.sentences = [];
    mocks.sentences.searchSentences.mockResolvedValue([SENTENCE]);
    const container = await renderBook();
    const field = getField(container);

    await typeInto(field, "i like fruit");
    await submit(field);

    expect(smartLookupMock).not.toHaveBeenCalled();
    expect(mocks.sentences.addTranslatedSentence).not.toHaveBeenCalled();
    expect(detailSheet()?.textContent).toContain("I like fruit.");
  });

  it("offers to look up and add the text when nothing saved matches", async () => {
    mocks.vocabulary.lookupOrAddWord.mockResolvedValue({
      success: true,
      existingWord: makeWord("w-3", "river"),
      isNew: true,
    });
    const container = await renderBook();
    await typeInto(getField(container), "river");
    await waitForSearch();

    await act(async () => {
      findButton(container, "查詢並加入「river」").click();
    });

    expect(mocks.vocabulary.lookupOrAddWord).toHaveBeenCalledTimes(1);
  });

  it("keeps the typed text and results when switching the type filter", async () => {
    const container = await renderBook();
    const field = getField(container);
    await typeInto(field, "app");

    await act(async () => {
      findButton(container, "句子").click();
    });
    expect(field.value).toBe("app");
    expect(listedWords(container)).toEqual([]);

    await act(async () => {
      findButton(container, "全部").click();
    });
    expect(listedWords(container)).toEqual(["apple"]);
  });

  it("ignores a slow search that finishes after the query changed", async () => {
    const slow = deferred<VocabularyWord[]>();
    mocks.vocabulary.searchWords
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValue([]);
    const container = await renderBook();
    const field = getField(container);

    await typeInto(field, "ap");
    await waitForSearch();
    await typeInto(field, "ban");
    await waitForSearch();
    await act(async () => {
      slow.resolve([makeWord("w-7", "apricot")]);
    });

    expect(listedWords(container)).toEqual(["banana"]);
  });

  it("returns focus to the field after adding on desktop", async () => {
    stubDesktop();
    mocks.vocabulary.lookupOrAddWord.mockResolvedValue({
      success: true,
      existingWord: makeWord("w-3", "river"),
      isNew: true,
    });
    const container = await renderBook();
    const field = getField(container);
    field.focus();

    await typeInto(field, "river");
    await submit(field);

    expect(document.activeElement).toBe(field);
    expect(field.value).toBe("");
  });

  it("keeps the field focused on touch screens after adding a word", async () => {
    mocks.vocabulary.lookupOrAddWord.mockResolvedValue({
      success: true,
      existingWord: makeWord("w-3", "river"),
      isNew: true,
    });
    const container = await renderBook();
    const field = getField(container);
    field.focus();

    await typeInto(field, "river");
    await submit(field);

    expect(detailSheet()).toBeNull();
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe("");
  });

  it("drops the keyboard on touch screens when a saved word opens over the field", async () => {
    const container = await renderBook();
    const field = getField(container);
    field.focus();

    await typeInto(field, "apple");
    await submit(field);

    expect(detailSheet()).not.toBeNull();
    expect(document.activeElement).not.toBe(field);
  });
});

describe("VocabularyBook review entry", () => {
  it("no longer offers a review button", async () => {
    const container = await renderBook();

    const labels = Array.from(container.querySelectorAll("button"), (button) =>
      button.textContent?.trim(),
    );
    expect(labels).not.toContain("複習");
    expect(container.querySelector('[title="開始複習"]')).toBeNull();
  });
});

function getButton(
  container: HTMLElement,
  matches: (text: string) => boolean,
): HTMLButtonElement {
  const button = Array.from(
    container.querySelectorAll<HTMLButtonElement>("button"),
  ).find((candidate) => matches(candidate.textContent ?? ""));
  if (!button) throw new Error("button not found");
  return button;
}

async function click(button: HTMLButtonElement) {
  await act(async () => {
    button.click();
  });
}

async function openTagEditor(container: HTMLElement, word: string) {
  await click(getButton(container, (text) => text.includes(`meaning of ${word}`)));
  await click(getButton(container, (text) => text === "編輯標籤"));
}

describe("VocabularyBook tag suggestions", () => {
  it("does not read every tag when the book opens or a word is added", async () => {
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
    expect(mocks.vocabulary.loadAllTags).not.toHaveBeenCalled();
  });

  it("loads every tag when the tag editor opens", async () => {
    const container = await renderBook();

    await openTagEditor(container, "apple");

    expect(mocks.vocabulary.loadAllTags).toHaveBeenCalledTimes(1);
  });

  it("suggests the book's tags in the tag editor", async () => {
    mocks.vocabulary.availableTags = ["fruit", "verbs"];
    const container = await renderBook();

    await openTagEditor(container, "apple");

    expect(container.textContent).toContain("+ fruit");
    expect(container.textContent).toContain("+ verbs");
  });
});
