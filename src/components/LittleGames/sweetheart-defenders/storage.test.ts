import { beforeEach, describe, expect, it } from "vitest";
import {
  createEmptySave,
  getCacheKey,
  mergeSaves,
  normalizeSave,
  readCache,
  writeCache,
  type SaveStorage,
  type SweetheartSaveV1,
} from "./storage";
import { LEVELS } from "./data/levels";

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

function makeSave(overrides: Partial<SweetheartSaveV1> = {}): SweetheartSaveV1 {
  return { ...createEmptySave(), ...overrides };
}

const LEVEL_A = LEVELS[0].id;
const LEVEL_B = LEVELS[1].id;

describe("createEmptySave", () => {
  it("starts with nothing cleared and nothing claimed", () => {
    const save = createEmptySave();

    expect(save.levelStars).toEqual({});
    expect(save.bestWave).toEqual({});
    expect(save.claimedClear).toEqual([]);
    expect(save.claimedThreeStars).toEqual([]);
  });

  it("does not carry a character list any more", () => {
    // 能用哪些角色由扭蛋收藏決定（useTowerRoster），不再存在這份存檔裡。
    expect(createEmptySave()).not.toHaveProperty("availableCharacterIds");
  });
});

describe("normalizeSave", () => {
  it("falls back to an empty save for junk input", () => {
    expect(normalizeSave(null)).toEqual(createEmptySave());
    expect(normalizeSave("nope")).toEqual(createEmptySave());
    expect(normalizeSave(42)).toEqual(createEmptySave());
  });

  it("keeps valid stars and clamps out-of-range ones", () => {
    const save = normalizeSave({
      levelStars: { [LEVEL_A]: 2, [LEVEL_B]: 99 },
    });

    expect(save.levelStars[LEVEL_A]).toBe(2);
    expect(save.levelStars[LEVEL_B]).toBe(3);
  });

  it("drops stars for levels that no longer exist", () => {
    const save = normalizeSave({ levelStars: { "deleted-level": 3 } });

    expect(save.levelStars["deleted-level"]).toBeUndefined();
  });



  it("clamps a best wave to the number of waves the level actually has", () => {
    const save = normalizeSave({ bestWave: { [LEVEL_A]: 9999 } });

    expect(save.bestWave[LEVEL_A]).toBe(LEVELS[0].waves.length);
  });

  it("ignores nonsense wave numbers", () => {
    const save = normalizeSave({
      bestWave: { [LEVEL_A]: -3, [LEVEL_B]: Number.NaN },
    });

    expect(save.bestWave[LEVEL_A]).toBeUndefined();
    expect(save.bestWave[LEVEL_B]).toBeUndefined();
  });

});

/**
 * 合併是這套存檔的核心：進度只會往前，所以兩台裝置的紀錄可以逐欄取好的那個，
 * 不需要「誰比較新誰贏」——那會讓其中一台的進度整份消失。
 */
describe("mergeSaves", () => {
  it("keeps the better star rating from either side", () => {
    const merged = mergeSaves(
      makeSave({ levelStars: { [LEVEL_A]: 3, [LEVEL_B]: 1 } }),
      makeSave({ levelStars: { [LEVEL_A]: 1, [LEVEL_B]: 2 } }),
    );

    expect(merged.levelStars[LEVEL_A]).toBe(3);
    expect(merged.levelStars[LEVEL_B]).toBe(2);
  });



  it("keeps the furthest wave from either side", () => {
    const merged = mergeSaves(
      makeSave({ bestWave: { [LEVEL_A]: 12 } }),
      makeSave({ bestWave: { [LEVEL_A]: 4, [LEVEL_B]: 6 } }),
    );

    expect(merged.bestWave[LEVEL_A]).toBe(12);
    expect(merged.bestWave[LEVEL_B]).toBe(6);
  });


});

/**
 * 領獎紀錄決定「這一關的代幣還能不能再拿」，所以它的合併與清洗
 * 跟星數一樣重要——弄錯就是重複發錢或該給沒給。
 */
describe("claimed reward records", () => {
  it("starts empty", () => {
    const save = createEmptySave();

    expect(save.claimedClear).toEqual([]);
    expect(save.claimedThreeStars).toEqual([]);
  });

  it("keeps records for levels that still exist", () => {
    const save = normalizeSave({
      claimedClear: [LEVEL_A, LEVEL_B],
      claimedThreeStars: [LEVEL_A],
    });

    expect(save.claimedClear).toEqual([LEVEL_A, LEVEL_B]);
    expect(save.claimedThreeStars).toEqual([LEVEL_A]);
  });

  it("drops records for levels that no longer exist", () => {
    const save = normalizeSave({ claimedClear: ["deleted-level", LEVEL_A] });

    expect(save.claimedClear).toEqual([LEVEL_A]);
  });

  it("ignores junk instead of throwing", () => {
    const save = normalizeSave({ claimedClear: "nope", claimedThreeStars: [7, null] });

    expect(save.claimedClear).toEqual([]);
    expect(save.claimedThreeStars).toEqual([]);
  });

  it("never lists the same level twice", () => {
    const save = normalizeSave({ claimedClear: [LEVEL_A, LEVEL_A] });

    expect(save.claimedClear).toEqual([LEVEL_A]);
  });

  it("unions on merge, so a reward stays claimed on every device", () => {
    const merged = mergeSaves(
      makeSave({ claimedClear: [LEVEL_A] }),
      makeSave({ claimedClear: [LEVEL_B], claimedThreeStars: [LEVEL_A] }),
    );

    expect(merged.claimedClear.sort()).toEqual([LEVEL_A, LEVEL_B].sort());
    expect(merged.claimedThreeStars).toEqual([LEVEL_A]);
  });
});

describe("local cache", () => {
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    storage = makeStorage();
  });

  it("keeps each account's progress under its own key", () => {
    expect(getCacheKey("uid-a")).not.toBe(getCacheKey("uid-b"));
  });

  it("stores signed-out progress under a guest key", () => {
    expect(getCacheKey(null)).toContain("guest");
  });

  it("round-trips a save", () => {
    const save = makeSave({ levelStars: { [LEVEL_A]: 2 } });
    writeCache("uid-a", save, storage);

    expect(readCache("uid-a", storage)?.levelStars[LEVEL_A]).toBe(2);
  });

  it("returns null when nothing has been written yet", () => {
    expect(readCache("uid-a", storage)).toBeNull();
  });

  it("survives a corrupted cache entry instead of throwing", () => {
    storage.setItem(getCacheKey("uid-a"), "{not json");

    expect(readCache("uid-a", storage)).toBeNull();
  });

  it("merges on write, so a second tab cannot clobber the first", () => {
    writeCache("uid-a", makeSave({ levelStars: { [LEVEL_A]: 3 } }), storage);
    // 另一個分頁只知道第二關的進度，對第一關一無所知。
    writeCache("uid-a", makeSave({ levelStars: { [LEVEL_B]: 1 } }), storage);

    const cached = readCache("uid-a", storage);
    expect(cached?.levelStars[LEVEL_A]).toBe(3);
    expect(cached?.levelStars[LEVEL_B]).toBe(1);
  });

  it("keeps one account's progress out of another's", () => {
    writeCache("uid-a", makeSave({ levelStars: { [LEVEL_A]: 3 } }), storage);

    expect(readCache("uid-b", storage)?.levelStars[LEVEL_A]).toBeUndefined();
  });

  it("still returns the merged save when storage refuses to write", () => {
    const readOnly: SaveStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
    };

    const merged = writeCache(
      "uid-a",
      makeSave({ levelStars: { [LEVEL_A]: 1 } }),
      readOnly,
    );

    expect(merged.levelStars[LEVEL_A]).toBe(1);
  });

  it("works when there is no storage at all", () => {
    expect(readCache("uid-a", null)).toBeNull();
    expect(() => writeCache("uid-a", createEmptySave(), null)).not.toThrow();
  });
});
