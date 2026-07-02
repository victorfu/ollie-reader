# /travel 新加坡內容擴充 — 設計文件

**日期：** 2026-07-02
**目標使用者：** 開發者與 10 歲女兒，行前練習新加坡親子旅遊英語
**確認行程：** 聖淘沙／環球影城、濱海灣區域、文化街區（Mandai 動物園已有完整內容）

## 背景與現況

`/travel`（Travel English）目前有 9 個主題：機場（桃園出發＋樟宜入境雙分組）、飛機上、交通、飯店、美食、購物、景點通用、求助、Mandai（5 園區分組）。

`src/data/scenes/research-notes.md` 的 gap analysis 早已規劃「出發前準備」與「回家囉」兩場景，內容（單字／句子／對話）已完整草擬，但從未做成資料檔。此外沒有聖淘沙／環球影城、濱海灣、文化街區的專屬內容。

## 設計決策（已與使用者確認）

採「做法 A」：聖淘沙獨立主題、「景點」主題擴成多分組、補齊旅程頭尾兩場景。

## 1. 新增場景檔（`src/data/scenes/`）

| 檔案 | Export | 場景 ID | 內容重點 |
|------|--------|---------|----------|
| `journey-before-departure.ts` | `beforeDepartureScene: TravelScene` | `before-departure` | 打包行李、檢查護照、認識新加坡天氣。內容以 research-notes.md「Scene 1: Before the Trip」草稿為準（略過草稿中的 Phonetic 欄） |
| `journey-going-home.ts` | `goingHomeScene: TravelScene` | `going-home` | 機場退稅（GST refund）、回程登機、道別。以 research-notes.md「Scene 11: Going Home」草稿為準 |
| `singapore-sentosa.ts` | `sentosaScenes: TravelScene[]`（2 個場景） | `uss`、`sentosa-island` | **環球影城**：遊樂設施、身高限制、快速通關、排隊、看秀、置物櫃。**聖淘沙島**：纜車、Sentosa Express、海灘、斜坡滑車（luge） |
| `singapore-city-sights.ts` | `marinaBayScene`、`cultureScene`（各為 `TravelScene`） | `marina-bay`、`culture` | **濱海灣**：超級樹、燈光秀（Garden Rhapsody）時間、觀景台、魚尾獅拍照、雲霧林/花穹。**文化街區**：牛車水、小印度、甘榜格南、寺廟與清真寺參觀禮儀、傳統小吃 |

句子 ID 前綴比照現有慣例：`before-p1`、`home-p1`、`uss-p1`、`island-p1`、`marina-p1`、`culture-p1`；對話 ID 同理（`uss-d1`…）。

## 2. 修改 `singapore-general.ts`

- `food` 場景：補 kopitiam 點飲料用語——單字 3 個（`kopi`、`teh`、`kaya toast`），句子 3 句（如 "One kopi and one Milo dinosaur, please."、"What is Milo dinosaur?"），funFact 1 則（kopitiam 飲料暗語）。
- `help` 場景：補天氣應對 2-3 句（突然下雨找地方躲、太熱要喝水休息），situation 用 `weather`。

## 3. 修改 `travelTopics.ts`

### 新增 3 個主題

| Topic ID | Section | Stage | StageLabel | 標題 | colorClass | Groups |
|----------|---------|-------|------------|------|------------|--------|
| `before-departure` | core | 1 | 行前準備 | Before the Trip／出發前準備 | `bg-violet-50` | `[singleGroup(beforeDepartureScene)]` |
| `sentosa` | more | 8 | 樂園海灘 | Sentosa & Universal Studios／聖淘沙與環球影城 | `bg-cyan-50` | `sentosaScenes.map(labeledGroup)` |
| `going-home` | more | 12 | 回程道別 | Going Home／回家囉 | `bg-indigo-50` | `[singleGroup(goingHomeScene)]` |

每個新主題比照現有欄位撰寫 `summary`、`learningGoals`（3 條）、`mission`、`reviewPrompt`。

### 「Attractions & Fun」擴成三分組

`groups` 改為 `[labeledGroup(通用 attractions 場景), labeledGroup(marinaBayScene), labeledGroup(cultureScene)]`；`summary`、`learningGoals`、`mission` 同步涵蓋濱海灣與文化街區。通用場景需補上 `title/titleChinese` 供分組小標顯示（現有 `general("attractions")` 場景已有標題，直接沿用）。

### Stage 全面重排（完整旅程順序）

| Stage | 主題 |
|-------|------|
| 1 | 出發前準備（新） |
| 2 | 機場與入境 |
| 3 | 飛機上 |
| 4 | 交通出行 |
| 5 | 飯店住宿 |
| 6 | 美食與小販中心 |
| 7 | 景點與娛樂（擴充） |
| 8 | 聖淘沙與環球影城（新） |
| 9 | Mandai 動物園 |
| 10 | 購物 |
| 11 | 求助與緊急 |
| 12 | 回家囉（新） |

Section 歸屬僅前述 3 個新主題調整，其餘不動（core/more 維持現狀）。

### `SITUATION_LABELS` 新增

`packing` 打包行李、`planning` 行程規劃、`departure` 準備出發、`knowledge` 小知識、`rides` 遊樂設施、`height` 身高限制、`fast pass` 快速通關、`beach` 海灘、`cable car` 搭纜車、`viewpoint` 觀景拍照、`etiquette` 參觀禮儀、`culture` 文化體驗、`weather` 天氣應對、`tax refund` 退稅、`farewell` 道別。（實作時若場景用到其他標籤一併補上；缺漏會 fallback 成「一般」，不會壞。）

## 4. 內容規格

- 每場景：10 個單字、8-10 個句子、2-3 段對話、3-4 則 funFacts。
- **不含音標**：`TravelVocab` 已無 `phonetic` 欄位（2026-07-02 移除）；research-notes 草稿中的 Phonetic 欄一律略過。
- 難度：國小四年級（約 10 歲），英文解釋用字簡單。
- 對話主角為小孩（speaker A 多為 Child），配角 Mom／Dad／Staff／Cashier 等，比照現有場景。
- funFacts 適量帶入 Singlish 與在地知識（lah、Can!、shiok、GST 退稅門檻、USS 身高規定等以「常識級」描述，不寫死易變動的價格與時刻）。

## 5. 範圍外

- 不動 UI 元件（多分組顯示 Mandai 主題已在用）。
- 不使用 `TravelDestination`（v2 型別）重構。
- 不新增練習／遊戲機制；`mission`、`reviewPrompt` 沿用現有欄位。
- 不回填舊資料音標（已於今日移除）。

## 6. 驗證

1. `npm run build`（含 TypeScript 檢查）與 `npm run lint` 通過。
2. 開發伺服器開 `/travel`：12 張主題卡順序正確、3 個新主題與「景點」三分組內容正常顯示、朗讀按鈕可用。
3. 抽查中英文內容正確性與難度。
