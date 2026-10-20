import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VocabularyWord } from "../../types/vocabulary";
import type { CefrInfo } from "../../types/wordPractice";

vi.mock("../../hooks/useSettings", () => ({
  useSettings: () => ({ showChineseTranslation: false }),
}));
vi.mock("../../hooks/useSpeechState", () => ({
  useSpeechState: () => ({
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
    isSpeaking: false,
    isLoadingAudio: false,
    speakingText: null,
  }),
}));

import { VocabularyRow } from "./VocabularyRow";

const WORD: VocabularyWord = {
  id: "vocab-1",
  word: "river",
  userId: "user-1",
  definitions: [{ partOfSpeech: "noun", definition: "a large stream of water" }],
  examples: [],
  synonyms: [],
  antonyms: [],
  tags: [],
  difficulty: "easy",
  createdAt: new Date(0),
  updatedAt: new Date(0),
  reviewCount: 0,
};

let root: Root | null;
let host: HTMLDivElement | null;

async function renderRow(cefr?: CefrInfo | null) {
  root = createRoot(host as HTMLDivElement);
  await act(async () => {
    root?.render(
      <VocabularyRow
        word={WORD}
        cefr={cefr}
        isActive={false}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
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

describe("VocabularyRow CEFR badge", () => {
  it("shows the badge next to the word", async () => {
    const view = await renderRow({ level: "A2", source: "list" });

    const badge = view.querySelector('[aria-label="CEFR A2"]');
    expect(badge?.textContent).toBe("A2");
    expect(badge?.previousElementSibling?.textContent).toBe("river");
  });

  it("shows an estimated level with the estimate label", async () => {
    const view = await renderRow({ level: "C1", source: "ai" });

    expect(view.querySelector('[aria-label="CEFR 估計 C1"]')?.textContent).toBe("≈C1");
  });

  it("shows no badge without a level", async () => {
    const withNull = await renderRow(null);
    expect(withNull.querySelector('[aria-label^="CEFR"]')).toBeNull();
    act(() => root?.unmount());
    root = null;

    const withoutProp = await renderRow();
    expect(withoutProp.querySelector('[aria-label^="CEFR"]')).toBeNull();
  });
});
