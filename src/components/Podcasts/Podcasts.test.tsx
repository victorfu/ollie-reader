import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SavedPodcast } from "../../types/podcast";
const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../../services/podcastService", () => ({ resolvePodcast: mocks.resolve }));
vi.mock("../../services/podcastLibraryService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/podcastLibraryService")>()),
  listSavedPodcasts: mocks.list,
  savePodcast: mocks.save,
  deleteSavedPodcast: mocks.remove,
}));
vi.mock("../../utils/firebaseUtil", () => ({ db: {} }));
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => ({ user: { uid: "user-1" } }) }));
import Podcasts from "./Podcasts";

const saved = (id: string, title: string, url = `https://podcasts.apple.com/${id}`): SavedPodcast =>
  ({ id, kind: "episode", url, title, podcastTitle: "Stories", artworkUrl: null, addedAt: 1 });

let host: HTMLDivElement, root: Root;
async function render(items: SavedPodcast[] = []) {
  mocks.list.mockResolvedValue(items);
  await act(async () => root.render(<MemoryRouter><Podcasts /></MemoryRouter>));
}
function typeUrl(value: string) {
  const input = host.querySelector<HTMLInputElement>("#podcast-url")!;
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
const submit = () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
const listedTitles = () => Array.from(host.querySelectorAll("li a .font-medium"), (node) => node.textContent);

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } },
  });
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.resetAllMocks(); });

it("lists saved podcasts as links to their player pages", async () => {
  await render([saved("a", "<b>A story</b>"), saved("b", "Another")]);
  expect(listedTitles()).toEqual(["<b>A story</b>", "Another"]);
  expect(host.querySelector("li b")).toBeNull();
  expect(host.querySelector("li a")?.getAttribute("href")).toBe("/podcasts/a");
});

it("checks a pasted link and saves it at the top of the list", async () => {
  await render([saved("a", "Old one")]);
  mocks.resolve.mockResolvedValue({ title: "New story", podcastTitle: "Stories", sourceUrl: "https://podcasts.apple.com/new", artworkUrl: null, audioUrl: "x" });
  mocks.save.mockImplementation(async (_uid, podcast) => ({ ...podcast, id: "new", addedAt: 2 }));
  typeUrl("https://podcasts.apple.com/new?i=1");
  await act(async () => { submit(); });
  expect(mocks.save).toHaveBeenCalledWith("user-1", expect.objectContaining({ kind: "episode", url: "https://podcasts.apple.com/new", title: "New story" }));
  expect(listedTitles()).toEqual(["New story", "Old one"]);
  expect(host.querySelector<HTMLInputElement>("#podcast-url")!.value).toBe("");
});

it("saves a show link with the show's title", async () => {
  await render();
  mocks.resolve.mockResolvedValue({ kind: "show", podcastTitle: "Stories", sourceUrl: "https://podcasts.apple.com/show", unavailableCount: 0,
    episodes: [{ title: "First", podcastTitle: "Stories", guid: "one", durationSeconds: 60, artworkUrl: "https://art.example/1.jpg" }] });
  mocks.save.mockImplementation(async (_uid, podcast) => ({ ...podcast, id: "show", addedAt: 2 }));
  typeUrl("https://podcasts.apple.com/show");
  await act(async () => { submit(); });
  expect(mocks.save).toHaveBeenCalledWith("user-1", expect.objectContaining({ kind: "show", title: "Stories", artworkUrl: "https://art.example/1.jpg" }));
});

it("does not save a link that fails to resolve", async () => {
  await render();
  mocks.resolve.mockRejectedValue(new Error("RSS 中找不到指定單集"));
  typeUrl("https://podcasts.apple.com/bad");
  await act(async () => { submit(); });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("RSS 中找不到");
  expect(mocks.save).not.toHaveBeenCalled();
  expect(host.querySelector<HTMLInputElement>("#podcast-url")!.value).toBe("https://podcasts.apple.com/bad");
});

it("does not save the same podcast twice", async () => {
  await render([saved("a", "A story", "https://podcasts.apple.com/a")]);
  mocks.resolve.mockResolvedValue({ title: "A story", podcastTitle: "Stories", sourceUrl: "https://podcasts.apple.com/a", artworkUrl: null, audioUrl: "x" });
  typeUrl("https://podcasts.apple.com/a?utm=1");
  await act(async () => { submit(); });
  expect(mocks.save).not.toHaveBeenCalled();
  expect(host.textContent).toContain("已經在清單裡了");
  expect(listedTitles()).toEqual(["A story"]);
});

it("deletes a podcast after confirmation", async () => {
  await render([saved("a", "A story"), saved("b", "Another")]);
  mocks.remove.mockResolvedValue(undefined);
  act(() => { host.querySelector<HTMLButtonElement>('li button[aria-label*="A story"]')!.click(); });
  const confirm = Array.from(document.querySelectorAll("dialog button")).find((button) => button.textContent?.includes("刪除")) as HTMLButtonElement;
  await act(async () => { confirm.click(); });
  expect(mocks.remove).toHaveBeenCalledWith("user-1", "a");
  expect(listedTitles()).toEqual(["Another"]);
});

it("cancels a pending check on unmount", async () => {
  await render();
  mocks.resolve.mockImplementation(() => new Promise(() => {}));
  typeUrl("https://podcasts.apple.com/slow");
  act(() => { submit(); });
  const signal = mocks.resolve.mock.calls[0][1] as AbortSignal;
  expect(signal.aborted).toBe(false);
  act(() => root.render(null));
  expect(signal.aborted).toBe(true);
});
