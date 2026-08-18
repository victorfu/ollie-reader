# 生詞本停靠模式（Docked Vocabulary Panel）設計

<metadata>
date: 2026-08-18
status: approved design, pending implementation plan
scope: /reader（PDF 閱讀器）— WordPanel、SettingsContext
audience: 開發者本人；私人使用、不公開發行。
</metadata>

## 1. 問題

生詞本（`WordPanel`）目前只有一種呈現方式：`position: fixed` 的浮動視窗，靠 `useFloatingPanel` 提供拖曳與縮放。

它蓋在 PDF 上面。使用者查完單字要看解釋時，解釋正好壓住他正在讀的段落；要看 PDF 就得把面板拖走，看完再拖回來。在桌機大螢幕上，畫面右側其實有大量空白，卻被迫用遮擋的方式呈現。

## 2. 目標

- 新增「停靠」模式：生詞本固定在 PDF 預覽右側，完全不遮擋內容。
- 停靠欄不隨 PDF 捲動 — 讀到第 10 頁時生詞本仍在原位。
- 保留現有浮動模式，兩者可隨時切換，選擇會被記住。
- 窄螢幕（`lg` 以下）自動退回浮動模式，不把手機版 PDF 擠成紙條。

## 3. 非目標

- 不做手機版 bottom sheet（已明確排除；窄螢幕就是退回浮動）。
- 不改動 `LookupPanel`（字幕頁的查詢結果面板）。它是另一個功能的面板，不在此次範圍。
- 不改變生詞本本身的內容、查詢邏輯、Firestore 結構。純呈現層。
- 不做左側停靠、不做上下停靠。

## 4. 關鍵前提（已驗證）

`PdfViewer` 的捲動容器是它自己的固定高度盒子：

```
src/components/PdfReader/PdfViewer.tsx:254
h-[calc(100dvh-11rem)] min-h-96 … overflow-y-scroll … lg:h-[800px] lg:min-h-[800px]
```

PDF 在這個盒子裡捲動，頁面本身另外由 document 捲動。

**因此停靠欄不需要 `position: sticky`。** 只要讓它成為 PDF 盒子的 flex 兄弟並等高，捲動 PDF 就完全不會動到它。這比 sticky 更單純，也不會有 sticky 在巢狀捲動容器裡失效的風險。

## 5. 架構

### 5.1 元件拆分

`WordPanel.tsx` 目前 913 行，同時負責「浮動外殼」與「面板內容」。停靠模式需要同一份內容配不同外殼，所以先拆：

| 檔案 | 職責 | 依賴 |
|------|------|------|
| `WordPanelContent.tsx`（新） | 標題列、搜尋框、查詢佇列、生詞清單、展開細節。不知道自己被放在哪裡。 | `useVocabularySearch`、`useSettings` |
| `WordPanel.tsx`（瘦身） | 浮動外殼：`useFloatingPanel` 幾何、framer-motion 進出場、縮放把手 | `WordPanelContent` |
| `WordPanelDock.tsx`（新） | 停靠外殼：右側欄容器、左緣寬度拖曳把手 | `WordPanelContent` |

`WordPanelContent` 的介面：

```ts
interface WordPanelContentProps {
  mode: "floating" | "docked";
  lookups: LookupItem[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onSpeak?: (text: string) => void;
  onLookupWord: (word: string) => void;
  onClose: () => void;                 // — 按鈕
  onToggleMode: () => void;            // 停靠 ⇄ 浮動 按鈕
  // 只有浮動模式傳入；型別取自 hook 的回傳值，避免重複定義
  dragHandleProps?: FloatingPanelResult["dragHandleProps"];
  disableItemLayoutAnimation: boolean; // 拖曳/縮放中關閉 layout 動畫
}
```

`FloatingPanelResult` 目前是 `useFloatingPanel.ts` 的內部 interface，需改為 `export`。

`mode` 只影響標題列的三件事：是否套用 `dragHandleProps`（停靠時不傳）、切換鈕的圖示與提示文字、`—` 的 `aria-label`（浮動＝收合面板／停靠＝關閉側欄）。其餘 UI 完全相同。

**同一時間只掛載一個外殼。** 兩個都掛會產生兩份 `useVocabularySearch` 訂閱與兩份搜尋狀態，所以由 `PdfReader` 三選一渲染（浮動／停靠／不顯示）。

掛載與否完全由 `PdfReader` 決定，因此兩個外殼都**不再接受 `isOpen` prop**（現行 `WordPanel` 的 `isOpen` 隨之移除）。`WordPanel` 內部原本的 `if (!isOpen) return null` 使得 `AnimatePresence` 的離場動畫本來就不會播放，所以此改動不影響現有觀感。面板關閉時的狀態重置（`clearSearch`、收合展開項）改為卸載時自然發生。

### 5.2 版型

`PdfReader.tsx` 中 PDF 區塊改為：

```tsx
<div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
  <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border-hairline bg-base-100 shadow-elevated">
    <PdfViewer … />
  </div>

  {isDocked && wordPanelOpen && (
    <WordPanelDock … />
  )}
</div>
```

- `min-w-0 flex-1` 讓 PDF 欄可以正確縮窄（沒有 `min-w-0` 的話 flex 子項不會小於內容寬度）。
- `lg:items-stretch` 讓停靠欄自動等於 PDF 盒子的高度，不需要自己算高度。
- 停靠欄內部：`flex flex-col` + 清單區 `flex-1 min-h-0 overflow-y-auto`。

停靠欄外觀沿用 macOS HIG 慣例，與浮動面板一致但去掉「浮起」感：

```
rounded-xl border border-border-hairline bg-base-100 shadow-elevated
```

（不用 `backdrop-blur`／`shadow-floating` — 依 CLAUDE.md，玻璃與浮起效果保留給真正的浮動層。）

### 5.3 模式狀態

`SettingsContext` 新增一項裝置層級偏好，比照現有 `showChineseTranslation` 的 localStorage 寫法（不上 Firestore — 這是隨螢幕大小而異的 UI 偏好，跨裝置同步反而礙事）：

```ts
type VocabularyPanelMode = "floating" | "docked";

// key: "ollie-reader-vocabulary-panel-mode"
// 預設: "docked"
vocabularyPanelMode: VocabularyPanelMode;
updateVocabularyPanelMode: (mode: VocabularyPanelMode) => void;
```

**預設值為 `docked`** — 這是使用者提出的痛點，預設就給最好的體驗。localStorage 讀不到或值不合法時回退到 `docked`。

實際生效的模式：

```ts
const isDesktop = useIsDesktop();                       // 既有 hook，(min-width: 1024px)
const isDocked = vocabularyPanelMode === "docked" && isDesktop;
```

視窗縮窄 → `useIsDesktop()` 變 false → 自動渲染浮動面板，但**偏好值不變**，拉寬後自動變回停靠。

### 5.4 停靠欄寬度

左緣可拖曳調寬，夾在 280–560px，存 localStorage（key `ollie-reader-vocabulary-dock-width`）。浮動模式本來就能縮放，停靠模式若不能調寬會像功能倒退。

寬度以 inline style 套用（動態數值不適合 Tailwind class）。拖曳實作沿用 `useFloatingPanel` 既有的指標模式：`setPointerCapture` + window 監聽 + `pointerup`/`pointercancel`/`lostpointercapture` 清理。

> 注意：拖曳把手是獨立的細長元素，不含任何按鈕，所以不受上次修的「把手內控制項」問題影響。

### 5.5 開關與 FAB

`wordPanelOpen` 的語意兩種模式共用：

| 動作 | 浮動 | 停靠 |
|------|------|------|
| 右下角 FAB | 開啟浮動面板 | 開啟右側欄 |
| 標題列 `—` | 收合面板 | 關閉側欄，PDF 回到滿寬 |
| Cmd/Ctrl+K | 切換 | 切換 |
| 查單字／翻譯句子 | 自動開啟 | 自動開啟 |

FAB 在面板開啟時隱藏，維持現狀。

## 6. 錯誤處理

- localStorage 不可用（隱私模式）：讀寫都包 try/catch，回退到預設值。比照 `getShowChineseTranslationFromStorage`。
- localStorage 存了無效值：白名單檢查，非 `"floating"`/`"docked"` 一律當預設。寬度非數字或超出範圍則夾回範圍內。
- `matchMedia` 不存在：`useMediaQuery` 已回傳 false → 走浮動模式，安全。
- PDF 欄變窄：`PdfViewer` 已有 `overflow-x-auto`，寬度不足時橫向捲動，不會破版。

## 7. 測試

**單元（vitest + jsdom）**

1. `SettingsContext`：預設為 `docked`；寫入後可讀回；localStorage 拋錯時不炸、回退預設；無效值回退預設。
2. `WordPanelContent`：兩種 `mode` 下，`清除`／`—`／`中` 三個標題列控制項的 callback 都會被呼叫。（同時鎖住先前修好的指標擷取 bug。）
3. `WordPanelContent`：`mode="docked"` 時不套用 `dragHandleProps`。
4. `PdfReader`：mock `useIsDesktop` → true + 偏好 `docked` 時渲染停靠欄；`useIsDesktop` → false 時改渲染浮動面板；偏好 `floating` 時永遠浮動。
5. 停靠寬度：夾在 280–560px。

**瀏覽器實測（Browser pane）**

- 停靠模式下 PDF 完全不被遮擋
- 在 PDF 盒子裡捲動多頁，停靠欄不動
- 拖曳左緣調寬，PDF 欄同步縮放
- 視窗縮到 1024px 以下 → 自動變浮動；拉回 → 自動變停靠
- 切換鈕雙向可用，重新整理後記住選擇

## 8. 動到的檔案

| 檔案 | 動作 |
|------|------|
| `src/types/settings.ts` | 新增 `VocabularyPanelMode` 型別 |
| `src/contexts/SettingsContextType.ts` | context 介面新增兩個欄位 |
| `src/contexts/SettingsContext.tsx` | localStorage 讀寫 + provider 值 |
| `src/components/PdfReader/WordPanelContent.tsx` | 新增（由 `WordPanel` 抽出） |
| `src/components/PdfReader/WordPanel.tsx` | 瘦身為浮動外殼 |
| `src/components/PdfReader/WordPanelDock.tsx` | 新增停靠外殼 + 寬度拖曳 |
| `src/components/PdfReader.tsx` | flex 版型、模式判斷、渲染三選一 |
| 對應測試檔 | 新增／更新 |

## 9. 未來可能的擴充（不在此次範圍）

- 字幕頁（`ShowSubtitlesPage`）的 `LookupPanel` 沿用同一套停靠機制
- 左側停靠
- 停靠欄可摺疊成圖示細條（icon rail）而非完全關閉
