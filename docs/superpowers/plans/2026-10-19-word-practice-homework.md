# 單字練習（Word Practice Homework）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/word-practice` 分頁，讓 Ollie 從生詞本依 CEFR 等級產生單字功課，在電腦上完成六個打字練習並自動批改。

**Architecture:** 純函式工具層（字形、CEFR 查表、答案比對、選字、進度計算）全部可單元測試；Firestore 存取集中在 `wordPracticeStorage.ts`，Gemini 呼叫集中在 `wordPracticeAi.ts`，`wordPracticeService.ts` 負責產生功課的流程；`useWordPractice` hook 管頁面狀態，元件只負責呈現與輸入。CEFR 資料由腳本從 CSV 轉成 JSON，前端 lazy import。

**Tech Stack:** React 19、TypeScript 5.9、Vite 7、Vitest（jsdom）、Firebase 12（Firestore、AI Logic）、Tailwind 4 + DaisyUI 5、lucide-react。

**Spec:** `docs/superpowers/specs/2026-10-19-word-practice-homework-design.md`（執行者必須同時讀 spec）

## Global Constraints

- 路由 `/word-practice`；側邊欄項目「單字練習」放在「生詞本」正下方；頁面在 auth 邊界內。
- Ollie 練習時看到的題目、說明、回饋全部是英文；任何練習畫面都不顯示 `definitionChinese`。頁面管理介面（產生功課、歷史紀錄）用繁體中文。
- 所有作答輸入框：`spellCheck={false}`、`autoComplete="off"`、`autoCorrect="off"`、`autoCapitalize="off"`；自動取得焦點；Enter 送出。
- 答案比對：去前後空白、連續空白壓成一個、彎引號轉直引號，之後不分大小寫，其餘完全一致。
- 字數預設 10，可選 5–20；起始等級預設 A1，存在 localStorage `ollie-word-practice-start-level`。
- 同一時間只有一份進行中的功課。
- Firestore 路徑只有 `users/{uid}/wordHomeworks/{homeworkId}` 與 `users/{uid}/wordPractice/state`；不改 `vocabulary` collection 的資料結構。
- Gemini 只透過 `generateGeminiContent`（共用 4 RPM 佇列）；CEFR 估計每批最多 50 個字；產生功課的例句補齊最多一次請求。
- 拼字練習每個字要打對 3 次；克漏字與看解釋打單字最多兩次機會。
- 步驟 6（拼字考試）要等步驟 1–5 都完成才開放；考試唸法：單字 → 例句 → 單字；沒有例句時唸單字兩次。
- 出處文字（逐字使用）：`The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies.`；C1/C2：`Octanove Vocabulary Profile (CC BY-SA 4.0)`。
- 設計依 `AGENTS.md`：macOS HIG、hairline 邊框、OKLCH token、淺色／深色、觸控目標至少 44px（`min-h-11`）。

## Review Focus

1. **含撇號、連字號或空白的字**（`don't`、`well-known`、`look forward to`）：克漏字挖空、造句檢查、答案比對都要正確處理；`\b` 在撇號與連字號旁會失效。→ Task 2 測試。
2. **生詞本裡大小寫或標點不同的字**（`Apple`、`run.`）：CEFR 查表、狀態 key、選字去重要用同一套正規化。→ Task 3、Task 6 測試。
3. **生詞本裡的重複字**（舊資料可能有兩筆 `run`）：功課不能出現同一個字兩次。→ Task 6 測試。
4. **Gemini 回傳格式錯誤、多出沒問的字、回饋夾中文、例句沒包含該字**：全部丟棄，不寫進功課。→ Task 8 測試。
5. **連點「完成考試」或「產生功課」、關掉分頁再回來**：完成考試必須冪等，不能重複加錯過次數。→ Task 7 測試。

---

### Task 1: CEFR 等級資料

**Files:**
- Create: `scripts/build-cefr-levels.mjs`
- Create: `src/data/cefr/cefrLevels.json`（腳本產生）
- Create: `src/data/cefr/README.md`
- Modify: `package.json`（scripts 加 `"build-cefr": "node scripts/build-cefr-levels.mjs"`）
- Test: `tests/buildCefrLevels.test.ts`

**Interfaces:**
- Produces: `cefrLevels.json` — `{ [lowercaseHeadword: string]: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" }`，key 依字母排序。
- Produces（腳本匯出）：`parseCsv(text: string): string[][]`、`buildCefrLevels(csvTexts: string[]): Record<string, string>`。

- [ ] **Step 1: 寫失敗的測試**

```ts
import { expect, test } from "vitest";
import { buildCefrLevels, parseCsv } from "../scripts/build-cefr-levels.mjs";

test("parses quoted fields containing commas", () => {
  expect(parseCsv('a,"b, c",d\n')[0]).toEqual(["a", "b, c", "d"]);
});

test("splits slash variants, lowercases, and keeps the lowest level", () => {
  const cefrj = 'headword,pos,CEFR,CoreInventory 1,CoreInventory 2,Threshold\n' +
    'a.m./A.M./am/AM,adverb,A1,,,\nlight,noun,A1,,,\nlight,adjective,A2,,,\n' +
    'air conditioning,noun,B1,Objects and rooms,,"House and home, environment"\n';
  const octanove = 'headword,pos,CEFR,notes\ncloak,noun,C1,\nlight,verb,C2,\nbad,noun,Z9,\n';
  expect(buildCefrLevels([cefrj, octanove])).toEqual({
    "a.m.": "A1", am: "A1", light: "A1", "air conditioning": "B1", cloak: "C1",
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/buildCefrLevels.test.ts`
Expected: FAIL（找不到 `../scripts/build-cefr-levels.mjs`）

- [ ] **Step 3: 實作 `scripts/build-cefr-levels.mjs`**

- `parseCsv`：支援雙引號欄位、欄位內逗號、`""` 跳脫、CRLF。
- `buildCefrLevels`：每份 CSV 依表頭找 `headword`、`CEFR` 欄；headword 以 `/` 拆成變體，每個變體 trim、連續空白壓成一個、轉小寫；等級不符合 `/^(A1|A2|B1|B2|C1|C2)$/` 的列略過；同一 key 取最低等級。
- 直接執行時（`import.meta.url` 對應 `process.argv[1]`）用 `fetch` 下載以下兩個 URL，產生 JSON（key 排序、`JSON.stringify(obj)` 加結尾換行）寫到 `src/data/cefr/cefrLevels.json`，並印出 key 數量：
  - `https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv`
  - `https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/octanove-vocabulary-profile-c1c2-1.0.csv`

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/buildCefrLevels.test.ts`
Expected: PASS

- [ ] **Step 5: 產生資料檔**

Run: `npm run build-cefr`
Expected: 印出的 key 數量超過 7000，`src/data/cefr/cefrLevels.json` 中 `"abandon":"B1"`、`"cloak":"C1"`。

- [ ] **Step 6: 寫 `src/data/cefr/README.md`**

內容：兩個來源 URL、版本（CEFR-J 1.5、Octanove 1.0）、上面「Global Constraints」的出處文字、CEFR-J 的授權條件（免費用於研究與商業用途，須註明出處；著作權屬於 TUFS Tono Laboratory）、`cefrLevels.json` 依 CC BY-SA 4.0 釋出（因含 Octanove 衍生資料）、重新產生的指令 `npm run build-cefr`。

- [ ] **Step 7: Commit**

```bash
git add scripts/build-cefr-levels.mjs tests/buildCefrLevels.test.ts src/data/cefr package.json
git commit -m "feat(word-practice): add CEFR word level data"
```

---

### Task 2: 字形工具（字尾變化、克漏字、遮字）

**Files:**
- Create: `src/utils/wordForms.ts`
- Test: `src/utils/wordForms.test.ts`

**Interfaces:**
- Produces:
  - `CLOZE_BLANK = "_____"`
  - `formsOf(word: string): string[]` — 這個字在句子裡算數的所有字形（小寫、去重、長的在前）
  - `baseCandidatesOf(word: string): string[]` — 查字典用的原形候選，依優先順序，不含字本身
  - `findWordForm(text: string, word: string): string | null` — 第一個出現的字形（保留原文大小寫）
  - `redactWordForms(text: string, word: string, blank?: string): string`
  - `makeCloze(sentence: string, word: string): { text: string; answer: string } | null`
  - `sentenceUsesWord(sentence: string, word: string): boolean`

- [ ] **Step 1: 寫失敗的測試**

```ts
import { describe, expect, it } from "vitest";
import { baseCandidatesOf, CLOZE_BLANK, findWordForm, formsOf, makeCloze, redactWordForms, sentenceUsesWord } from "./wordForms";

describe("formsOf", () => {
  it.each([
    ["run", ["running", "runs", "ran", "run"]],
    ["study", ["studies", "studied", "studying"]],
    ["make", ["making", "made", "makes"]],
    ["stop", ["stopped", "stopping"]],
    ["box", ["boxes"]],
    ["child", ["children"]],
    ["go", ["went", "gone", "goes", "going"]],
  ])("%s includes %j", (word, expected) => {
    expect(formsOf(word)).toEqual(expect.arrayContaining(expected));
  });
  it("inflects only the first word of a phrase", () => {
    expect(formsOf("look forward to")).toEqual(expect.arrayContaining(["looked forward to", "looking forward to"]));
  });
});

describe("baseCandidatesOf", () => {
  it.each([
    ["ran", "run"], ["running", "run"], ["making", "make"], ["stopped", "stop"],
    ["studies", "study"], ["boxes", "box"], ["children", "child"], ["liked", "like"],
  ])("%s → %s", (word, base) => expect(baseCandidatesOf(word)).toContain(base));
  it("never strips a base shorter than three letters", () => {
    expect(baseCandidatesOf("red")).not.toContain("r");
    expect(baseCandidatesOf("bring")).not.toContain("br");
  });
});

describe("sentence matching", () => {
  it("finds inflected and irregular forms, preserving case", () => {
    expect(findWordForm("She Ran home.", "run")).toBe("Ran");
    expect(findWordForm("The runner waited.", "run")).toBeNull();
  });
  it("handles apostrophes, curly quotes, hyphens and phrases", () => {
    expect(findWordForm("I don’t know.", "don't")).toBe("don’t");
    expect(findWordForm("A well-known song.", "well-known")).toBe("well-known");
    expect(findWordForm("We are looking  forward to it.", "look forward to")).toBe("looking  forward to");
    expect(findWordForm("I know it.", "now")).toBeNull();
  });
  it("blanks every form and answers with the first occurrence", () => {
    expect(makeCloze("Run fast! He runs every day.", "run")).toEqual({
      text: `${CLOZE_BLANK} fast! He ${CLOZE_BLANK} every day.`, answer: "Run",
    });
    expect(makeCloze("No match here.", "run")).toBeNull();
  });
  it("redacts the headword inside a definition", () => {
    expect(redactWordForms("to keep running", "run", "____")).toBe("to keep ____");
  });
  it("checks that a sentence uses the word", () => {
    expect(sentenceUsesWord("My children are happy.", "child")).toBe(true);
    expect(sentenceUsesWord("I like apples.", "child")).toBe(false);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/utils/wordForms.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作 `src/utils/wordForms.ts`**

- 不重用 `quizQuestions.ts` 的 `stemOf`：它為了遮字而刻意激進（會砍 `-e`、`-ly`），用在找字形或查表會誤判。
- `IRREGULAR_FORMS: Record<string, string[]>`：常見不規則動詞（至少 `be/go/run/eat/see/take/make/come/get/give/write/swim/sing/begin/break/buy/bring/think/teach/catch/fly/drive/ride/speak/tell/know/grow/draw/fall/feel/find/hold/keep/leave/lose/meet/pay/read/say/sell/send/sit/sleep/stand/win/wear`）與不規則名詞（至少 `child/man/woman/mouse/tooth/foot/person/fish/sheep`）；同時建立反查表（形式 → 原形）。
- `formsOf`：對單一字產生原形、`-s`/`-es`、子音＋`y`→`-ies`/`-ied`、`-ed`/`-d`、`-ing`、去 `e` 加 `-ing`、`ie`→`-ying`、子音-母音-子音（結尾不是 w/x/y）時重複字尾加 `-ed`/`-ing`，再加上不規則表的同組字形；片語只對第一個字做變化。
- 比對用的正規式：撇號同時接受 `'` 與 `’`，片語內空白對應 `\s+`，前後邊界用 `(?<![\p{L}\p{N}'’-])` 與 `(?![\p{L}\p{N}'’-])`，旗標 `giu`；字形要先跳脫正規式特殊字元。
- `baseCandidatesOf`：先查不規則反查表，再依序試 `-ies→y`、`-ied→y`、`-es`、`-s`（不砍 `-ss`）、雙子音＋`-ed`、`-ed→e`、`-ed`、雙子音＋`-ing`、`-ing→e`、`-ing`；任何候選長度小於 3 就丟棄。

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/utils/wordForms.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/wordForms.ts src/utils/wordForms.test.ts
git commit -m "feat(word-practice): add word form matching utilities"
```

---

### Task 3: 型別與 CEFR 查表

**Files:**
- Create: `src/types/wordPractice.ts`
- Create: `src/utils/cefr.ts`
- Modify: `tsconfig.app.json`（`compilerOptions` 加 `"resolveJsonModule": true`）
- Test: `src/utils/cefr.test.ts`

**Interfaces:**
- Consumes: Task 1 `cefrLevels.json`；Task 2 `baseCandidatesOf`；`normalizeUniqueText`（`src/utils/firestoreIdentity.ts`）。
- Produces（`src/types/wordPractice.ts`，後面所有 task 都用這些名稱）：

```ts
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export interface CefrInfo { level: CefrLevel; source: "list" | "ai" }

export interface WordPracticeWordState { learnedAt?: number; missCount: number; lastMissedAt?: number }
export interface WordPracticeState {
  activeHomeworkId: string | null;
  words: Record<string, WordPracticeWordState>;   // key = practiceKey(word)
  cefrEstimates: Record<string, CefrLevel>;       // key = practiceKey(word)
}

export interface Cloze { text: string; answer: string }
export interface HomeworkWord {
  key: string;                // practiceKey(word)
  vocabularyId: string;
  word: string;
  emoji?: string;
  definitions: { partOfSpeech: string; definition: string }[];  // 只有英文
  sentence: string | null;
  cloze: Cloze | null;
  cefr: CefrInfo | null;
}
export interface ExerciseProgress { attempts: number; correct: boolean; done: boolean }
export interface SentenceFeedback { usedCorrectly: boolean; feedback: string; suggestion?: string }
export interface HomeworkWordProgress {
  learned: boolean;
  spellCorrect: number;
  fill: ExerciseProgress;
  define: ExerciseProgress;
  sentence: { text: string; feedback: SentenceFeedback | null } | null;
  testAnswer: string | null;
}
export interface HomeworkOptions { wordCount: number; startLevel: CefrLevel }
export interface HomeworkResult { correctKeys: string[]; missedKeys: string[]; correctCount: number; total: number }
export type HomeworkStatus = "active" | "completed" | "abandoned";
export interface Homework {
  id: string;
  status: HomeworkStatus;
  createdAt: number;
  completedAt?: number;
  options: HomeworkOptions;
  words: HomeworkWord[];
  progress: HomeworkWordProgress[];   // 與 words 同順序
  result?: HomeworkResult;
}
```

- Produces（`src/utils/cefr.ts`）：
  - `CEFR_LEVELS: readonly CefrLevel[]`（A1→C2）
  - `cefrRank(level: CefrLevel): number`（A1=0 … C2=5）
  - `practiceKey(word: string): string` — `normalizeUniqueText`，並把 `’` 換成 `'`、去掉前後非字母數字字元
  - `type CefrTable = ReadonlyMap<string, CefrLevel>`
  - `loadCefrTable(): Promise<CefrTable>` — lazy `import("../data/cefr/cefrLevels.json")`，同一個 promise 重複使用
  - `lookupCefrLevel(table: CefrTable, word: string): CefrLevel | null`
  - `resolveCefr(table: CefrTable, estimates: Record<string, CefrLevel>, word: string): CefrInfo | null`

- [ ] **Step 1: 寫失敗的測試**

```ts
import { describe, expect, it } from "vitest";
import { cefrRank, loadCefrTable, lookupCefrLevel, practiceKey, resolveCefr } from "./cefr";

const table = new Map([["run", "A1"], ["make", "A1"], ["child", "A1"], ["evening", "A1"], ["even", "A2"], ["don't", "A1"]] as const);

describe("cefr", () => {
  it("ranks levels", () => expect(cefrRank("A1")).toBeLessThan(cefrRank("C2")));
  it("normalizes keys", () => {
    expect(practiceKey("  Run. ")).toBe("run");
    expect(practiceKey("Don’t")).toBe("don't");
  });
  it("prefers an exact match, then base candidates", () => {
    expect(lookupCefrLevel(table, "evening")).toBe("A1");
    expect(lookupCefrLevel(table, "Ran")).toBe("A1");
    expect(lookupCefrLevel(table, "making")).toBe("A1");
    expect(lookupCefrLevel(table, "children")).toBe("A1");
    expect(lookupCefrLevel(table, "xyzzy")).toBeNull();
  });
  it("falls back to AI estimates by practice key", () => {
    expect(resolveCefr(table, {}, "run")).toEqual({ level: "A1", source: "list" });
    expect(resolveCefr(table, { "bona fide": "C2" }, "Bona  Fide")).toEqual({ level: "C2", source: "ai" });
    expect(resolveCefr(table, {}, "bona fide")).toBeNull();
  });
  it("loads the generated table", async () => {
    const loaded = await loadCefrTable();
    expect(loaded.size).toBeGreaterThan(7000);
    expect(loaded.get("abandon")).toBe("B1");
    expect(loaded.get("cloak")).toBe("C1");
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/utils/cefr.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 建立 `src/types/wordPractice.ts`（內容如上）並實作 `src/utils/cefr.ts`**

`lookupCefrLevel`：先用 `practiceKey(word)` 查，查不到再依 `baseCandidatesOf(key)` 順序查第一個存在的候選。

- [ ] **Step 4: 執行測試與型別檢查**

Run: `npx vitest run src/utils/cefr.test.ts` → PASS
Run: `npx tsc -b` → 無錯誤

- [ ] **Step 5: Commit**

```bash
git add src/types/wordPractice.ts src/utils/cefr.ts src/utils/cefr.test.ts tsconfig.app.json
git commit -m "feat(word-practice): add CEFR lookup and practice types"
```

---

### Task 4: 答案比對與拼錯標示

**Files:**
- Create: `src/utils/answerMatch.ts`
- Test: `src/utils/answerMatch.test.ts`

**Interfaces:**
- Produces:
  - `normalizeAnswer(value: string): string`
  - `isAnswerCorrect(input: string, expected: string): boolean`
  - `type SpellingDiffPart = { text: string; kind: "same" | "wrong" | "missing" | "extra" }`
  - `diffSpelling(input: string, expected: string): SpellingDiffPart[]`

- [ ] **Step 1: 寫失敗的測試**

```ts
import { expect, it } from "vitest";
import { diffSpelling, isAnswerCorrect, normalizeAnswer } from "./answerMatch";

it("normalizes whitespace, quotes and case", () => {
  expect(normalizeAnswer("  Don’t   Stop ")).toBe("don't stop");
  expect(isAnswerCorrect("Apple ", "apple")).toBe(true);
  expect(isAnswerCorrect("aple", "apple")).toBe(false);
  expect(isAnswerCorrect("well known", "well-known")).toBe(false);
});

it("marks the misspelled positions against the expected word", () => {
  expect(diffSpelling("aple", "apple")).toEqual([
    { text: "a", kind: "same" }, { text: "p", kind: "missing" }, { text: "ple", kind: "same" },
  ]);
  expect(diffSpelling("appel", "apple")).toEqual([
    { text: "app", kind: "same" }, { text: "le", kind: "wrong" },
  ]);
  expect(diffSpelling("apples", "apple")).toEqual([
    { text: "apple", kind: "same" }, { text: "s", kind: "extra" },
  ]);
  expect(diffSpelling("Apple", "apple")).toEqual([{ text: "apple", kind: "same" }]);
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/utils/answerMatch.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作 `src/utils/answerMatch.ts`**

`diffSpelling` 在兩邊 `normalizeAnswer` 之後，用 Levenshtein DP 從尾端回溯對齊：相同字元是 `same`，替換是 `wrong`（顯示正確字元），預期有而輸入沒有是 `missing`，輸入多出來的是 `extra`（顯示輸入字元）；相鄰同種類合併成一段。**成本相同時的回溯優先順序：對角線（相同或替換）→ `missing` → `extra`**，上面的測試結果依這個順序決定。

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/utils/answerMatch.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/answerMatch.ts src/utils/answerMatch.test.ts
git commit -m "feat(word-practice): add answer matching and spelling diff"
```

---

### Task 5: 功課進度與評分

**Files:**
- Create: `src/utils/homeworkProgress.ts`
- Test: `src/utils/homeworkProgress.test.ts`

**Interfaces:**
- Consumes: Task 3 型別；Task 4 `isAnswerCorrect`；Task 2 `sentenceUsesWord`。
- Produces:
  - `type StepId = "learn" | "spell" | "fill" | "define" | "sentence" | "test"`
  - `STEP_ORDER: readonly StepId[]`、`SPELL_TARGET = 3`、`MAX_ATTEMPTS = 2`
  - `emptyProgress(count: number): HomeworkWordProgress[]`
  - `applyExerciseAnswer(p: ExerciseProgress, correct: boolean): ExerciseProgress`
  - `isStepComplete(hw: Pick<Homework, "words" | "progress">, step: StepId): boolean`
  - `isTestUnlocked(hw: Pick<Homework, "words" | "progress">): boolean`
  - `gradeTest(hw: Pick<Homework, "words" | "progress">): HomeworkResult`

- [ ] **Step 1: 寫失敗的測試**

測試建立兩個字的功課（`apple` 有 cloze、`look forward to` 的 `cloze: null`），斷言：
- `emptyProgress(2)` 每筆是 `{ learned: false, spellCorrect: 0, fill/define: { attempts: 0, correct: false, done: false }, sentence: null, testAnswer: null }`。
- `applyExerciseAnswer({attempts:0,correct:false,done:false}, false)` → `{attempts:1, correct:false, done:false}`；再錯一次 → `done: true`；第一次就對 → `{attempts:1, correct:true, done:true}`。
- `isStepComplete(hw, "spell")` 只有兩個字都 `spellCorrect >= 3` 才是 true。
- `isStepComplete(hw, "fill")` 只看 `cloze` 不為 null 的字；全部都沒有 cloze 時為 true。
- `isStepComplete(hw, "sentence")` 要求每個字的 `sentence.text` 有用到該字（`"I look forward to it."` 算，`"I like it."` 不算）。
- `isTestUnlocked` 在 learn/spell/fill/define/sentence 全部完成前為 false。
- `gradeTest`：答案 `"Apple "` 與 `"look forward"` → `{ correctKeys: ["apple"], missedKeys: ["look forward to"], correctCount: 1, total: 2 }`；任一 `testAnswer` 為 null 時丟出錯誤。

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/utils/homeworkProgress.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作 `src/utils/homeworkProgress.ts`**

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/utils/homeworkProgress.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/homeworkProgress.ts src/utils/homeworkProgress.test.ts
git commit -m "feat(word-practice): add homework progress and grading"
```

---

### Task 6: 選字規則

**Files:**
- Create: `src/services/wordPracticeSelection.ts`
- Test: `src/services/wordPracticeSelection.test.ts`

**Interfaces:**
- Consumes: Task 3 型別、`cefrRank`、`practiceKey`；`VocabularyWord`（`src/types/vocabulary.ts`）。
- Produces:
  - `isEligibleWord(word: VocabularyWord): boolean` — 至少一個 `definitions[].definition` 非空白
  - `interface SelectionInput { words: VocabularyWord[]; state: WordPracticeState; levelOf: (word: VocabularyWord) => CefrInfo | null; options: HomeworkOptions }`
  - `selectHomeworkWords(input: SelectionInput): VocabularyWord[]`

- [ ] **Step 1: 寫失敗的測試**

用 `createdAt` 遞增的字建立 fixture，`levelOf` 由一個 Map 提供。斷言：
- 依等級 A1 → A2 → B1 排序，同等級依 `createdAt` 由舊到新；估計值（`source: "ai"`）依估計等級排入；`levelOf` 回傳 null 的字排在 C2 之後。
- 考錯過且未學會的字（`state.words[key].missCount > 0`）排最前面，`lastMissedAt` 越新越前面，即使它是 B2。
- 已學會（`learnedAt` 有值）的字一律排除，包括考錯過後又學會的字。
- `startLevel: "A2"` 時，沒考錯過、查表（`source: "list"`）為 A1 的字被排除；考錯過的 A1 字仍在最前面；估計值為 A1 的字（`source: "ai"`）與未分級的字不被排除。
- 沒有英文解釋的字被排除。
- 生詞本有兩筆 `run` 與 `Run.`（`practiceKey` 相同）時只選一筆，保留 `createdAt` 較早的那筆。
- 回傳數量不超過 `options.wordCount`；可練習的字不夠時回傳全部。

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/services/wordPracticeSelection.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作 `src/services/wordPracticeSelection.ts`**

排序鍵依序為：組別（考錯過 = 0，其餘 = 1）→ 考錯組用 `lastMissedAt` 由新到舊 → 其餘組用等級排名（未分級 = 6）→ `createdAt` 由舊到新 → `practiceKey` 字母順序（讓結果穩定）。

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/services/wordPracticeSelection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/wordPracticeSelection.ts src/services/wordPracticeSelection.test.ts
git commit -m "feat(word-practice): add CEFR-ordered word selection"
```

---

### Task 7: Firestore 儲存與規則片段

**Files:**
- Create: `src/services/wordPracticeStorage.ts`
- Create: `word-practice-firestore-rules.fragment`
- Test: `src/services/wordPracticeStorage.test.ts`

**Interfaces:**
- Consumes: Task 3 型別；Task 5 `gradeTest`；`db`（`src/utils/firebaseUtil.ts`）。
- Produces:
  - `EMPTY_PRACTICE_STATE: WordPracticeState`
  - `newHomeworkId(uid: string): string`（`doc(collection(db, "users", uid, "wordHomeworks")).id`）
  - `loadPracticeState(uid: string): Promise<WordPracticeState>`
  - `saveCefrEstimates(uid: string, estimates: Record<string, CefrLevel>): Promise<void>`
  - `getActiveHomework(uid: string): Promise<Homework | null>`
  - `createHomework(uid: string, homework: Homework): Promise<void>`
  - `saveHomeworkProgress(uid: string, id: string, progress: HomeworkWordProgress[]): Promise<void>`
  - `saveHomeworkWords(uid: string, id: string, words: HomeworkWord[]): Promise<void>`
  - `abandonHomework(uid: string, id: string): Promise<void>`
  - `completeHomework(uid: string, id: string, now: number): Promise<Homework>`
  - `listCompletedHomeworks(uid: string, max?: number): Promise<Homework[]>`（預設 20）

- [ ] **Step 1: 寫失敗的測試**

比照 `src/services/podcastTranscriptStorage.test.ts` 的寫法，用 `vi.mock("firebase/firestore")` 建立記憶體版的 `doc`/`getDoc`/`setDoc`/`updateDoc`/`runTransaction`/`collection`/`query`/`orderBy`/`limit`/`getDocs`。斷言：
- 沒有 state 文件時，`loadPracticeState` 回傳 `EMPTY_PRACTICE_STATE`。
- `createHomework` 在已有進行中功課時，把舊的標成 `abandoned`，並把 `state.activeHomeworkId` 改成新的 id；`getActiveHomework` 回傳新的那份。
- `saveCefrEstimates` 會合併既有估計值，不覆蓋 `words` 與 `activeHomeworkId`。
- `completeHomework`：寫入 `status: "completed"`、`completedAt`、`result`；答對的 key 設 `learnedAt = now`；答錯的 key `missCount + 1`、`lastMissedAt = now`；`activeHomeworkId` 清成 null。
- **冪等**：同一份功課連續呼叫兩次 `completeHomework`，`missCount` 只加一次，第二次回傳第一次的結果。
- `abandonHomework` 把狀態改成 `abandoned` 並清除 `activeHomeworkId`；之後 `getActiveHomework` 回傳 null。
- 不同 uid 互不影響。
- key 內含 `.`、`'` 或空白時（`a.m.`、`don't`、`look forward to`）能正確存取。

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/services/wordPracticeStorage.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作 `src/services/wordPracticeStorage.ts`**

- state 文件：`doc(db, "users", uid, "wordPractice", "state")`；功課：`doc(db, "users", uid, "wordHomeworks", id)`。
- state 的 `words`、`cefrEstimates` 這兩個 map 一律整份寫入（transaction 內 `tx.set(stateRef, fullState)`），不用含 `.` 的 field path 更新，避免 key 中的 `.` 被解讀成路徑。
- `createHomework`、`abandonHomework`、`completeHomework`、`saveCefrEstimates` 都用 `runTransaction`。
- `completeHomework` 在功課已經是 `completed` 時直接回傳現有文件；不是 `active` 也不是 `completed` 時丟出錯誤。
- `listCompletedHomeworks` 用 `orderBy("completedAt", "desc")` 加 `limit(max)`：只有完成的功課有 `completedAt`，所以不需要複合索引。

- [ ] **Step 4: 寫規則片段 `word-practice-firestore-rules.fragment`**

格式比照 `server/podcast-firestore-rules.fragment`：開頭註明要合併到部署規則的 `/databases/{database}/documents` 區塊內。`ownsWordPractice(uid)` 條件與 podcast 的 `ownsPodcastData` 相同（`request.auth.uid == uid`、`email_verified`、`allowedUsers/{email}` 存在）。只允許：
- `users/{uid}/wordPractice/state`
- `users/{uid}/wordHomeworks/{homeworkId}`

- [ ] **Step 5: 執行測試確認通過**

Run: `npx vitest run src/services/wordPracticeStorage.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/wordPracticeStorage.ts src/services/wordPracticeStorage.test.ts word-practice-firestore-rules.fragment
git commit -m "feat(word-practice): add Firestore storage and rules fragment"
```

---

### Task 8: Gemini 呼叫（等級估計、例句、造句回饋）

**Files:**
- Create: `src/services/wordPracticeAi.ts`
- Modify: `src/services/geminiClient.ts`（`GeminiAction` 加 `"cefr_estimate" | "example_sentence" | "sentence_feedback"`）
- Modify: `src/services/aiService.ts`（`parseJsonResponse` 改成 `export`）
- Test: `src/services/wordPracticeAi.test.ts`

**Interfaces:**
- Consumes: `generateGeminiContent`；Task 3 `CEFR_LEVELS`、`practiceKey`；Task 2 `findWordForm`。
- Produces:
  - `CEFR_ESTIMATE_BATCH_SIZE = 50`
  - `estimateCefrLevels(words: string[], signal?: AbortSignal): Promise<Record<string, CefrLevel>>` — key 是 `practiceKey`；超過 50 個字時丟出 `RangeError`
  - `generateExampleSentences(words: string[], signal?: AbortSignal): Promise<Record<string, string>>` — key 是 `practiceKey`
  - `getSentenceFeedback(word: string, sentence: string, signal?: AbortSignal): Promise<SentenceFeedback>` — 回應無效時丟出錯誤

- [ ] **Step 1: 寫失敗的測試**

`vi.mock("./geminiClient")`，讓 `generateGeminiContent` 回傳 `{ response: { text: () => json } }`。斷言：
- `estimateCefrLevels(["bona fide", "Zeitgeist"])` 遇到 `{"levels":[{"word":"bona fide","level":"C2"},{"word":"zeitgeist","level":"C1"},{"word":"extra","level":"A1"},{"word":"bona fide","level":"Z9"}]}` 時，回傳 `{ "bona fide": "C2", zeitgeist: "C1" }`：沒問的字與無效等級都被丟棄。呼叫時帶 `action: "cefr_estimate"`。
- `estimateCefrLevels` 收到 51 個字時丟出 `RangeError`，而且沒有呼叫 Gemini。
- `generateExampleSentences(["run","sing"])` 遇到 `{"sentences":[{"word":"run","sentence":"I ran to school."},{"word":"sing","sentence":"I like music."}]}` 時，只回傳 `{ run: "I ran to school." }`，因為第二句沒有用到該字。夾中文（`/[㐀-鿿]/`）的句子也要丟棄。
- `getSentenceFeedback` 解析 `{"usedCorrectly":true,"feedback":"Great sentence!","suggestion":"..."}`；`feedback` 空白、夾中文或 `usedCorrectly` 不是布林值時丟出錯誤；`suggestion` 夾中文時只丟掉 suggestion。
- 回應被 ```json 程式碼框包住時也能解析。
- Gemini 丟出錯誤時，錯誤原樣往外拋。

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/services/wordPracticeAi.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作 `src/services/wordPracticeAi.ts`**

prompt 用英文撰寫，各自要求只回 JSON：
- **cefr_estimate**：估計每個英文單字或片語對英語學習者的 CEFR 等級（A1–C2），格式 `{"levels":[{"word","level"}]}`，`word` 照原樣回傳。
- **example_sentence**：每個字寫一句五年級學生看得懂的簡單句子，句子必須包含該字（可有字尾變化），格式 `{"sentences":[{"word","sentence"}]}`。
- **sentence_feedback**：你是親切的國小英文老師，這是五年級英文學習者用 `<word>` 造的句子；只能用簡單英文，一到兩句鼓勵性的短回饋，指出字有沒有用對，需要時附上改好的句子；格式 `{"usedCorrectly","feedback","suggestion"?}`。

`feedback` 最長 300 字元、例句最長 200 字元，超過就視為無效。三個函式都只用預設的重試政策，不另外重試。

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/services/wordPracticeAi.test.ts src/services/geminiClient.test.ts src/services/aiService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/wordPracticeAi.ts src/services/wordPracticeAi.test.ts src/services/geminiClient.ts src/services/aiService.ts
git commit -m "feat(word-practice): add Gemini level estimates, sentences and feedback"
```

---

### Task 9: 產生功課流程

**Files:**
- Create: `src/services/wordPracticeService.ts`
- Modify: `src/services/vocabularyService.ts`（新增 `getAllVocabularyWords`）
- Test: `src/services/wordPracticeService.test.ts`

**Interfaces:**
- Consumes: Tasks 2、3、5、6、7、8 的函式。
- Produces:
  - `getAllVocabularyWords(userId: string): Promise<VocabularyWord[]>`（`vocabularyService.ts`；與 `getVocabularyForReview` 用同一個 `where("userId","==",userId)` 查詢與 `convertToVocabularyWord`）
  - `type GenerateHomeworkResult = { status: "created"; homework: Homework } | { status: "empty" }`
  - `findExampleCloze(word: VocabularyWord): { sentence: string; cloze: Cloze } | null`
  - `generateHomework(uid: string, options: HomeworkOptions, signal?: AbortSignal): Promise<GenerateHomeworkResult>`
  - `fillMissingSentences(uid: string, homework: Homework, signal?: AbortSignal): Promise<Homework>`

- [ ] **Step 1: 寫失敗的測試**

mock `./vocabularyService`、`./wordPracticeStorage`、`./wordPracticeAi`、`../utils/cefr` 的 `loadCefrTable`（回傳小型 Map）。斷言：
- 只替「可練習、未學會、查表查不到、也沒有估計值」的字請求估計；120 個這種字分成 50、50、20 三批；其中一批失敗時其他批照常，`saveCefrEstimates` 只收到成功的結果；全部失敗時功課照樣產生。
- 生詞本例句含有該字時直接使用，不呼叫 `generateExampleSentences`；缺例句的字合併成一次呼叫；呼叫失敗時這些字的 `sentence` 與 `cloze` 為 null，功課仍然建立。
- 快照的 `definitions` 只有 `partOfSpeech` 與 `definition`，不含 `definitionChinese`。
- `options`、`createdAt`、`status: "active"`、`progress`（等於 `emptyProgress(n)`）、每個字的 `cefr` 都正確寫入；`createHomework` 只被呼叫一次。
- 沒有可練習的字時回傳 `{ status: "empty" }`，不呼叫 `createHomework`。
- `fillMissingSentences` 只替 `sentence === null` 的字請求一次，補上後呼叫 `saveHomeworkWords`；沒有缺的字時不呼叫 Gemini。
- signal 已經 abort 時丟出 AbortError，且不建立功課。

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/services/wordPracticeService.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作**

`generateHomework` 的順序：讀全部單字 → 讀 state → 載入 CEFR 表 → 篩出可練習字 → 分批估計並存檔 → `selectHomeworkWords` → 準備例句（`findExampleCloze`，缺的一次補齊）→ 組出 `Homework`（`newHomeworkId`、`Date.now()`）→ `createHomework`。每個 await 之後都檢查 `signal`。

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/services/wordPracticeService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/wordPracticeService.ts src/services/wordPracticeService.test.ts src/services/vocabularyService.ts
git commit -m "feat(word-practice): generate homework from the vocabulary book"
```

---

### Task 10: 語音的選用錯誤回報

**Files:**
- Modify: `src/contexts/SpeechContextType.ts`
- Modify: `src/contexts/SpeechContext.tsx`（`speakAsync` 的系統語音分支，約 `:400-431`）
- Test: `src/contexts/SpeechContext.test.tsx`（新增案例）

**Interfaces:**
- Produces: `export interface SpeakOptions { reportErrors?: boolean }`；`speakAsync: (text: string, options?: SpeakOptions) => Promise<void>`

- [ ] **Step 1: 寫失敗的測試**

在既有的 `SpeechContext.test.tsx` 加入：
- 系統語音模式下，`window.speechSynthesis` 不存在時：`speakAsync("hi")` resolve；`speakAsync("hi", { reportErrors: true })` reject。
- utterance 觸發 `onerror`（`error: "synthesis-failed"`）時：預設 resolve；`reportErrors: true` 時 reject。
- `stopSpeaking()` 中斷時，兩種情況都 resolve。

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/contexts/SpeechContext.test.tsx`
Expected: 新案例 FAIL

- [ ] **Step 3: 實作**

只有在 `reportErrors` 為 true 時，系統分支才以 `Error("Speech playback failed")` reject；API 分支維持原本行為（本來就會 reject）。其他呼叫端不傳 options，行為不變。

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/contexts/SpeechContext.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/contexts/SpeechContextType.ts src/contexts/SpeechContext.tsx src/contexts/SpeechContext.test.tsx
git commit -m "feat(speech): let callers opt in to speech error reporting"
```

---

### Task 11: `useWordPractice` hook

**Files:**
- Create: `src/hooks/useWordPractice.ts`
- Test: `src/hooks/useWordPractice.test.tsx`

**Interfaces:**
- Consumes: `useAuth`（`user.uid`）；Task 7、Task 9 的函式。
- Produces:

```ts
export interface UseWordPractice {
  status: "loading" | "ready" | "error";
  error: string | null;
  active: Homework | null;
  history: Homework[];
  generating: boolean;
  saveError: string | null;
  generate(options: HomeworkOptions): Promise<"created" | "empty" | "failed">;
  abandon(): Promise<void>;
  updateProgress(next: HomeworkWordProgress[]): void;
  ensureSentences(): Promise<void>;
  finishTest(): Promise<Homework | null>;
  reload(): Promise<void>;
}
export function useWordPractice(): UseWordPractice;
```

- [ ] **Step 1: 寫失敗的測試**

用 createRoot＋act 的寫法（同 `src/hooks/useSpeechPractice.test.tsx`），mock storage、service、`useAuth`。斷言：
- 掛載時讀取進行中功課與歷史，之後 `status` 變成 `"ready"`。
- `updateProgress` 立即更新 `active.progress`，並呼叫 `saveHomeworkProgress`；儲存失敗時設定 `saveError`，下一次 `updateProgress` 會送出完整進度，成功後清除 `saveError`。
- `ensureSentences` 在同一份功課只會呼叫一次 `fillMissingSentences`。
- `finishTest` 成功後 `active` 變成 null，完成的功課出現在 `history` 第一筆；`generating` 期間再呼叫 `generate` 直接回傳 `"failed"`，不重複產生。
- `generate` 回傳 `"empty"` 時 `active` 不變。
- 卸載時中止進行中的產生請求（傳入的 signal 變成 aborted）。

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/hooks/useWordPractice.test.tsx`
Expected: FAIL

- [ ] **Step 3: 實作 `src/hooks/useWordPractice.ts`**

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/hooks/useWordPractice.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useWordPractice.ts src/hooks/useWordPractice.test.tsx
git commit -m "feat(word-practice): add word practice page state hook"
```

---

### Task 12: 分頁、導覽、產生功課、總覽、歷史與成績

**Files:**
- Create: `src/components/WordPractice/WordPracticePage.tsx`（default export）
- Create: `src/components/WordPractice/GenerateHomeworkPanel.tsx`
- Create: `src/components/WordPractice/HomeworkOverview.tsx`
- Create: `src/components/WordPractice/HomeworkHistory.tsx`
- Create: `src/components/WordPractice/HomeworkResult.tsx`
- Modify: `src/App.tsx`（lazy import、`navItems` 在 `/vocabulary` 後面插入 `{ to: "/word-practice", label: "單字練習", icon: SpellCheck }`、`<Route path="/word-practice" …>`）
- Test: `src/components/WordPractice/WordPracticePage.test.tsx`、`src/App.test.tsx`（新增案例）

**Interfaces:**
- Consumes: Task 11 `useWordPractice`；Task 5 `STEP_ORDER`、`isStepComplete`、`isTestUnlocked`；`ConfirmModal`（`src/components/common/ConfirmModal.tsx`）。
- Produces: `WordPracticePage` 內部的畫面狀態 `{ view: "home" } | { view: "step"; step: StepId } | { view: "result"; homeworkId: string }`；Task 13、Task 14 的步驟元件掛在 `view: "step"`。本 task 先為六個步驟放佔位元件，由 Task 13、14 換掉。
- 步驟顯示名稱（英文）：`Learn`、`Spell It`、`Fill in the Blank`、`What's the Word?`、`Write a Sentence`、`Spelling Test`。

- [ ] **Step 1: 寫失敗的測試**

`App.test.tsx`：
- `a[href="/word-practice"]` 有兩個（桌面與手機），文字包含「單字練習」。
- 在桌面導覽中，它是 `a[href="/vocabulary"]` 的下一個連結。
- 未登入時開啟 `/word-practice`，會導向 `/login`，並記住 `from`。

`WordPracticePage.test.tsx`（mock `useWordPractice`）：
- 沒有進行中的功課時，顯示產生區塊：字數預設 10（選項 5–20）、起始等級預設 A1（選項 A1–C2），以及「產生功課」按鈕。
- 起始等級改成 B1 後重新掛載，仍是 B1（localStorage `ollie-word-practice-start-level`）；localStorage 拋錯時退回 A1。
- 有進行中的功課時按「產生功課」，會出現 ConfirmModal（「要放棄目前的功課嗎？」）；確認後才呼叫 `generate`。
- `generate` 回傳 `"empty"` 時，顯示「生詞本裡沒有可以練習的新單字」。
- `generating` 為 true 時，「產生功課」按鈕 disabled，並顯示 `role="status"` 的「正在產生功課…」（Gemini 排隊時可能要等一分鐘以上）。
- 總覽顯示六個步驟與完成狀態；步驟 1–5 未全部完成時，`Spelling Test` 按鈕是 disabled。
- 歷史清單顯示日期與 `correctCount / total`；點擊後進入成績畫面，列出每個字的作答與正確拼法，錯的字有標示。
- 頁面底部有 Global Constraints 中的出處文字。

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/components/WordPractice/WordPracticePage.test.tsx src/App.test.tsx`
Expected: 新案例 FAIL

- [ ] **Step 3: 實作元件與 App 變更**

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/components/WordPractice/WordPracticePage.test.tsx src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/WordPractice src/App.tsx src/App.test.tsx
git commit -m "feat(word-practice): add word practice page and navigation"
```

---

### Task 13: 步驟 1–4（Learn、Spell It、Fill in the Blank、What's the Word?）

**Files:**
- Create: `src/components/WordPractice/AnswerInput.tsx`
- Create: `src/components/WordPractice/SpellingDiff.tsx`
- Create: `src/components/WordPractice/steps/LearnStep.tsx`
- Create: `src/components/WordPractice/steps/SpellStep.tsx`
- Create: `src/components/WordPractice/steps/FillBlankStep.tsx`
- Create: `src/components/WordPractice/steps/DefinitionStep.tsx`
- Modify: `src/components/WordPractice/WordPracticePage.tsx`（換掉佔位元件）
- Test: `src/components/WordPractice/steps/steps.test.tsx`

**Interfaces:**
- Consumes: Task 4 `isAnswerCorrect`、`diffSpelling`；Task 5 `applyExerciseAnswer`、`SPELL_TARGET`；Task 2 `redactWordForms`；`useSpeechState().speak`。
- Produces:
  - 步驟元件共用 props：`interface StepProps { homework: Homework; onProgress: (next: HomeworkWordProgress[]) => void; onExit: () => void }`
  - `AnswerInput` props：`{ value: string; onChange: (v: string) => void; onSubmit: () => void; label: string; disabled?: boolean }`
  - `SpellingDiff` props：`{ input: string; expected: string }`

- [ ] **Step 1: 寫失敗的測試**

- `AnswerInput` 的 input 有 `spellcheck="false"`、`autocomplete="off"`、`autocorrect="off"`、`autocapitalize="off"`，掛載後取得焦點，按 Enter 呼叫 `onSubmit`。
- `LearnStep` 顯示單字、emoji、詞性與英文解釋、例句；顯示某張卡時，該字的 `learned` 變成 true；fixture 的整個畫面文字不含任何中文（`/[㐀-鿿]/`）。
- `SpellStep`：一開始看得到單字；按 “I’m ready” 後單字消失；輸入 `"Apple "` 送出後 `spellCorrect` 加 1；輸入 `"aple"` 顯示 `SpellingDiff` 與正確拼法，`spellCorrect` 不變，之後回到看字階段；同一個字打對 3 次後進入下一個字。
- `FillBlankStep`：題目顯示 `cloze.text`，畫面不含 `cloze.answer`；連續答錯兩次後顯示答案，並記錄 `done: true, correct: false`；`cloze` 為 null 的字顯示 “No sentence for this word yet.”。
- `DefinitionStep`：解釋裡出現的單字被遮成 `____`（例如 `"to keep running"` → `"to keep ____"`）；答題規則與 `FillBlankStep` 相同。
- 每次作答後 `onProgress` 收到完整的新進度陣列。

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/components/WordPractice/steps/steps.test.tsx`
Expected: FAIL

- [ ] **Step 3: 實作元件**

`SpellingDiff` 用顏色加底線標示 `wrong`/`missing`/`extra`，並在外層加 `aria-label` 寫出正確拼法。所有按鈕至少 44px 高。

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/components/WordPractice/steps/steps.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/WordPractice
git commit -m "feat(word-practice): add learn, spelling, cloze and definition steps"
```

---

### Task 14: 步驟 5–6（Write a Sentence、Spelling Test）

**Files:**
- Create: `src/components/WordPractice/steps/SentenceStep.tsx`
- Create: `src/components/WordPractice/steps/SpellingTestStep.tsx`
- Modify: `src/components/WordPractice/WordPracticePage.tsx`（換掉佔位元件；進入 `fill` 或 `test` 步驟時呼叫 `ensureSentences()`；`finishTest()` 成功後切到 `{ view: "result", homeworkId }`）
- Test: `src/components/WordPractice/steps/sentenceAndTest.test.tsx`

**Interfaces:**
- Consumes: Task 8 `getSentenceFeedback`；Task 2 `sentenceUsesWord`；Task 10 `speakAsync(text, { reportErrors: true })`；Task 11 `finishTest`。
- Produces: `SpellingTestStep` 的 props 是 `StepProps` 加上 `onFinish: () => Promise<void>`。

- [ ] **Step 1: 寫失敗的測試**

`SentenceStep`：
- 句子沒有用到該字時，顯示 “Try using the word *X* in your sentence.”，不呼叫 `getSentenceFeedback`，也不儲存。
- 有用到時，儲存 `{ text, feedback: null }`，接著呼叫 `getSentenceFeedback`；等待期間顯示 `role="status"` 的 “Checking your sentence…”；成功後儲存回饋，並顯示 `feedback` 與 `suggestion`。
- 回饋失敗時，句子仍算完成，顯示 “Feedback isn’t available right now.” 與 “Try again” 按鈕；按下後重新請求。
- 修改句子再送出，會覆蓋前一次的句子與回饋。

`SpellingTestStep`：
- 每題依序呼叫 `speakAsync(word)`、`speakAsync(sentence)`、`speakAsync(word)`，三次都帶 `{ reportErrors: true }`；`sentence` 為 null 時只唸單字兩次。
- 有重聽按鈕。
- 語音失敗時顯示錯誤、提示到「設定」調整語音模式，並提供重試；這題不記錄答案。
- 作答時不顯示對錯；送出後記錄 `testAnswer`，進入下一題。
- 最後一題作答後顯示 “Finish test” 按鈕；按下後呼叫 `onFinish`，等待期間按鈕 disabled（連點只呼叫一次）。

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/components/WordPractice/steps/sentenceAndTest.test.tsx`
Expected: FAIL

- [ ] **Step 3: 實作元件**

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/components/WordPractice/steps/sentenceAndTest.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/WordPractice
git commit -m "feat(word-practice): add sentence writing and spelling test steps"
```

---

### Task 15: 生詞本的 CEFR 等級徽章

**Files:**
- Create: `src/hooks/useCefrLevels.ts`
- Create: `src/components/common/CefrBadge.tsx`
- Modify: `src/components/Vocabulary/VocabularyRow.tsx`（新增 optional prop `cefr?: CefrInfo | null`，放在單字旁邊）
- Modify: `src/components/Vocabulary/WordDetailPanel.tsx`（新增 optional prop `cefr`，放在 `h2` 單字旁，約 `:129`）
- Modify: `src/components/Vocabulary/WordDetail.tsx`（轉傳 `cefr`）
- Modify: `src/components/Vocabulary/VocabularyBook.tsx`（呼叫 hook，把 `levelOf(word.word)` 傳下去）
- Test: `src/components/common/CefrBadge.test.tsx`、`src/hooks/useCefrLevels.test.tsx`

**Interfaces:**
- Consumes: Task 3 `loadCefrTable`、`resolveCefr`；Task 7 `loadPracticeState`。
- Produces: `useCefrLevels(): { ready: boolean; levelOf: (word: string) => CefrInfo | null }`；`CefrBadge` props `{ info: CefrInfo }`。

- [ ] **Step 1: 寫失敗的測試**

- `CefrBadge`：`{level:"B1",source:"list"}` 顯示 `B1`，`aria-label="CEFR B1"`；`{level:"B1",source:"ai"}` 顯示 `≈B1`，`aria-label="CEFR 估計 B1"`，兩者的樣式 class 不同。
- `useCefrLevels`：表格與估計值載入前 `ready` 為 false，`levelOf` 回傳 null；載入後查表字回傳 `source: "list"`，只有估計值的字回傳 `source: "ai"`；`loadPracticeState` 失敗時仍可使用查表結果。
- 生詞本本身不呼叫任何 Gemini 函式：測試 mock `wordPracticeAi`，斷言沒有任何呼叫。

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/components/common/CefrBadge.test.tsx src/hooks/useCefrLevels.test.tsx`
Expected: FAIL

- [ ] **Step 3: 實作並接到生詞本**

- [ ] **Step 4: 執行測試確認通過，並跑生詞本既有測試**

Run: `npx vitest run src/components/common/CefrBadge.test.tsx src/hooks/useCefrLevels.test.tsx src/components/Vocabulary src/hooks/useVocabulary.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCefrLevels.ts src/hooks/useCefrLevels.test.tsx src/components/common/CefrBadge.tsx src/components/common/CefrBadge.test.tsx src/components/Vocabulary
git commit -m "feat(vocabulary): show CEFR level badges"
```

---

### Task 16: README、整體驗證

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README**

- Features 表格在 Smart Vocabulary Book 下面新增「**Word Practice** (單字練習)」：依 CEFR 等級從生詞本產生功課，包含六個打字練習、Gemini 造句回饋、自動批改的拼字考試，以及雲端進度。
- Smart Vocabulary Book 那一列補上 CEFR 等級徽章。
- Prerequisites 段落提到要合併 `word-practice-firestore-rules.fragment`。
- 專案結構加入 `src/components/WordPractice/`、`src/data/cefr/` 與規則片段。
- 新增「Acknowledgements」段落，放 Global Constraints 中的出處文字與授權。

- [ ] **Step 2: 執行完整檢查**

Run: `npm run lint` → 無錯誤
Run: `npm run test` → 全部通過
Run: `npm run build` → 成功；輸出中 `cefrLevels` 是獨立的 chunk，不在主 bundle 裡

- [ ] **Step 3: 瀏覽器實測（需要 Google 登入，若無法登入則在交付說明中註明未驗證）**

`npm run dev` 後依 spec §12 的驗收情境 1–11 逐一操作，並在淺色／深色、1440px／768px 下截圖。此步需要部署前先合併 Firestore 規則片段。

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document word practice homework"
```
