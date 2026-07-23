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
import { PETS, STARTER_PET_IDS } from "./data/pets";

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
const REWARD_PET = LEVELS[0].unlocksOnClear[0];

describe("createEmptySave", () => {
  it("starts with the starter pets and nothing else", () => {
    const save = createEmptySave();

    expect(save.unlockedPetIds).toEqual(STARTER_PET_IDS);
    expect(save.levelStars).toEqual({});
    expect(save.bestWave).toEqual({});
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

  it("drops pets that no longer exist but keeps the real ones", () => {
    const save = normalizeSave({
      unlockedPetIds: [REWARD_PET, "ghost-pet", 7, null],
    });

    expect(save.unlockedPetIds).toContain(REWARD_PET);
    expect(save.unlockedPetIds).not.toContain("ghost-pet");
  });

  it("always re-adds the starters, even if the save dropped them", () => {
    const save = normalizeSave({ unlockedPetIds: [] });

    for (const starter of STARTER_PET_IDS) {
      expect(save.unlockedPetIds).toContain(starter);
    }
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

  it("survives a save whose fields are all the wrong type", () => {
    const save = normalizeSave({
      levelStars: "nope",
      unlockedPetIds: "nope",
      bestWave: 5,
      updatedAt: "yesterday",
    });

    expect(save).toEqual(createEmptySave());
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

  it("unions the unlocked pets so neither device loses one", () => {
    const laptop = makeSave({
      unlockedPetIds: [...STARTER_PET_IDS, REWARD_PET],
    });
    const tablet = makeSave({
      unlockedPetIds: [...STARTER_PET_IDS, PETS[20].id],
    });

    const merged = mergeSaves(laptop, tablet);

    expect(merged.unlockedPetIds).toContain(REWARD_PET);
    expect(merged.unlockedPetIds).toContain(PETS[20].id);
  });

  it("never duplicates a pet that both sides had", () => {
    const merged = mergeSaves(createEmptySave(), createEmptySave());

    expect(merged.unlockedPetIds).toHaveLength(
      new Set(merged.unlockedPetIds).size,
    );
  });

  it("keeps the furthest wave from either side", () => {
    const merged = mergeSaves(
      makeSave({ bestWave: { [LEVEL_A]: 12 } }),
      makeSave({ bestWave: { [LEVEL_A]: 4, [LEVEL_B]: 6 } }),
    );

    expect(merged.bestWave[LEVEL_A]).toBe(12);
    expect(merged.bestWave[LEVEL_B]).toBe(6);
  });

  it("does not care which way round the two saves are given", () => {
    const a = makeSave({
      levelStars: { [LEVEL_A]: 3 },
      bestWave: { [LEVEL_B]: 9 },
    });
    const b = makeSave({
      levelStars: { [LEVEL_B]: 2 },
      unlockedPetIds: [...STARTER_PET_IDS, REWARD_PET],
    });

    expect(mergeSaves(a, b)).toEqual(mergeSaves(b, a));
  });

  it("changes nothing when a save is merged with itself", () => {
    const save = makeSave({
      levelStars: { [LEVEL_A]: 2 },
      bestWave: { [LEVEL_A]: 7 },
      unlockedPetIds: [...STARTER_PET_IDS, REWARD_PET],
    });

    expect(mergeSaves(save, save)).toEqual(save);
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
