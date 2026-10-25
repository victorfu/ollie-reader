import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DictationItem,
  Homework,
  HomeworkProgress,
  HomeworkWord,
  WordPageProgress,
} from "../../types/wordPractice";

const speech = vi.hoisted(() => ({
  speak: vi.fn(),
  speakAsync: vi.fn(),
  stopSpeaking: vi.fn(),
  isSpeaking: false,
  isLoadingAudio: false,
  speakingText: null as string | null,
}));
vi.mock("../../hooks/useSpeechState", () => ({ useSpeechState: () => speech }));

import { HomeworkBook } from "./HomeworkBook";

function word(key: string): HomeworkWord {
  return {
    key,
    vocabularyId: `v-${key}`,
    word: key,
    definitions: [{ partOfSpeech: "noun", definition: `Meaning of ${key}.` }],
    sentence: `The ${key} is here.`,
    cefr: null,
  };
}

const RIVER = word("river");
const MOON = word("moon");

const DONE_PAGE: WordPageProgress = {
  section: "done",
  copies: 3,
  phrase: "a long river",
  sentence: "The river is very long.",
};

function item(key: string, answer: string | null): DictationItem {
  return { key, source: "new", answer, skipped: false };
}

function makeHomework(overrides: Partial<Homework> = {}): Homework {
  return {
    version: 2,
    id: "hw",
    status: "active",
    createdAt: 1,
    newWords: [RIVER, MOON],
    reviewWords: [],
    pages: [DONE_PAGE, DONE_PAGE],
    dictation: [item("river", null), item("moon", null)],
    corrections: {},
    ...overrides,
  };
}

let host: HTMLDivElement;
let root: Root;
let onProgress: ReturnType<typeof vi.fn<(next: HomeworkProgress) => void>>;
let onRest: ReturnType<typeof vi.fn<() => void>>;
let onSubmit: ReturnType<typeof vi.fn<() => void>>;

/** Applies each progress like the hook does, so the book advances as it would on the page. */
function Harness({ initial, locked = false }: { initial: Homework; locked?: boolean }) {
  const [homework, setHomework] = useState(initial);
  return (
    <HomeworkBook
      homework={homework}
      onProgress={(next) => {
        onProgress(next);
        setHomework((current) => ({ ...current, ...next }));
      }}
      onRest={onRest}
      onSubmit={onSubmit}
      submitting={false}
      locked={locked}
    />
  );
}

function show(initial: Homework, locked = false) {
  act(() => root.render(<Harness initial={initial} locked={locked} />));
}

const text = () => host.textContent ?? "";

async function type(value: string) {
  const el = host.querySelector("input:not([disabled])") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  speech.speakAsync.mockReset().mockResolvedValue(undefined);
  onProgress = vi.fn();
  onRest = vi.fn();
  onSubmit = vi.fn();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("HomeworkBook", () => {
  it("moves from the last word page to the dictation, keeping everything else", async () => {
    const finishedSentence = { ...DONE_PAGE, section: "sentence" as const, sentence: null };
    show(makeHomework({ pages: [DONE_PAGE, finishedSentence], corrections: { river: 1 } }));
    expect(text()).toContain("第 2 / 2 個字");

    await type("The moon is very bright.");

    expect(onProgress).toHaveBeenCalledWith({
      pages: [DONE_PAGE, { ...DONE_PAGE, sentence: "The moon is very bright." }],
      dictation: [item("river", null), item("moon", null)],
      corrections: { river: 1 },
    });
    expect(text()).toContain("聽寫 1 / 2");
  });

  it("goes from a wrong dictation answer to its correction, then to the submit button", async () => {
    show(makeHomework({ dictation: [item("river", null), item("moon", "moon")] }));
    expect(text()).toContain("聽寫 1 / 2");

    await type("rivr");

    expect(onProgress).toHaveBeenLastCalledWith({
      pages: [DONE_PAGE, DONE_PAGE],
      dictation: [item("river", "rivr"), item("moon", "moon")],
      corrections: {},
    });
    expect(text()).toContain("訂正");

    await type("river");
    await type("river");
    expect(text()).toContain("訂正");
    await type("river");

    expect(onProgress).toHaveBeenLastCalledWith({
      pages: [DONE_PAGE, DONE_PAGE],
      dictation: [item("river", "rivr"), item("moon", "moon")],
      corrections: { river: 3 },
    });
    const submit = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("交作業"),
    );
    expect(submit).toBeTruthy();
    act(() => submit!.click());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("starts straight at the dictation when there are no new words", () => {
    show(
      makeHomework({
        newWords: [],
        reviewWords: [RIVER],
        pages: [],
        dictation: [{ key: "river", source: "review", answer: null, skipped: false }],
      }),
    );

    expect(text()).toContain("聽寫 1 / 1");
    expect(text()).not.toContain("個字");
    const bar = host.querySelector("progress") as HTMLProgressElement;
    expect(bar.value).toBe(0);
  });

  it("shows the fallback instead of throwing when a dictation key is unknown", () => {
    show(makeHomework({ dictation: [item("ghost", null), item("moon", null)] }));

    expect(host.querySelector('[role="alert"]')?.textContent).toContain("資料有問題");
  });

  it("locks the step and the rest button while locked", () => {
    show(makeHomework(), true);

    expect(host.querySelector("fieldset")?.disabled).toBe(true);
    const rest = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("先休息"),
    );
    expect(rest?.disabled).toBe(true);
  });
});
