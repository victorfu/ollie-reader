# 自製考卷（題庫裁題 → 隨機組卷 → 列印）設計

<metadata>
date: 2026-09-24
status: draft（待使用者審閱）
scope: 新分頁 /my-exams（自製考卷）— 上傳、裁題、題庫、組卷、列印
audience: 開發者本人（家長）；私人使用、不公開發行。
</metadata>

## 1. 問題

女兒的考前練習素材散落在各處：改完發回來的考卷與作業（錯題）、課本與講義上的題目。現有的 `/exams`（考卷練習）只能練寫死在 `src/data/exams/` 的三份卷，無法放進自己的題目。

需要一個地方把這些題目收進題庫，再隨機組成一張考卷**印出來給她用筆寫**。

## 2. 目標

- 上傳照片或 PDF，由家長手動框出每一題，存進題庫。
- 已寫過的錯題可以用白色遮蓋框蓋掉她的答案與老師紅筆，印出來不露答案。
- 依科目與題數隨機抽題組卷，抽完可替換、移除、加題、調整順序。
- 印出 A4 試卷（可另存 PDF），可選擇附一張答案頁給家長批改。
- 支援國語、數學、英文、自然、社會。

## 3. 非目標（本版不做，見 §15）

- **不使用 AI（Gemini）**。不擷取題目文字、不自動框題、不產生類題、不擦除手寫。
- 不做線上作答，只印紙本。
- 不做回填對錯與錯題權重（資料結構預留擴充空間）。
- 不做標籤、單元篩選。
- 不做兩欄排版、透視校正、去紅筆濾鏡、裁題畫面縮放。

## 4. 決策

| 決策 | 選擇 | 否決的選項與原因 |
|------|------|------------------|
| 題目來源 | 家長手動框選原圖 | **AI 擷取＋可調框**：使用者決定先不用 AI；且 `gemini-3.5-flash-lite` 對中文手寫卷＋座標的能力未驗證，有限流。**純文字重排**：幾何題、看圖題、圖表題無法處理。 |
| 已寫過的卷 | 白色遮蓋框（手動） | **AI 擦除手寫**：可能順手改掉印刷字（例如數學題的數字），不易察覺，對考卷風險太高。 |
| 遮蓋框掛在哪 | 掛在「頁」上 | 掛在「題」上：同一頁的多題要各蓋一次。掛在頁上蓋一次、該頁所有題目共用。 |
| 裁切結果 | 不另存檔，一律「原頁圖＋框座標」即時呈現 | 另存裁切圖：改框要重新上傳、多一份儲存與清理成本。 |
| 旋轉 | 只在上傳前的預覽步驟 | 上傳後可旋轉：需要重新編碼上傳，並換算既有框與遮蓋的座標。手機掃描＋EXIF 已涵蓋多數情況。 |
| 裁題儲存 | 自動儲存（防抖 1 秒） | 手動存檔＋離開提醒：專案使用 `BrowserRouter`，沒有 `useBlocker`，攔不住站內換頁（`ExamPracticePage.tsx:31` 有同樣的限制）。 |
| 遮蓋框的繪製 | SVG `<rect fill="white">` | CSS 背景色 div：瀏覽器列印預設不印背景色，會透出底下的答案。 |
| 與 `/exams` 的關係 | 獨立新分頁 | 併入 `/exams`：該頁是線上作答引擎，本功能只印紙本，兩者資料與流程都不同。只重用科目名稱的呈現方式。 |
| 題庫載入 | 一次全量載入、前端篩選與抽題 | 分頁查詢：題庫預期只有數百題，全量最單純。 |

## 5. 架構總覽

### 5.1 頁面與路由

| 路徑 | 用途 | 版面 |
|------|------|------|
| `/my-exams` | 首頁：「題庫」「上傳紀錄」「考卷」三個 tab | App 版面 |
| `/my-exams/sources/:id` | 裁題畫面 | App 版面 |
| `/my-exams/sheets/new` | 組新考卷 | App 版面 |
| `/my-exams/sheets/:id/edit` | 編輯既有考卷（同一個組卷元件） | App 版面 |
| `/my-exams/sheets/:id/print` | 列印版面 | 獨立全螢幕 |

- 分頁在 `navItems` 註冊為 `{ to: "/my-exams", label: "自製考卷", icon: Printer }`。
- 列印頁跟小遊戲一樣走 `App.tsx` 的獨立全螢幕分支，但**要放在登入檢查之後**（小遊戲的分支在登入檢查之前；列印頁要讀 Firestore，必須已登入）。
- 頂部標題 `currentLabel` 目前是 `location.pathname` 完全比對，子頁面會顯示 fallback「Ollie Reader」。改為前綴比對（`pathname === to || pathname.startsWith(to + "/")`），讓 `/my-exams/*` 顯示「自製考卷」。

### 5.2 檔案

| 檔案 | 動作 | 職責 |
|------|------|------|
| `src/types/questionBank.ts` | 新增 | 型別與科目標籤（§6） |
| `src/services/questionSourceService.ts` | 新增 | 上傳頁面圖、建立／讀取／更新遮蓋／刪除來源 |
| `src/services/bankQuestionService.ts` | 新增 | 讀取題庫、依來源讀取、批次寫入（upsert＋刪除） |
| `src/services/examSheetService.ts` | 新增 | 考卷 CRUD |
| `src/utils/pageImageProcessor.ts` | 新增 | 照片與 PDF 轉成頁面 JPEG；尺寸計算拆成純函式 |
| `src/hooks/useSignedPageUrls.ts` | 新增 | 批次取得 signed URL、記憶體快取 |
| `src/hooks/useAutosave.ts` | 新增 | 防抖、只寫有變更的項目、切走時立即儲存 |
| `src/components/MyExams/MyExamsPage.tsx` | 新增 | 首頁三個 tab |
| `src/components/MyExams/SourceUploadDialog.tsx` | 新增 | 上傳對話框（選檔、預覽、旋轉、進度） |
| `src/components/MyExams/SourceCropEditor.tsx` | 新增 | 裁題畫面（頁面縮圖列、題目清單、工具列） |
| `src/components/MyExams/CropCanvas.tsx` | 新增 | 頁面大圖上的框：繪製、選取、移動、改大小 |
| `src/components/MyExams/QuestionCrop.tsx` | 新增 | 共用的裁切呈現元件 |
| `src/components/MyExams/QuestionPicker.tsx` | 新增 | 題庫挑選器（組卷「加入指定題目」） |
| `src/components/MyExams/SheetComposer.tsx` | 新增 | 組卷與編輯 |
| `src/components/MyExams/SheetPrintView.tsx` | 新增 | 列印版面 |
| `src/components/MyExams/boxGeometry.ts` | 新增 | 框的純函式計算 |
| `src/components/MyExams/cropStyle.ts` | 新增 | 框 → CSS 百分比、列印寬度 |
| `src/components/MyExams/pickRandomQuestions.ts` | 新增 | 隨機抽題 |
| `src/App.tsx` | 修改 | lazy import、`navItems`、routes、列印獨立分支、標題前綴比對 |
| `src/index.css` | 修改 | `@page` 與少量列印樣式；其餘用 Tailwind `print:` |

## 6. 資料模型

Firestore 沿用專案慣例：平鋪的 top-level collection，每份文件帶 `userId`，時間用 `Timestamp.now()`，讀取時由 `toX()` mapper 轉成 `Date`。

```ts
// src/types/questionBank.ts

export type BankSubject = "chinese" | "math" | "english" | "science" | "social";

/** 顯示順序即組卷時的科目排列順序。 */
export const BANK_SUBJECTS: readonly BankSubject[] = [
  "chinese", "math", "english", "science", "social",
];

export const BANK_SUBJECT_LABELS: Record<BankSubject, string> = {
  chinese: "國語",
  math: "數學",
  english: "英文",
  science: "自然",
  social: "社會",
};

/** 0–1 的相對座標，原點是頁面圖片左上角。 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SourcePage {
  /** Supabase 路徑：question-bank/{uid}/{sourceId}/page-{index}.jpg */
  storagePath: string;
  /** 頁面圖片的像素尺寸（計算長寬比用）。 */
  width: number;
  height: number;
  /** 白色遮蓋框；該頁所有題目共用。 */
  masks: Box[];
}

/** Firestore collection: questionSources（一次上傳一筆）。 */
export interface QuestionSource {
  id: string;
  userId: string;
  title: string;
  /** 該來源題目的預設科目。 */
  subject: BankSubject;
  pages: SourcePage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionRegion {
  pageIndex: number;
  box: Box;
}

export type AnswerSpace = "none" | "small" | "medium" | "large";

/** Firestore collection: bankQuestions。 */
export interface BankQuestion {
  id: string;
  userId: string;
  sourceId: string;
  subject: BankSubject;
  /** 至少一個；列印時由上往下接續（跨欄、跨頁的題目）。 */
  regions: [QuestionRegion, ...QuestionRegion[]];
  /** 選填的簡短答案，印在答案頁。 */
  answer?: string;
  /** 題目下方額外的作答留白。 */
  answerSpace: AnswerSpace;
  createdAt: Date;
  updatedAt: Date;
}

/** Firestore collection: examSheets。 */
export interface ExamSheet {
  id: string;
  userId: string;
  title: string;
  /** 有順序；引用的題目可能已被刪除（列印時跳過）。 */
  questionIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

- **題目排序**：不存 `order` 欄位。裁題畫面與題庫列表依第一個 region 的 `(pageIndex, box.y, box.x)` 排序，跟原卷由上到下的順序一致。
- **`regions` 非空**：mapper 讀取時驗證；空的就視為壞資料、略過並用 `logger` 記錄。
- **Firestore 巢狀限制**：`pages[].masks[]` 是「陣列裡的 map 裡的陣列」，Firestore 允許；不會出現陣列直接包陣列。
- **擴充預留**：之後做回填對錯，在 `ExamSheet` 加 `results?: Record<string, "correct" | "wrong">` 與 `gradedAt`，在 `BankQuestion` 加 `timesUsed`、`timesWrong`、`lastWrongAt`；本版不加。

## 7. 上傳流程

入口是首頁的「上傳題目」按鈕，開啟 `SourceUploadDialog`。

1. **填寫**：標題、科目（必填），選檔案。`accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"`，可多選。
2. **選檔檢查**：單一檔案超過 50MB，或所有檔案展開後總頁數超過 30 頁，當場擋下並提示拆開上傳。
3. **轉成頁面圖**（`pageImageProcessor.ts`，在前端做）：
   - **照片**：`createImageBitmap(file, { imageOrientation: "from-image" })` 依 EXIF 轉正；長邊縮到 2400px（小於就不放大）；畫到 canvas，`toBlob("image/jpeg", 0.85)`。
   - **PDF**：用現有 react-pdf 的 `pdfjs`（`src/utils/pdfConfig.ts` 已設定 worker 與 cMap），逐頁 `getViewport({ scale })`，`scale = 2400 / max(width, height)`，render 到 canvas 後輸出 JPEG，規格同照片。
   - 讀不了的檔案（例如桌機 Chrome 無法解 HEIC、PDF 有密碼）在該檔案旁顯示「無法讀取，請轉成 JPG 或 PDF」，其餘檔案照常處理。
   - 尺寸計算拆成純函式 `fitLongEdge(width, height, maxLongEdge)`，可在 jsdom 測試；canvas 相關的包裝函式靠手動驗證。
4. **預覽**：顯示每頁縮圖，可「順時針旋轉 90°」或刪除該頁。旋轉在這一步重新畫 canvas 產生新的 blob。
5. **上傳**（`questionSourceService.createSource`）：
   - 先用 `doc(collection(db, "questionSources")).id` 產生 `sourceId`。
   - 依序上傳每一頁到 Supabase（`STORAGE_BUCKET`，`contentType: "image/jpeg"`），顯示「上傳中 3/12」。
   - 全部成功後才 `setDoc` 寫入 `questionSources`（`masks` 皆為空陣列）。
   - 中途失敗：盡量 `remove` 已上傳的路徑，顯示錯誤與「重試」。
6. 完成後導向 `/my-exams/sources/:id`。

## 8. 裁題畫面 `/my-exams/sources/:id`

### 8.1 版面

- **桌機（`lg+`）**：左側頁面縮圖列、中間目前這頁的大圖（`CropCanvas`）、右側這頁的題目清單。
- **手機**：大圖占滿寬度，題目清單改為底部可拉出的面板；頁面切換用上一頁／下一頁按鈕。
- **工具列**：模式切換「框題目」／「遮蓋」、儲存狀態、返回首頁。
- **`?q=<questionId>`**：從題庫首頁點題目進來時帶這個參數，畫面切到該題第一個 region 所在的頁並選取該題。

### 8.2 `CropCanvas` 互動

- 大圖是 `<img>`，上面疊一層絕對定位的 SVG，`viewBox="0 0 1 1"`、`preserveAspectRatio="none"`，所有框直接用 0–1 座標繪製。
- 指標座標以圖片的 `getBoundingClientRect()` 換算成 0–1；統一用 pointer events（`setPointerCapture`），滑鼠與觸控共用。繪圖區設 `touch-action: none`。
- **框題目模式**：
  - 在空白處拖拉 → 新增一題，`subject` 帶來源的科目，`answerSpace` 預設 `"none"`，`regions` 為這個框。
  - 小於最小尺寸（寬或高 < 0.01）的框視為誤觸，忽略。
  - 點框 → 選取；拖曳選取的框 → 移動；拖四個角 → 改大小。框會被夾在 0–1 內。
  - 刪除：題目卡片上的刪除按鈕，或選取後按 Delete／Backspace。
  - 遮蓋框顯示為半透明，但不可互動。
- **遮蓋模式**：同樣的繪製、選取、移動、改大小、刪除，對象是 `pages[pageIndex].masks`；題目框顯示為淡色、不可互動。
- **新增區塊**：題目卡片上的「新增區塊」按鈕進入附加狀態，下一個畫的框（可以先切到別頁）會加到該題的 `regions` 尾端，而不是新增一題。按 Esc 或再按一次按鈕取消。每個區塊可以單獨刪除，但至少保留一個。

### 8.3 題目卡片

- 顯示 `QuestionCrop` 預覽（已套用遮蓋）。
- 可編輯：科目（下拉）、答案（單行文字，選填）、作答留白（無／小／中／大）。
- 刪除這一題。
- 清單依 §6 的排序規則排列，卡片上顯示在本來源內的序號。

### 8.4 自動儲存（`useAutosave`）

- 追蹤三種變更：upsert 的題目 id 集合、刪除的題目 id 集合、來源遮蓋是否變更。
- 最後一次變更後 1000ms，用一個 `writeBatch` 送出：題目 `set`（新增與修改相同）、題目 `delete`、來源 `update({ pages, updatedAt })`。
- 送出期間的新變更累積到下一批，不會遺失。
- `visibilitychange`（hidden）、`pagehide` 與元件卸載時立即送出。
- 狀態顯示：「儲存中…」／「已儲存」／「儲存失敗・重試」。失敗時保留所有未送出的變更，按重試或下一次變更時重送。

## 9. `QuestionCrop` 與圖片網址

- **輸入**：`regions`、對應頁面的 `SourcePage`（尺寸與遮蓋）、signed URL 對照表、選填的 `enhance`（列印增強）。
- **每個 region** 渲染一個容器：
  - `aspect-ratio = (box.w × page.width) / (box.h × page.height)`、`overflow: hidden`、`position: relative`。
  - 內含整頁 `<img>`：`position: absolute; width: (100 / box.w)%; height: (100 / box.h)%; left: -(box.x / box.w × 100)%; top: -(box.y / box.h × 100)%`。因為容器的長寬比等於框的實際長寬比，這組數值剛好還原整頁比例。
  - 內含定位完全相同的 SVG（`viewBox="0 0 1 1"`，`preserveAspectRatio="none"`），把該頁的遮蓋框畫成 `<rect fill="white">`，並加 `print-color-adjust: exact`。
  - 百分比計算放在 `cropStyle.ts`，純函式可測。
- 多個 region 由上往下疊。
- **`enhance`**：只對 `<img>` 套 `filter: grayscale(1) contrast(1.3) brightness(1.05)`，不影響遮蓋。
- **圖片載入失敗**：顯示「圖片載入失敗」與重試按鈕；重試時要求 `useSignedPageUrls` 重新取得該路徑。
- **`useSignedPageUrls(paths)`**：
  - 用 `supabase.storage.from(STORAGE_BUCKET).createSignedUrls(paths, 3600)` 一次批次取得。
  - 模組層級的記憶體快取（path → url、到期時間），剩不到 5 分鐘就視為過期重新取得。
  - 回傳 `{ urls, refresh(path) }`。

## 10. 題庫首頁 `/my-exams`

- **「題庫」tab**：
  - 題目卡片牆（`QuestionCrop` 縮圖＋科目標籤＋來源標題），上方科目篩選（全部＋五科，顯示各科題數）。
  - 點卡片 → 導向該題所屬來源的裁題畫面，並切到該頁、選取該題（用 query string `?q=<questionId>`）。
  - 空題庫時顯示引導文字與「上傳題目」按鈕。
- **「上傳紀錄」tab**：
  - 每次上傳一列：標題、科目、頁數、題數、日期。點擊進入裁題畫面。
  - 刪除：確認框 →（1）`writeBatch` 刪除該來源的所有題目與來源文件，每批最多 500 筆；（2）刪除 Storage 的頁面圖。Storage 刪除失敗只用 `logger` 記錄，不擋住操作。
- **「考卷」tab**：每張考卷一列（標題、日期、題數），操作：列印、編輯、刪除（確認框）。右上角「組新考卷」。

## 11. 組卷 `SheetComposer`

用於 `/my-exams/sheets/new` 與 `/my-exams/sheets/:id/edit`。

### 11.1 抽題設定

- 標題：預設「自製考卷 YYYY/MM/DD」（今天的日期）。
- 科目：五科勾選，勾選的科目有加減按鈕設定題數，範圍 1 到該科題庫題數；題庫沒有題目的科目不能勾。顯示總題數。
- 按「隨機抽題」產生題目清單（會取代目前清單；清單非空時先確認）。

### 11.2 `pickRandomQuestions`

```ts
function pickRandomQuestions(
  pool: readonly BankQuestion[],
  count: number,
  rng: () => number = Math.random,
  excludeIds: ReadonlySet<string> = new Set(),
): BankQuestion[];
```

- 從 `pool` 排除 `excludeIds` 後，不放回地抽 `min(count, 剩餘數)` 題，回傳順序即隨機順序（部分 Fisher–Yates，做法同 `src/data/exams/mixed.ts`）。
- 組卷時每科各呼叫一次，依 `BANK_SUBJECTS` 的順序串接；同科內順序隨機。
- 之後要加錯題權重，只改這個函式。

### 11.3 手動調整

題目清單每列：序號、`QuestionCrop` 縮圖、科目標籤，操作：

- **換一題**：`pickRandomQuestions(同科題目, 1, rng, 目前清單的 id)`；沒有可換的題目時按鈕停用並提示「沒有其他題目」。
- **移除**。
- **上移／下移**：按鈕，不做拖拉。
- 清單下方「加入指定題目」開啟 `QuestionPicker`：題目卡片牆＋科目篩選＋勾選，已在清單中的題目不顯示；「加入 N 題」加到清單尾端。

### 11.4 儲存

- 新考卷 `addDoc`；編輯 `updateDoc({ title, questionIds, updatedAt })`。完成後導向列印頁。
- 儲存前，組卷內容只存在元件 state；中途離開就消失（重抽只要幾秒，不另做草稿保存）。
- 編輯模式載入時，已從題庫刪除的題目不放進清單，並提示「有 N 題已從題庫刪除，已自動移除」。

## 12. 列印 `SheetPrintView`

### 12.1 螢幕工具列（`print:hidden`）

- **返回**、**列印**（`window.print()`）。圖片還沒全部載入前「列印」按鈕停用，顯示「圖片載入中 n/m」，避免印出空白。
- **列印增強**開關（預設關）。
- **題目大小**：小／標準／大 = 0.85／1／1.15 倍。
- **附答案頁**開關；沒有任何一題有答案時停用。
- 三個設定記在 `localStorage`（讀寫都包 `try/catch`，失敗就用預設值）。
- 有題目已被刪除時提示「有 N 題已從題庫刪除，列印時會略過」。

### 12.2 版面

- `src/index.css`：`@page { size: A4; margin: 12mm; }`；版面內容寬度 186mm。
- **卷頭**：考卷標題；下一行「姓名＿＿＿＿ 日期＿＿＿＿ 分數＿＿＿＿」。
- **每一題**（`break-inside: avoid`）：
  - 左側新題號「1.」（固定寬度），右側 `QuestionCrop`。
  - 每個 region 的寬度 = `min(box.w × 186mm × 題目大小倍率, 題號右側的可用寬度)`，高度由 `aspect-ratio` 決定。計算放在 `cropStyle.ts`。
  - 題目下方作答留白：無 0、小 2cm、中 4cm、大 7cm。
  - 已刪除的題目跳過，題號連續。
- **答案頁**（開啟時）：`break-before: page`，標題「答案」，以 CSS 多欄（3 欄）列出「題號. 答案」，沒有答案的題目顯示「—」。

### 12.3 列印背景色的陷阱

Chrome 預設不勾「背景圖形」，CSS 背景色不會印出。遮蓋框因此一律用 SVG `<rect fill="white">`（§9），不用背景色 div；另加 `print-color-adjust: exact` 當雙重保險。手動驗證時必須在「背景圖形」關閉的狀態下確認遮蓋有效（§14）。

## 13. 錯誤處理

| 情境 | 處理方式 |
|------|----------|
| 檔案讀不了（HEIC、加密 PDF、壞檔） | 在該檔案旁提示「無法讀取，請轉成 JPG 或 PDF」，其他檔案照常處理 |
| 單一檔案 > 50MB 或總頁數 > 30 | 選檔時擋下，提示拆開上傳 |
| 上傳到一半失敗 | 盡量刪除已上傳的檔案，顯示「重試」 |
| 上傳時直接關掉分頁 | 可能留下沒人用的 Storage 檔案；本版接受（之後可沿用 `audioUploadCleanupQueue` 的做法） |
| 自動儲存失敗 | 「儲存失敗・重試」，保留未送出的變更，下次變更時一併重送 |
| 圖片網址過期或載入失敗 | `QuestionCrop` 顯示錯誤與重試，重新取得網址 |
| 來源或考卷不存在、不屬於自己 | 顯示「找不到這份資料」與返回首頁按鈕 |
| 刪除來源 | 先刪 Firestore（題目＋來源），再刪 Storage；Storage 失敗只記錄 |
| 考卷引用已刪除的題目 | 列印時略過並提示；編輯時自動移除並提示 |
| 兩個分頁同時編輯 | 以最後寫入為準（單一使用者，可接受） |

所有 service 呼叫前檢查 `auth.currentUser`，未登入直接丟錯；權限最終由 Firestore 規則與 Supabase RLS 把關（§15）。

## 14. 測試

vitest＋jsdom，測試檔放在被測檔案旁邊；不用 testing-library，元件測試用 `createRoot`＋`act`（參考 `ExamPracticePage.test.tsx`）。

- **純函式**
  - `boxGeometry`：兩個拖拉點 → 正規化的框（任意方向拖拉）、夾在 0–1、最小尺寸判斷、移動（不超出邊界）、四個角改大小。
  - `cropStyle`：框 → `<img>` 的 width／left／top 百分比與 aspect-ratio；列印寬度（含倍率與上限）。
  - `pickRandomQuestions`：固定種子的 rng；不重複、排除指定 id、`count` 大於可用數時回傳全部、`count` 為 0 時回傳空陣列。
  - `fitLongEdge`：縮小、不放大、直式與橫式。
  - 題目排序（`pageIndex`、`y`、`x`）。
- **Service**（照 `audioUploadService.test.ts`，用 `vi.hoisted`＋`vi.mock` 模擬 `firebase/firestore`、`../utils/firebaseUtil`、`../utils/supabaseClient`）
  - `questionSourceService`：上傳路徑格式、全部上傳成功才寫文件、失敗時清掉已上傳檔案、刪除順序。
  - `bankQuestionService`：mapper 略過 `regions` 為空的資料、批次寫入分批 500。
  - `examSheetService`：CRUD 與 mapper。
- **`useAutosave`**（fake timers）：防抖、送出期間的新變更進下一批、hidden 時立即送出、失敗後保留並重送。
- **元件**
  - `SheetComposer`：隨機抽題 → 換一題 → 移除 → 上移下移；沒有可換的題目時停用。
  - `SheetPrintView`：題號連續、略過已刪除題目、沒有答案時答案頁開關停用、遮蓋框以 SVG `rect` 渲染。
- **手動驗證**
  - 瀏覽器實際上傳 PDF 與手機照片（含直式、橫式、EXIF 旋轉），裁題、遮蓋、跨頁區塊。
  - 手機觸控可以畫框、移動、改大小。
  - Chrome 列印預覽**關閉「背景圖形」**時，遮蓋框仍然蓋住答案。
  - iOS Safari 列印（或存成 PDF）一次。

## 15. 需要在 console 手動設定

repo 裡沒有 Firestore 規則與 Supabase SQL 檔，以下要在 console 套用。

**Supabase Storage RLS**：把現有 policy（見 `2026-06-21-storage-client-direct-supabase-design.md` §3.7）的資料夾清單加上 `'question-bank'`：

```sql
bucket_id = 'ollie-reader'
and (storage.foldername(name))[1] in ('speech-practice','audio-uploads','question-bank')
and (storage.foldername(name))[2] = (auth.jwt() ->> 'sub')
```

**Firestore 規則**：依現有規則的寫法，為三個 collection 加入：

```
function isOwner() {
  return request.auth != null && resource.data.userId == request.auth.uid;
}
function keepsOwnUserId() {
  return request.auth != null && request.resource.data.userId == request.auth.uid;
}

match /questionSources/{id} {
  allow read, delete: if isOwner();
  allow create: if keepsOwnUserId();
  allow update: if isOwner() && keepsOwnUserId();
}
// bankQuestions、examSheets 同上。
```

**Firestore 複合索引**：`questionSources`、`bankQuestions`、`examSheets` 各需 `userId ASC, createdAt DESC`。第一次查詢時錯誤訊息會附上建立連結。`bankQuestions` 依 `userId`＋`sourceId` 的查詢只有等值條件，不需要複合索引。

## 16. Milestones

- **M1 題庫**：型別、三個 service 中的來源與題目部分、`pageImageProcessor`、`useSignedPageUrls`、`useAutosave`、上傳對話框、裁題畫面、`QuestionCrop`、首頁「題庫」「上傳紀錄」tab、分頁註冊與標題前綴比對。驗收：上傳 → 裁題 → 題庫看得到裁好的題目。
- **M2 組卷與列印**：`examSheetService`、`pickRandomQuestions`、`SheetComposer`、`QuestionPicker`、`SheetPrintView`、首頁「考卷」tab、列印獨立分支、`@page` 樣式。驗收：組一張卷、印出來（遮蓋有效、答案頁正確）。

## 17. 之後的項目

- AI 擷取題目文字與自動框題（先用真實考卷做模型能力的小實驗）。
- AI 產生類題。
- 回填對錯、錯題權重抽題（§6 已預留欄位設計）。
- 線上作答（接上 `/exams` 的作答引擎）。
- 標籤與單元篩選。
- 裁題畫面縮放、兩欄排版、去紅筆濾鏡、透視校正。
- 清理上傳中斷留下的 Storage 檔案。
