import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PracticeSentence } from "../types/sentencePractice";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  addSentences: vi.fn(),
  getSpeechSentences: vi.fn(),
  updateSentence: vi.fn(),
  deleteSentence: vi.fn(),
  clearSpeechSentences: vi.fn(),
  updateSentenceOrders: vi.fn(),
  parseAndTranslateSentences: vi.fn(),
  translateWithAI: vi.fn(),
  getWordDefinition: vi.fn(),
}));

vi.mock("./useAuth", () => ({ useAuth: mocks.useAuth }));
vi.mock("../services/sentencePracticeService", () => ({
  addSentences: mocks.addSentences,
  getSpeechSentences: mocks.getSpeechSentences,
  updateSentence: mocks.updateSentence,
  deleteSentence: mocks.deleteSentence,
  clearSpeechSentences: mocks.clearSpeechSentences,
  updateSentenceOrders: mocks.updateSentenceOrders,
}));
vi.mock("../services/aiService", () => ({
  parseAndTranslateSentences: mocks.parseAndTranslateSentences,
  translateWithAI: mocks.translateWithAI,
  getWordDefinition: mocks.getWordDefinition,
}));

import { useSentencePractice } from "./useSentencePractice";

type HookValue = ReturnType<typeof useSentencePractice>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function sentence(id: string, speechId: string, order = 0): PracticeSentence {
  return {
    id,
    speechId,
    order,
    userId: "user-1",
    english: `${id} English`,
    chinese: `${id} Chinese`,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

describe("useSentencePractice operation ownership", () => {
  let container: HTMLDivElement;
  let root: Root;
  let current: HookValue;

  const Harness = ({ activeSpeechId }: { activeSpeechId: string }) => {
    const hookValue = useSentencePractice(activeSpeechId);
    useEffect(() => {
      current = hookValue;
    }, [hookValue]);
    return null;
  };

  const renderSpeech = async (speechId: string) => {
    await act(async () => {
      root.render(<Harness activeSpeechId={speechId} />);
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({ user: { uid: "user-1" } });
    mocks.getSpeechSentences.mockResolvedValue({
      sentences: [],
      hasMore: false,
      lastDocId: undefined,
    });
    mocks.clearSpeechSentences.mockResolvedValue(undefined);
    mocks.updateSentenceOrders.mockResolvedValue([]);
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("does not append an old speech load-more response after switching", async () => {
    const oldPage = deferred<{
      sentences: PracticeSentence[];
      hasMore: boolean;
      lastDocId?: string;
    }>();
    mocks.getSpeechSentences.mockImplementation(
      (activeSpeechId: string, filters?: { cursor?: string }) => {
        if (activeSpeechId === "speech-a" && filters?.cursor) {
          return oldPage.promise;
        }
        if (activeSpeechId === "speech-a") {
          return Promise.resolve({
            sentences: [sentence("a-1", "speech-a")],
            hasMore: true,
            lastDocId: "a-1",
          });
        }
        return Promise.resolve({
          sentences: [sentence("b-1", "speech-b")],
          hasMore: false,
          lastDocId: "b-1",
        });
      },
    );

    await renderSpeech("speech-a");
    let loadMorePromise!: Promise<void>;
    act(() => {
      loadMorePromise = current.loadMore();
    });
    await renderSpeech("speech-b");
    expect(current.sentences.map((item) => item.id)).toEqual(["b-1"]);

    await act(async () => {
      oldPage.resolve({
        sentences: [sentence("a-2", "speech-a", 1)],
        hasMore: false,
        lastDocId: "a-2",
      });
      await loadMorePromise;
    });

    expect(current.sentences.map((item) => item.id)).toEqual(["b-1"]);
    expect(current.hasMore).toBe(false);
  });

  it("aborts an in-flight parse when switching speeches without persisting it", async () => {
    const parsed = deferred<{ english: string; chinese: string }[]>();
    mocks.parseAndTranslateSentences.mockReturnValue(parsed.promise);
    mocks.addSentences.mockResolvedValue([{ id: "a-new", order: -1 }]);
    mocks.getSpeechSentences.mockImplementation((activeSpeechId: string) =>
      Promise.resolve({
        sentences:
          activeSpeechId === "speech-b"
            ? [sentence("b-1", "speech-b")]
            : [],
        hasMore: false,
        lastDocId: activeSpeechId === "speech-b" ? "b-1" : undefined,
      }),
    );

    await renderSpeech("speech-a");
    let parsePromise!: ReturnType<HookValue["parseAndTranslate"]>;
    act(() => {
      parsePromise = current.parseAndTranslate("A sentence.");
    });
    const parseSignal = mocks.parseAndTranslateSentences.mock.calls[0]?.[1] as
      | AbortSignal
      | undefined;
    expect(parseSignal?.aborted).toBe(false);
    await renderSpeech("speech-b");
    expect(parseSignal?.aborted).toBe(true);

    await act(async () => {
      parsed.resolve([{ english: "A sentence.", chinese: "A 句子。" }]);
      await parsePromise;
    });

    expect(mocks.addSentences).not.toHaveBeenCalled();
    expect(current.sentences.map((item) => item.id)).toEqual(["b-1"]);
    expect(current.isProcessing).toBe(false);
  });

  it("does not resurrect an old processing state after an A-B-A switch", async () => {
    const parsed = deferred<{ english: string; chinese: string }[]>();
    mocks.parseAndTranslateSentences.mockReturnValue(parsed.promise);

    await renderSpeech("speech-a");
    let parsePromise!: ReturnType<HookValue["parseAndTranslate"]>;
    act(() => {
      parsePromise = current.parseAndTranslate("A sentence.");
    });
    expect(current.isProcessing).toBe(true);

    await renderSpeech("speech-b");
    expect(current.isProcessing).toBe(false);
    await renderSpeech("speech-a");
    expect(current.isProcessing).toBe(false);

    await act(async () => {
      parsed.resolve([{ english: "A sentence.", chinese: "A 句子。" }]);
      await parsePromise;
    });

    expect(mocks.addSentences).not.toHaveBeenCalled();
    expect(current.isProcessing).toBe(false);
  });

  it("does not clear the new speech when an old speech clear finishes", async () => {
    const clearing = deferred<void>();
    mocks.clearSpeechSentences.mockReturnValue(clearing.promise);
    mocks.getSpeechSentences.mockImplementation((activeSpeechId: string) =>
      Promise.resolve({
        sentences: [sentence(`${activeSpeechId}-1`, activeSpeechId)],
        hasMore: false,
        lastDocId: `${activeSpeechId}-1`,
      }),
    );

    await renderSpeech("speech-a");
    let clearPromise!: ReturnType<HookValue["clearAll"]>;
    act(() => {
      clearPromise = current.clearAll("speech-a");
    });
    await renderSpeech("speech-b");

    await act(async () => {
      clearing.resolve();
      await clearPromise;
    });

    expect(mocks.clearSpeechSentences).toHaveBeenCalledWith("speech-a");
    expect(current.sentences.map((item) => item.id)).toEqual(["speech-b-1"]);
  });

  it("does not apply an old speech reorder result to the new speech", async () => {
    const reordering = deferred<{ id: string; order: number }[]>();
    mocks.updateSentenceOrders.mockReturnValue(reordering.promise);
    mocks.getSpeechSentences.mockImplementation((activeSpeechId: string) =>
      Promise.resolve({
        sentences:
          activeSpeechId === "speech-a"
            ? [sentence("a-1", "speech-a", 0), sentence("a-2", "speech-a", 1)]
            : [sentence("b-1", "speech-b", 0)],
        hasMore: false,
        lastDocId: activeSpeechId === "speech-a" ? "a-2" : "b-1",
      }),
    );

    await renderSpeech("speech-a");
    const reordered = [current.sentences[1], current.sentences[0]];
    let reorderPromise!: ReturnType<HookValue["reorderSentences"]>;
    act(() => {
      reorderPromise = current.reorderSentences(reordered);
    });
    await renderSpeech("speech-b");

    await act(async () => {
      reordering.resolve([
        { id: "a-2", order: 0 },
        { id: "a-1", order: 1 },
      ]);
      await reorderPromise;
    });

    expect(mocks.updateSentenceOrders).toHaveBeenCalledWith("speech-a", [
      "a-2",
      "a-1",
    ]);
    expect(current.sentences.map((item) => item.id)).toEqual(["b-1"]);
  });

  it("keeps a sentence added while a reorder request is in flight", async () => {
    const reordering = deferred<{ id: string; order: number }[]>();
    mocks.updateSentenceOrders.mockReturnValue(reordering.promise);
    mocks.parseAndTranslateSentences.mockResolvedValue([
      { english: "New sentence.", chinese: "新句子。" },
    ]);
    mocks.addSentences.mockResolvedValue([{ id: "a-new", order: -1 }]);
    mocks.getSpeechSentences.mockResolvedValue({
      sentences: [
        sentence("a-1", "speech-a", 0),
        sentence("a-2", "speech-a", 1),
      ],
      hasMore: false,
      lastDocId: "a-2",
    });

    await renderSpeech("speech-a");
    const reordered = [current.sentences[1], current.sentences[0]];
    let reorderPromise!: ReturnType<HookValue["reorderSentences"]>;
    act(() => {
      reorderPromise = current.reorderSentences(reordered);
    });

    await act(async () => {
      await current.parseAndTranslate("New sentence.");
    });
    expect(current.sentences.map((item) => item.id)).toEqual([
      "a-new",
      "a-2",
      "a-1",
    ]);

    await act(async () => {
      reordering.resolve([
        { id: "a-2", order: 0 },
        { id: "a-1", order: 1 },
      ]);
      await reorderPromise;
    });

    expect(current.sentences.map((item) => item.id)).toEqual([
      "a-new",
      "a-2",
      "a-1",
    ]);
  });
});
