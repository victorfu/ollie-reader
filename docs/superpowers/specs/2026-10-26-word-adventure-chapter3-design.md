# 單字大冒險第三章「珊瑚海底王國」與句子填空題型

<metadata>
date: 2026-10-26
status: 設計中，待確認
scope: 單字大冒險（Word Adventure）新增第三章 10 關、等級上限 15 → 20、新題型「句子填空」(cloze)
audience: 開發者本人；私人使用、不公開發行。
</metadata>

標記說明：**【你決定】** 是對話中你明確說過的；**【我的決定】** 是寫文件時我自己做的選擇，可以推翻。

## 1. 為什麼要做

- 第二章「雲頂星夢國」打完就沒有新關卡了，要繼續設計更多關卡 **【你決定】**。
- 第三章要帶一種新題型 **【你決定】**，選的是「句子填空」**【你決定】**。現有五種題型（看字選意思、聽音、看表情符號、反向選字、拼字）都在練「字和意思的對應」，句子填空是第一個練「這個字在句子裡怎麼用」的題型。
- 英文功課 10/25 加過又拿掉「例句填空」，因為用起來沒有幫助。遊戲版的情況不一樣，照做 **【你決定】**。差別是：功課版要打出句子裡的實際字形，夾在抄寫、默寫、造句之間；遊戲版是四選一，答完念整句並顯示翻譯。

## 2. 目標、非目標、反目標

**目標**
- 第三章 10 關（7 一般、3 魔王），接在第二章「星夢女王」之後，用和第二章一樣的章節分隔、章節鎖。
- 句子填空題型，只在第三章（以及之後的章節）出現。
- 等級上限延伸到 Lv20，讓第三章有升級空間。

**非目標**
- 不改第一、二章的關卡、題型或數值（唯一例外是 §6 的成就修正）。
- 不為句子填空呼叫額外的 Gemini（例句缺翻譯也不即時補翻譯）。
- 不把關卡名稱、章節名稱做雙語；第一、二章目前也只有中文，第三章照舊。新的 UI 文字（題目提示等）照現有 i18n 做中英兩版。

**反目標（做出來但等於失敗）**
- 句子裡還看得到答案（例如挖了 `puppy` 卻留下 `puppy's`、挖了 `run` 卻留下 `ran`）。
- 單字池沒有例句時整輪出不了題，或卡住。
- 答對後句子和翻譯一閃就跳題，玩家根本看不到。

## 3. 句子填空題型

### 3.1 題目長相 【你決定（四選一、作答前不顯示翻譯）】

```
把空格選出正確的單字！

The team showed great _____ and finished the race.

  [ perseverance ]  [ magnificent ]
  [ curious ]       [ whisper ]
```

- 題幹是挖空後的英文例句。**作答前不顯示中文翻譯** **【你決定】**。
- 四選一，選項是單字原形（單字本裡記的寫法），不是句子裡的變化形 **【我的決定】**。例如句子是 `ran`，正解選項顯示 `run`。
- 答錯扣命、連擊、魔王扣血、計時都沿用現有選擇題規則。

### 3.2 答完之後 【你決定（答完顯示完整句子和翻譯）】

- 回饋區顯示**完整句子**，空格填回句子裡實際的字形並加粗標示；下方顯示**中文翻譯**（有的話）。沒有翻譯就只顯示英文句子 **【你決定】**。
- 回饋區有「再聽一次」按鈕，念整句 **【我的決定】**。答完自動念一次整句（瀏覽器支援語音時）**【我的決定】**。
- **句子填空答對也不自動跳題**，和答錯一樣出現「下一題」按鈕 **【我的決定】**。現在答對 1.5 秒自動跳題，來不及讀句子和翻譯、也聽不完整句。其他題型行為不變。

### 3.3 例句從哪裡來 【我的決定】

`GameWord` 新增兩個可選欄位：`example?: string`（英文例句）、`exampleZh?: string`（中文翻譯）。

| 單字來源 | 例句 | 翻譯 |
|---|---|---|
| 單字本（`prepareGamePool`） | 第一個**用得上**的例句：依序找 `examples[]` 中句子裡找得到這個字（§3.4）的那一句 | 該例句的 `translation`（大多沒有） |
| AI 產生的單字（`generateGameWords`） | prompt 多要一個 `example`：一句簡單、12–14 歲讀得懂、**必須包含該字**的英文句子 | prompt 同時要 `exampleZh` 繁體中文翻譯 |
| 內建 20 個備用字（`gameWords.ts`） | 手寫補上 | 手寫補上 |

- 單字本的例句順序和意思一一對應，遊戲用的是第一個意思；優先用第一句，第一句找不到字才往後找，避免意思錯位的情況盡量少。
- AI 回傳的 `example` 若找不到該字（§3.4 比對失敗），當作沒有例句，不丟掉整個字。

### 3.4 挖空 【我的決定】

- 直接用現有的 `src/utils/wordForms.ts`：`sentenceUsesWord` 判斷句子能不能用，`redactWordForms` 挖空，`findWordForm` 取出句子裡實際的字形供答完後填回。它已處理字尾變化、`IRREGULAR_FORMS` 不規則變化（`run` → `ran`）、所有格（`puppy's` 的 `'s` 留在外面）、標點、同句出現兩種字形全部挖掉。
- 限制：`sentenceUsesWord` / `findWordForm` 不認所有格，句子裡**只有** `puppy's` 這種寫法時視為不能用，退回 `reverse`（§3.6）。不會洩答，只是少出一些填空，接受 **【我的決定】**。
- `findWordForm` 只回傳第一個字形；同句有兩種字形時，答完填回不能把同一個字形塞進每個空格。答完顯示時改成「原句照原樣顯示，把每個符合的字形加粗」，不需要 `answerForm` 欄位 **【我的決定】**。
- 不用 `quizQuestions.ts` 裡的 `redactHeadword`（只砍字尾、不認不規則變化）。
- 空格符號用 `CLOZE_BLANK`。

### 3.5 選項 【我的決定】

- 干擾項：從同一輪單字池隨機挑 3 個其他單字原形，沿用 `makeOptions` 的去重與 `FALLBACK_WORDS` 補位。
- 不做「同詞性干擾項」，AI 字沒有詞性資料。實際玩起來太好猜，再另外加強。

### 3.6 沒辦法出填空時的退路 【我的決定】

- 這一題的字沒有可用例句 → 改出 `reverse`（反向選字）。和 emoji 題遇到預設 ✨ 退回 meaning 是同一種處理，放在 `buildQuizQuestions` 同一段。
- 不換字，只換題型；題數不變，所以魔王戰「題數 ≥ HP」的保證不受影響。

### 3.7 中英釋義模式

- 句子填空不用釋義，題幹永遠是英文句子、選項永遠是英文單字；英文釋義模式（`defLanguage: "en"`）下行為一樣。
- 退回 `reverse` 時照該輪語言出釋義，和現在一樣。

### 3.8 型別

- `QuizKind` 加上 `"cloze"`。
- 新增 `ClozeQuestion`（`kind: "cloze"`、`prompt`＝挖空句、`options`、`correctIndex`、`sentence`＝原句、`translation?`），或擴充 `OptionQuestion` 帶這些欄位。選哪一種留給實作。`isQuestionCorrect` 照選項題判斷。
- `PROMPT_HINT` 新增 `adventure.quiz.prompt.cloze`：「選出空格裡的單字！」／「Pick the word that fits the blank!」。

## 4. 第三章關卡

章節：`ch3`「第三章 · 珊瑚海底王國」，副標「潛進閃閃發光的海底世界」**【我的決定】**，`firstStageIndex: 23`。主題選海底，和前兩章（草原、糖果天空）色調差最多 **【我的決定】**。

| index | id | 名稱 | 類型 | 需求等級 | 題數 | 魔王 HP | EXP | 代幣 | 題型 |
|---|---|---|---|---|---|---|---|---|---|
| 23 | stage-16 | 珊瑚礁淺灘 | 一般 | 14 | 6 | – | 600 | 45 | cloze, meaning |
| 24 | stage-17 | 水母燈籠街 | 一般 | 14 | 6 | – | 640 | 45 | emoji, reverse |
| 25 | stage-18 | 海龜驛站 | 一般 | 15 | 6 | – | 680 | 50 | cloze, listen |
| 26 | boss-9 | 章魚守門人 | 魔王 | 15 | 9 | 6 | 1600 | 90 | cloze, listen |
| 27 | stage-19 | 沉船寶藏 | 一般 | 16 | 6 | – | 720 | 50 | reverse, spell |
| 28 | stage-20 | 珍珠貝殼宮 | 一般 | 16 | 6 | – | 760 | 55 | cloze, spell |
| 29 | boss-10 | 鯊魚船長 | 魔王 | 17 | 11 | 8 | 2000 | 120 | cloze, spell, emoji |
| 30 | stage-21 | 深海螢光森林 | 一般 | 17 | 7 | – | 820 | 55 | 六種混合 |
| 31 | stage-22 | 海底火山 | 一般 | 18 | 7 | – | 880 | 60 | 六種混合 |
| 32 | boss-11 | 深海鯨王 | 最終魔王 | 19 | 13 | 10 | 2400 | 160 | 六種混合 |

- 魔王實際題數由 `useAdventure.ts` 決定：`bossHp + BOSS_QUESTION_BUFFER(3)`，不讀 `questionCount`。表中魔王題數照這個公式填 **【我的決定】**，不改公式（改了會動到第一、二章魔王）。
- 一般關卡全破一次的 EXP 不夠直接升到最終魔王的需求等級，要重打幾關；第二章現在也是這樣，視為刻意。
- 「六種混合」＝ `["meaning", "listen", "reverse", "emoji", "spell", "cloze"]`。
- 第一關先搭最熟的 meaning 讓玩家認識新題型；之後 cloze 出現在大多數關卡。
- 數值皆為 **【我的決定】**，延續第二章的遞增節奏；實作後若升級太慢或太快再調。

### 4.1 場景主題（`sceneThemes.ts`）【我的決定】

| id | 漸層 | 粒子 | accent |
|---|---|---|---|
| stage-16 珊瑚礁淺灘 | from-cyan-100 via-teal-100 to-sky-100 | 🐠 🪸 🫧 🐚 ✨ 🌊 | cyan |
| stage-17 水母燈籠街 | from-violet-100 via-sky-100 to-fuchsia-100 | 🪼 🏮 🫧 ✨ 💜 🌟 | violet |
| stage-18 海龜驛站 | from-emerald-100 via-cyan-100 to-teal-100 | 🐢 🌿 🫧 🐟 ✨ 🌊 | emerald |
| boss-9 章魚守門人 | from-purple-200 via-violet-100 to-cyan-100 | 🐙 🫧 🌊 ✨ 🛡️ 💫 | purple |
| stage-19 沉船寶藏 | from-amber-100 via-yellow-100 to-cyan-100 | ⚓ 💰 🪙 🫧 ✨ 🗝️ | amber |
| stage-20 珍珠貝殼宮 | from-rose-100 via-pink-50 to-sky-100 | 🦪 🐚 💎 🫧 ✨ 👑 | rose |
| boss-10 鯊魚船長 | from-slate-200 via-sky-100 to-blue-100 | 🦈 🏴‍☠️ ⚓ 🌊 ⚡ 💫 | slate |
| stage-21 深海螢光森林 | from-indigo-200 via-teal-100 to-emerald-100 | ✨ 🪼 🌿 💡 🫧 🌟 | teal |
| stage-22 海底火山 | from-orange-100 via-red-100 to-indigo-100 | 🌋 🔥 🫧 💥 ✨ 🌊 | orange |
| boss-11 深海鯨王 | from-blue-200 via-indigo-100 to-cyan-100 | 🐋 🌊 👑 ✨ 💫 🌟 | blue |

描述文字自由發揮（一句話，和前兩章同風格）。`glowColor` 依 accent 色。

### 4.2 魔王外觀（`BossBattle.tsx` 的 `BOSS_EMOJI`）

`boss-9` 🐙、`boss-10` 🦈、`boss-11` 🐋。

## 5. 等級上限 15 → 20 【我的決定】

`LEVEL_EXP_TABLE` 照目前的遞增（每級多 200）往後接：

| 等級 | 16 | 17 | 18 | 19 | 20（最高） |
|---|---|---|---|---|---|
| 總 EXP | 11000 | 13000 | 15200 | 17600 | 20200 |

- 升級邏輯（`calculateLevelUp`、`getAdventureLevelProgress`、結算）都讀表長，沒有寫死 15，不用改邏輯。
- 舊存檔：`progressFromData` 每次載入都會用 `calculateLevelUp` 修正等級，所以 Lv15 且已有多餘 EXP 的存檔，一載入就會直接升級。

## 6. 成就

- **修正「星夢傳說」（`chapter2-clear`）**：現在是 `currentStageIndex >= STAGES.length`，加關後會變成要破第三章才拿得到。改成 `>= 23`（第三章 `firstStageIndex`，從 `CHAPTERS` 取，不寫死數字）。
- **新增「海底傳說」（`chapter3-clear`）**：「通關珊瑚海底王國」，🐋，`currentStageIndex >= STAGES.length`，rarity `rainbow` **【我的決定】**。中英文 i18n 都加。
- **「語言大師」（`level-max`）維持 `level >= 15`，描述改成「達到等級 15」／「Reach level 15」** **【你決定】**。`achievements.ts` 和 `adventure.ts` 中英文都要改。
- **新增 Lv20 成就** **【你決定】**：id `level-20`，「單字傳奇」，描述「達到最高等級 20」／「Reach the top level, 20」，🏆，`level >= 20`，rarity `rainbow`（名稱、圖示、id 為 **【我的決定】**）。
- **「魔王剋星」（`boss-conqueror`）維持 `>= 8` 不改** **【我的決定】**。成就是每次依進度即時計算、不存檔（`AchievementsPanel`、`AdventureHome`），調高門檻會讓已拿到的玩家「掉」成就；而且 `totalBossDefeated` 是累積次數（重打也算），本來就不是「每隻都打過」。

## 7. 要動的檔案（給實作參考）

- `src/types/game.ts`：`QuizKind` 加 `cloze`、新題目型別。
- `src/services/aiService.ts`：`GameWord` 加 `example?` / `exampleZh?`；`generateGameWords` prompt 與正規化。
- `src/services/gameService.ts`：`prepareGamePool` 帶出例句。
- `src/services/gameWords.ts`：20 個備用字補例句與翻譯。
- `src/components/Game/quizQuestions.ts`：出 cloze 題、退回 reverse。
- `src/components/Game/QuizCard.tsx`：cloze 題幹、答完的完整句子＋翻譯＋念整句。
- `src/hooks/useAdventure.ts`：cloze 答對不自動跳題。
- `src/services/gameProgressService.ts`：`STAGES` 加 10 關、`LEVEL_EXP_TABLE`。
- `src/constants/chapters.ts`、`sceneThemes.ts`、`achievements.ts`；`BossBattle.tsx`。
- `src/i18n/messages/adventure.ts`：cloze 提示、新成就（中英）。
- 測試：`quizQuestions.test.ts`（cloze 出題、挖空不洩答、無例句退回 reverse、題數不變）、`adventureLevelProgress.test.ts`（新等級表）、`aiService` 正規化測試、`gameStages.test.ts`（寫死的 `QUIZ_KINDS` 要加 `cloze`、「最後一關屬於 ch2」要改成 ch3）。

## 8. 留給實作決定

- `ClozeQuestion` 是獨立型別還是擴充 `OptionQuestion`。
- 回饋區句子的排版與答案字形的標示樣式（照現有回饋區風格即可）。
- 場景描述文字、`glowColor` 的實際數值。
- 測試時呼叫 Gemini 要少量、間隔開，遇到 429 / 額度錯誤就停，不要重試。
