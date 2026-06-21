import test from "node:test";
import assert from "node:assert/strict";

import {
  WORD_RUNNER_BEST_SCORE_KEY,
  buildWordRunnerRounds,
  compactRunnerText,
  getWordRunnerBestScore,
  setWordRunnerBestScore,
  shouldStartWordRunnerGame,
} from "../src/components/LittleGames/kaplay-runner/wordRunnerData.ts";
import {
  scheduleKaplayInit,
  startKaplaySceneWhenReady,
} from "../src/components/LittleGames/kaplay-runner/kaplayLifecycle.ts";
import type { GameWord } from "../src/services/gameService.ts";

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

const sampleWords: GameWord[] = [
  { word: "brave", def: "勇敢的", emoji: "🛡️" },
  { word: "curious", def: "好奇的", emoji: "🔎" },
  { word: "gentle", def: "溫柔的", emoji: "🌿" },
  { word: "patient", def: "有耐心的", emoji: "⏳" },
  { word: "clever", def: "聰明的", emoji: "💡" },
];

test("builds vocabulary runner rounds with one unique correct option each", () => {
  const rounds = buildWordRunnerRounds(sampleWords, 4);

  assert.equal(rounds.length, 4);

  for (const round of rounds) {
    assert.ok(round.prompt.length > 0);
    assert.equal(round.options.length, 3);
    assert.equal(new Set(round.options.map((option) => option.id)).size, 3);
    assert.equal(
      round.options.filter((option) => option.id === round.correctOptionId)
        .length,
      1,
    );
    assert.ok(
      round.options.some(
        (option) =>
          option.id === round.correctOptionId &&
          option.kind === "correct" &&
          option.word === round.prompt,
      ),
    );
  }
});

test("filters incomplete words before building runner rounds", () => {
  const rounds = buildWordRunnerRounds(
    [
      { word: "  ", def: "空白", emoji: "x" },
      { word: "valid", def: "有效的", emoji: "✅" },
      { word: "missing-def", def: "", emoji: "x" },
      { word: "steady", def: "穩定的", emoji: "⚓" },
      { word: "bright", def: "明亮的", emoji: "✨" },
    ],
    2,
  );

  assert.equal(rounds.length, 2);
  assert.ok(rounds.every((round) => round.prompt.length > 0));
  assert.ok(
    rounds.every((round) =>
      round.options.every((option) => option.word !== "missing-def"),
    ),
  );
});

test("uses fallback words when caller has no usable vocabulary", () => {
  const rounds = buildWordRunnerRounds([], 5);

  assert.equal(rounds.length, 5);
  assert.ok(rounds.every((round) => round.options.length === 3));
  assert.ok(rounds.some((round) => round.prompt === "Magnificent"));
});

test("reads and writes word runner best score safely", () => {
  const storage = createMemoryStorage({
    [WORD_RUNNER_BEST_SCORE_KEY]: "not-a-number",
  });

  assert.equal(getWordRunnerBestScore(storage), 0);

  setWordRunnerBestScore(1250, storage);

  assert.equal(storage.getItem(WORD_RUNNER_BEST_SCORE_KEY), "1250");
  assert.equal(getWordRunnerBestScore(storage), 1250);
});

test("does not lower an existing best score", () => {
  const storage = createMemoryStorage({
    [WORD_RUNNER_BEST_SCORE_KEY]: "300",
  });

  setWordRunnerBestScore(200, storage);

  assert.equal(getWordRunnerBestScore(storage), 300);
});

test("starts the runner scene immediately when KAPLAY assets are already loaded", () => {
  const calls: string[] = [];

  startKaplaySceneWhenReady({
    loadProgress: () => 1,
    onLoad: () => {
      calls.push("onLoad");
    },
    go: (scene) => {
      calls.push(`go:${scene}`);
    },
  });

  assert.deepEqual(calls, ["go:runner"]);
});

test("cancels deferred KAPLAY initialization before creating an instance", () => {
  const calls: string[] = [];
  const tasks: Array<() => void> = [];
  const cancelledTaskIds = new Set<number>();

  const cancel = scheduleKaplayInit(
    () => {
      calls.push("create");
    },
    {
      setTimeout: (task) => {
        tasks.push(task);
        return tasks.length - 1;
      },
      clearTimeout: (taskId) => {
        cancelledTaskIds.add(taskId);
      },
    },
  );

  cancel();
  tasks.forEach((task, taskId) => {
    if (!cancelledTaskIds.has(taskId)) task();
  });

  assert.deepEqual(calls, []);
});

test("waits for authenticated vocabulary before mounting the runner host", () => {
  assert.equal(
    shouldStartWordRunnerGame({ hasUser: true, vocabularyReady: false }),
    false,
  );
  assert.equal(
    shouldStartWordRunnerGame({ hasUser: true, vocabularyReady: true }),
    true,
  );
  assert.equal(
    shouldStartWordRunnerGame({ hasUser: false, vocabularyReady: false }),
    true,
  );
});

test("compacts long runner text for the in-canvas HUD", () => {
  const compacted = compactRunnerText(
    "某事物被設計用來執行的特別用途或工作（功能）。",
    18,
  );

  assert.equal(compactRunnerText("短提示", 18), "短提示");
  assert.ok(compacted.endsWith("…"));
  assert.ok(Array.from(compacted).length <= 18);
});
