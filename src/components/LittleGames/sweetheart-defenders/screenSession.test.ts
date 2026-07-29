import { describe, expect, it } from "vitest";
import {
  getScreenSessionKey,
  readScreenSession,
  writeScreenSession,
  type ScreenStorage,
} from "./screenSession";
import { LEVELS } from "./data/levels";

function makeStorage(): ScreenStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

function makeBrokenStorage(): ScreenStorage {
  return {
    getItem: () => {
      throw new Error("storage exploded");
    },
    setItem: () => {
      throw new Error("storage exploded");
    },
    removeItem: () => {
      throw new Error("storage exploded");
    },
  };
}

const LEVEL_A = LEVELS[0].id;

describe("screenSession", () => {
  it("round-trips the level the player was on", () => {
    const storage = makeStorage();

    writeScreenSession(LEVEL_A, storage);

    expect(readScreenSession(storage)).toBe(LEVEL_A);
  });

  it("clears the entry when back on the title screen", () => {
    const storage = makeStorage();
    writeScreenSession(LEVEL_A, storage);

    writeScreenSession(null, storage);

    expect(readScreenSession(storage)).toBeNull();
    expect(storage.data.has(getScreenSessionKey())).toBe(false);
  });

  it("returns null when nothing was stored", () => {
    expect(readScreenSession(makeStorage())).toBeNull();
  });

  it("drops level ids that no longer exist", () => {
    // 改版拿掉關卡後,舊分頁殘留的 id 不能把玩家帶進不存在的關。
    const storage = makeStorage();
    storage.setItem(getScreenSessionKey(), "removed-level");

    expect(readScreenSession(storage)).toBeNull();
  });

  it("survives a storage that throws", () => {
    // 無痕模式等情境 sessionStorage 可能直接丟例外;遊戲照常開,只是不回復。
    const storage = makeBrokenStorage();

    expect(() => writeScreenSession(LEVEL_A, storage)).not.toThrow();
    expect(() => writeScreenSession(null, storage)).not.toThrow();
    expect(readScreenSession(storage)).toBeNull();
  });

  it("treats a missing storage as empty", () => {
    expect(readScreenSession(null)).toBeNull();
    expect(() => writeScreenSession(LEVEL_A, null)).not.toThrow();
  });
});
