import { act, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AnimatePresence mode="wait" 的退場動畫在 jsdom 沒有 rAF 驅動,
// 舊視圖永遠退不了場;把 framer-motion 換成同步 passthrough。
vi.mock("framer-motion", async () => {
  const { createElement, forwardRef, Fragment } = await import("react");
  const MOTION_ONLY_PROPS = new Set([
    "initial",
    "animate",
    "exit",
    "variants",
    "transition",
    "whileTap",
    "layout",
  ]);
  const motion = new Proxy({} as Record<string | symbol, unknown>, {
    get: (_target, tag) =>
      forwardRef(function MotionStub(
        props: Record<string, unknown>,
        ref: unknown,
      ) {
        const domProps: Record<string, unknown> = { ref };
        for (const [key, value] of Object.entries(props)) {
          if (!MOTION_ONLY_PROPS.has(key) && key !== "children") {
            domProps[key] = value;
          }
        }
        return createElement(
          String(tag),
          domProps,
          props.children as ReactNode,
        );
      }),
  });
  return {
    motion,
    AnimatePresence: (props: { children?: ReactNode }) =>
      createElement(Fragment, null, props.children),
    useReducedMotion: () => true,
  };
});

import {
  SpeechContext,
  type SpeechContextType,
} from "../../contexts/SpeechContextType";
import ExamPracticePage from "./ExamPracticePage";

let container: HTMLDivElement;
let root: Root;
let currentSearch = "";

/** 綜合卷測試會進入 ExamQuizView(依賴 SpeechContext),以 stub 提供。 */
const FAKE_SPEECH: SpeechContextType = {
  speechRate: 1,
  isSpeaking: false,
  ttsMode: "browser",
  ttsEngine: "piper",
  setTtsMode: vi.fn(),
  isLoadingAudio: false,
  speechSupported: true,
  speak: vi.fn(),
  speakAsync: vi.fn().mockResolvedValue(undefined),
  stopSpeaking: vi.fn(),
};

function LocationProbe() {
  const location = useLocation();
  useEffect(() => {
    currentSearch = location.search;
  }, [location.search]);
  return <ExamPracticePage />;
}

async function renderAt(entry: string): Promise<void> {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <SpeechContext.Provider value={FAKE_SPEECH}>
          <LocationProbe />
        </SpeechContext.Provider>
      </MemoryRouter>,
    );
  });
}

function subjectButton(label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`subject button not found: ${label}`);
  }
  return button;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    },
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
  });
  window.localStorage.clear();
  currentSearch = "";
  // jsdom 未實作;綜合卷流程會觸發視圖捲動
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ExamPracticePage subject query", () => {
  it("redirects bare /exams to the canonical chinese query", async () => {
    await renderAt("/exams");

    expect(currentSearch).toBe("?subject=chinese");
    expect(container.textContent).toContain("四年級國語練習卷");
  });

  it("keeps both subjects explicit when switching", async () => {
    await renderAt("/exams?subject=math");
    expect(currentSearch).toBe("?subject=math");
    expect(container.textContent).toContain("四年級數學練習卷");

    await act(async () => {
      subjectButton("國語").click();
    });

    expect(currentSearch).toBe("?subject=chinese");
  });

  it("switches to the mixed tab from a fixed subject", async () => {
    await renderAt("/exams?subject=chinese");

    await act(async () => {
      subjectButton("綜合").click();
    });

    expect(currentSearch).toBe("?subject=mixed");
    expect(container.textContent).toContain("隨機綜合卷");
    expect(container.textContent).toContain("產生考卷並開始");
  });
});

describe("ExamPracticePage mixed random paper", () => {
  it("generates a paper with the selected count and starts immediately", async () => {
    await renderAt("/exams?subject=mixed");
    expect(container.textContent).toContain("隨機綜合卷");

    const select = container.querySelector("select");
    expect(select).toBeInstanceOf(HTMLSelectElement);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        "value",
      )?.set;
      setter?.call(select, "20");
      select?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const generate = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("產生考卷並開始"),
    );
    expect(generate).toBeTruthy();
    await act(async () => {
      generate?.click();
    });

    // 直接進入作答:頂部列顯示範圍名稱與 1 / 20 進度
    expect(container.textContent).toContain("1 / 20");
    expect(container.textContent).toContain("隨機綜合卷");
    expect(container.textContent).toContain("原卷 國語");
  });
});
