# 生詞本（/vocabulary）Master-Detail 重新設計

- **日期**：2026-06-19
- **狀態**：設計已核可（待 spec 覆核 → 進入 writing-plans）
- **範圍**：`/vocabulary` 整頁（單字 + 句子翻譯兩個分頁）

## 背景與問題

`/vocabulary` 在新的 sidebar app 外殼之前就設計好了，現在有兩個問題：

1. **卡片大小異常**：單字採用 `.auto-grid`（`grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`）。`auto-fit` 會收合空白 track，導致某個日期分組只有 1 張卡時（例如 community），該卡被 `1fr` 撐滿整列；而多卡分組則正常。視覺上卡片忽大忽小。
2. **設計過時**：頁面自帶三層 chrome（分頁色塊 + 手動新增卡 + 搜尋篩選卡），用 `max-w-7xl`，與新的 sidebar + sticky toolbar 外殼重複且笨重；與較新的頁面（Travel/Speech/Settings）風格不一致。

## 目標

- 以 **master-detail（主從分欄）** 重新設計「單字」分頁，貼近 macOS 來源列表體驗。
- 「句子翻譯」分頁維持單欄閱讀清單，但與單字分頁共用同一外殼／工具列／設計語彙，達成視覺整合。
- 修正卡片大小異常。
- 不減損任何現有功能（新增、刪除、搜尋、排序、複習、編輯標籤/難度、重新生成、發音、無限捲動）。

## 非目標

- 不更動 `useVocabulary` / `useSentenceTranslation` 等資料層 API。
- 不更動共用的 `.auto-grid` utility（仍被 SceneHub / StageMap / TopicSelector / EpisodeList 使用，改動會波及它們）。單字改清單後不再使用 grid，bug 自然消失。
- 不把「句子翻譯」拆成獨立路由（維持同頁兩分頁）。
- 不更動 PDF 閱讀器內同名的 `WordDetail`（`PdfReader/WordPanel.tsx`，為不同元件）。

## 核心洞察

兩個分頁的「詳情」本質不同：

- **單字**：有定義、例句、標籤、難度、統計、編輯、重新生成 → 適合主從分欄。
- **句子翻譯**：每筆「英文 + 中譯 + 來源」在列表中已完整 → 套 master-detail 會出現空詳情面板，是反效果。

因此：**單字 = master-detail；句子翻譯 = 單欄清單。**

## 詳細設計

### 1. 版面骨架與斷點

整頁是 toolbar 以下填滿視窗的工作區（兩欄各自捲動，文件本身的捲動由內部 pane 接手）。最上方一條 segmented control 切換 `[ 單字 | 句子翻譯 ]`（macOS 風格，取代現在的大色塊 tab）。

- **桌機 (`lg`+)**：單字分頁為兩欄。
  - 清單 pane：寬度隨斷點調整（約 `lg:w-72` ≈ 288px、`xl:w-80`/`2xl:w-96`），可獨立捲動。
  - 詳情 pane：`flex-1`，可獨立捲動。
- **手機／平板 (`< lg`)**：單欄。只顯示清單；點選一筆 → 詳情以 bottom sheet / 全螢幕 modal 滑出（沿用現有 modal 行為，內容為抽出的同一詳情元件）。
- 太窄時可由使用者收合左側 app 導覽列（既有功能）爭取空間。

### 2. 單字清單 pane（卡片 → 清單列）

左欄為緊湊的來源列表列（取代大卡片），這也讓 `auto-fit` 的撐滿 bug 消失。

- 每列：emoji｜單字｜音標（小字）｜一行釋義預覽（`line-clamp-1`）｜難度小圓點；hover 顯示發音與刪除按鈕；active 列以 `accent-tint` 高亮。
- 日期分組改為清單內 **sticky 小標題**（沿用句子分頁既有的 sticky 日期樣式）。
- 無限捲動沿用既有 `IntersectionObserver` + `loadMoreRef`。
- 搜尋結果同樣以清單列呈現於清單 pane（取代原本的 `.auto-grid` 搜尋結果）。
- 清單 pane 頂部精簡工具列：搜尋｜排序（加入時間／字母、升／降）｜手動新增｜開始複習。

桌機行為：載入完成後自動選取第一個字，詳情 pane 不空白；未選時顯示空狀態（例如「選擇一個單字以查看詳情」）。

### 3. 單字詳情 pane + `WordDetailPanel` 重構

把現有 `WordDetail` 的內容抽成純呈現元件 **`WordDetailPanel`**（定義／例句／標籤編輯／難度／統計／發音／重新生成皆照舊），外層提供兩種容器：

- 桌機 → 直接嵌入右側 pane。
- 手機 → 包進 modal/sheet（`WordDetail` 瘦身為這個 modal 包裝）。

Props 與資料流不變：`word`、`onClose`、`onUpdateWord`、`onRegenerateWordDetails`、`availableTags`。

### 4. 句子翻譯 pane

維持單欄閱讀清單（句子本身已完整），僅做樣式對齊：統一工具列／搜尋樣式、日期 sticky 標題、間距與圓角對齊新語彙。內部互動不動（`SentenceTranslationBook embedded`）。

### 5. 工具列整併

「分頁色塊 + 手動新增卡 + 搜尋篩選卡」三層 → 收斂為：頂部 segmented control 一條 + 清單 pane 一條精簡工具列。整頁由 `max-w-7xl` 改為填滿可用寬度的工作區。

## 元件 / 檔案異動（預估）

| 檔案 | 變更 |
|------|------|
| `src/components/Vocabulary/VocabularyBook.tsx` | 改寫為 master-detail 外殼；狀態與資料邏輯大多沿用 |
| `src/components/Vocabulary/VocabularyRow.tsx` | **新增**：清單列元件 |
| `src/components/Vocabulary/WordDetailPanel.tsx` | **新增**：抽出的詳情內容（桌機嵌入用） |
| `src/components/Vocabulary/WordDetail.tsx` | 瘦身為 modal 包裝（手機用），內部改用 `WordDetailPanel` |
| `src/components/Vocabulary/VocabularyCard.tsx` | 單字分頁不再使用；保留或移除（實作時決定） |
| `src/components/SentenceTranslation/SentenceTranslationBook.tsx` | 輕度樣式對齊 |

## 資料流（不變）

`useVocabulary` 的 API 全部沿用（words / loading / hasMore / loadVocabulary / loadMore / deleteWord / addWord / updateWord / regenerateWordDetails / updateReview / loadWordsForReview / searchWords / getTags / getWordCount）。選取狀態沿用既有 `selectedWord`。

## 風險與取捨

- **三欄並置**（app 導覽 + 清單 + 詳情）在 ~1280px 尚可；更窄時收合 app 導覽列，`< lg` 退回「清單 + sheet」。
- **密度取捨**：大卡片視覺換成密度較高的清單列——master-detail 的本質。
- **獨立捲動高度**：需把頁面設為 toolbar 以下填滿視窗（`min-h-0` + `overflow-y-auto` 於各 pane），注意外層 `<main>` padding 的處理。

## 驗證

- `npm run build`（型別檢查 + 建置）與 `npm run lint` 通過。
- 手動：桌機兩欄選取／搜尋／排序／無限捲動／複習；手機單欄 + sheet；空狀態；新增／刪除／編輯標籤難度／重新生成／發音皆正常。
