import { describe, expect, it } from "vitest";
import { MAX_SQUAD_SIZE } from "./constants";
import { CHARACTERS, DEFAULT_ROSTER_IDS } from "./data/characters";
import {
  getSquadCacheKey,
  readSquadCache,
  recommendSquad,
  sanitizeSquad,
  writeSquadCache,
} from "./squad";
import type { SaveStorage } from "./storage";

/** 依 CHARACTERS 的順序取出指定角色，跟 roster 給畫面的順序一致。 */
function byIds(ids: string[]) {
  const wanted = new Set(ids);
  return CHARACTERS.filter((character) => wanted.has(character.id));
}

const DEFAULTS = byIds(DEFAULT_ROSTER_IDS);

function makeStorage(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("sanitizeSquad", () => {
  it("回傳空陣列當輸入不是陣列", () => {
    for (const raw of [null, undefined, "pochacco", 5, { 0: "pochacco" }]) {
      expect(sanitizeSquad(raw, DEFAULTS)).toEqual([]);
    }
  });

  it("丟掉不是字串或不在可用名單裡的項目", () => {
    const raw = ["pochacco", 7, null, "not-a-character", "hello-kitty", "shiro"];

    // hello-kitty 不在預設班底裡，所以也要被濾掉。
    expect(sanitizeSquad(raw, DEFAULTS)).toEqual(["pochacco", "shiro"]);
  });

  it("去掉重複，保留第一次出現的順序", () => {
    const raw = ["shiro", "pochacco", "shiro", "pochacco"];

    expect(sanitizeSquad(raw, DEFAULTS)).toEqual(["shiro", "pochacco"]);
  });

  it("最多只留下隊伍上限的數量", () => {
    // 預設班底有六隻，全塞進來只能留五隻。
    const result = sanitizeSquad(DEFAULT_ROSTER_IDS, DEFAULTS);

    expect(result).toHaveLength(MAX_SQUAD_SIZE);
    expect(result).toEqual(DEFAULT_ROSTER_IDS.slice(0, MAX_SQUAD_SIZE));
  });
});

describe("recommendSquad", () => {
  it("從零開始會照打法優先序補滿五隻", () => {
    // 預設班底涵蓋六種打法；優先序是 速射、爆裂、狙擊、重砲、糖漿、藤蔓，
    // 所以藤蔓（keroppi）會被留下來。
    expect(recommendSquad(DEFAULTS, [])).toEqual([
      "pochacco", // rapid
      "minna-no-tabo", // burst
      "shiro", // sniper
      "chococat", // cannon
      "tuxedosam", // syrup
    ]);
  });

  it("同一種打法優先選稀有度高的角色", () => {
    // crayon-shinchan 是 mythling 的速射，要贏過 common 的 pochacco。
    const available = byIds([...DEFAULT_ROSTER_IDS, "crayon-shinchan"]);

    expect(recommendSquad(available, [])[0]).toBe("crayon-shinchan");
    expect(recommendSquad(available, [])).not.toContain("pochacco");
  });

  it("保留已選的角色，接著只補還沒涵蓋的打法", () => {
    const result = recommendSquad(DEFAULTS, ["keroppi"]);

    // keroppi 已涵蓋藤蔓，剩下照優先序補 速射、爆裂、狙擊、重砲。
    expect(result).toEqual([
      "keroppi",
      "pochacco",
      "minna-no-tabo",
      "shiro",
      "chococat",
    ]);
  });

  it("打法都涵蓋後，剩的名額照稀有度補", () => {
    // 三隻全是速射：mythling 先佔速射名額，剩下照稀有度 rare > common。
    const available = byIds(["pochacco", "goropikadon", "crayon-shinchan"]);

    expect(recommendSquad(available, [])).toEqual([
      "crayon-shinchan",
      "goropikadon",
      "pochacco",
    ]);
  });

  it("可用角色不足五隻就全部帶上", () => {
    const available = byIds(["pochacco", "keroppi"]);

    expect(recommendSquad(available, [])).toEqual(["pochacco", "keroppi"]);
  });

  it("已選滿五隻就原樣回傳", () => {
    const picked = DEFAULT_ROSTER_IDS.slice(0, MAX_SQUAD_SIZE);

    expect(recommendSquad(CHARACTERS, picked)).toEqual(picked);
  });

  it("已選名單裡的髒資料會先被清掉", () => {
    const result = recommendSquad(DEFAULTS, ["not-a-character", "shiro"]);

    expect(result[0]).toBe("shiro");
    expect(result).toHaveLength(MAX_SQUAD_SIZE);
    expect(new Set(result).size).toBe(result.length);
  });
});

describe("squad cache", () => {
  it("key 依 uid 區分，沒登入用 guest", () => {
    expect(getSquadCacheKey("uid-1")).not.toBe(getSquadCacheKey("uid-2"));
    expect(getSquadCacheKey(null)).toContain("guest");
  });

  it("寫進去再讀出來是同一份", () => {
    const storage = makeStorage();
    writeSquadCache("uid-1", ["pochacco", "shiro"], storage);

    expect(readSquadCache("uid-1", storage)).toEqual(["pochacco", "shiro"]);
  });

  it("不同 uid 的隊伍互不干擾", () => {
    const storage = makeStorage();
    writeSquadCache("uid-1", ["pochacco"], storage);
    writeSquadCache(null, ["keroppi"], storage);

    expect(readSquadCache("uid-1", storage)).toEqual(["pochacco"]);
    expect(readSquadCache(null, storage)).toEqual(["keroppi"]);
  });

  it("沒存過就回空陣列", () => {
    expect(readSquadCache("uid-1", makeStorage())).toEqual([]);
  });

  it("內容壞掉（不是 JSON 或不是字串陣列）就回空陣列", () => {
    const storage = makeStorage();

    storage.data.set(getSquadCacheKey("uid-1"), "not json {");
    expect(readSquadCache("uid-1", storage)).toEqual([]);

    storage.data.set(getSquadCacheKey("uid-1"), JSON.stringify({ a: 1 }));
    expect(readSquadCache("uid-1", storage)).toEqual([]);

    storage.data.set(getSquadCacheKey("uid-1"), JSON.stringify(["ok", 5, null]));
    expect(readSquadCache("uid-1", storage)).toEqual(["ok"]);
  });

  it("storage 丟例外時讀寫都不會炸", () => {
    const broken: SaveStorage = {
      getItem: () => {
        throw new Error("quota");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };

    expect(() => writeSquadCache("uid-1", ["pochacco"], broken)).not.toThrow();
    expect(readSquadCache("uid-1", broken)).toEqual([]);
  });

  it("storage 不存在（SSR）時安全地退化", () => {
    expect(() => writeSquadCache("uid-1", ["pochacco"], null)).not.toThrow();
    expect(readSquadCache("uid-1", null)).toEqual([]);
  });
});
