import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: { displayName: "Learner", email: "learner@example.test" } as { displayName: string; email: string } | null,
  loading: false,
  authError: null,
  signOutUser: vi.fn(),
}));

vi.mock("./hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("./hooks/useWarmServer", () => ({ useWarmServerOnRouteChange: vi.fn() }));
vi.mock("./utils/lazyWithReload", () => ({ lazyWithReload: () => () => <div>Page content</div> }));
vi.mock("./contexts/PdfContext", () => ({ PdfProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("./contexts/SpeechContext", () => ({ SpeechProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("./contexts/SettingsContext", () => ({ SettingsProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("./components/common/ThemeToggle", () => ({ ThemeToggle: () => null }));

import App from "./App";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  auth.user = { displayName: "Learner", email: "learner@example.test" };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  window.history.replaceState(null, "", "/");
  localStorage.clear();
});

const desktopNavLabels = () =>
  Array.from(host.querySelectorAll("aside nav a")).map((link) => link.textContent);
const desktopMoreToggle = () =>
  Array.from(host.querySelectorAll<HTMLButtonElement>("aside nav button")).find(
    (button) => button.textContent === "更多",
  )!;

describe("default home page", () => {
  it("opens the Vocabulary Book from the root path", () => {
    window.history.replaceState(null, "", "/");
    act(() => root.render(<App />));
    expect(window.location.pathname).toBe("/vocabulary");
  });
  it("lands on the Vocabulary Book after login when no page was requested", () => {
    window.history.replaceState(null, "", "/login");
    act(() => root.render(<App />));
    expect(window.location.pathname).toBe("/vocabulary");
  });
});

describe("retired travel page", () => {
  it.each(["/travel", "/travel/?topic=airport"])("redirects %s to the reader without adding history", (path) => {
    window.history.replaceState(null, "", path);
    const historyLength = window.history.length;
    act(() => root.render(<App />));
    expect(window.location.pathname).toBe("/reader");
    expect(window.location.search).toBe("");
    expect(window.history.length).toBe(historyLength);
    expect(host.querySelector('a[href="/travel"]')).toBeNull();
    expect(host.textContent).not.toContain("旅遊英文");
    expect(host.querySelector('a[href="/podcasts"]')).not.toBeNull();
  });

  it("preserves authentication when opening a retired bookmark", () => {
    auth.user = null;
    window.history.replaceState(null, "", "/travel");
    act(() => root.render(<App />));
    expect(window.location.pathname).toBe("/login");
    expect(window.history.state.usr.from).toBe("/reader");
  });
});

describe("Word Practice navigation", () => {
  it("exposes the Word Practice route in desktop and mobile navigation", () => {
    window.history.replaceState(null, "", "/word-practice");
    act(() => root.render(<App />));
    expect(window.location.pathname).toBe("/word-practice");
    expect(host.querySelector('a[href="/word-practice"]')?.textContent).toContain("單字練習");
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="開啟選單"]')!.click());
    const links = host.querySelectorAll('a[href="/word-practice"]');
    expect(links).toHaveLength(2);
    links.forEach((link) => expect(link.textContent).toContain("單字練習"));
  });
  it("places it right after Vocabulary in the desktop navigation", () => {
    window.history.replaceState(null, "", "/reader");
    act(() => root.render(<App />));
    const hrefs = Array.from(host.querySelectorAll("aside nav a")).map((link) => link.getAttribute("href"));
    expect(hrefs[hrefs.indexOf("/vocabulary") + 1]).toBe("/word-practice");
  });
  it("renders the page for the Word Practice route", () => {
    window.history.replaceState(null, "", "/word-practice");
    act(() => root.render(<App />));
    expect(host.textContent).toContain("Page content");
  });
  it("requires authentication for the Word Practice page", () => {
    auth.user = null;
    window.history.replaceState(null, "", "/word-practice");
    act(() => root.render(<App />));
    expect(window.location.pathname).toBe("/login");
    expect(window.history.state.usr.from).toBe("/word-practice");
  });
});

describe("Podcast navigation", () => {
  it("exposes the Podcast route in desktop and mobile navigation", () => {
    window.history.replaceState(null, "", "/podcasts");
    act(() => root.render(<App />));
    expect(window.location.pathname).toBe("/podcasts");
    expect(host.querySelector('a[href="/podcasts"]')?.textContent).toContain("Podcast 聽力");
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="開啟選單"]')!.click());
    expect(host.querySelectorAll('a[href="/podcasts"]')).toHaveLength(2);
  });
  it("requires authentication for the Podcast page", () => {
    auth.user = null;
    window.history.replaceState(null, "", "/podcasts");
    act(() => root.render(<App />));
    expect(window.location.pathname).toBe("/login");
    expect(window.history.state.usr.from).toBe("/podcasts");
  });
});

describe("Speech navigation", () => {
  it("shows a single Speech entry instead of separate speech items", () => {
    window.history.replaceState(null, "", "/reader");
    act(() => root.render(<App />));
    act(() => desktopMoreToggle().click());
    const labels = desktopNavLabels();
    expect(labels).toContain("演講");
    expect(labels).not.toContain("英文演講");
    expect(labels).not.toContain("演講練習");
    expect(labels).not.toContain("音訊庫");
  });
  it.each(["/english-speech", "/speech-practice", "/audio-uploads"])("marks the Speech entry active on %s and shows all sub-tabs", (path) => {
    window.history.replaceState(null, "", path);
    act(() => root.render(<App />));
    const active = host.querySelector('aside nav a[aria-current="page"]');
    expect(active?.textContent).toBe("演講");
    const tabs = host.querySelector('nav[aria-label="演講分類"]');
    expect(tabs?.querySelector('a[href="/english-speech"]')?.textContent).toContain("英文演講");
    expect(tabs?.querySelector('a[href="/speech-practice"]')?.textContent).toContain("演講練習");
    expect(tabs?.querySelector('a[href="/audio-uploads"]')?.textContent).toContain("音訊庫");
    expect(tabs?.querySelector(`a[href="${path}"]`)?.getAttribute("aria-current")).toBe("page");
    expect(host.textContent).toContain("Page content");
  });
  it("redirects /speech to English Speech", () => {
    window.history.replaceState(null, "", "/speech");
    act(() => root.render(<App />));
    expect(window.location.pathname).toBe("/english-speech");
  });
});

describe("More section", () => {
  it("tucks Speech, Show subtitles and Exams under a collapsed 更多 by default", () => {
    window.history.replaceState(null, "", "/reader");
    act(() => root.render(<App />));
    const toggle = desktopMoreToggle();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(desktopNavLabels()).toEqual(["閱讀器", "生詞本", "單字練習", "Podcast 聽力", "小遊戲"]);
    act(() => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(desktopNavLabels().slice(-3)).toEqual(["演講", "影集字幕", "基本學力測驗"]);
  });

  it("expands 更多 when the current page lives inside it", () => {
    window.history.replaceState(null, "", "/exams");
    act(() => root.render(<App />));
    expect(desktopMoreToggle().getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelector('aside nav a[aria-current="page"]')?.textContent).toBe("基本學力測驗");
  });

  it("moves items out of and back into 更多, remembering the choice", () => {
    window.history.replaceState(null, "", "/reader");
    act(() => root.render(<App />));
    act(() => desktopMoreToggle().click());
    act(() => host.querySelector<HTMLButtonElement>('aside button[aria-label="把「影集字幕」移出更多"]')!.click());
    act(() => host.querySelector<HTMLButtonElement>('aside button[aria-label="把「小遊戲」移到更多"]')!.click());
    expect(desktopNavLabels()).toEqual([
      "閱讀器", "生詞本", "單字練習", "Podcast 聽力", "影集字幕", "演講", "基本學力測驗", "小遊戲",
    ]);

    act(() => root.unmount());
    root = createRoot(host);
    act(() => root.render(<App />));
    act(() => desktopMoreToggle().click());
    expect(desktopNavLabels()).toEqual([
      "閱讀器", "生詞本", "單字練習", "Podcast 聽力", "影集字幕",
    ]);
  });

  it("hides the 更多 toggle once every item has been moved out", () => {
    window.history.replaceState(null, "", "/reader");
    act(() => root.render(<App />));
    act(() => desktopMoreToggle().click());
    for (const label of ["演講", "影集字幕", "基本學力測驗"]) {
      act(() => host.querySelector<HTMLButtonElement>(`aside button[aria-label="把「${label}」移出更多"]`)!.click());
    }
    expect(desktopMoreToggle()).toBeUndefined();
    expect(desktopNavLabels()).toHaveLength(8);
  });
});
