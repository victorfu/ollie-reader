import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type NamedTab = {
  closed: boolean;
  focus: ReturnType<typeof vi.fn>;
  location: { href: string };
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("openGameTab", () => {
  it("recovers an existing named tab after the Hub module is reloaded", async () => {
    let href = "about:blank";
    let navigationCount = 0;
    const tab: NamedTab = {
      closed: false,
      focus: vi.fn(),
      location: {
        get href() {
          return href;
        },
        set href(value: string) {
          navigationCount += 1;
          href = value;
        },
      },
    };
    const openMock = vi
      .spyOn(window, "open")
      .mockReturnValue(tab as unknown as Window);

    const firstModule = await import("./gameTabs");
    const expectedUrl = new URL("/games/meteor", window.location.href).href;
    firstModule.openGameTab("/games/meteor");

    expect(href).toBe(expectedUrl);
    expect(navigationCount).toBe(1);

    // A hard reload rebuilds the module-level Map, while the browser-owned
    // named browsing context remains alive.
    vi.resetModules();
    const reloadedModule = await import("./gameTabs");
    reloadedModule.openGameTab("/games/meteor");

    expect(openMock).toHaveBeenCalledTimes(2);
    expect(openMock).toHaveBeenNthCalledWith(
      1,
      "",
      firstModule.getGameTabTargetName("/games/meteor"),
    );
    expect(openMock).toHaveBeenNthCalledWith(
      2,
      "",
      reloadedModule.getGameTabTargetName("/games/meteor"),
    );
    expect(navigationCount).toBe(1);
    expect(tab.focus).toHaveBeenCalledTimes(2);
  });

  it("navigates a live game tab back to the game after it returned to the Hub", async () => {
    let href = new URL("/games", window.location.href).href;
    let navigationCount = 0;
    const tab: NamedTab = {
      closed: false,
      focus: vi.fn(),
      location: {
        get href() {
          return href;
        },
        set href(value: string) {
          navigationCount += 1;
          href = value;
        },
      },
    };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);

    const gameTabs = await import("./gameTabs");
    gameTabs.openGameTab("/games/meteor");

    expect(href).toBe(new URL("/games/meteor", window.location.href).href);
    expect(navigationCount).toBe(1);
    expect(tab.focus).toHaveBeenCalledTimes(1);
  });
});
