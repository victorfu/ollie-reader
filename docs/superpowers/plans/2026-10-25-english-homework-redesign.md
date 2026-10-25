# 英文功課（單字練習重新設計）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/word-practice` 從六步驟功課改成「英文作業簿」：每個新字一頁（看字、抄寫 3 遍、默寫、造詞、造句），接著聽寫（新字＋到期複習字），寫錯的字訂正，交作業後由家長看造詞造句；整個流程不呼叫 Gemini。

**Architecture:** 純函式層新增兩個檔案：`reviewSchedule.ts`（複習排程與舊資料轉換）和 `homeworkFlow.ts`（目前該做哪一格、本地檢查、聽寫計分），取代 `homeworkProgress.ts`。`wordPracticeStorage.ts` 改寫成第 2 版的文件格式，並保留讀取舊版已完成功課的能力；`wordPracticeService.ts` 只剩離線選字與快照，刪除 `wordPracticeAi.ts`。`useWordPractice` 沿用現有的進度存檔佇列，改成新的進度形狀。畫面是一條直線：首頁卡片 → 作業簿（生字頁 → 聽寫 → 訂正 → 交作業）→ 寫完畫面。

**Tech Stack:** React 19、TypeScript 5.9（strict）、Vite 7、Vitest（jsdom）、Firebase 12（Firestore）、Tailwind 4 + DaisyUI 5、lucide-react。

**Spec:** `docs/superpowers/specs/2026-10-25-english-homework-redesign-design.md`（執行者必須同時讀 spec；舊版 spec `2026-10-19-word-practice-homework-design.md` 的 §5 詞表查表仍然有效）

## Global Constraints

- 整個單字練習（產生功課、寫功課、交作業）**不呼叫 Gemini**；`src/services/wordPracticeAi.ts` 刪除。
- 說明文字用繁體中文；單字、例句、造詞造句是英文。看字段落同時顯示英文解釋（含詞性）和中文解釋。
- Ollie 的畫面上不出現 CEFR、字數等設定；設定在頁面底部收合的「家長設定」。
- 份量預設：新字 5 個（可設 3–10）、複習上限 10 個（可設 0–20）、起始等級 A1；存在 state 文件的 `settings`。
- 抄寫 3 遍（`COPY_TARGET = 3`）、默寫打對 1 遍、訂正 3 遍（`CORRECTION_TARGET = 3`）。
- 造詞：要用到這個字（`sentenceUsesWord`），總共 2–5 個英文字；造句：要用到這個字，至少 4 個英文字。
- 複習間隔（天）：`[1, 3, 7, 14, 30]`，stage 1–5；stage 5 寫對後維持 stage 5、30 天後到期。
- 聽寫唸法：單字 → 例句 → 單字；沒有例句時唸單字兩次。每題只寫一次，作答時不顯示對錯。語音失敗可重試或跳過，跳過不算對也不算錯。
- 所有作答輸入框：`spellCheck={false}`、`autoComplete="off"`、`autoCorrect="off"`、`autoCapitalize="off"`，Enter 送出（沿用 `AnswerInput`）。
- 答案比對沿用 `isAnswerCorrect`（大小寫、前後空白、彎直引號不算錯）。
- Firestore 只用 `users/{uid}/wordHomeworks/{homeworkId}` 與 `users/{uid}/wordPractice/state`；新功課文件有 `version: 2`；state 文件轉換後有 `schemaVersion: 2`。
- 不改 `vocabulary` collection 的結構；聽寫結果用既有的 `updateReviewStats(wordId, remembered)` 累加複習統計。
- 設計規範依 `AGENTS.md`：macOS HIG、hairline 邊框、淺色／深色、觸控目標 44px。

## Review Focus

- **只有複習字、沒有新字**：生詞本的字都練過，但有到期的複習字時，要能產生「只有聽寫」的功課，並直接從聽寫開始。測試在 Task 4 與 Task 3。
- **語音完全不能用**：每一題都跳過時，訂正為空、可以交作業，所有字的排程不變、不呼叫 `updateReviewStats`。測試在 Task 3 與 Task 5。
- **重新整理不洩漏答案**：聽寫做到一半重新整理，已作答的題目不顯示答案或對錯，從第一個未作答的題目接續。測試在 Task 8。
- **片語的抄寫與聽寫**：`look forward to` 打成 `Look  forward to` 算對；默寫時英文解釋裡的 `look forward to` 也被遮住。測試在 Task 7。
- **複習字已從生詞本刪除**：產生功課時這個字不放進聽寫，排程不變（下次仍到期）。測試在 Task 4。

---

## 檔案結構

| 檔案 | 動作 | 責任 |
|---|---|---|
| `src/types/wordPractice.ts` | 改寫 | 第 2 版型別；保留 `LegacyHomework` 給歷史紀錄 |
| `src/utils/reviewSchedule.ts` | 新增 | 間隔、聽寫結果套用、到期挑選、舊 state 轉換 |
| `src/utils/homeworkFlow.ts` | 新增（取代 `homeworkProgress.ts`） | 目前位置、造詞造句本地檢查、聽寫計分 |
| `src/services/wordPracticeSelection.ts` | 修改 | 以 `stage`／`needsPractice` 選新字 |
| `src/services/wordPracticeService.ts` | 改寫 | 離線產生功課（新字快照、複習字快照、例句） |
| `src/services/wordPracticeStorage.ts` | 改寫 | state 正規化與轉換、設定、v2 功課存取、完成功課 |
| `src/services/wordPracticeAi.ts`（＋test） | 刪除 | — |
| `src/services/geminiClient.ts` | 修改 | 移除 `cefr_estimate`、`example_sentence`、`sentence_feedback` 三個 action |
| `src/hooks/useWordPractice.ts` | 改寫 | 頁面狀態、存檔佇列、開始／交作業／放棄／設定 |
| `src/components/WordPractice/*` | 改寫＋新增 | `WordPracticePage`、`TodayCard`、`ParentSettings`、`HomeworkBook`、`WordPage`、`CopyBoxes`、`DictationStep`、`CorrectionStep`、`FinishedView`、`HomeworkHistory` |
| `src/components/WordPractice/steps/*`、`HomeworkOverview`、`GenerateHomeworkPanel`、`HomeworkResult`、`stepTypes` | 刪除 | — |
| `README.md` | 修改 | Features 表的 Word Practice 列與專案結構 |

---

### Task 1: 第 2 版型別與複習排程

**Files:**
- Modify: `src/types/wordPractice.ts`
- Create: `src/utils/reviewSchedule.ts`
- Test: `src/utils/reviewSchedule.test.ts`

**Interfaces:**
- Produces（型別，`src/types/wordPractice.ts`）：
  ```ts
  export type ReviewStage = 0 | 1 | 2 | 3 | 4 | 5;
  export interface WordPracticeWordState {
    stage: ReviewStage;
    dueAt?: number;            // ms；stage >= 1 才有
    needsPractice?: boolean;   // 聽寫寫錯、還沒重新聽寫寫對
    lastResult?: "correct" | "wrong";
    sentence?: string;         // 這個字在以前功課快照裡的例句
    learnedAt?: number; missCount: number; lastMissedAt?: number; // 只作紀錄
  }
  export interface PracticeSettings { newWordCount: number; reviewLimit: number; startLevel: CefrLevel }
  export interface WordPracticeState {
    schemaVersion: 2;
    activeHomeworkId: string | null;
    words: Record<string, WordPracticeWordState>;
    cefrEstimates: Record<string, CefrLevel>;
    settings: PracticeSettings;
  }
  export interface HomeworkWord {
    key: string; vocabularyId: string; word: string; emoji?: string;
    definitions: { partOfSpeech: string; definition: string; definitionChinese?: string }[];
    sentence: string | null; cefr: CefrInfo | null;
  }
  export type PageSection = "look" | "copy" | "recall" | "phrase" | "sentence" | "done";
  export interface WordPageProgress { section: PageSection; copies: number; phrase: string | null; sentence: string | null }
  export interface DictationItem { key: string; source: "new" | "review"; answer: string | null; skipped: boolean }
  export interface HomeworkProgress { pages: WordPageProgress[]; dictation: DictationItem[]; corrections: Record<string, number> }
  export interface DictationResult { correctKeys: string[]; wrongKeys: string[]; skippedKeys: string[]; correctCount: number; total: number }
  export interface Homework extends HomeworkProgress {
    version: 2; id: string; status: HomeworkStatus; createdAt: number; completedAt?: number;
    newWords: HomeworkWord[];     // pages 與它同順序
    reviewWords: HomeworkWord[];
    result?: DictationResult;
  }
  /** 舊版已完成的功課，只用來在紀錄裡顯示日期與分數。 */
  export interface LegacyHomework { id: string; status: HomeworkStatus; createdAt: number; completedAt?: number;
    words: { key: string; word: string }[]; result?: { correctCount: number; total: number } }
  export type HistoryHomework = Homework | LegacyHomework;
  ```
  `CefrLevel`、`CefrInfo`、`HomeworkStatus`、`Cloze`（`wordForms.ts` 仍在用）保留；其餘舊型別（`HomeworkOptions`、`HomeworkWordProgress`、`ExerciseProgress`、`SentenceFeedback`、`HomeworkResult`）刪除，由後面的任務一併移除引用。
- Produces（`src/utils/reviewSchedule.ts`）：
  - `REVIEW_INTERVAL_DAYS: readonly number[] = [1, 3, 7, 14, 30]`
  - `DEFAULT_SETTINGS: PracticeSettings = { newWordCount: 5, reviewLimit: 10, startLevel: "A1" }`
  - `applyDictationOutcome(previous: WordPracticeWordState | undefined, outcome: "correct" | "wrong" | "skipped", now: number): WordPracticeWordState`
  - `dueReviewKeys(words: Record<string, WordPracticeWordState>, now: number, limit: number): string[]`
  - `migrateWordState(legacy: { learnedAt?: number; missCount?: number; lastMissedAt?: number }, now: number): WordPracticeWordState`

- [ ] **Step 1: Write the failing tests** in `src/utils/reviewSchedule.test.ts`

```ts
const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

it("moves a new word to stage 1, due one day later, when written correctly", () => {
  expect(applyDictationOutcome(undefined, "correct", NOW)).toMatchObject({
    stage: 1, dueAt: NOW + DAY, lastResult: "correct", learnedAt: NOW, missCount: 0,
  });
});

it("steps through 1, 3, 7, 14 and 30 days and stays at stage 5", () => {
  let state = applyDictationOutcome(undefined, "correct", NOW);
  const gaps = [];
  for (let i = 0; i < 5; i++) {
    state = applyDictationOutcome(state, "correct", NOW);
    gaps.push((state.dueAt! - NOW) / DAY);
  }
  expect(gaps).toEqual([3, 7, 14, 30, 30]);
  expect(state.stage).toBe(5);
});

it("sends a wrong word back to stage 0 to be practised again", () => {
  const reviewing = { stage: 3, dueAt: NOW, missCount: 1, learnedAt: 1 } as const;
  expect(applyDictationOutcome(reviewing, "wrong", NOW)).toEqual({
    stage: 0, needsPractice: true, lastResult: "wrong", learnedAt: 1, missCount: 2, lastMissedAt: NOW,
  });
});

it("clears needsPractice only when the word is written correctly", () => {
  const missed = { stage: 0, needsPractice: true, missCount: 1 } as const;
  expect(applyDictationOutcome(missed, "correct", NOW).needsPractice).toBeUndefined();
});

it("leaves a skipped word exactly as it was", () => {
  const reviewing = { stage: 2, dueAt: NOW - DAY, missCount: 0 } as const;
  expect(applyDictationOutcome(reviewing, "skipped", NOW)).toEqual(reviewing);
});

it("picks due words, earliest first, up to the limit", () => {
  const words = {
    later: { stage: 1, dueAt: NOW + 1, missCount: 0 },
    old: { stage: 2, dueAt: NOW - 2 * DAY, missCount: 0 },
    recent: { stage: 1, dueAt: NOW - DAY, missCount: 0 },
    fresh: { stage: 0, missCount: 0 },
  } as const;
  expect(dueReviewKeys(words, NOW, 10)).toEqual(["old", "recent"]);
  expect(dueReviewKeys(words, NOW, 1)).toEqual(["old"]);
  expect(dueReviewKeys(words, NOW, 0)).toEqual([]);
});

it("turns a learned legacy word into a stage 1 word due now", () => {
  expect(migrateWordState({ learnedAt: 5, missCount: 1, lastMissedAt: 3 }, NOW)).toEqual({
    stage: 1, dueAt: NOW, learnedAt: 5, missCount: 1, lastMissedAt: 3,
  });
});

it("turns a missed legacy word into a word to practise first", () => {
  expect(migrateWordState({ missCount: 2, lastMissedAt: 3 }, NOW)).toEqual({
    stage: 0, needsPractice: true, missCount: 2, lastMissedAt: 3,
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/utils/reviewSchedule.test.ts` — Expected: FAIL（模組不存在）。

- [ ] **Step 3: 改寫 `src/types/wordPractice.ts`，實作 `src/utils/reviewSchedule.ts`。** 規則：
  - `correct`：`stage = min(previous.stage + 1, 5)`（undefined 視為 stage 0、`missCount: 0`）；`dueAt = now + REVIEW_INTERVAL_DAYS[stage - 1] * DAY`；刪除 `needsPractice`；`lastResult: "correct"`；`learnedAt` 沒有才設成 `now`；保留 `sentence`、`missCount`、`lastMissedAt`。
  - `wrong`：`stage: 0`，刪除 `dueAt`，`needsPractice: true`，`lastResult: "wrong"`，`missCount + 1`，`lastMissedAt: now`。
  - `skipped`：原樣回傳（undefined 回傳 `{ stage: 0, missCount: 0 }`）。
  - `dueReviewKeys`：`stage >= 1 && dueAt <= now`，依 `dueAt` 由小到大、相同時依 key 排序，取前 `limit` 個。
  - 回傳物件不含值為 `undefined` 的欄位（Firestore 會拒絕）。
  - 這一步會讓其他引用舊型別的檔案編譯失敗，屬預期；Task 2–9 逐一修正。只跑這個測試檔。

- [ ] **Step 4: Run** `npx vitest run src/utils/reviewSchedule.test.ts` — Expected: PASS。

- [ ] **Step 5: Commit** `feat(word-practice): add review schedule and v2 homework types`

---

### Task 2: 作業簿規則（目前位置、本地檢查、計分）

**Files:**
- Create: `src/utils/homeworkFlow.ts`
- Delete: `src/utils/homeworkProgress.ts`（＋其 test）
- Test: `src/utils/homeworkFlow.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `Homework`、`HomeworkProgress`、`WordPageProgress`、`DictationResult`。
- Produces:
  - `COPY_TARGET = 3`、`CORRECTION_TARGET = 3`
  - `type HomeworkPosition = { phase: "page"; wordIndex: number; section: Exclude<PageSection, "done"> } | { phase: "dictation"; itemIndex: number } | { phase: "correction"; key: string } | { phase: "submit" }`
  - `currentPosition(hw: Pick<Homework, "pages" | "dictation" | "corrections">): HomeworkPosition`
  - `emptyPage(): WordPageProgress`（`{ section: "look", copies: 0, phrase: null, sentence: null }`）
  - `nextSection(section: PageSection): PageSection`（look → copy → recall → phrase → sentence → done）
  - `checkPhrase(text: string, word: string): "ok" | "missingWord" | "tooShort" | "tooLong"`
  - `checkSentence(text: string, word: string): "ok" | "missingWord" | "tooShort"`
  - `countEnglishWords(text: string): number`
  - `gradeDictation(hw: Pick<Homework, "newWords" | "reviewWords" | "dictation">): DictationResult`
  - `wordForKey(hw, key): HomeworkWord`（從 newWords 或 reviewWords 找）

- [ ] **Step 1: Write the failing tests** in `src/utils/homeworkFlow.test.ts`

```ts
it("starts at the first section of the first unfinished page", () => {
  expect(currentPosition({ pages: [done(), { ...emptyPage(), section: "recall" }], dictation: items(2), corrections: {} }))
    .toEqual({ phase: "page", wordIndex: 1, section: "recall" });
});
it("goes to the first unanswered dictation item once every page is done", () => {
  expect(currentPosition({ pages: [done()], dictation: [answered("a"), unanswered("b")], corrections: {} }))
    .toEqual({ phase: "dictation", itemIndex: 1 });
});
it("starts with dictation when the homework has no new words", () => {
  expect(currentPosition({ pages: [], dictation: [unanswered("a")], corrections: {} }))
    .toEqual({ phase: "dictation", itemIndex: 0 });
});
it("asks for corrections of wrong answers until each has 3 copies", () => {
  const hw = { pages: [], dictation: [answered("run", "rnu")], corrections: { run: 2 } };
  expect(currentPosition(withWords(hw, ["run"]))).toEqual({ phase: "correction", key: "run" });
  expect(currentPosition(withWords({ ...hw, corrections: { run: 3 } }, ["run"]))).toEqual({ phase: "submit" });
});
it("is ready to submit when every item was skipped", () => {
  expect(currentPosition({ pages: [], dictation: [skipped("a"), skipped("b")], corrections: {} })).toEqual({ phase: "submit" });
});
it("checks a phrase: the word, and 2 to 5 English words", () => {
  expect(checkPhrase("a curious cat", "curious")).toBe("ok");
  expect(checkPhrase("curious", "curious")).toBe("tooShort");
  expect(checkPhrase("a very very very curious cat", "curious")).toBe("tooLong");
  expect(checkPhrase("a funny cat", "curious")).toBe("missingWord");
  expect(checkPhrase("looking forward to it", "look forward to")).toBe("ok");
});
it("checks a sentence: the word, and at least 4 English words", () => {
  expect(checkSentence("The cat is curious.", "curious")).toBe("ok");
  expect(checkSentence("Curious cat.", "curious")).toBe("tooShort");
  expect(checkSentence("The cat is very funny.", "curious")).toBe("missingWord");
});
it("counts English words, ignoring punctuation and numbers", () => {
  expect(countEnglishWords("I don't know, 2 cats!")).toBe(4);
});
it("grades dictation: correct, wrong and skipped, ignoring case and spaces", () => {
  expect(gradeDictation(hwWith([["Apple", "apple "], ["river", "rivr"], ["moon", SKIP]]))).toEqual({
    correctKeys: ["apple"], wrongKeys: ["river"], skippedKeys: ["moon"], correctCount: 1, total: 2,
  });
});
```
（`done()`、`items()`、`answered()`、`unanswered()`、`skipped()`、`withWords()`、`hwWith()` 是測試檔內的小工具；`total` 不含跳過的題目。）

- [ ] **Step 2: Run** `npx vitest run src/utils/homeworkFlow.test.ts` — Expected: FAIL。

- [ ] **Step 3: 實作 `src/utils/homeworkFlow.ts`，刪除 `homeworkProgress.ts` 與其 test。**
  - 英文字：符合 `/[A-Za-z]+(?:['’][A-Za-z]+)*/g` 的片段（`don't` 算一個字）。
  - 用到這個字沿用 `sentenceUsesWord(text, word)`。
  - 計分沿用 `isAnswerCorrect`；跳過的題目不計入 `total`。
  - 訂正只針對 `wrongKeys`，依 `dictation` 的順序逐一要求。

- [ ] **Step 4: Run** `npx vitest run src/utils/homeworkFlow.test.ts` — Expected: PASS。

- [ ] **Step 5: Commit** `feat(word-practice): add homework book flow rules`

---

### Task 3: state 正規化、轉換與家長設定（儲存層前半）

**Files:**
- Modify: `src/services/wordPracticeStorage.ts`
- Test: `src/services/wordPracticeStorage.test.ts`（沿用檔內的 in-memory Firestore mock；刪除只測舊版行為的案例）

**Interfaces:**
- Consumes: Task 1 的 `migrateWordState`、`DEFAULT_SETTINGS`。
- Produces:
  - `loadPracticeState(uid: string, now?: number): Promise<WordPracticeState>`：讀到沒有 `schemaVersion: 2` 的文件時，在一個 transaction 裡轉換並寫回；如果 `activeHomeworkId` 指向沒有 `version: 2` 的進行中功課，同一個 transaction 把它標成 `abandoned` 並清掉指標。
  - `saveSettings(uid: string, settings: PracticeSettings): Promise<void>`：夾在範圍內（新字 3–10、複習 0–20、等級必須是 CEFR 等級，否則用預設值）。
  - `normalizeSettings(raw: unknown): PracticeSettings`（export，供測試）。
  - `saveCefrEstimates` 刪除。

- [ ] **Step 1: Write the failing tests**

```ts
it("converts a legacy state once and marks it schemaVersion 2", async () => {
  seed("users/u/wordPractice/state", { words: { apple: { learnedAt: 5, missCount: 0 }, rivr: { missCount: 1 } }, cefrEstimates: { "look up": "A2" } });
  const state = await loadPracticeState("u", NOW);
  expect(state.words.apple).toMatchObject({ stage: 1, dueAt: NOW });
  expect(state.words.rivr).toMatchObject({ stage: 0, needsPractice: true });
  expect(state.cefrEstimates).toEqual({ "look up": "A2" });
  expect(stored("users/u/wordPractice/state")).toMatchObject({ schemaVersion: 2 });
  await loadPracticeState("u", NOW + 1000);
  expect(stored("users/u/wordPractice/state").words.apple.dueAt).toBe(NOW); // not converted twice
});

it("abandons an active legacy homework while converting", async () => {
  seed("users/u/wordPractice/state", { activeHomeworkId: "old", words: {} });
  seed("users/u/wordHomeworks/old", { status: "active", createdAt: 1, words: [], progress: [] });
  const state = await loadPracticeState("u", NOW);
  expect(state.activeHomeworkId).toBeNull();
  expect(stored("users/u/wordHomeworks/old").status).toBe("abandoned");
});

it("uses default settings when none are stored", async () => {
  expect((await loadPracticeState("u", NOW)).settings).toEqual({ newWordCount: 5, reviewLimit: 10, startLevel: "A1" });
});

it("clamps settings into their ranges", () => {
  expect(normalizeSettings({ newWordCount: 50, reviewLimit: -3, startLevel: "Z9" }))
    .toEqual({ newWordCount: 10, reviewLimit: 0, startLevel: "A1" });
});

it("saves settings without touching the words", async () => {
  await loadPracticeState("u", NOW);
  await saveSettings("u", { newWordCount: 3, reviewLimit: 20, startLevel: "B1" });
  expect(stored("users/u/wordPractice/state").settings).toEqual({ newWordCount: 3, reviewLimit: 20, startLevel: "B1" });
});
```

- [ ] **Step 2: Run** `npx vitest run src/services/wordPracticeStorage.test.ts` — Expected: 新案例 FAIL。

- [ ] **Step 3: 實作。** `normalizeWordState` 讀 v2 欄位（`stage` 必須是 0–5 的整數，否則 0）；`normalizeState` 回傳 v2 形狀。轉換只在 `loadPracticeState` 發生；其他函式在 transaction 內讀 state 時，遇到未轉換的文件一律先套同一個轉換（共用一個 `toV2State(raw, now)`），避免寫回舊格式。

- [ ] **Step 4: Run** `npx vitest run src/services/wordPracticeStorage.test.ts` — Expected: 本任務的案例 PASS（Task 5 的案例此時可以先 skip）。

- [ ] **Step 5: Commit** `feat(word-practice): migrate practice state and store parent settings`

---

### Task 4: 選字與離線產生功課

**Files:**
- Modify: `src/services/wordPracticeSelection.ts`、`src/services/wordPracticeService.ts`
- Delete: `src/services/wordPracticeAi.ts`、`src/services/wordPracticeAi.test.ts`
- Modify: `src/services/geminiClient.ts`（移除三個 action 型別成員；`geminiClient.test.ts` 若有引用一併調整）
- Test: `src/services/wordPracticeSelection.test.ts`、`src/services/wordPracticeService.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `dueReviewKeys`、Task 2 的 `emptyPage`、Task 3 的 `loadPracticeState`、儲存層現有的 `createHomework` 與 `newHomeworkId`（Task 5 只改它們的型別；本任務的測試 mock 儲存層）。
- Produces:
  - `selectHomeworkWords({ words, state, levelOf, settings }: { words: VocabularyWord[]; state: WordPracticeState; levelOf: (w: VocabularyWord) => CefrInfo | null; settings: PracticeSettings }): VocabularyWord[]`
  - `generateHomework(uid: string, now?: number): Promise<{ status: "created"; homework: Homework } | { status: "empty" }>`（不再接受 `options` 和 `signal`）
  - `findExampleCloze` 保留。

- [ ] **Step 1: Write the failing tests**

```ts
// wordPracticeSelection.test.ts
it("only offers stage 0 words, needsPractice first", () => {
  const state = stateWith({ apple: { stage: 2, dueAt: 1, missCount: 0 }, river: { stage: 0, needsPractice: true, missCount: 1 } });
  expect(names(selectHomeworkWords({ words: book("apple", "cat", "river"), state, levelOf: listLevel, settings: S5 })))
    .toEqual(["river", "cat"]);
});
it("puts words without a level after every rated word", () => {
  expect(names(selectHomeworkWords({ words: book("look forward to", "cat"), state: EMPTY, levelOf: listLevel, settings: S5 })))
    .toEqual(["cat", "look forward to"]);
});
it("takes settings.newWordCount words", () => { /* 8 eligible, newWordCount 5 → 5 */ });

// wordPracticeService.test.ts
it("never calls Gemini", async () => { await generateHomework("u", NOW); expect(generateGeminiContent).not.toHaveBeenCalled(); });
it("snapshots English and Chinese definitions and the first example that contains the word", async () => {
  const { homework } = await created();
  expect(homework.newWords[0]).toMatchObject({ word: "river", sentence: "The river is long.",
    definitions: [{ partOfSpeech: "noun", definition: "a long flow of water", definitionChinese: "河流" }] });
});
it("falls back to a sentence kept in the practice state, then to none", async () => { /* state.words.x.sentence → 用它；都沒有 → null */ });
it("adds due review words to dictation, shuffled with the new words", async () => {
  const { homework } = await created({ due: ["apple", "moon"] });
  expect(homework.reviewWords.map((w) => w.key).sort()).toEqual(["apple", "moon"]);
  expect(homework.dictation.map((i) => i.key).sort()).toEqual(["apple", "cat", "moon", "river"]);
  expect(homework.pages).toHaveLength(2);
});
it("makes a dictation-only homework when there are review words but no new words", async () => {
  const { homework } = await created({ newWords: [], due: ["apple"] });
  expect(homework.newWords).toEqual([]);
  expect(homework.dictation).toEqual([{ key: "apple", source: "review", answer: null, skipped: false }]);
});
it("leaves out a due review word that was deleted from the vocabulary book", async () => {
  const { homework } = await created({ due: ["ghost"], book: ["cat"] });
  expect(homework.reviewWords).toEqual([]);
});
it("reports empty when there is nothing new and nothing due", async () => {
  expect(await generateHomework("u", NOW)).toEqual({ status: "empty" });
});
```

- [ ] **Step 2: Run** `npx vitest run src/services/wordPracticeSelection.test.ts src/services/wordPracticeService.test.ts` — Expected: FAIL。

- [ ] **Step 3: 實作。**
  - 選字：候選 = `isEligibleWord` 且 state 裡沒有、或 `stage === 0` 的字；`missed` 改看 `needsPractice`；起始等級改讀 `settings.startLevel`；字數讀 `settings.newWordCount`。
  - 等級：`resolveCefr(table, state.cefrEstimates, word)`，不再估計。
  - 複習字：`dueReviewKeys(state.words, now, settings.reviewLimit)`，排除這次已選為新字的 key，再到生詞本以 `practiceKey` 找對應記錄；找不到就略過（不寫任何東西）。
  - 例句：`findExampleCloze(word)?.sentence ?? state.words[key]?.sentence ?? null`。
  - 聽寫順序用 `shuffleArray`（`src/utils/arrayUtils.ts`）。
  - `pages = newWords.map(emptyPage)`、`corrections = {}`、`version: 2`。
  - 刪除 `fillMissingSentences`、`estimateMissingLevels`、`sentenceWithCloze`。

- [ ] **Step 4: Run** 同 Step 2 — Expected: PASS。再跑 `npx vitest run src/services/geminiClient.test.ts` — Expected: PASS。

- [ ] **Step 5: Commit** `feat(word-practice): pick words and build homework without Gemini`

---

### Task 5: 功課的存取與完成（儲存層後半）

**Files:**
- Modify: `src/services/wordPracticeStorage.ts`
- Test: `src/services/wordPracticeStorage.test.ts`

**Interfaces:**
- Consumes: Task 1 `applyDictationOutcome`；Task 2 `gradeDictation`、`wordForKey`。
- Produces:
  - `createHomework(uid, homework: Homework): Promise<void>`（沿用現有行為）
  - `getActiveHomework(uid): Promise<Homework | null>`（只回傳 `version === 2` 且 `active` 的功課）
  - `saveHomeworkProgress(uid, id, progress: HomeworkProgress): Promise<void>`（寫 `pages`、`dictation`、`corrections` 三個欄位）
  - `abandonHomework(uid, id)`（沿用）
  - `completeHomework(uid, id, now): Promise<{ homework: Homework; reviewUpdates: { vocabularyId: string; remembered: boolean }[] }>`
  - `listCompletedHomeworks(uid, max?): Promise<HistoryHomework[]>`

- [ ] **Step 1: Write the failing tests**

```ts
it("completes a homework and schedules every dictated word in one transaction", async () => {
  const { homework, reviewUpdates } = await completeHomework("u", "h1", NOW);
  expect(homework).toMatchObject({ status: "completed", completedAt: NOW, result: { correctKeys: ["apple"], wrongKeys: ["river"] } });
  expect(stored(STATE).words.apple).toMatchObject({ stage: 1, dueAt: NOW + DAY, sentence: "I ate an apple." });
  expect(stored(STATE).words.river).toMatchObject({ stage: 0, needsPractice: true });
  expect(stored(STATE).activeHomeworkId).toBeNull();
  expect(reviewUpdates).toEqual([{ vocabularyId: "v-apple", remembered: true }, { vocabularyId: "v-river", remembered: false }]);
});
it("changes no schedule and returns no updates when every item was skipped", async () => {
  const { reviewUpdates } = await completeHomework("u", "allSkipped", NOW);
  expect(reviewUpdates).toEqual([]);
  expect(stored(STATE).words).toEqual(wordsBefore);
});
it("returns an already completed homework unchanged, with no updates, when completed twice", async () => { /* 第二次呼叫不再改 state */ });
it("refuses to complete a homework that still has unanswered or uncorrected items", async () => {
  await expect(completeHomework("u", "unfinished", NOW)).rejects.toThrow();
});
it("lists completed homeworks of both versions, newest first", async () => {
  expect((await listCompletedHomeworks("u")).map((h) => h.id)).toEqual(["v2", "legacy"]);
});
it("ignores an active legacy homework when looking for the active one", async () => { /* 回傳 null */ });
```

- [ ] **Step 2: Run** `npx vitest run src/services/wordPracticeStorage.test.ts` — Expected: 新案例 FAIL。

- [ ] **Step 3: 實作。** `completeHomework` 只在 `currentPosition(homework).phase === "submit"` 時完成，否則 throw。寫對的字若有快照例句，存進 state 的 `sentence`（之後補例句用）。`reviewUpdates` 只含有 `vocabularyId` 且沒有被跳過的題目；第二次完成回傳 `reviewUpdates: []`，避免統計重複累加。

- [ ] **Step 4: Run** 同 Step 2 — Expected: 全部 PASS。

- [ ] **Step 5: Commit** `feat(word-practice): store v2 homework and complete it with review scheduling`

---

### Task 6: `useWordPractice` hook

**Files:**
- Modify: `src/hooks/useWordPractice.ts`
- Test: `src/hooks/useWordPractice.test.tsx`

**Interfaces:**
- Consumes: Task 3–5 的儲存與服務函式；`updateReviewStats`（`src/services/vocabularyService.ts`）。
- Produces:
  ```ts
  export interface UseWordPractice {
    status: "loading" | "ready" | "error";
    error: string | null;
    active: Homework | null;
    history: HistoryHomework[];
    settings: PracticeSettings;
    reviewDueCount: number;      // 從 state 算，min(到期數, settings.reviewLimit)
    starting: boolean;
    saveError: string | null;
    start(): Promise<"created" | "empty" | "failed">;
    updateProgress(next: HomeworkProgress): void;
    submit(): Promise<Homework | null>;
    abandon(): Promise<void>;
    saveSettings(next: PracticeSettings): Promise<void>;
    reload(): Promise<void>;
  }
  ```

- [ ] **Step 1: 改寫測試。** 保留現有 loading、reload、帳號切換、存檔佇列、unmount 後存檔、完成時等存檔的案例，改用新的進度形狀與函式名稱（`generate` → `start`、`finishTest` → `submit`）；刪除 `sentence retry` 整組。新增：

```ts
it("updates review stats for each graded word after submitting, without failing on errors", async () => {
  mocks.completeHomework.mockResolvedValue({ homework: completed, reviewUpdates: [{ vocabularyId: "a", remembered: true }, { vocabularyId: "b", remembered: false }] });
  mocks.updateReviewStats.mockRejectedValueOnce(new Error("quota"));
  await act(() => hook.current.submit());
  expect(mocks.updateReviewStats.mock.calls).toEqual([["a", true], ["b", false]]);
  expect(hook.current.error).toBeNull();
  expect(hook.current.history[0].id).toBe(completed.id);
});
it("shows the due review count capped by the review limit", async () => { /* 12 個到期、上限 10 → 10 */ });
it("saves settings and uses them for the home card", async () => { /* saveSettings 後 settings 更新 */ });
```

- [ ] **Step 2: Run** `npx vitest run src/hooks/useWordPractice.test.tsx` — Expected: FAIL。

- [ ] **Step 3: 實作。** 沿用 `ProgressTracker` 與 `queueSave`，`progress` 型別改為 `HomeworkProgress`。`load` 同時讀 state（拿 settings 與到期數）、進行中功課、紀錄。`submit` 先等存檔佇列，再 `completeHomework`，之後逐一呼叫 `updateReviewStats`（失敗只 `logger.error`），最後重新算 `reviewDueCount`。錯誤訊息沿用現有中文字串，`GENERATE_ERROR` 改為「準備功課失敗，請稍後再試」。

- [ ] **Step 4: Run** 同 Step 2 — Expected: PASS。

- [ ] **Step 5: Commit** `feat(word-practice): drive the homework book from useWordPractice`

---

### Task 7: 生字頁（看字、抄寫、默寫、造詞、造句）

**Files:**
- Create: `src/components/WordPractice/WordPage.tsx`、`src/components/WordPractice/CopyBoxes.tsx`
- Test: `src/components/WordPractice/WordPage.test.tsx`

**Interfaces:**
- Consumes: Task 2 的 `nextSection`、`COPY_TARGET`、`checkPhrase`、`checkSentence`；`AnswerInput`、`SpellingDiff`、`redactWordForms`（`wordForms.ts`）、`useSpeechState().speakAsync`。
- Produces:
  - `WordPage({ word, progress, index, total, onChange }: { word: HomeworkWord; progress: WordPageProgress; index: number; total: number; onChange: (next: WordPageProgress) => void })`
  - `CopyBoxes({ word, done, target, onCorrect }: { word: string; done: number; target: number; onCorrect: () => void })`：顯示 `target` 個格子，前 `done` 格已打對；目前那一格打錯時顯示 `SpellingDiff` 並清空。

- [ ] **Step 1: Write the failing tests**（沿用 `WordPracticePage.test.tsx` 的 createRoot＋act 寫法；mock `useSpeechState`）

```ts
it("shows the word, both definitions and the example while looking", () => {
  render(<WordPage word={RIVER} progress={page("look")} index={0} total={5} onChange={spy} />);
  expect(text()).toContain("river"); expect(text()).toContain("河流"); expect(text()).toContain("The river is long.");
});
it("counts a copy only when it is spelled right, marking the mistake otherwise", async () => {
  await type("rivr"); expect(spy).not.toHaveBeenCalled(); expect(diffShown()).toBe(true); expect(input().value).toBe("");
  await type("River "); expect(spy).toHaveBeenCalledWith({ ...page("copy"), copies: 1 });
});
it("moves on to recall after the third copy", async () => { /* copies 2 → 打對 → { section: "recall", copies: 3 } */ });
it("hides the word everywhere while recalling, including inside the definition", () => {
  render(<WordPage word={LOOK_FORWARD_TO} progress={page("recall")} … />);
  expect(text()).not.toMatch(/look forward to/i);
});
it("accepts a phrase recall typed with extra spaces", async () => { await type("Look  forward to"); expect(spy).toHaveBeenCalledWith(expect.objectContaining({ section: "phrase" })); });
it("explains in Chinese why a phrase is not accepted, without saving it", async () => {
  await type("river"); expect(text()).toContain("至少要 2 個英文字"); expect(spy).not.toHaveBeenCalled();
});
it("saves the sentence and finishes the page", async () => {
  await type("The river is very long."); expect(spy).toHaveBeenCalledWith(expect.objectContaining({ section: "done", sentence: "The river is very long." }));
});
it("shows finished sections as one-line summaries", () => { /* section "phrase" 時看得到「✓ 抄寫 3 遍」「✓ 默寫」 */ });
```

- [ ] **Step 2: Run** `npx vitest run src/components/WordPractice/WordPage.test.tsx` — Expected: FAIL。

- [ ] **Step 3: 實作。** 固定文案：
  - 段落標題：`看一看、聽一聽`、`照著打 3 遍`、`不看單字，聽發音打出來`、`造詞：用 {word} 寫一個短短的詞，例如 a curious cat`、`造句：用 {word} 寫一個完整的句子`。
  - 造詞造句提示：`missingWord` → `要用到「{word}」喔`；`tooShort`（造詞）→ `至少要 2 個英文字`；`tooLong` → `造詞最多 5 個英文字，長的可以留到造句`；`tooShort`（造句）→ `句子至少要 4 個英文字`。
  - 看字段落進入時自動 `speakAsync(word)` 一次（不帶 `reportErrors`），按「看完了」進入抄寫。
  - 默寫：解釋文字經 `redactWordForms(text, word, "____")`；打錯顯示 `SpellingDiff` 與正確拼法，清空後再打。
  - 一次只顯示目前段落；已完成段落顯示一行摘要。

- [ ] **Step 4: Run** 同 Step 2 — Expected: PASS。

- [ ] **Step 5: Commit** `feat(word-practice): add the word page of the homework book`

---

### Task 8: 聽寫、訂正、寫完畫面

**Files:**
- Create: `src/components/WordPractice/DictationStep.tsx`、`CorrectionStep.tsx`、`FinishedView.tsx`
- Test: `src/components/WordPractice/dictation.test.tsx`

**Interfaces:**
- Consumes: Task 2 的 `gradeDictation`、`wordForKey`、`CORRECTION_TARGET`；Task 7 的 `CopyBoxes`；`useSpeechState().speakAsync(text, { reportErrors: true })`。
- Produces:
  - `DictationStep({ homework, itemIndex, onChange }: { homework: Homework; itemIndex: number; onChange: (dictation: DictationItem[]) => void })`
  - `CorrectionStep({ homework, wordKey, onChange }: { homework: Homework; wordKey: string; onChange: (corrections: Record<string, number>) => void })`
  - `FinishedView({ homework, onBack, onAgain }: { homework: Homework; onBack: () => void; onAgain?: () => void })`

- [ ] **Step 1: Write the failing tests**

```ts
it("reads the word, the sentence and the word again", async () => { expect(speakAsync.mock.calls.map((c) => c[0])).toEqual(["river", "The river is long.", "river"]); });
it("reads the word twice when it has no sentence", async () => { expect(spoken()).toEqual(["moon", "moon"]); });
it("records the answer without saying whether it is right", async () => {
  await type("rivr"); expect(onChange).toHaveBeenCalledWith([{ key: "river", source: "new", answer: "rivr", skipped: false }, …]);
  expect(text()).not.toMatch(/正確|錯|correct/i);
});
it("offers to retry and to skip when speech fails", async () => {
  speakAsync.mockRejectedValue(new Error("x")); await flush();
  await click("跳過這題"); expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ key: "river", skipped: true })]);
});
it("never shows an earlier answer after a reload in the middle of dictation", () => {
  render(<DictationStep homework={withAnswers(["rivr", null])} itemIndex={1} … />);
  expect(text()).not.toContain("rivr"); expect(text()).not.toContain("river");
});
it("asks for three correct copies of a wrong word", async () => { /* CorrectionStep：打對一次 → onChange({ river: 1 }) */ });
it("lists each word's phrase and sentence for the parent", () => {
  render(<FinishedView homework={finished} onBack={noop} />);
  expect(text()).toContain("a long river"); expect(text()).toContain("The river is very long.");
  expect(text()).toContain("聽寫 1 / 2");
});
```

- [ ] **Step 2: Run** `npx vitest run src/components/WordPractice/dictation.test.tsx` — Expected: FAIL。

- [ ] **Step 3: 實作。** 播放邏輯從現有 `SpellingTestStep` 搬過來（取消、重聽、`failedPlayback`）。固定文案：`聽寫 {n} / {total}`、`再聽一次`、`播放失敗，再試一次`、`跳過這題`、`訂正：照著打 3 遍`、`寫完了！`、`聽寫 {correct} / {total}`、`造詞和造句（給家長看）`。寫完畫面可用 `canvas-confetti`。

- [ ] **Step 4: Run** 同 Step 2 — Expected: PASS。

- [ ] **Step 5: Commit** `feat(word-practice): add dictation, corrections and the finished view`

---

### Task 9: 頁面組裝、家長設定、紀錄、清除舊程式與文件

**Files:**
- Modify: `src/components/WordPractice/WordPracticePage.tsx`、`HomeworkHistory.tsx`、`homeworkFormat.ts`
- Create: `TodayCard.tsx`、`ParentSettings.tsx`、`HomeworkBook.tsx`
- Delete: `steps/`（整個目錄）、`HomeworkOverview.tsx`、`GenerateHomeworkPanel.tsx`、`HomeworkResult.tsx`、`stepTypes.ts`
- Modify: `README.md`
- Test: `src/components/WordPractice/WordPracticePage.test.tsx`（改寫）

**Interfaces:**
- Consumes: Task 6 的 `UseWordPractice`；Task 2 的 `currentPosition`；Task 7、8 的元件。
- Produces:
  - `TodayCard({ settings, reviewDueCount, active, starting, onStart, onContinue })`
  - `ParentSettings({ settings, hasActive, onSave, onAbandon })`（`<details>` 收合，標題「家長設定」）
  - `HomeworkBook({ homework, onProgress, onRest, onSubmit, submitting })`：依 `currentPosition` 顯示 `WordPage`／`DictationStep`／`CorrectionStep`／交作業按鈕，上方是進度條與「先休息，等一下再寫」。

- [ ] **Step 1: 改寫頁面測試。** 案例：

```ts
it("shows today's homework with no settings in sight, and starts it with one button", async () => {
  expect(text()).toContain("今天的功課"); expect(text()).toContain("5 個新字"); expect(text()).toContain("3 個複習字");
  expect(text()).not.toMatch(/CEFR|A1/); // 家長設定收合時看不到
  await click("開始寫功課"); expect(wordPractice.start).toHaveBeenCalledTimes(1);
});
it("continues an active homework at its current word", () => { expect(text()).toContain("繼續寫功課（第 3 / 5 個字）"); });
it("shows the notice when there is nothing to practise", async () => { /* start → "empty" → 「生詞本裡沒有可以練習的新單字」 */ });
it("keeps abandon inside the parent settings, behind a confirmation", async () => { /* 展開「家長設定」才看得到「放棄這份功課」，按下跳出 ConfirmModal */ });
it("goes from the last correction to submit, then to the finished view", async () => { /* phase submit → 按「交作業」→ submit() → FinishedView */ });
it("opens a legacy homework from the history with its date and score", () => { /* LegacyHomework 顯示「答對 7 / 10」 */ });
```

- [ ] **Step 2: Run** `npx vitest run src/components/WordPractice` — Expected: FAIL。

- [ ] **Step 3: 實作與清除。** 頁面標題維持「單字練習」，副標改為「照作業簿一步一步寫：抄寫、默寫、造詞、造句，最後聽寫。」。保留頁尾 CEFR 出處兩行。刪除舊元件與 `steps/`。`homeworkFormat.ts` 改為接受 `HistoryHomework`。README 的 Word Practice 列改寫成新流程（作業簿、聽寫與間隔複習、家長看造詞造句、不使用 Gemini），並更新專案結構裡的檔案清單；Smart Vocabulary Book 列中「estimate (≈B1) once one has been made while generating a Word Practice homework」改成「an estimate (≈B1) if one was stored earlier」。

- [ ] **Step 4: 完整驗證。**
  Run: `npm run lint` — Expected: 0 errors。
  Run: `npm run build` — Expected: `✓ built`。
  Run: `npm run test` — Expected: 全部 PASS。
  Run: `grep -rn "wordPracticeAi\|generateExampleSentences\|estimateCefrLevels\|getSentenceFeedback\|homeworkProgress" src` — Expected: 沒有結果。

- [ ] **Step 5: 在瀏覽器驗證**（假資料或真實帳號，依當時 Firestore 額度決定；真實帳號下不需要任何 Gemini 請求）：產生一份功課、做完一個生字頁、重新整理後接續、做聽寫並訂正、交作業、在紀錄裡看到造詞造句；淺色／深色、1440px／768px 版面正常。

- [ ] **Step 6: Commit** `feat(word-practice): assemble the homework book page and remove the old steps`
