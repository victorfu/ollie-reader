import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VocabularyWord } from "../../types/vocabulary";
import type { CefrInfo } from "../../types/wordPractice";

vi.mock("../../hooks/useSettings", () => ({
  useSettings: () => ({
    showChineseTranslation: false,
    updateShowChineseTranslation: vi.fn(),
  }),
}));
vi.mock("../../hooks/useSpeechState", () => ({
  useSpeechState: () => ({ speak: vi.fn() }),
}));

import { WordDetail } from "./WordDetail";
import { WordDetailPanel } from "./WordDetailPanel";

const WORD: VocabularyWord = {
  id: "vocab-1",
  word: "river",
  userId: "user-1",
  definitions: [{ partOfSpeech: "noun", definition: "a large stream of water" }],
  examples: [],
  synonyms: [],
  antonyms: [],
  tags: [],
  createdAt: new Date(0),
  updatedAt: new Date(0),
  reviewCount: 0,
};

const handlers = {
  onUpdateWord: vi.fn(),
  onRegenerateWordDetails: vi.fn(),
};

let root: Root | null;
let host: HTMLDivElement | null;

async function render(element: React.ReactElement) {
  root = createRoot(host as HTMLDivElement);
  await act(async () => {
    root?.render(element);
  });
  return host as HTMLDivElement;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  root = null;
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
});

describe("WordDetailPanel CEFR badge", () => {
  it("shows the badge next to the word heading", async () => {
    const cefr: CefrInfo = { level: "B1", source: "list" };
    const view = await render(<WordDetailPanel word={WORD} cefr={cefr} {...handlers} />);

    const heading = view.querySelector("h2");
    expect(heading?.textContent).toBe("river");
    expect(heading?.nextElementSibling?.getAttribute("aria-label")).toBe("CEFR B1");
  });

  it("shows no badge when the word has no level", async () => {
    const withNull = await render(<WordDetailPanel word={WORD} cefr={null} {...handlers} />);
    expect(withNull.querySelector('[aria-label^="CEFR"]')).toBeNull();
    act(() => root?.unmount());
    root = null;

    const withoutProp = await render(<WordDetailPanel word={WORD} {...handlers} />);
    expect(withoutProp.querySelector('[aria-label^="CEFR"]')).toBeNull();
  });
});

describe("WordDetail CEFR badge", () => {
  it("passes the level on to the panel in the sheet", async () => {
    const view = await render(
      <WordDetail
        word={WORD}
        cefr={{ level: "B2", source: "ai" }}
        onClose={vi.fn()}
        {...handlers}
      />,
    );

    expect(view.querySelector('[aria-label="CEFR 估計 B2"]')?.textContent).toBe("≈B2");
  });
});
