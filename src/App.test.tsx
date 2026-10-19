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
    expect(host.querySelector('a[href="/exams"]')).not.toBeNull();
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
