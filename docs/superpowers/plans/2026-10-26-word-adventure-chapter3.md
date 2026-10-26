# 單字大冒險第三章與句子填空 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增第三章「珊瑚海底王國」10 關、等級上限 15 → 20，以及只在第三章出現的新題型「句子填空」(`cloze`)。

**Architecture:** `cloze` 是第六種 `QuizKind`，由 `quizQuestions.ts` 從 `GameWord.example` 出題，挖空沿用 `src/utils/wordForms.ts`；無可用例句時該題改出 `reverse`。例句由三個單字來源（單字本、AI、內建備用字）各自帶入 `GameWord`。關卡、章節、場景、等級表、成就都是資料變更。

**Tech Stack:** React + TypeScript + Vite，vitest，Tailwind/daisyUI，framer-motion，Firestore。

**Spec:** `docs/superpowers/specs/2026-10-26-word-adventure-chapter3-design.md`

## Global Constraints

- 第一、二章的關卡、題型、數值不變（只有 spec §6 的成就修正）。
- 不為句子填空額外呼叫 Gemini；例句缺翻譯就不顯示翻譯。
- 關卡、章節名稱只有中文（照前兩章）；新的 UI 文字和成就描述要在 `src/i18n/messages/adventure.ts` 中英兩版都加。
- 程式註解用繁體中文，風格照周圍程式碼。
- 測試不打真的 Gemini。手動驗證時 Gemini 呼叫要少、間隔開，遇到 429／額度錯誤就停，不重試。
- 每個 task 結束跑：`npx vitest run <相關檔案>`；最後一個 task 跑全部 `npm test`、`npm run lint`、`npx tsc -b`。

## Review Focus

1. 句子裡只有所有格（`The puppy's ball is red.`）→ 該題改出 `reverse`，畫面上不會出現 `puppy`。（Task 1 測試）
2. 不規則變化（考 `run`，句子是 `She ran home.`）→ 挖空成 `She _____ home.`，選項顯示 `run`。（Task 1 測試）
3. 整個單字池都沒有例句、關卡又宣告 `cloze` → 全部退回 `reverse`，題數不變，魔王仍打得倒。（Task 1 測試）
4. 句子填空答對**不**自動跳題，但其他題型答對仍 1.5 秒自動跳題；一般關卡與魔王戰都一樣。（Task 3 測試）
5. 瀏覽器不支援語音（`speak` 為 undefined）→ 句子填空照常出題、答完不念、沒有「再聽一次」按鈕，不報錯。（Task 3 手動驗證）

---

### Task 1: 句子填空出題

**Files:**
- Modify: `src/types/game.ts`（`QuizKind`、新 `ClozeQuestion`、`QuizQuestion` union）
- Modify: `src/services/aiService.ts:48-53`（`GameWord` 加兩個可選欄位，本 task 只改型別）
- Modify: `src/components/Game/quizQuestions.ts`（`buildOne`、`buildQuizQuestions`）
- Modify: `src/utils/wordForms.ts`（新增 `splitWordForms`）
- Test: `src/components/Game/quizQuestions.test.ts`、`src/utils/wordForms.test.ts`

**Interfaces:**
- Produces:
  - `type QuizKind = "meaning" | "listen" | "spell" | "reverse" | "emoji" | "cloze"`
  - `interface ClozeQuestion extends BaseQuestion { kind: "cloze"; prompt: string /* 挖空句 */; options: string[]; correctIndex: number; sentence: string /* 原句 */; translation?: string }`
  - `type QuizQuestion = OptionQuestion | SpellQuestion | ClozeQuestion`
  - `GameWord` 新增 `example?: string; exampleZh?: string`
  - `splitWordForms(text: string, word: string): { text: string; match: boolean }[]` — 依序切出原句片段，`match: true` 的是 `word` 的任一字形（所有格的 `'s` 不算在 match 內）；串回去等於原句。
  - `isQuestionCorrect` 對 `cloze` 用 `correctIndex` 判斷（現有的非 spell 分支已涵蓋，不需改）。

- [ ] **Step 1: 寫失敗的測試**（`quizQuestions.test.ts` 新增 `describe("cloze")`，stage 用 `questionKinds: ["cloze"]`）
  - `builds a blanked sentence with word options`：池中每字都有 `example`（如 `apple` → `"I eat an apple every day."`）；斷言 `kind === "cloze"`、`prompt` 含 `CLOZE_BLANK` 且不含 `apple`（不分大小寫）、`sentence` 等於原句、`options[correctIndex] === "apple"`、`options` 長度 4 且不重複。
  - `blanks an irregular form`：`run` 的 `example` 為 `"She ran home."` → `prompt === "She _____ home."`、正解選項 `run`。
  - `falls back to reverse when the sentence only has a possessive`：`dog` 的 `example` 為 `"The dog's ball is red."` → `kind === "reverse"`。
  - `falls back to reverse when the word has no example`：無 `example` → `kind === "reverse"`，題數等於 `count`。
  - `carries the translation`：`exampleZh: "我每天吃一顆蘋果。"` → `translation` 相同；無 `exampleZh` 時 `translation` 為 `undefined`。
  - `fallback reverse uses the round's definition language`：`defLanguage: "en"`、無例句 → `prompt` 為英文釋義、不含 CJK。
  - `wordForms.test.ts`：`splitWordForms("Dogs love to run, and my dog runs.", "dog")` 的 match 片段為 `["Dogs", "dog"]`，`map(p => p.text).join("")` 等於原句；`splitWordForms("The puppy's toy", "puppy")` match 片段為 `["puppy"]`。

- [ ] **Step 2: 跑測試確認失敗**
  Run: `npx vitest run src/components/Game/quizQuestions.test.ts src/utils/wordForms.test.ts`
  Expected: FAIL（`cloze` 不存在／`splitWordForms` 未定義）

- [ ] **Step 3: 實作**
  - `splitWordForms`：用 `matcherFor(word, true)` 跑 `matchAll`，切出 match 與非 match 片段。
  - `buildOne` 新增 `cloze` 分支：`prompt = redactWordForms(example, word.word)`，選項用 `makeOptions(word.word, pool.map(w => w.word), FALLBACK_WORDS, padLabel)`。
  - `buildQuizQuestions`：在現有 emoji 退回邏輯旁加上「`kind === "cloze"` 且（無 `example` 或 `!sentenceUsesWord(example, word.word)`）→ `kind = "reverse"`」。
  - 更新 `game.ts` 中 `OptionQuestion` 上方的題型說明註解，加上 cloze。

- [ ] **Step 4: 跑測試確認通過**
  Run: `npx vitest run src/components/Game/quizQuestions.test.ts src/utils/wordForms.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit** — `feat(game): add the sentence cloze question kind`

---

### Task 2: 三個單字來源帶入例句

**Files:**
- Modify: `src/services/aiService.ts:407-470`（`generateGameWords` prompt 與正規化）
- Modify: `src/services/gameService.ts:114-140`（`prepareGamePool`）
- Modify: `src/services/gameWords.ts`（`GameWordSeed` 加 `example: string; exampleZh: string`，20 個字都補）
- Test: `src/services/aiService.test.ts`、`src/services/gameWords.test.ts`、`src/services/gameService.test.ts`（新建）

**Interfaces:**
- Consumes: Task 1 的 `GameWord.example?` / `exampleZh?`；`sentenceUsesWord` from `src/utils/wordForms.ts`。
- Produces: 三個來源產出的 `GameWord` 都可能帶 `example` / `exampleZh`。

- [ ] **Step 1: 寫失敗的測試**
  - `gameWords.test.ts`：`every fallback word has an example that uses it` — 每個 seed `sentenceUsesWord(seed.example, seed.word)` 為 true、`HAS_CJK.test(seed.exampleZh)` 為 true、`HAS_CJK.test(seed.example)` 為 false。
  - `aiService.test.ts`：`normalizes game word examples` — mock 回傳 `[{ word: "brave", def: "勇敢的", defEn: "not afraid", emoji: "🦁", example: " The brave girl jumped. ", exampleZh: "勇敢的女孩跳了。" }, { word: "calm", def: "冷靜的", emoji: "😌", example: 3 }]` → 第一個 `example === "The brave girl jumped."`、`exampleZh` 相同；第二個 `example`、`exampleZh` 皆 `undefined`。
  - `gameService.test.ts`（mock `./aiService`）：`picks the first example that uses the word` — `VocabularyWord` 的 `examples: [{ sentence: "Bark loudly." }, { sentence: "My dog barks.", translation: "我的狗在叫。" }]`、`word: "dog"`（構造 4 個字讓它不打 AI）→ 該字 `example === "My dog barks."`、`exampleZh === "我的狗在叫。"`；`examples: []` 的字 `example` 為 `undefined`。

- [ ] **Step 2: 跑測試確認失敗**
  Run: `npx vitest run src/services/gameWords.test.ts src/services/aiService.test.ts src/services/gameService.test.ts`
  Expected: FAIL

- [ ] **Step 3: 實作**
  - `prepareGamePool`：`const ex = w.examples?.find(e => sentenceUsesWord(e.sentence, w.word))`，`example: ex?.sentence`、`exampleZh: ex?.translation?.trim() || undefined`。
  - `generateGameWords` prompt 加兩行並更新 Example format：
    - `"example": One short, simple English sentence (8-15 words) a 12-year-old can read. It MUST contain the target word (an inflected form like "ran" or "dogs" is fine).`
    - `"exampleZh": The Traditional Chinese translation of "example".`
  - 正規化：非空字串才保留並 trim，否則 `undefined`；不因缺例句丟掉整個字。
  - `gameWords.ts`：手寫 20 句簡單例句與繁中翻譯。

- [ ] **Step 4: 跑測試確認通過**（同 Step 2 指令，Expected: PASS）

- [ ] **Step 5: Commit** — `feat(game): carry example sentences into the game word pool`

---

### Task 3: 句子填空的畫面與答完流程

**Files:**
- Modify: `src/components/Game/QuizCard.tsx`（題幹、回饋區、`PROMPT_HINT`、「下一題」按鈕條件、答完自動念）
- Modify: `src/hooks/useAdventure.ts:861-868`（cloze 答對不自動跳題）
- Modify: `src/i18n/messages/adventure.ts`（中英各加 key）
- Test: `src/hooks/useAdventure.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `ClozeQuestion`、`splitWordForms`。

- [ ] **Step 1: 寫失敗的測試**（`useAdventure.test.tsx`）
  - `keeps a correct cloze answer on screen until the player moves on`：讓 `mocks.buildQuizQuestions` 回傳 `kind: "cloze"` 題（帶 `prompt`、`sentence`、`options`、`correctIndex: 0`），`submitAnswer(0)` 後 `advanceTimersByTimeAsync(2_000)`，`current.quizState?.currentIndex` 仍為 0；呼叫 `current.advanceQuestion()` 後變 1。
  - 現有 `meaning` 題答對 1.5 秒自動跳題的測試維持通過（若沒有就加一個 `still auto-advances a correct meaning answer`）。

- [ ] **Step 2: 跑測試確認失敗**
  Run: `npx vitest run src/hooks/useAdventure.test.tsx`
  Expected: FAIL（cloze 題被自動跳過）

- [ ] **Step 3: 實作**
  - `useAdventure.ts`：自動跳題條件改為 `isCorrect && currentQuestion.kind !== "cloze"`，註解說明原因（要留時間看完整句子和翻譯）。
  - `QuizCard.tsx`：
    - 題幹：`cloze` 顯示 `question.prompt`（英文句子，字級比單字題小，例如 `text-xl`，可換行）。
    - `PROMPT_HINT.cloze = "adventure.quiz.prompt.cloze"`。
    - 回饋區（`isAnswered` 時，cloze 專屬）：用 `splitWordForms(question.sentence, question.word)` 顯示原句、match 片段加粗；有 `translation` 時下一行顯示；`speak` 存在時放「再聽一次整句」按鈕（`Volume2`，aria-label 用新 key），按下 `speak(question.sentence)`。
    - 答完自動念：`useEffect` 在 `isAnswered && question.kind === "cloze"` 變成 true 時 `speak?.(question.sentence)` 一次。
    - 「下一題」按鈕條件改為 `onNext && (lastAnswerCorrect === false || question.kind === "cloze")`。
  - i18n（中／英）：
    - `adventure.quiz.prompt.cloze`：「選出空格裡的單字！」／「Pick the word that fits the blank!」
    - `adventure.quiz.listenSentence`：「再聽一次整句」／「Hear the sentence again」

- [ ] **Step 4: 跑測試確認通過**
  Run: `npx vitest run src/hooks/useAdventure.test.tsx`
  Expected: PASS

- [ ] **Step 5: Commit** — `feat(game): show the full sentence after a cloze answer`

---

### Task 4: 第三章關卡資料與等級上限

**Files:**
- Modify: `src/services/gameProgressService.ts`（`STAGES` 尾端加 10 關、`LEVEL_EXP_TABLE` 加 5 級）
- Modify: `src/constants/chapters.ts`、`src/constants/sceneThemes.ts`、`src/components/Game/BossBattle.tsx`（`BOSS_EMOJI`）
- Test: `src/services/gameStages.test.ts`、`src/components/Game/adventureLevelProgress.test.ts`

**Interfaces:**
- Produces: `CHAPTERS` 第三筆 `{ id: "ch3", name: "第三章 · 珊瑚海底王國", subtitle: "潛進閃閃發光的海底世界", firstStageIndex: 23 }`；`STAGES.length === 33`。

- [ ] **Step 1: 寫失敗的測試**
  - `gameStages.test.ts`：`QUIZ_KINDS` 加 `"cloze"`；`maps stage indices to the right chapter` 加 `getChapterForStageIndex(22).id === "ch2"`、`(23) === "ch3"`、最後一關改成 `"ch3"`；新增 `has 33 stages ending with the deep sea whale king`（`STAGES.length === 33`、`STAGES[32].id === "boss-11"`）；新增 `only chapter 3 uses cloze`（`cloze` 只出現在 `chapterId === "ch3"` 的關卡）；新增 `every chapter 3 stage has a scene theme and every chapter 3 boss has an emoji`（若 `BOSS_EMOJI` 未 export，改為 export）。
  - `adventureLevelProgress.test.ts`：`LEVEL_EXP_TABLE.length === 20`、`LEVEL_EXP_TABLE.slice(15)` 等於 `[11000, 13000, 15200, 17600, 20200]`；Lv15、EXP 12000 時 `isMaxLevel === false`；Lv20 時 `isMaxLevel === true`。

- [ ] **Step 2: 跑測試確認失敗**
  Run: `npx vitest run src/services/gameStages.test.ts src/components/Game/adventureLevelProgress.test.ts`
  Expected: FAIL

- [ ] **Step 3: 實作**（數值照 spec §4，魔王 `questionCount` 依 `bossHp + 3`）

  | id | name | stageNumber | isBoss | requiredLevel | questionCount | bossHp | rewardExp | rewardCoins | questionKinds |
  |---|---|---|---|---|---|---|---|---|---|
  | stage-16 | 珊瑚礁淺灘 | 24 | false | 14 | 6 | – | 600 | 45 | cloze, meaning |
  | stage-17 | 水母燈籠街 | 25 | false | 14 | 6 | – | 640 | 45 | emoji, reverse |
  | stage-18 | 海龜驛站 | 26 | false | 15 | 6 | – | 680 | 50 | cloze, listen |
  | boss-9 | 章魚守門人 | 27 | true | 15 | 9 | 6 | 1600 | 90 | cloze, listen |
  | stage-19 | 沉船寶藏 | 28 | false | 16 | 6 | – | 720 | 50 | reverse, spell |
  | stage-20 | 珍珠貝殼宮 | 29 | false | 16 | 6 | – | 760 | 55 | cloze, spell |
  | boss-10 | 鯊魚船長 | 30 | true | 17 | 11 | 8 | 2000 | 120 | cloze, spell, emoji |
  | stage-21 | 深海螢光森林 | 31 | false | 17 | 7 | – | 820 | 55 | meaning, listen, reverse, emoji, spell, cloze |
  | stage-22 | 海底火山 | 32 | false | 18 | 7 | – | 880 | 60 | 同上 |
  | boss-11 | 深海鯨王 | 33 | true | 19 | 13 | 10 | 2400 | 160 | 同上 |

  全部 `chapterId: "ch3"`，前面加 `// ===== 第三章「珊瑚海底王國」=====`。場景主題的漸層、粒子、accent 照 spec §4.1；`glowColor` 用 accent 色的 rgba（一般 0.3、魔王 0.4），描述一句話自由發揮。`BOSS_EMOJI`：`boss-9` 🐙、`boss-10` 🦈、`boss-11` 🐋。`LEVEL_EXP_TABLE` 註解「Level 15 (最高)」改到 Level 20。

- [ ] **Step 4: 跑測試確認通過**（同 Step 2 指令，Expected: PASS）

- [ ] **Step 5: Commit** — `feat(game): add chapter 3, the coral sea kingdom`

---

### Task 5: 成就

**Files:**
- Modify: `src/constants/achievements.ts`、`src/i18n/messages/adventure.ts`
- Test: `src/constants/achievements.test.ts`（新建；需 `vi.mock("../utils/firebaseUtil", () => ({ db: {} }))`，照 `gameStages.test.ts`）

**Interfaces:**
- Consumes: Task 4 的 `CHAPTERS`（`ch3.firstStageIndex`）、`STAGES.length`。

- [ ] **Step 1: 寫失敗的測試**（用 `DEFAULT_PLAYER_PROGRESS` 展開成 progress，取 `ACHIEVEMENTS` 中對應 id）
  - `chapter2-clear unlocks after the dream queen`：`currentStageIndex: 23` → true；`22` → false。
  - `chapter3-clear unlocks after the whale king`：`33` → true；`32` → false。
  - `level-max still unlocks at 15`、`level-20 unlocks at 20`（`level: 19` → false）。
  - `boss-conqueror still needs 8 boss wins`。

- [ ] **Step 2: 跑測試確認失敗**
  Run: `npx vitest run src/constants/achievements.test.ts`
  Expected: FAIL

- [ ] **Step 3: 實作**
  - `level-max`：description「達到等級 15」；i18n 中「達到等級 15」／英「Reach level 15」。
  - 新增 `level-20`：name「單字傳奇」、description「達到最高等級 20」、icon 🏆、`p.level >= 20`、rarity `rainbow`，放在 `level-max` 後；i18n 中「達到最高等級 20」／英「Reach the top level, 20」。
  - `chapter2-clear`：`p.currentStageIndex >= ch3.firstStageIndex`，從 `CHAPTERS.find(c => c.id === "ch3")` 取，不寫死 23。
  - 新增 `chapter3-clear`：name「海底傳說」、description「通關珊瑚海底王國」、icon 🐋、`p.currentStageIndex >= STAGES.length`、rarity `rainbow`，放在 `chapter2-clear` 後；i18n 中「通關珊瑚海底王國」／英「Clear all of Chapter 3」。

- [ ] **Step 4: 跑測試確認通過**（同 Step 2 指令，Expected: PASS）

- [ ] **Step 5: Commit** — `feat(game): add chapter 3 and level 20 achievements`

---

### Task 6: 全面驗證

- [ ] **Step 1:** `npm test` → 全部 PASS。
- [ ] **Step 2:** `npm run lint` → 無錯誤；`npx tsc -b` → 無錯誤。
- [ ] **Step 3: 瀏覽器手動驗證**（`preview_start`，以已有進度或測試帳號進到第三章；必要時在本機暫時調高 `currentStageIndex`，驗證後還原，不 commit）：
  - 地圖顯示第三章分隔與章節鎖；10 關的場景主題、魔王外觀正確。
  - 「珊瑚礁淺灘」出現句子填空：句子看不到答案；答對不自動跳題，顯示完整句子（答案字加粗）、有翻譯時顯示翻譯、自動念整句、可再聽一次，按「下一題」繼續。
  - 答錯時同樣顯示完整句子與「下一題」。
  - 其他題型答對仍自動跳題。
  - 成就面板：「語言大師」描述為「達到等級 15」，「單字傳奇」「海底傳說」出現。
  - 截圖留證。
