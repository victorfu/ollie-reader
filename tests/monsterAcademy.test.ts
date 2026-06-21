import test from "node:test";
import assert from "node:assert/strict";

import {
  MONSTER_ACADEMY_BEST_KEY,
  MONSTER_ACADEMY_SAVE_KEY,
  applyBattleAction,
  buildMonsterAcademyChapter,
  clearMonsterAcademySave,
  createInitialBattleState,
  getMonsterAcademyBest,
  getMonsterAcademySave,
  setMonsterAcademyBest,
  setMonsterAcademySave,
} from "../src/components/LittleGames/monster-academy/monsterAcademyData.ts";

function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));

  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

test("builds a complete first chapter with three battles and one boss", () => {
  const chapter = buildMonsterAcademyChapter();

  assert.equal(chapter.id, "crystal-bell-trial");
  assert.equal(chapter.battles.length, 4);
  assert.equal(chapter.battles.filter((battle) => battle.kind === "boss").length, 1);
  assert.deepEqual(
    chapter.battles.map((battle) => battle.enemyId),
    ["glimmer-puff", "riddle-moth", "echo-drake", "muddlefox"],
  );
});

test("starts battle state from the selected enemy stats", () => {
  const chapter = buildMonsterAcademyChapter();
  const battle = createInitialBattleState(chapter.battles[0]);

  assert.equal(battle.enemy.id, "glimmer-puff");
  assert.equal(battle.playerHp, 5);
  assert.equal(battle.enemyHp, battle.enemy.maxHp);
  assert.equal(battle.combo, 0);
  assert.equal(battle.status, "active");
});

test("applies attack, magic, item, and run actions", () => {
  const chapter = buildMonsterAcademyChapter();
  const battle = createInitialBattleState(chapter.battles[3]);

  const afterAttack = applyBattleAction(battle, "attack");
  assert.equal(afterAttack.enemyHp, battle.enemyHp - 1);
  assert.equal(afterAttack.combo, 1);

  const afterMagic = applyBattleAction(afterAttack, "magic");
  assert.equal(afterMagic.enemyHp, Math.max(0, afterAttack.enemyHp - 2));

  const damaged = { ...afterMagic, playerHp: 3 };
  const afterItem = applyBattleAction(damaged, "item");
  assert.equal(afterItem.playerHp, 4);

  const withoutItems = applyBattleAction({ ...afterItem, items: 0 }, "item");
  assert.equal(withoutItems.playerHp, afterItem.playerHp);
  assert.equal(withoutItems.items, 0);

  const afterRun = applyBattleAction(afterItem, "run");
  assert.equal(afterRun.status, "fled");
});

test("triggers an Ollie assist after three offensive actions", () => {
  const bossBattle = createInitialBattleState(buildMonsterAcademyChapter().battles[3]);

  const first = applyBattleAction(bossBattle, "attack");
  const second = applyBattleAction(first, "attack");
  const third = applyBattleAction(second, "attack");

  assert.equal(third.combo, 0);
  assert.equal(third.enemyHp, bossBattle.enemyHp - 4);
  assert.equal(third.lastEvent, "ollie-assist");
});

test("stores save data and best stars safely", () => {
  const storage = createMemoryStorage({
    [MONSTER_ACADEMY_SAVE_KEY]: "not-json",
    [MONSTER_ACADEMY_BEST_KEY]: "bad-score",
  });

  assert.equal(getMonsterAcademySave(storage), null);
  assert.equal(getMonsterAcademyBest(storage), 0);

  const save = {
    chapterId: "crystal-bell-trial",
    battleIndex: 2,
    stars: 7,
    unlockedAt: "2026-06-21T00:00:00.000Z",
  };

  setMonsterAcademySave(save, storage);
  setMonsterAcademyBest(9, storage);
  setMonsterAcademyBest(4, storage);

  assert.deepEqual(getMonsterAcademySave(storage), save);
  assert.equal(getMonsterAcademyBest(storage), 9);

  clearMonsterAcademySave(storage);

  assert.equal(storage.getItem(MONSTER_ACADEMY_SAVE_KEY), null);
});
