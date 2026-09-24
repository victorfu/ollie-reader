# 自製考卷 M1：題庫（上傳 → 裁題 → 題庫列表）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增「自製考卷」分頁的題庫部分：家長上傳照片或 PDF，手動框出題目、畫白色遮蓋框，自動存進 Firestore，並在題庫首頁看到裁好的題目。

**Architecture:** 上傳時在前端把照片／PDF 一頁一頁轉成 JPEG 傳到 Supabase，Firestore 只存頁面資訊與「框的 0–1 座標」；裁切一律用「原頁圖＋座標」即時以 CSS 呈現（`QuestionCrop`）。裁題畫面的狀態是純 reducer（`cropEditorState`），變更透過與 React 無關的 `AutosaveQueue` 防抖寫入。所有幾何、排序、樣式計算都是純函式，可在 jsdom 測試。

**Tech Stack:** React 19、React Router 7（`BrowserRouter`）、TypeScript strict、Tailwind CSS v4 + DaisyUI 5、Firebase Firestore、Supabase Storage、react-pdf（pdfjs-dist 5.4）、Vitest + jsdom、lucide-react。

**Spec:** `docs/superpowers/specs/2026-09-24-my-exams-question-bank-design.md`（本計畫實作 §16 的 **M1**；M2 在 `docs/superpowers/plans/2026-09-24-my-exams-m2-compose-print.md`）

## Global Constraints

- TypeScript strict，並開啟 `noUnusedLocals`、`noUnusedParameters`、`erasableSyntaxOnly`：**不可用 constructor parameter properties、enum、namespace**；沒用到的參數要加 `_` 前綴。
- `npm run build` 的 `tsc -b` 會型別檢查 `src/` 下的**測試檔**，測試碼也必須通過 strict。
- 型別放 `src/types/questionBank.ts`；數值常數放 `src/constants/questionBank.ts`。
- 只用 functional components，2 空格縮排，Tailwind utility；inline `style` 只用於動態數值（座標、百分比、長寬比）。
- 檔名：Components `PascalCase.tsx`、Hooks `useName.ts`、其他 `camelCase.ts`。
- `react-refresh/only-export-components`：元件檔只 export 元件（可另外 export type）。純函式放獨立的 `.ts` 檔。
- ESLint 使用 `eslint-plugin-react-hooks` 7 的 `recommended-latest`：**不可在 effect 本體同步呼叫 setState**（放在 promise callback 或事件裡）、**不可在 render 期間讀寫 `ref.current`**、**不可在 render 期間呼叫 `Date.now()`／`new Date()`／`Math.random()`**（放在事件處理函式裡）。
- `src/main.tsx` 開了 `StrictMode`：開發模式下 effect 會「執行 → 清除 → 再執行」，所有 effect 的清除都必須可逆。
- Logging 一律用 `src/utils/logger.ts` 的 `logger`。
- 測試：Vitest + jsdom。**本專案沒有 @testing-library**。元件／hook 測試用 `react-dom/client` 的 `createRoot` + React 的 `act`，並設 `IS_REACT_ACT_ENVIRONMENT = true`。Firebase／Supabase 用 `vi.hoisted` + `vi.mock` 模擬（參考 `src/services/audioUploadService.test.ts`）。
- 單一測試檔執行：`npx vitest run <path>`；全部：`npm run test`；型別：`npx tsc -b`；lint：`npm run lint`。
- Firestore：平鋪 collection，每份文件帶 `userId`；**不可寫入值為 `undefined` 的欄位**（`getFirestore(app)` 沒開 `ignoreUndefinedProperties`）。
- Storage 路徑：`question-bank/{uid}/{sourceId}/page-{index}.jpg`，bucket 用 `STORAGE_BUCKET`，上傳一律 `upsert: true`、`contentType: "image/jpeg"`。
- 常數值（與 spec 一致）：最多 30 頁、單檔 50MB、頁面長邊 2400px、縮圖長邊 240px、JPEG 品質 0.85、最小框 0.01、自動儲存 1000ms、signed URL 3600 秒、提前 5 分鐘視為過期、`writeBatch` 每批 500。
- 介面文字一律繁體中文。
- Commit 用 Conventional Commits（`feat:`、`fix:`、`test:`、`refactor:`、`chore:`），summary 72 字元內、祈使句；訊息結尾加一行 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## 手動前置作業（只影響瀏覽器實測，不影響單元測試）

Task 16 的瀏覽器實測前，使用者必須已在 console 完成 spec §15：Supabase RLS 加上 `'question-bank'`、Firestore 規則加上 `questionSources`／`bankQuestions`、`questionSources` 的複合索引（`userId ASC, createdAt DESC`）。執行 Task 16 前先向使用者確認。

## 檔案結構

| 檔案 | 任務 | 職責 |
|------|------|------|
| `src/constants/questionBank.ts` | 1 | collection 名稱、Storage 資料夾、所有數值常數 |
| `src/types/questionBank.ts` | 1 | 型別、科目與作答留白的標籤、型別守衛 |
| `src/testing/questionBankFixtures.ts` | 1 | 測試用的假資料產生器 |
| `src/components/MyExams/boxGeometry.ts` | 1 | 框的純函式（拖拉、夾制、移動、改大小） |
| `src/components/MyExams/cropStyle.ts` | 2 | 框 → CSS 百分比、長寬比、縮圖寬度、列印寬度 |
| `src/components/MyExams/questionOrdering.ts` | 2 | 題目排序、某頁上的區塊與題目 |
| `src/components/MyExams/editorKeyboard.ts` | 2 | 判斷事件目標是否為可編輯欄位 |
| `src/utils/pageImageProcessor.ts` | 3 | 照片／PDF 展開成頁、渲染成 JPEG、旋轉 |
| `src/services/questionBankMappers.ts` | 4 | Firestore ↔ 型別的轉換（讀取驗證、寫入去除 undefined） |
| `src/services/requireCurrentUserId.ts` | 4 | 取得目前登入者 uid，未登入就丟錯 |
| `src/services/bankQuestionService.ts` | 5 | 讀題目、裁題畫面的批次寫入、依來源刪除題目 |
| `src/services/questionSourceService.ts` | 6 | 建立（逐頁上傳）、讀取、刪除來源 |
| `src/hooks/useSignedPageUrls.ts` | 7 | 批次 signed URL＋記憶體快取 |
| `src/hooks/autosaveQueue.ts` | 8 | 自動儲存的純邏輯（與 React 無關） |
| `src/hooks/useAutosave.ts` | 8 | 把佇列接上 React 與 visibilitychange／pagehide |
| `src/components/MyExams/cropEditorState.ts` | 9 | 裁題畫面的 reducer 與變更種類 |
| `src/components/MyExams/editorSelection.ts` | 9 | 選取 key 的組合與解析 |
| `src/components/MyExams/QuestionCrop.tsx` | 10 | 共用裁切呈現元件 |
| `src/components/MyExams/CropCanvas.tsx` | 11 | 大圖上的框：繪製、選取、移動、改大小 |
| `src/components/MyExams/SourceUploadDialog.tsx` | 12 | 上傳對話框 |
| `src/hooks/useQuestionBank.ts` | 13 | 載入來源與題目 |
| `src/components/MyExams/MyExamsPage.tsx` | 13 | 首頁（題庫、上傳紀錄 tab） |
| `src/components/MyExams/QuestionBankGrid.tsx` | 13 | 題庫卡片牆＋科目篩選 |
| `src/components/MyExams/SourceList.tsx` | 13 | 上傳紀錄列表＋刪除 |
| `src/components/MyExams/SourceCropEditor.tsx` | 14 | 裁題畫面的資料載入 |
| `src/components/MyExams/CropEditorWorkspace.tsx` | 14 | 裁題畫面本體 |
| `src/components/MyExams/CropEditorToolbar.tsx` | 14 | 工具列（改名、模式、儲存狀態） |
| `src/components/MyExams/PageThumbnailStrip.tsx` | 14 | 桌機左側頁面縮圖列 |
| `src/components/MyExams/QuestionCard.tsx` | 14 | 右側題目卡片 |
| `src/utils/navLabel.ts` | 15 | 分頁的前綴比對 |
| `src/App.tsx` | 15 | 註冊分頁與 routes |

---

### Task 1: 常數、型別、測試假資料與框幾何

**Files:**
- Create: `src/constants/questionBank.ts`
- Create: `src/types/questionBank.ts`
- Create: `src/testing/questionBankFixtures.ts`
- Create: `src/components/MyExams/boxGeometry.ts`
- Test: `src/components/MyExams/boxGeometry.test.ts`
- Test: `src/types/questionBank.test.ts`

**Interfaces:**
- Consumes: 無
- Produces:
  - 常數：`QUESTION_SOURCES_COLLECTION`、`BANK_QUESTIONS_COLLECTION`、`EXAM_SHEETS_COLLECTION`、`QUESTION_BANK_STORAGE_FOLDER`、`MAX_SOURCE_PAGES`、`MAX_UPLOAD_FILE_BYTES`、`PAGE_LONG_EDGE_PX`、`THUMBNAIL_LONG_EDGE_PX`、`PAGE_JPEG_QUALITY`、`MIN_BOX_SIZE`、`AUTOSAVE_DELAY_MS`、`SIGNED_URL_TTL_SECONDS`、`SIGNED_URL_REFRESH_MARGIN_MS`、`FIRESTORE_BATCH_LIMIT`、`ACCEPTED_UPLOAD_TYPES`
  - 型別：`BankSubject`、`Box`、`SourcePage`、`QuestionSource`、`QuestionRegion`、`AnswerSpace`、`BankQuestion`、`ExamSheet`
  - `BANK_SUBJECTS`、`BANK_SUBJECT_LABELS`、`isBankSubject(value: unknown): value is BankSubject`
  - `ANSWER_SPACES`、`ANSWER_SPACE_LABELS`、`isAnswerSpace(value: unknown): value is AnswerSpace`
  - 假資料：`makePage(overrides?)`、`makeSource(overrides?)`、`makeQuestion(overrides?)`
  - `interface Point { x: number; y: number }`、`type Corner = "nw" | "ne" | "sw" | "se"`
  - `clamp01(value: number): number`
  - `boxFromPoints(a: Point, b: Point): Box`
  - `isBoxTooSmall(box: Box): boolean`
  - `moveBox(box: Box, dx: number, dy: number): Box`
  - `resizeBox(box: Box, corner: Corner, point: Point): Box`
  - `sameBox(a: Box, b: Box): boolean`
  - `toRelativePoint(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): Point`

- [ ] **Step 1: 建立常數檔**

Create `src/constants/questionBank.ts`:

```ts
/** Firestore collections（平鋪、每份文件帶 userId）。 */
export const QUESTION_SOURCES_COLLECTION = "questionSources";
export const BANK_QUESTIONS_COLLECTION = "bankQuestions";
export const EXAM_SHEETS_COLLECTION = "examSheets";

/** Supabase Storage 第一層資料夾；RLS 允許清單必須包含它（spec §15）。 */
export const QUESTION_BANK_STORAGE_FOLDER = "question-bank";

/** 一次上傳最多幾頁（照片＋PDF 展開後合計）。 */
export const MAX_SOURCE_PAGES = 30;
/** 單一檔案上限。 */
export const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;

/** 存進 Storage 的頁面圖長邊。 */
export const PAGE_LONG_EDGE_PX = 2400;
/** 上傳前預覽縮圖的長邊。 */
export const THUMBNAIL_LONG_EDGE_PX = 240;
export const PAGE_JPEG_QUALITY = 0.85;

/** 寬或高小於這個值（0–1 座標）的框視為誤觸。 */
export const MIN_BOX_SIZE = 0.01;

export const AUTOSAVE_DELAY_MS = 1000;

export const SIGNED_URL_TTL_SECONDS = 3600;
/** 剩不到這麼久就視為過期、重新取得。 */
export const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export const FIRESTORE_BATCH_LIMIT = 500;

/**
 * 刻意不列 image/heic：accept 沒有 HEIC 時，iPhone Safari 會先把相簿照片
 * 轉成 JPEG 再交給網頁（spec §7）。
 */
export const ACCEPTED_UPLOAD_TYPES =
  "image/jpeg,image/png,image/webp,application/pdf";
```

- [ ] **Step 2: 寫型別守衛的失敗測試**

Create `src/types/questionBank.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ANSWER_SPACES,
  BANK_SUBJECTS,
  BANK_SUBJECT_LABELS,
  isAnswerSpace,
  isBankSubject,
} from "./questionBank";

describe("isBankSubject", () => {
  it("accepts the five subjects", () => {
    for (const subject of BANK_SUBJECTS) {
      expect(isBankSubject(subject)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isBankSubject("mixed")).toBe(false);
    expect(isBankSubject("")).toBe(false);
    expect(isBankSubject(undefined)).toBe(false);
    expect(isBankSubject(3)).toBe(false);
  });

  it("labels every subject in Traditional Chinese", () => {
    expect(BANK_SUBJECTS.map((subject) => BANK_SUBJECT_LABELS[subject])).toEqual([
      "國語",
      "數學",
      "英文",
      "自然",
      "社會",
    ]);
  });
});

describe("isAnswerSpace", () => {
  it("accepts the four sizes and rejects others", () => {
    for (const space of ANSWER_SPACES) {
      expect(isAnswerSpace(space)).toBe(true);
    }
    expect(isAnswerSpace("huge")).toBe(false);
    expect(isAnswerSpace(null)).toBe(false);
  });
});
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `npx vitest run src/types/questionBank.test.ts`
Expected: FAIL，錯誤為找不到模組 `./questionBank`。

- [ ] **Step 4: 建立型別檔**

Create `src/types/questionBank.ts`:

```ts
export type BankSubject = "chinese" | "math" | "english" | "science" | "social";

/** 顯示順序即組卷時的科目排列順序。 */
export const BANK_SUBJECTS: readonly BankSubject[] = [
  "chinese",
  "math",
  "english",
  "science",
  "social",
];

export const BANK_SUBJECT_LABELS: Record<BankSubject, string> = {
  chinese: "國語",
  math: "數學",
  english: "英文",
  science: "自然",
  social: "社會",
};

export function isBankSubject(value: unknown): value is BankSubject {
  return (
    typeof value === "string" &&
    (BANK_SUBJECTS as readonly string[]).includes(value)
  );
}

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

export const ANSWER_SPACES: readonly AnswerSpace[] = [
  "none",
  "small",
  "medium",
  "large",
];

export const ANSWER_SPACE_LABELS: Record<AnswerSpace, string> = {
  none: "無",
  small: "小",
  medium: "中",
  large: "大",
};

export function isAnswerSpace(value: unknown): value is AnswerSpace {
  return (
    typeof value === "string" &&
    (ANSWER_SPACES as readonly string[]).includes(value)
  );
}

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

/** Firestore collection: examSheets（M2 使用）。 */
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

- [ ] **Step 5: 執行測試確認通過**

Run: `npx vitest run src/types/questionBank.test.ts`
Expected: PASS（4 個測試）。

- [ ] **Step 6: 建立測試假資料**

Create `src/testing/questionBankFixtures.ts`:

```ts
import type {
  BankQuestion,
  QuestionSource,
  SourcePage,
} from "../types/questionBank";

const FIXED_DATE = new Date("2026-09-01T00:00:00Z");

export function makePage(overrides: Partial<SourcePage> = {}): SourcePage {
  return {
    storagePath: "question-bank/user-1/source-1/page-0.jpg",
    width: 1000,
    height: 1400,
    masks: [],
    ...overrides,
  };
}

export function makeSource(
  overrides: Partial<QuestionSource> = {},
): QuestionSource {
  return {
    id: "source-1",
    userId: "user-1",
    title: "四上數學月考",
    subject: "math",
    pages: [makePage()],
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  };
}

export function makeQuestion(
  overrides: Partial<BankQuestion> = {},
): BankQuestion {
  return {
    id: "question-1",
    userId: "user-1",
    sourceId: "source-1",
    subject: "math",
    regions: [{ pageIndex: 0, box: { x: 0.1, y: 0.1, w: 0.5, h: 0.2 } }],
    answerSpace: "none",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  };
}
```

- [ ] **Step 7: 寫框幾何的失敗測試**

Create `src/components/MyExams/boxGeometry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Box } from "../../types/questionBank";
import {
  boxFromPoints,
  clamp01,
  isBoxTooSmall,
  moveBox,
  resizeBox,
  sameBox,
  toRelativePoint,
} from "./boxGeometry";

function expectBox(actual: Box, expected: Box): void {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
  expect(actual.w).toBeCloseTo(expected.w, 10);
  expect(actual.h).toBeCloseTo(expected.h, 10);
}

describe("clamp01", () => {
  it("keeps values inside 0–1", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(1.7)).toBe(1);
  });
});

describe("boxFromPoints", () => {
  it("normalizes a drag in any direction", () => {
    expectBox(boxFromPoints({ x: 0.6, y: 0.8 }, { x: 0.2, y: 0.3 }), {
      x: 0.2,
      y: 0.3,
      w: 0.4,
      h: 0.5,
    });
  });

  it("clamps points that leave the page", () => {
    expectBox(boxFromPoints({ x: -0.2, y: 0.5 }, { x: 0.4, y: 1.3 }), {
      x: 0,
      y: 0.5,
      w: 0.4,
      h: 0.5,
    });
  });
});

describe("isBoxTooSmall", () => {
  it("rejects boxes thinner than 0.01 in either direction", () => {
    expect(isBoxTooSmall({ x: 0, y: 0, w: 0.005, h: 0.5 })).toBe(true);
    expect(isBoxTooSmall({ x: 0, y: 0, w: 0.5, h: 0.009 })).toBe(true);
    expect(isBoxTooSmall({ x: 0, y: 0, w: 0.01, h: 0.01 })).toBe(false);
  });
});

describe("moveBox", () => {
  it("translates the box", () => {
    expectBox(moveBox({ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, 0.1, 0.2), {
      x: 0.2,
      y: 0.3,
      w: 0.2,
      h: 0.2,
    });
  });

  it("stops at the page edges without shrinking", () => {
    expectBox(moveBox({ x: 0.7, y: 0.1, w: 0.2, h: 0.2 }, 0.3, -0.5), {
      x: 0.8,
      y: 0,
      w: 0.2,
      h: 0.2,
    });
  });
});

describe("resizeBox", () => {
  const box: Box = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };

  it("moves the dragged corner and keeps the opposite corner fixed", () => {
    expectBox(resizeBox(box, "se", { x: 0.9, y: 0.9 }), {
      x: 0.2,
      y: 0.2,
      w: 0.7,
      h: 0.7,
    });
    expectBox(resizeBox(box, "nw", { x: 0.1, y: 0.1 }), {
      x: 0.1,
      y: 0.1,
      w: 0.5,
      h: 0.5,
    });
    expectBox(resizeBox(box, "ne", { x: 0.7, y: 0.1 }), {
      x: 0.2,
      y: 0.1,
      w: 0.5,
      h: 0.5,
    });
  });

  it("flips instead of producing a negative size", () => {
    expectBox(resizeBox(box, "nw", { x: 0.8, y: 0.8 }), {
      x: 0.6,
      y: 0.6,
      w: 0.2,
      h: 0.2,
    });
  });
});

describe("sameBox", () => {
  it("compares with a tiny tolerance", () => {
    const box: Box = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    expect(sameBox(box, { ...box, x: 0.1 + 1e-12 })).toBe(true);
    expect(sameBox(box, { ...box, w: 0.31 })).toBe(false);
  });
});

describe("toRelativePoint", () => {
  it("converts client coordinates to 0–1 inside the rect", () => {
    const point = toRelativePoint(150, 100, {
      left: 100,
      top: 50,
      width: 200,
      height: 100,
    });
    expect(point.x).toBeCloseTo(0.25);
    expect(point.y).toBeCloseTo(0.5);
  });

  it("returns 0 for an unmeasured rect", () => {
    expect(
      toRelativePoint(10, 10, { left: 0, top: 0, width: 0, height: 0 }),
    ).toEqual({ x: 0, y: 0 });
  });
});
```

- [ ] **Step 8: 執行測試確認失敗**

Run: `npx vitest run src/components/MyExams/boxGeometry.test.ts`
Expected: FAIL，找不到模組 `./boxGeometry`。

- [ ] **Step 9: 實作框幾何**

Create `src/components/MyExams/boxGeometry.ts`:

```ts
import { MIN_BOX_SIZE } from "../../constants/questionBank";
import type { Box } from "../../types/questionBank";

export interface Point {
  x: number;
  y: number;
}

export type Corner = "nw" | "ne" | "sw" | "se";

const EPSILON = 1e-9;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 兩個拖拉點（任意方向）→ 夾在 0–1 內、寬高為正的框。 */
export function boxFromPoints(a: Point, b: Point): Box {
  const left = clamp01(Math.min(a.x, b.x));
  const top = clamp01(Math.min(a.y, b.y));
  const right = clamp01(Math.max(a.x, b.x));
  const bottom = clamp01(Math.max(a.y, b.y));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function isBoxTooSmall(box: Box): boolean {
  return box.w < MIN_BOX_SIZE || box.h < MIN_BOX_SIZE;
}

/** 平移；整個框保持在 0–1 內（貼邊就停，不縮小）。 */
export function moveBox(box: Box, dx: number, dy: number): Box {
  return {
    ...box,
    x: Math.min(1 - box.w, Math.max(0, box.x + dx)),
    y: Math.min(1 - box.h, Math.max(0, box.y + dy)),
  };
}

/** 把某個角拖到 point；對角固定。拖過頭會翻轉，結果仍是正規化的框。 */
export function resizeBox(box: Box, corner: Corner, point: Point): Box {
  const fixed: Point = {
    x: corner === "nw" || corner === "sw" ? box.x + box.w : box.x,
    y: corner === "nw" || corner === "ne" ? box.y + box.h : box.y,
  };
  return boxFromPoints(fixed, point);
}

export function sameBox(a: Box, b: Box): boolean {
  return (
    Math.abs(a.x - b.x) < EPSILON &&
    Math.abs(a.y - b.y) < EPSILON &&
    Math.abs(a.w - b.w) < EPSILON &&
    Math.abs(a.h - b.h) < EPSILON
  );
}

/** clientX／clientY → 以 rect 為基準的 0–1 座標（未夾制）。 */
export function toRelativePoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): Point {
  return {
    x: rect.width > 0 ? (clientX - rect.left) / rect.width : 0,
    y: rect.height > 0 ? (clientY - rect.top) / rect.height : 0,
  };
}
```

- [ ] **Step 10: 執行測試確認通過**

Run: `npx vitest run src/components/MyExams/boxGeometry.test.ts src/types/questionBank.test.ts`
Expected: PASS。

- [ ] **Step 11: 型別檢查**

Run: `npx tsc -b`
Expected: 無錯誤。

- [ ] **Step 12: Commit**

```bash
git add src/constants/questionBank.ts src/types/questionBank.ts src/types/questionBank.test.ts src/testing/questionBankFixtures.ts src/components/MyExams/boxGeometry.ts src/components/MyExams/boxGeometry.test.ts
git commit -m "feat(my-exams): add question bank types and box geometry" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 裁切樣式、題目排序、鍵盤判斷

**Files:**
- Create: `src/components/MyExams/cropStyle.ts`
- Create: `src/components/MyExams/questionOrdering.ts`
- Create: `src/components/MyExams/editorKeyboard.ts`
- Test: `src/components/MyExams/cropStyle.test.ts`
- Test: `src/components/MyExams/questionOrdering.test.ts`
- Test: `src/components/MyExams/editorKeyboard.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `Box`、`SourcePage`、`BankQuestion`、`QuestionSource`、`makeQuestion`、`makeSource`
- Produces:
  - `interface RegionImageStyle { width: string; height: string; left: string; top: string }`
  - `regionImageStyle(box: Box): RegionImageStyle`
  - `regionAspectRatio(box: Box, page: Pick<SourcePage, "width" | "height">): number`
  - `thumbnailMaxWidth(aspectRatio: number, maxHeightPx: number): string`
  - `printRegionWidthPercent(box: Box, scale: number): number`
  - `sortQuestionsInSource(questions: readonly BankQuestion[]): BankQuestion[]`
  - `orderBankQuestions(questions: readonly BankQuestion[], sources: readonly QuestionSource[]): BankQuestion[]`
  - `interface PageRegionEntry { question: BankQuestion; number: number; regionIndex: number; box: Box; isContinuation: boolean }`
  - `regionsOnPage(sorted: readonly BankQuestion[], pageIndex: number): PageRegionEntry[]`
  - `interface PageQuestionEntry { question: BankQuestion; number: number; isContinuation: boolean }`
  - `questionsOnPage(sorted: readonly BankQuestion[], pageIndex: number): PageQuestionEntry[]`
  - `isEditableTarget(target: EventTarget | null): boolean`

- [ ] **Step 1: 寫 cropStyle 的失敗測試**

Create `src/components/MyExams/cropStyle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  printRegionWidthPercent,
  regionAspectRatio,
  regionImageStyle,
  thumbnailMaxWidth,
} from "./cropStyle";

describe("regionImageStyle", () => {
  it("scales and offsets the full page so only the box shows", () => {
    expect(regionImageStyle({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 })).toEqual({
      width: "200%",
      height: "400%",
      left: "-50%",
      top: "-200%",
    });
  });

  it("is the identity for a full-page box", () => {
    expect(regionImageStyle({ x: 0, y: 0, w: 1, h: 1 })).toEqual({
      width: "100%",
      height: "100%",
      left: "0%",
      top: "0%",
    });
  });
});

describe("regionAspectRatio", () => {
  it("uses the box size in real pixels", () => {
    expect(
      regionAspectRatio(
        { x: 0, y: 0, w: 0.5, h: 0.25 },
        { width: 1000, height: 2000 },
      ),
    ).toBeCloseTo(1);
    expect(
      regionAspectRatio(
        { x: 0, y: 0, w: 1, h: 0.1 },
        { width: 1000, height: 1400 },
      ),
    ).toBeCloseTo(1000 / 140);
  });
});

describe("thumbnailMaxWidth", () => {
  it("caps the width so the height stays under the limit", () => {
    expect(thumbnailMaxWidth(2, 160)).toBe("min(100%, 320px)");
    expect(thumbnailMaxWidth(0.5, 160)).toBe("min(100%, 80px)");
  });
});

describe("printRegionWidthPercent", () => {
  it("keeps the original proportion of the page width", () => {
    expect(printRegionWidthPercent({ x: 0, y: 0, w: 0.5, h: 0.1 }, 1)).toBeCloseTo(50);
    expect(printRegionWidthPercent({ x: 0, y: 0, w: 0.5, h: 0.1 }, 0.85)).toBeCloseTo(42.5);
  });

  it("never exceeds the content column", () => {
    expect(printRegionWidthPercent({ x: 0, y: 0, w: 0.95, h: 0.1 }, 1.15)).toBe(100);
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npx vitest run src/components/MyExams/cropStyle.test.ts`
Expected: FAIL，找不到模組 `./cropStyle`。

- [ ] **Step 3: 實作 cropStyle**

Create `src/components/MyExams/cropStyle.ts`:

```ts
import type { Box, SourcePage } from "../../types/questionBank";

export interface RegionImageStyle {
  width: string;
  height: string;
  left: string;
  top: string;
}

function percent(ratio: number): string {
  // 加 0 把 -0 轉成 0，輸出 "0%" 而不是 "-0%"
  return `${ratio * 100 + 0}%`;
}

/**
 * 容器的長寬比等於框的實際長寬比，因此以容器為基準：
 * 整頁圖寬 = 1/w、高 = 1/h，再往左上平移 x/w、y/h（spec §9）。
 */
export function regionImageStyle(box: Box): RegionImageStyle {
  return {
    width: percent(1 / box.w),
    height: percent(1 / box.h),
    left: percent(-box.x / box.w),
    top: percent(-box.y / box.h),
  };
}

export function regionAspectRatio(
  box: Box,
  page: Pick<SourcePage, "width" | "height">,
): number {
  return (box.w * page.width) / (box.h * page.height);
}

/** 卡片縮圖：限制寬度，讓高度不超過 maxHeightPx。 */
export function thumbnailMaxWidth(
  aspectRatio: number,
  maxHeightPx: number,
): string {
  return `min(100%, ${Math.round(maxHeightPx * aspectRatio)}px)`;
}

/** 列印：佔內容欄寬度的百分比（0–100，spec §12.2）。 */
export function printRegionWidthPercent(box: Box, scale: number): number {
  return Math.min(box.w * scale * 100, 100);
}
```

- [ ] **Step 4: 執行確認通過**

Run: `npx vitest run src/components/MyExams/cropStyle.test.ts`
Expected: PASS。

- [ ] **Step 5: 寫排序的失敗測試**

Create `src/components/MyExams/questionOrdering.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import {
  orderBankQuestions,
  questionsOnPage,
  regionsOnPage,
  sortQuestionsInSource,
} from "./questionOrdering";

const at = (iso: string) => new Date(iso);
const box = { x: 0.1, y: 0.1, w: 0.3, h: 0.1 };

describe("sortQuestionsInSource", () => {
  it("orders by creation time, not by position (two-column papers)", () => {
    const rightColumn = makeQuestion({
      id: "right",
      createdAt: at("2026-09-01T00:00:02Z"),
      regions: [{ pageIndex: 0, box: { x: 0.5, y: 0.1, w: 0.4, h: 0.1 } }],
    });
    const leftColumn = makeQuestion({
      id: "left",
      createdAt: at("2026-09-01T00:00:01Z"),
      regions: [{ pageIndex: 0, box: { x: 0.05, y: 0.8, w: 0.4, h: 0.1 } }],
    });
    expect(
      sortQuestionsInSource([rightColumn, leftColumn]).map((q) => q.id),
    ).toEqual(["left", "right"]);
  });

  it("breaks ties by id", () => {
    const same = at("2026-09-01T00:00:00Z");
    const b = makeQuestion({ id: "b", createdAt: same });
    const a = makeQuestion({ id: "a", createdAt: same });
    expect(sortQuestionsInSource([b, a]).map((q) => q.id)).toEqual(["a", "b"]);
  });
});

describe("orderBankQuestions", () => {
  it("groups by source (newest first), then by creation order", () => {
    const oldSource = makeSource({ id: "old", createdAt: at("2026-08-01T00:00:00Z") });
    const newSource = makeSource({ id: "new", createdAt: at("2026-09-01T00:00:00Z") });
    const questions = [
      makeQuestion({ id: "old-1", sourceId: "old", createdAt: at("2026-08-01T00:00:01Z") }),
      makeQuestion({ id: "new-2", sourceId: "new", createdAt: at("2026-09-01T00:00:02Z") }),
      makeQuestion({ id: "orphan", sourceId: "gone", createdAt: at("2026-07-01T00:00:00Z") }),
      makeQuestion({ id: "new-1", sourceId: "new", createdAt: at("2026-09-01T00:00:01Z") }),
    ];
    expect(
      orderBankQuestions(questions, [oldSource, newSource]).map((q) => q.id),
    ).toEqual(["new-1", "new-2", "old-1", "orphan"]);
  });
});

describe("regionsOnPage", () => {
  const first = makeQuestion({
    id: "q1",
    createdAt: at("2026-09-01T00:00:01Z"),
    regions: [
      { pageIndex: 0, box },
      { pageIndex: 1, box },
    ],
  });
  const second = makeQuestion({
    id: "q2",
    createdAt: at("2026-09-01T00:00:02Z"),
    regions: [{ pageIndex: 1, box }],
  });
  const sorted = [first, second];

  it("uses source-wide numbers and flags continuation regions", () => {
    expect(
      regionsOnPage(sorted, 1).map((entry) => ({
        id: entry.question.id,
        number: entry.number,
        regionIndex: entry.regionIndex,
        isContinuation: entry.isContinuation,
      })),
    ).toEqual([
      { id: "q1", number: 1, regionIndex: 1, isContinuation: true },
      { id: "q2", number: 2, regionIndex: 0, isContinuation: false },
    ]);
  });
});

describe("questionsOnPage", () => {
  it("lists each question once and marks when it started on another page", () => {
    const crossColumn = makeQuestion({
      id: "q1",
      createdAt: at("2026-09-01T00:00:01Z"),
      regions: [
        { pageIndex: 0, box },
        { pageIndex: 0, box: { ...box, x: 0.5 } },
      ],
    });
    const crossPage = makeQuestion({
      id: "q2",
      createdAt: at("2026-09-01T00:00:02Z"),
      regions: [
        { pageIndex: 0, box },
        { pageIndex: 1, box },
      ],
    });
    const sorted = [crossColumn, crossPage];

    expect(questionsOnPage(sorted, 0).map((e) => [e.question.id, e.number, e.isContinuation])).toEqual([
      ["q1", 1, false],
      ["q2", 2, false],
    ]);
    expect(questionsOnPage(sorted, 1).map((e) => [e.question.id, e.number, e.isContinuation])).toEqual([
      ["q2", 2, true],
    ]);
  });
});
```

- [ ] **Step 6: 執行確認失敗**

Run: `npx vitest run src/components/MyExams/questionOrdering.test.ts`
Expected: FAIL，找不到模組 `./questionOrdering`。

- [ ] **Step 7: 實作排序**

Create `src/components/MyExams/questionOrdering.ts`:

```ts
import type {
  BankQuestion,
  Box,
  QuestionSource,
} from "../../types/questionBank";

function byCreation(a: BankQuestion, b: BankQuestion): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
}

/** 同一來源內：依框選順序（createdAt），不依位置（spec §6）。 */
export function sortQuestionsInSource(
  questions: readonly BankQuestion[],
): BankQuestion[] {
  return [...questions].sort(byCreation);
}

/** 題庫列表：來源由新到舊分組，組內依框選順序；找不到來源的題目放最後。 */
export function orderBankQuestions(
  questions: readonly BankQuestion[],
  sources: readonly QuestionSource[],
): BankQuestion[] {
  const rank = new Map(
    [...sources]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((source, index) => [source.id, index]),
  );
  const rankOf = (question: BankQuestion) =>
    rank.get(question.sourceId) ?? Number.MAX_SAFE_INTEGER;
  return [...questions].sort(
    (a, b) => rankOf(a) - rankOf(b) || byCreation(a, b),
  );
}

export interface PageRegionEntry {
  question: BankQuestion;
  /** 題目在來源內的序號（1 起算）。 */
  number: number;
  regionIndex: number;
  box: Box;
  /** 不是該題的第一個區塊。 */
  isContinuation: boolean;
}

/** 某一頁上的所有區塊；sorted 必須已經過 sortQuestionsInSource。 */
export function regionsOnPage(
  sorted: readonly BankQuestion[],
  pageIndex: number,
): PageRegionEntry[] {
  return sorted.flatMap((question, index) =>
    question.regions.flatMap((region, regionIndex) =>
      region.pageIndex === pageIndex
        ? [
            {
              question,
              number: index + 1,
              regionIndex,
              box: region.box,
              isContinuation: regionIndex > 0,
            },
          ]
        : [],
    ),
  );
}

export interface PageQuestionEntry {
  question: BankQuestion;
  number: number;
  /** 這題的第一個區塊不在這一頁（跨頁的接續）。 */
  isContinuation: boolean;
}

/** 右側清單：在這一頁有任何區塊的題目（每題一次）。 */
export function questionsOnPage(
  sorted: readonly BankQuestion[],
  pageIndex: number,
): PageQuestionEntry[] {
  return sorted.flatMap((question, index) =>
    question.regions.some((region) => region.pageIndex === pageIndex)
      ? [
          {
            question,
            number: index + 1,
            isContinuation: question.regions[0].pageIndex !== pageIndex,
          },
        ]
      : [],
  );
}
```

- [ ] **Step 8: 執行確認通過**

Run: `npx vitest run src/components/MyExams/questionOrdering.test.ts`
Expected: PASS。

- [ ] **Step 9: 寫鍵盤判斷的失敗測試**

Create `src/components/MyExams/editorKeyboard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isEditableTarget } from "./editorKeyboard";

describe("isEditableTarget", () => {
  it("treats form fields as editable", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(isEditableTarget(document.createElement(tag))).toBe(true);
    }
  });

  it("treats contenteditable descendants as editable", () => {
    const host = document.createElement("div");
    host.setAttribute("contenteditable", "true");
    const child = document.createElement("span");
    host.appendChild(child);
    expect(isEditableTarget(child)).toBe(true);
  });

  it("respects contenteditable=false", () => {
    const host = document.createElement("div");
    host.setAttribute("contenteditable", "false");
    expect(isEditableTarget(host)).toBe(false);
  });

  it("ignores buttons, the body and null", () => {
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(document.body)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
```

- [ ] **Step 10: 執行確認失敗**

Run: `npx vitest run src/components/MyExams/editorKeyboard.test.ts`
Expected: FAIL，找不到模組 `./editorKeyboard`。

- [ ] **Step 11: 實作鍵盤判斷**

Create `src/components/MyExams/editorKeyboard.ts`:

```ts
const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * 焦點在可輸入的欄位時，裁題畫面的 Delete／Backspace／Esc 快捷鍵不處理，
 * 避免在答案欄刪字時把題目刪掉（spec §8.2）。
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (EDITABLE_TAGS.has(target.tagName)) return true;
  return (
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null
  );
}
```

- [ ] **Step 12: 執行確認通過**

Run: `npx vitest run src/components/MyExams/editorKeyboard.test.ts src/components/MyExams/cropStyle.test.ts src/components/MyExams/questionOrdering.test.ts`
Expected: PASS。

- [ ] **Step 13: Commit**

```bash
git add src/components/MyExams/cropStyle.ts src/components/MyExams/cropStyle.test.ts src/components/MyExams/questionOrdering.ts src/components/MyExams/questionOrdering.test.ts src/components/MyExams/editorKeyboard.ts src/components/MyExams/editorKeyboard.test.ts
git commit -m "feat(my-exams): add crop style, ordering and keyboard helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 頁面圖處理

照片與 PDF 在前端展開成「頁」，預覽只產生小縮圖、旋轉只記角度；上傳時才逐頁渲染成 2400px JPEG（spec §7）。

**Files:**
- Create: `src/utils/pageImageProcessor.ts`
- Test: `src/utils/pageImageProcessor.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `MAX_UPLOAD_FILE_BYTES`、`PAGE_JPEG_QUALITY`；既有 `src/utils/pdfConfig.ts` 的 `pdfDocumentOptions`；`react-pdf` 的 `pdfjs`
- Produces:
  - `type PageRotation = 0 | 90 | 180 | 270`
  - `interface PageInput { key: string; file: File; kind: "image" | "pdf"; pdfPageNumber?: number; rotation: PageRotation }`
  - `interface RenderedPage { blob: Blob; width: number; height: number }`
  - `interface FileReadError { fileName: string; message: string }`
  - `UNREADABLE_FILE_MESSAGE: string`
  - `fitLongEdge(width: number, height: number, maxLongEdge: number): { width: number; height: number }`
  - `rotatedSize(width: number, height: number, rotation: PageRotation): { width: number; height: number }`
  - `nextRotation(rotation: PageRotation): PageRotation`
  - `expandFilesToPages(files: readonly File[]): Promise<{ pages: PageInput[]; errors: FileReadError[] }>`
  - `renderPage(input: PageInput, maxLongEdge: number): Promise<RenderedPage>`
  - `releasePdfFiles(files: readonly File[]): Promise<void>`

- [ ] **Step 1: 寫失敗測試**

Create `src/utils/pageImageProcessor.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDocument: vi.fn() }));

// 真正的 react-pdf／pdfjs 在 jsdom 載入會失敗；pdfConfig 載入時會設定 worker。
vi.mock("react-pdf", () => ({ pdfjs: { getDocument: mocks.getDocument } }));
vi.mock("./pdfConfig", () => ({ pdfDocumentOptions: {} }));

import {
  expandFilesToPages,
  fitLongEdge,
  nextRotation,
  rotatedSize,
  UNREADABLE_FILE_MESSAGE,
} from "./pageImageProcessor";

function fileOf(name: string, type: string, size?: number): File {
  const file = new File(["data"], name, { type });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new ArrayBuffer(4),
  });
  if (size !== undefined) {
    Object.defineProperty(file, "size", { value: size });
  }
  return file;
}

describe("fitLongEdge", () => {
  it("scales the long edge down to the limit", () => {
    expect(fitLongEdge(4000, 3000, 2400)).toEqual({ width: 2400, height: 1800 });
    expect(fitLongEdge(3000, 6000, 2400)).toEqual({ width: 1200, height: 2400 });
  });

  it("never scales up", () => {
    expect(fitLongEdge(800, 600, 2400)).toEqual({ width: 800, height: 600 });
  });
});

describe("rotatedSize", () => {
  it("swaps width and height for quarter turns", () => {
    expect(rotatedSize(100, 200, 90)).toEqual({ width: 200, height: 100 });
    expect(rotatedSize(100, 200, 270)).toEqual({ width: 200, height: 100 });
    expect(rotatedSize(100, 200, 180)).toEqual({ width: 100, height: 200 });
    expect(rotatedSize(100, 200, 0)).toEqual({ width: 100, height: 200 });
  });
});

describe("nextRotation", () => {
  it("cycles clockwise", () => {
    expect(nextRotation(0)).toBe(90);
    expect(nextRotation(90)).toBe(180);
    expect(nextRotation(180)).toBe(270);
    expect(nextRotation(270)).toBe(0);
  });
});

describe("expandFilesToPages", () => {
  beforeEach(() => {
    mocks.getDocument.mockReset();
  });

  it("turns each photo into one upright page", async () => {
    const { pages, errors } = await expandFilesToPages([
      fileOf("a.jpg", "image/jpeg"),
      fileOf("b.png", "image/png"),
    ]);
    expect(errors).toEqual([]);
    expect(pages.map((page) => [page.file.name, page.kind, page.rotation])).toEqual([
      ["a.jpg", "image", 0],
      ["b.png", "image", 0],
    ]);
    expect(new Set(pages.map((page) => page.key)).size).toBe(2);
  });

  it("expands a PDF into one page per PDF page", async () => {
    mocks.getDocument.mockImplementation(() => ({ promise: Promise.resolve({ numPages: 3 }) }));
    const { pages } = await expandFilesToPages([fileOf("exam.pdf", "application/pdf")]);
    expect(pages.map((page) => [page.kind, page.pdfPageNumber])).toEqual([
      ["pdf", 1],
      ["pdf", 2],
      ["pdf", 3],
    ]);
  });

  it("reports unreadable and oversized files without dropping the others", async () => {
    // 呼叫時才建立 rejected promise，避免在被 await 之前觸發 unhandled rejection
    mocks.getDocument.mockImplementation(() => ({ promise: Promise.reject(new Error("password")) }));
    const { pages, errors } = await expandFilesToPages([
      fileOf("notes.txt", "text/plain"),
      fileOf("big.jpg", "image/jpeg", 60 * 1024 * 1024),
      fileOf("locked.pdf", "application/pdf"),
      fileOf("ok.webp", "image/webp"),
    ]);
    expect(pages.map((page) => page.file.name)).toEqual(["ok.webp"]);
    expect(errors).toEqual([
      { fileName: "notes.txt", message: UNREADABLE_FILE_MESSAGE },
      { fileName: "big.jpg", message: "檔案超過 50MB，請拆開上傳" },
      { fileName: "locked.pdf", message: UNREADABLE_FILE_MESSAGE },
    ]);
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npx vitest run src/utils/pageImageProcessor.test.ts`
Expected: FAIL，找不到模組 `./pageImageProcessor`。

- [ ] **Step 3: 實作**

Create `src/utils/pageImageProcessor.ts`:

```ts
import { pdfjs } from "react-pdf";
import {
  MAX_UPLOAD_FILE_BYTES,
  PAGE_JPEG_QUALITY,
} from "../constants/questionBank";
import { pdfDocumentOptions } from "./pdfConfig";

export type PageRotation = 0 | 90 | 180 | 270;

export interface PageInput {
  /** 穩定的 React key。 */
  key: string;
  file: File;
  kind: "image" | "pdf";
  /** PDF 頁碼（1 起算）；照片沒有。 */
  pdfPageNumber?: number;
  /** 使用者在預覽時加上的順時針旋轉。 */
  rotation: PageRotation;
}

export interface RenderedPage {
  blob: Blob;
  width: number;
  height: number;
}

export interface FileReadError {
  fileName: string;
  message: string;
}

export const UNREADABLE_FILE_MESSAGE = "無法讀取，請轉成 JPG 或 PDF";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type PdfDocument = Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;

/** 同一個 PDF 檔只開一次；上傳完或關閉對話框時用 releasePdfFiles 釋放。 */
const pdfDocuments = new WeakMap<File, Promise<PdfDocument>>();
let keySequence = 0;

export function fitLongEdge(
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { width, height };
  const ratio = maxLongEdge / longEdge;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

export function rotatedSize(
  width: number,
  height: number,
  rotation: PageRotation,
): { width: number; height: number } {
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

export function nextRotation(rotation: PageRotation): PageRotation {
  return ((rotation + 90) % 360) as PageRotation;
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function loadPdf(file: File): Promise<PdfDocument> {
  let loading = pdfDocuments.get(file);
  if (!loading) {
    loading = file
      .arrayBuffer()
      .then((data) => pdfjs.getDocument({ data, ...pdfDocumentOptions }).promise);
    pdfDocuments.set(file, loading);
  }
  return loading;
}

function nextKey(): string {
  keySequence += 1;
  return `page-${keySequence}`;
}

/** 把選到的檔案展開成頁；PDF 只讀頁數，不 render（spec §7 步驟 2）。 */
export async function expandFilesToPages(
  files: readonly File[],
): Promise<{ pages: PageInput[]; errors: FileReadError[] }> {
  const pages: PageInput[] = [];
  const errors: FileReadError[] = [];

  for (const file of files) {
    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      errors.push({ fileName: file.name, message: "檔案超過 50MB，請拆開上傳" });
      continue;
    }
    if (isPdf(file)) {
      try {
        const pdf = await loadPdf(file);
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          pages.push({ key: nextKey(), file, kind: "pdf", pdfPageNumber: pageNumber, rotation: 0 });
        }
      } catch {
        errors.push({ fileName: file.name, message: UNREADABLE_FILE_MESSAGE });
      }
      continue;
    }
    if (IMAGE_TYPES.has(file.type)) {
      pages.push({ key: nextKey(), file, kind: "image", rotation: 0 });
      continue;
    }
    errors.push({ fileName: file.name, message: UNREADABLE_FILE_MESSAGE });
  }

  return { pages, errors };
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))),
      "image/jpeg",
      quality,
    );
  });
}

async function drawPdfPage(
  canvas: HTMLCanvasElement,
  input: PageInput,
  maxLongEdge: number,
): Promise<void> {
  const pdf = await loadPdf(input.file);
  const page = await pdf.getPage(input.pdfPageNumber ?? 1);
  const base = page.getViewport({ scale: 1 });
  const scale = maxLongEdge / Math.max(base.width, base.height);
  const viewport = page.getViewport({
    scale,
    rotation: (page.rotate + input.rotation) % 360,
  });
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvas, viewport, background: "rgb(255,255,255)" }).promise;
  page.cleanup();
}

async function drawImageFile(
  canvas: HTMLCanvasElement,
  input: PageInput,
  maxLongEdge: number,
): Promise<void> {
  const bitmap = await createImageBitmap(input.file, { imageOrientation: "from-image" });
  try {
    const fitted = fitLongEdge(bitmap.width, bitmap.height, maxLongEdge);
    const size = rotatedSize(fitted.width, fitted.height, input.rotation);
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas 2d context unavailable");
    // 透明 PNG 轉 JPEG 會變黑底，先鋪白。
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.translate(size.width / 2, size.height / 2);
    context.rotate((input.rotation * Math.PI) / 180);
    context.drawImage(bitmap, -fitted.width / 2, -fitted.height / 2, fitted.width, fitted.height);
  } finally {
    bitmap.close();
  }
}

/**
 * 把一頁渲染成 JPEG。呼叫端一次只處理一頁：用完的 canvas 會立刻歸零，
 * 避免 iPhone Safari 記憶體爆掉（spec §7）。
 */
export async function renderPage(
  input: PageInput,
  maxLongEdge: number,
): Promise<RenderedPage> {
  const canvas = document.createElement("canvas");
  try {
    if (input.kind === "pdf") {
      await drawPdfPage(canvas, input, maxLongEdge);
    } else {
      await drawImageFile(canvas, input, maxLongEdge);
    }
    const blob = await canvasToJpeg(canvas, PAGE_JPEG_QUALITY);
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function releasePdfFiles(files: readonly File[]): Promise<void> {
  for (const file of files) {
    const loading = pdfDocuments.get(file);
    if (!loading) continue;
    pdfDocuments.delete(file);
    try {
      await (await loading).destroy();
    } catch {
      // 讀取失敗的 PDF 沒有東西要釋放
    }
  }
}
```

注意 `renderPage` 的 `return` 在 `finally` 之前就讀出了 `canvas.width/height`，所以歸零不影響回傳值。

- [ ] **Step 4: 執行確認通過**

Run: `npx vitest run src/utils/pageImageProcessor.test.ts`
Expected: PASS（`renderPage` 依賴 canvas，靠 Task 16 手動驗證）。

- [ ] **Step 5: 型別檢查**

Run: `npx tsc -b`
Expected: 無錯誤。若 `page.render` 的參數型別報錯，對照 `node_modules/pdfjs-dist/types/src/display/api.d.ts` 的 `RenderParameters`（5.4 版 `canvas` 為必填、`canvasContext` 可省略）。

- [ ] **Step 6: Commit**

```bash
git add src/utils/pageImageProcessor.ts src/utils/pageImageProcessor.test.ts
git commit -m "feat(my-exams): expand photos and PDFs into page images" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Firestore mapper 與登入檢查

**Files:**
- Create: `src/services/questionBankMappers.ts`
- Create: `src/services/requireCurrentUserId.ts`
- Test: `src/services/questionBankMappers.test.ts`
- Test: `src/services/requireCurrentUserId.test.ts`

**Interfaces:**
- Consumes: Task 1 的型別與型別守衛
- Produces:
  - `toBox(value: unknown): Box | null`
  - `toQuestionSource(id: string, data: DocumentData): QuestionSource | null`
  - `toBankQuestion(id: string, data: DocumentData): BankQuestion | null`
  - `toFirestoreQuestion(question: BankQuestion): DocumentData`（沒有值為 `undefined` 的欄位；`updatedAt` 一律 `Timestamp.now()`）
  - `toFirestorePages(pages: readonly SourcePage[]): DocumentData[]`
  - `requireCurrentUserId(): string`（未登入丟 `Error("尚未登入")`）

- [ ] **Step 1: 寫 mapper 的失敗測試**

Create `src/services/questionBankMappers.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  Timestamp: {
    now: vi.fn(() => ({ kind: "now" })),
    fromDate: vi.fn((date: Date) => ({ kind: "fromDate", date })),
  },
}));

import { makePage, makeQuestion } from "../testing/questionBankFixtures";
import {
  toBankQuestion,
  toBox,
  toFirestorePages,
  toFirestoreQuestion,
  toQuestionSource,
} from "./questionBankMappers";

const stamp = (iso: string) => ({ toDate: () => new Date(iso) });

describe("toBox", () => {
  it("accepts four finite numbers and rejects everything else", () => {
    expect(toBox({ x: 0, y: 0.1, w: 0.2, h: 0.3 })).toEqual({ x: 0, y: 0.1, w: 0.2, h: 0.3 });
    expect(toBox({ x: 0, y: 0.1, w: 0.2 })).toBeNull();
    expect(toBox({ x: Number.NaN, y: 0, w: 1, h: 1 })).toBeNull();
    expect(toBox(null)).toBeNull();
  });
});

describe("toQuestionSource", () => {
  const valid = {
    userId: "user-1",
    title: "月考",
    subject: "math",
    pages: [{ storagePath: "p0.jpg", width: 100, height: 200 }],
    createdAt: stamp("2026-09-01T00:00:00Z"),
    updatedAt: stamp("2026-09-02T00:00:00Z"),
  };

  it("maps a valid document and defaults missing masks to []", () => {
    expect(toQuestionSource("s1", valid)).toEqual({
      id: "s1",
      userId: "user-1",
      title: "月考",
      subject: "math",
      pages: [{ storagePath: "p0.jpg", width: 100, height: 200, masks: [] }],
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: new Date("2026-09-02T00:00:00Z"),
    });
  });

  it("rejects a source with a broken page (page indexes would shift)", () => {
    expect(toQuestionSource("s1", { ...valid, pages: [{ storagePath: "p0.jpg" }] })).toBeNull();
  });

  it("rejects an unknown subject", () => {
    expect(toQuestionSource("s1", { ...valid, subject: "music" })).toBeNull();
  });
});

describe("toBankQuestion", () => {
  const valid = {
    userId: "user-1",
    sourceId: "s1",
    subject: "chinese",
    regions: [
      { pageIndex: 0, box: { x: 0, y: 0, w: 0.5, h: 0.5 } },
      { pageIndex: 1, box: { x: 0, y: 0 } },
    ],
    answerSpace: "medium",
    createdAt: stamp("2026-09-01T00:00:00Z"),
    updatedAt: stamp("2026-09-01T00:00:00Z"),
  };

  it("drops broken regions and has no answer key when there is no answer", () => {
    const question = toBankQuestion("q1", valid);
    expect(question?.regions).toEqual([{ pageIndex: 0, box: { x: 0, y: 0, w: 0.5, h: 0.5 } }]);
    expect(question && "answer" in question).toBe(false);
    expect(question?.answerSpace).toBe("medium");
  });

  it("returns null when no region survives", () => {
    expect(toBankQuestion("q1", { ...valid, regions: [] })).toBeNull();
  });

  it("falls back to no extra answer space for unknown values", () => {
    expect(toBankQuestion("q1", { ...valid, answerSpace: "huge" })?.answerSpace).toBe("none");
  });

  it("keeps a non-empty answer", () => {
    expect(toBankQuestion("q1", { ...valid, answer: "(3)" })?.answer).toBe("(3)");
  });
});

describe("toFirestoreQuestion", () => {
  it("never writes undefined and omits an empty answer", () => {
    const data = toFirestoreQuestion(makeQuestion({ answer: undefined }));
    expect(Object.values(data)).not.toContain(undefined);
    expect("answer" in data).toBe(false);
    expect("answer" in toFirestoreQuestion(makeQuestion({ answer: "   " }))).toBe(false);
  });

  it("trims the answer and converts dates", () => {
    const createdAt = new Date("2026-09-01T00:00:00Z");
    const data = toFirestoreQuestion(makeQuestion({ answer: " 12 公分 ", createdAt }));
    expect(data.answer).toBe("12 公分");
    expect(data.createdAt).toEqual({ kind: "fromDate", date: createdAt });
    expect(data.updatedAt).toEqual({ kind: "now" });
    expect(data).not.toHaveProperty("id");
  });
});

describe("toFirestorePages", () => {
  it("writes plain page objects", () => {
    const pages = [makePage({ masks: [{ x: 0, y: 0, w: 0.1, h: 0.1 }] })];
    expect(toFirestorePages(pages)).toEqual([
      {
        storagePath: pages[0].storagePath,
        width: 1000,
        height: 1400,
        masks: [{ x: 0, y: 0, w: 0.1, h: 0.1 }],
      },
    ]);
  });
});
```

- [ ] **Step 2: 寫登入檢查的失敗測試**

Create `src/services/requireCurrentUserId.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: "user-1" } as { uid: string } | null },
}));

vi.mock("../utils/firebaseUtil", () => ({ auth: mocks.auth }));

import { requireCurrentUserId } from "./requireCurrentUserId";

describe("requireCurrentUserId", () => {
  it("returns the signed-in uid", () => {
    mocks.auth.currentUser = { uid: "user-1" };
    expect(requireCurrentUserId()).toBe("user-1");
  });

  it("throws when nobody is signed in", () => {
    mocks.auth.currentUser = null;
    expect(() => requireCurrentUserId()).toThrow("尚未登入");
  });
});
```

- [ ] **Step 3: 執行確認失敗**

Run: `npx vitest run src/services/questionBankMappers.test.ts src/services/requireCurrentUserId.test.ts`
Expected: FAIL，找不到兩個模組。

- [ ] **Step 4: 實作**

Create `src/services/requireCurrentUserId.ts`:

```ts
import { auth } from "../utils/firebaseUtil";

/** 所有題庫 service 呼叫前都先檢查登入（spec §13）。 */
export function requireCurrentUserId(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("尚未登入");
  return uid;
}
```

Create `src/services/questionBankMappers.ts`:

```ts
import { Timestamp, type DocumentData } from "firebase/firestore";
import {
  isAnswerSpace,
  isBankSubject,
  type BankQuestion,
  type Box,
  type QuestionRegion,
  type QuestionSource,
  type SourcePage,
} from "../types/questionBank";
import { logger } from "../utils/logger";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonNull<T>(value: T | null): value is T {
  return value !== null;
}

function toDate(value: unknown): Date {
  if (isRecord(value) && typeof value.toDate === "function") {
    return (value.toDate as () => Date)();
  }
  return new Date();
}

export function toBox(value: unknown): Box | null {
  if (!isRecord(value)) return null;
  const { x, y, w, h } = value;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(w) || !isFiniteNumber(h)) {
    return null;
  }
  return { x, y, w, h };
}

function toSourcePage(value: unknown): SourcePage | null {
  if (!isRecord(value)) return null;
  const { storagePath, width, height, masks } = value;
  if (typeof storagePath !== "string" || !isFiniteNumber(width) || !isFiniteNumber(height)) {
    return null;
  }
  return {
    storagePath,
    width,
    height,
    masks: Array.isArray(masks) ? masks.map(toBox).filter(nonNull) : [],
  };
}

function toQuestionRegion(value: unknown): QuestionRegion | null {
  if (!isRecord(value) || !isFiniteNumber(value.pageIndex)) return null;
  const box = toBox(value.box);
  return box ? { pageIndex: value.pageIndex, box } : null;
}

export function toQuestionSource(id: string, data: DocumentData): QuestionSource | null {
  const rawPages: unknown[] = Array.isArray(data.pages) ? data.pages : [];
  const pages = rawPages.map(toSourcePage);
  const validPages = pages.filter(nonNull);
  if (
    typeof data.userId !== "string" ||
    !isBankSubject(data.subject) ||
    validPages.length !== pages.length
  ) {
    // 壞掉的頁會讓後面的 pageIndex 全部錯位，整份來源視為壞資料。
    logger.warn("[questionBank] skip invalid source", id);
    return null;
  }
  return {
    id,
    userId: data.userId,
    title: typeof data.title === "string" ? data.title : "",
    subject: data.subject,
    pages: validPages,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toBankQuestion(id: string, data: DocumentData): BankQuestion | null {
  const rawRegions: unknown[] = Array.isArray(data.regions) ? data.regions : [];
  const [first, ...rest] = rawRegions.map(toQuestionRegion).filter(nonNull);
  if (
    !first ||
    typeof data.userId !== "string" ||
    typeof data.sourceId !== "string" ||
    !isBankSubject(data.subject)
  ) {
    logger.warn("[questionBank] skip invalid question", id);
    return null;
  }
  const answer = typeof data.answer === "string" && data.answer.trim() ? data.answer : null;
  return {
    id,
    userId: data.userId,
    sourceId: data.sourceId,
    subject: data.subject,
    regions: [first, ...rest],
    ...(answer ? { answer } : {}),
    answerSpace: isAnswerSpace(data.answerSpace) ? data.answerSpace : "none",
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function plainBox(box: Box): Box {
  return { x: box.x, y: box.y, w: box.w, h: box.h };
}

/** 寫入用：不含 id、沒有值為 undefined 的欄位（spec §6）。 */
export function toFirestoreQuestion(question: BankQuestion): DocumentData {
  const answer = question.answer?.trim();
  return {
    userId: question.userId,
    sourceId: question.sourceId,
    subject: question.subject,
    regions: question.regions.map((region) => ({
      pageIndex: region.pageIndex,
      box: plainBox(region.box),
    })),
    answerSpace: question.answerSpace,
    ...(answer ? { answer } : {}),
    createdAt: Timestamp.fromDate(question.createdAt),
    updatedAt: Timestamp.now(),
  };
}

export function toFirestorePages(pages: readonly SourcePage[]): DocumentData[] {
  return pages.map((page) => ({
    storagePath: page.storagePath,
    width: page.width,
    height: page.height,
    masks: page.masks.map(plainBox),
  }));
}
```

- [ ] **Step 5: 執行確認通過**

Run: `npx vitest run src/services/questionBankMappers.test.ts src/services/requireCurrentUserId.test.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/services/questionBankMappers.ts src/services/questionBankMappers.test.ts src/services/requireCurrentUserId.ts src/services/requireCurrentUserId.test.ts
git commit -m "feat(my-exams): map question bank documents to and from Firestore" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 題目 service

**Files:**
- Create: `src/services/bankQuestionService.ts`
- Test: `src/services/bankQuestionService.test.ts`

**Interfaces:**
- Consumes: Task 1 常數；Task 4 的 `toBankQuestion`、`toFirestoreQuestion`、`toFirestorePages`、`requireCurrentUserId`
- Produces:
  - `newBankQuestionId(): string`
  - `listBankQuestions(): Promise<BankQuestion[]>`
  - `listQuestionsForSource(sourceId: string): Promise<BankQuestion[]>`
  - `deleteQuestionsForSource(sourceId: string): Promise<void>`
  - `interface EditorCommit { upserts: readonly BankQuestion[]; deleteIds: readonly string[]; source: Pick<QuestionSource, "id" | "title" | "pages"> | null }`
  - `commitEditorChanges(commit: EditorCommit): Promise<void>`（題目 set／delete 在前，來源 update 在最後一批）

- [ ] **Step 1: 寫失敗測試**

Create `src/services/bankQuestionService.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeBatch {
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
}

const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: "user-1" } as { uid: string } | null },
  getDocs: vi.fn(),
  batches: [] as FakeBatch[],
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  doc: vi.fn((_parent: unknown, name?: string, id?: string) =>
    name === undefined ? { id: "generated-id" } : { path: `${name}/${id}` },
  ),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ ref, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  getDocs: mocks.getDocs,
  writeBatch: vi.fn(() => {
    const batch: FakeBatch = {
      set: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };
    mocks.batches.push(batch);
    return batch;
  }),
  Timestamp: {
    now: vi.fn(() => ({ kind: "now" })),
    fromDate: vi.fn((date: Date) => ({ kind: "fromDate", date })),
  },
}));
vi.mock("../utils/firebaseUtil", () => ({ db: {}, auth: mocks.auth }));

import { makePage, makeQuestion } from "../testing/questionBankFixtures";
import {
  commitEditorChanges,
  deleteQuestionsForSource,
  listBankQuestions,
  listQuestionsForSource,
  newBankQuestionId,
} from "./bankQuestionService";

const stamp = { toDate: () => new Date("2026-09-01T00:00:00Z") };

function questionDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    ref: { path: `bankQuestions/${id}` },
    data: () => ({
      userId: "user-1",
      sourceId: "s1",
      subject: "math",
      regions: [{ pageIndex: 0, box: { x: 0, y: 0, w: 0.5, h: 0.5 } }],
      answerSpace: "none",
      createdAt: stamp,
      updatedAt: stamp,
      ...overrides,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.batches.length = 0;
  mocks.auth.currentUser = { uid: "user-1" };
});

describe("newBankQuestionId", () => {
  it("uses a Firestore auto id", () => {
    expect(newBankQuestionId()).toBe("generated-id");
  });
});

describe("listBankQuestions", () => {
  it("queries the current user's questions and skips broken documents", async () => {
    mocks.getDocs.mockResolvedValue({
      docs: [questionDoc("q1"), questionDoc("broken", { regions: [] })],
    });
    const questions = await listBankQuestions();
    expect(questions.map((q) => q.id)).toEqual(["q1"]);
    const [query] = mocks.getDocs.mock.calls[0];
    expect(query.constraints).toEqual([{ field: "userId", op: "==", value: "user-1" }]);
  });

  it("refuses to run without a signed-in user", async () => {
    mocks.auth.currentUser = null;
    await expect(listBankQuestions()).rejects.toThrow("尚未登入");
  });
});

describe("listQuestionsForSource", () => {
  it("filters by user and source", async () => {
    mocks.getDocs.mockResolvedValue({ docs: [questionDoc("q1")] });
    await listQuestionsForSource("s1");
    const [query] = mocks.getDocs.mock.calls[0];
    expect(query.constraints).toEqual([
      { field: "userId", op: "==", value: "user-1" },
      { field: "sourceId", op: "==", value: "s1" },
    ]);
  });
});

describe("deleteQuestionsForSource", () => {
  it("deletes in batches of 500", async () => {
    mocks.getDocs.mockResolvedValue({
      docs: Array.from({ length: 1200 }, (_, index) => questionDoc(`q${index}`)),
    });
    await deleteQuestionsForSource("s1");
    expect(mocks.batches.map((batch) => batch.delete.mock.calls.length)).toEqual([500, 500, 200]);
    expect(mocks.batches.every((batch) => batch.commit.mock.calls.length === 1)).toBe(true);
  });
});

describe("commitEditorChanges", () => {
  it("writes questions, deletions and the source in one batch", async () => {
    const question = makeQuestion({ id: "q1", answer: undefined });
    await commitEditorChanges({
      upserts: [question],
      deleteIds: ["q9"],
      source: { id: "s1", title: "新標題", pages: [makePage()] },
    });

    expect(mocks.batches).toHaveLength(1);
    const [batch] = mocks.batches;
    const [ref, data] = batch.set.mock.calls[0];
    expect(ref).toEqual({ path: "bankQuestions/q1" });
    expect("answer" in data).toBe(false);
    expect(batch.delete).toHaveBeenCalledWith({ path: "bankQuestions/q9" });
    expect(batch.update).toHaveBeenCalledWith(
      { path: "questionSources/s1" },
      expect.objectContaining({ title: "新標題", updatedAt: { kind: "now" } }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("puts the source update in the last batch when chunking", async () => {
    const upserts = Array.from({ length: 501 }, (_, index) => makeQuestion({ id: `q${index}` }));
    await commitEditorChanges({
      upserts,
      deleteIds: [],
      source: { id: "s1", title: "t", pages: [makePage()] },
    });
    expect(mocks.batches).toHaveLength(2);
    expect(mocks.batches[0].update).not.toHaveBeenCalled();
    expect(mocks.batches[1].update).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there is nothing to write", async () => {
    await commitEditorChanges({ upserts: [], deleteIds: [], source: null });
    expect(mocks.batches).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npx vitest run src/services/bankQuestionService.test.ts`
Expected: FAIL，找不到模組 `./bankQuestionService`。

- [ ] **Step 3: 實作**

Create `src/services/bankQuestionService.ts`:

```ts
import {
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import {
  BANK_QUESTIONS_COLLECTION,
  FIRESTORE_BATCH_LIMIT,
  QUESTION_SOURCES_COLLECTION,
} from "../constants/questionBank";
import type { BankQuestion, QuestionSource } from "../types/questionBank";
import {
  toBankQuestion,
  toFirestorePages,
  toFirestoreQuestion,
} from "./questionBankMappers";
import { requireCurrentUserId } from "./requireCurrentUserId";

type BatchOperation = (batch: WriteBatch) => void;

export function newBankQuestionId(): string {
  return doc(collection(db, BANK_QUESTIONS_COLLECTION)).id;
}

function mapQuestions(docs: readonly QueryDocumentSnapshot<DocumentData>[]): BankQuestion[] {
  return docs
    .map((snapshot) => toBankQuestion(snapshot.id, snapshot.data()))
    .filter((question): question is BankQuestion => question !== null);
}

async function commitInChunks(operations: readonly BatchOperation[]): Promise<void> {
  for (let start = 0; start < operations.length; start += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db);
    operations
      .slice(start, start + FIRESTORE_BATCH_LIMIT)
      .forEach((operation) => operation(batch));
    await batch.commit();
  }
}

/** 全量載入（題庫預期數百題），排序交給前端（spec §4、§15）。 */
export async function listBankQuestions(): Promise<BankQuestion[]> {
  const userId = requireCurrentUserId();
  const snapshot = await getDocs(
    query(collection(db, BANK_QUESTIONS_COLLECTION), where("userId", "==", userId)),
  );
  return mapQuestions(snapshot.docs);
}

export async function listQuestionsForSource(sourceId: string): Promise<BankQuestion[]> {
  const userId = requireCurrentUserId();
  const snapshot = await getDocs(
    query(
      collection(db, BANK_QUESTIONS_COLLECTION),
      where("userId", "==", userId),
      where("sourceId", "==", sourceId),
    ),
  );
  return mapQuestions(snapshot.docs);
}

export async function deleteQuestionsForSource(sourceId: string): Promise<void> {
  const userId = requireCurrentUserId();
  const snapshot = await getDocs(
    query(
      collection(db, BANK_QUESTIONS_COLLECTION),
      where("userId", "==", userId),
      where("sourceId", "==", sourceId),
    ),
  );
  await commitInChunks(
    snapshot.docs.map((item) => (batch: WriteBatch) => batch.delete(item.ref)),
  );
}

export interface EditorCommit {
  upserts: readonly BankQuestion[];
  deleteIds: readonly string[];
  /** 遮蓋或標題有變更時才帶。 */
  source: Pick<QuestionSource, "id" | "title" | "pages"> | null;
}

/** 裁題畫面的自動儲存（spec §8.4）。來源的 update 永遠排在最後。 */
export async function commitEditorChanges(commit: EditorCommit): Promise<void> {
  requireCurrentUserId();
  const operations: BatchOperation[] = [
    ...commit.upserts.map(
      (question) => (batch: WriteBatch) =>
        batch.set(doc(db, BANK_QUESTIONS_COLLECTION, question.id), toFirestoreQuestion(question)),
    ),
    ...commit.deleteIds.map(
      (id) => (batch: WriteBatch) => batch.delete(doc(db, BANK_QUESTIONS_COLLECTION, id)),
    ),
  ];
  const { source } = commit;
  if (source) {
    operations.push((batch: WriteBatch) =>
      batch.update(doc(db, QUESTION_SOURCES_COLLECTION, source.id), {
        title: source.title,
        pages: toFirestorePages(source.pages),
        updatedAt: Timestamp.now(),
      }),
    );
  }
  if (operations.length === 0) return;
  await commitInChunks(operations);
}
```

- [ ] **Step 4: 執行確認通過**

Run: `npx vitest run src/services/bankQuestionService.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/services/bankQuestionService.ts src/services/bankQuestionService.test.ts
git commit -m "feat(my-exams): add bank question service with batched editor saves" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 來源 service

**Files:**
- Create: `src/services/questionSourceService.ts`
- Test: `src/services/questionSourceService.test.ts`

**Interfaces:**
- Consumes: Task 1 常數；Task 3 的 `type RenderedPage`；Task 4 的 `toQuestionSource`、`requireCurrentUserId`；Task 5 的 `deleteQuestionsForSource`；既有 `supabase`、`STORAGE_BUCKET`
- Produces:
  - `createQuestionSourcePath(userId: string, sourceId: string, pageIndex: number): string`
  - `newQuestionSourceId(): string`
  - `interface CreateSourceInput { sourceId: string; title: string; subject: BankSubject; pageCount: number; renderPage: (pageIndex: number) => Promise<RenderedPage>; onProgress?: (uploaded: number, total: number) => void }`
  - `createSource(input: CreateSourceInput): Promise<QuestionSource>`
  - `listSources(): Promise<QuestionSource[]>`
  - `getSource(sourceId: string): Promise<QuestionSource | null>`（不存在、別人的、`permission-denied` 都回 `null`）
  - `deleteSource(source: QuestionSource): Promise<void>`（題目 → 來源文件 → Storage）

- [ ] **Step 1: 寫失敗測試**

Create `src/services/questionSourceService.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: "user-1" } as { uid: string } | null },
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  deleteQuestionsForSource: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  doc: vi.fn((_parent: unknown, name?: string, id?: string) =>
    name === undefined ? { id: "generated-source-id" } : { path: `${name}/${id}` },
  ),
  getDoc: mocks.getDoc,
  getDocs: mocks.getDocs,
  setDoc: mocks.setDoc,
  deleteDoc: mocks.deleteDoc,
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ ref, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ kind: "where", field, op, value })),
  orderBy: vi.fn((field: string, direction: string) => ({ kind: "orderBy", field, direction })),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date("2026-09-24T00:00:00Z") })),
  },
}));
vi.mock("../utils/firebaseUtil", () => ({ db: {}, auth: mocks.auth }));
vi.mock("../utils/supabaseClient", () => ({
  STORAGE_BUCKET: "ollie-reader",
  supabase: {
    storage: { from: vi.fn(() => ({ upload: mocks.upload, remove: mocks.remove })) },
  },
}));
vi.mock("./bankQuestionService", () => ({
  deleteQuestionsForSource: mocks.deleteQuestionsForSource,
}));

import { makePage, makeSource } from "../testing/questionBankFixtures";
import {
  createQuestionSourcePath,
  createSource,
  deleteSource,
  getSource,
  listSources,
  newQuestionSourceId,
} from "./questionSourceService";

const stamp = { toDate: () => new Date("2026-09-01T00:00:00Z") };
const sourceData = {
  userId: "user-1",
  title: "月考",
  subject: "math",
  pages: [{ storagePath: "p0.jpg", width: 10, height: 20, masks: [] }],
  createdAt: stamp,
  updatedAt: stamp,
};

function rendered(width: number) {
  return { blob: new Blob(["jpeg"]), width, height: 200 };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.currentUser = { uid: "user-1" };
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.setDoc.mockResolvedValue(undefined);
  mocks.deleteDoc.mockResolvedValue(undefined);
  mocks.deleteQuestionsForSource.mockResolvedValue(undefined);
});

describe("paths and ids", () => {
  it("builds the owner-scoped storage path", () => {
    expect(createQuestionSourcePath("user-1", "s1", 3)).toBe("question-bank/user-1/s1/page-3.jpg");
  });

  it("uses a Firestore auto id for new sources", () => {
    expect(newQuestionSourceId()).toBe("generated-source-id");
  });
});

describe("createSource", () => {
  it("renders and uploads one page at a time, then writes the document", async () => {
    const log: string[] = [];
    mocks.upload.mockImplementation(async (path: string) => {
      log.push(`upload ${path}`);
      return { error: null };
    });
    mocks.setDoc.mockImplementation(async () => {
      log.push("setDoc");
    });

    const source = await createSource({
      sourceId: "s1",
      title: "月考",
      subject: "math",
      pageCount: 2,
      renderPage: async (index) => {
        log.push(`render ${index}`);
        return rendered(100 + index);
      },
      onProgress: (done, total) => log.push(`progress ${done}/${total}`),
    });

    expect(log).toEqual([
      "render 0",
      "upload question-bank/user-1/s1/page-0.jpg",
      "progress 1/2",
      "render 1",
      "upload question-bank/user-1/s1/page-1.jpg",
      "progress 2/2",
      "setDoc",
    ]);
    expect(mocks.upload).toHaveBeenCalledWith(
      "question-bank/user-1/s1/page-0.jpg",
      expect.any(Blob),
      { contentType: "image/jpeg", upsert: true },
    );
    const [ref, data] = mocks.setDoc.mock.calls[0];
    expect(ref).toEqual({ path: "questionSources/s1" });
    expect(data).toMatchObject({
      userId: "user-1",
      title: "月考",
      subject: "math",
      pages: [
        { storagePath: "question-bank/user-1/s1/page-0.jpg", width: 100, height: 200, masks: [] },
        { storagePath: "question-bank/user-1/s1/page-1.jpg", width: 101, height: 200, masks: [] },
      ],
    });
    expect(source.id).toBe("s1");
    expect(source.pages).toHaveLength(2);
  });

  it("cleans up uploaded pages and skips the document when an upload fails", async () => {
    mocks.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error("network") });

    await expect(
      createSource({
        sourceId: "s1",
        title: "t",
        subject: "math",
        pageCount: 2,
        renderPage: async (index) => rendered(index),
      }),
    ).rejects.toThrow("network");

    expect(mocks.setDoc).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith(["question-bank/user-1/s1/page-0.jpg"]);
  });

  it("cleans up every page when the document write fails", async () => {
    mocks.setDoc.mockRejectedValue(new Error("denied"));
    await expect(
      createSource({
        sourceId: "s1",
        title: "t",
        subject: "math",
        pageCount: 2,
        renderPage: async (index) => rendered(index),
      }),
    ).rejects.toThrow("denied");
    expect(mocks.remove).toHaveBeenCalledWith([
      "question-bank/user-1/s1/page-0.jpg",
      "question-bank/user-1/s1/page-1.jpg",
    ]);
  });
});

describe("listSources", () => {
  it("lists the current user's sources newest first and skips broken ones", async () => {
    mocks.getDocs.mockResolvedValue({
      docs: [
        { id: "s1", data: () => sourceData },
        { id: "bad", data: () => ({ ...sourceData, subject: "music" }) },
      ],
    });
    const sources = await listSources();
    expect(sources.map((source) => source.id)).toEqual(["s1"]);
    const [query] = mocks.getDocs.mock.calls[0];
    expect(query.constraints).toEqual([
      { kind: "where", field: "userId", op: "==", value: "user-1" },
      { kind: "orderBy", field: "createdAt", direction: "desc" },
    ]);
  });
});

describe("getSource", () => {
  it("returns the source when it belongs to the current user", async () => {
    mocks.getDoc.mockResolvedValue({ id: "s1", exists: () => true, data: () => sourceData });
    expect((await getSource("s1"))?.title).toBe("月考");
  });

  it("returns null for missing, foreign or forbidden sources", async () => {
    mocks.getDoc.mockResolvedValueOnce({ id: "s1", exists: () => false, data: () => undefined });
    expect(await getSource("s1")).toBeNull();

    mocks.getDoc.mockResolvedValueOnce({
      id: "s1",
      exists: () => true,
      data: () => ({ ...sourceData, userId: "someone-else" }),
    });
    expect(await getSource("s1")).toBeNull();

    mocks.getDoc.mockRejectedValueOnce({ code: "permission-denied" });
    expect(await getSource("s1")).toBeNull();
  });
});

describe("deleteSource", () => {
  it("deletes questions, then the source document, then the page images", async () => {
    const log: string[] = [];
    mocks.deleteQuestionsForSource.mockImplementation(async () => log.push("questions"));
    mocks.deleteDoc.mockImplementation(async () => log.push("source"));
    mocks.remove.mockImplementation(async () => {
      log.push("storage");
      return { error: null };
    });

    await deleteSource(
      makeSource({ id: "s1", pages: [makePage({ storagePath: "a.jpg" }), makePage({ storagePath: "b.jpg" })] }),
    );

    expect(log).toEqual(["questions", "source", "storage"]);
    expect(mocks.deleteDoc).toHaveBeenCalledWith({ path: "questionSources/s1" });
    expect(mocks.remove).toHaveBeenCalledWith(["a.jpg", "b.jpg"]);
  });

  it("does not fail when the storage cleanup fails", async () => {
    mocks.remove.mockRejectedValue(new Error("storage down"));
    await expect(deleteSource(makeSource())).resolves.toBeUndefined();
  });

  it("keeps the source document when deleting questions fails (so it can be retried)", async () => {
    mocks.deleteQuestionsForSource.mockRejectedValue(new Error("offline"));
    await expect(deleteSource(makeSource())).rejects.toThrow("offline");
    expect(mocks.deleteDoc).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npx vitest run src/services/questionSourceService.test.ts`
Expected: FAIL，找不到模組 `./questionSourceService`。

- [ ] **Step 3: 實作**

Create `src/services/questionSourceService.ts`:

```ts
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import { STORAGE_BUCKET, supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";
import {
  QUESTION_BANK_STORAGE_FOLDER,
  QUESTION_SOURCES_COLLECTION,
} from "../constants/questionBank";
import type { BankSubject, QuestionSource, SourcePage } from "../types/questionBank";
import type { RenderedPage } from "../utils/pageImageProcessor";
import { deleteQuestionsForSource } from "./bankQuestionService";
import { toQuestionSource } from "./questionBankMappers";
import { requireCurrentUserId } from "./requireCurrentUserId";

export function createQuestionSourcePath(
  userId: string,
  sourceId: string,
  pageIndex: number,
): string {
  return `${QUESTION_BANK_STORAGE_FOLDER}/${userId}/${sourceId}/page-${pageIndex}.jpg`;
}

export function newQuestionSourceId(): string {
  return doc(collection(db, QUESTION_SOURCES_COLLECTION)).id;
}

async function removeStorageFiles(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([...paths]);
    if (error) logger.warn("[questionSource] storage cleanup failed", error);
  } catch (error) {
    logger.warn("[questionSource] storage cleanup failed", error);
  }
}

export interface CreateSourceInput {
  /** 重試時沿用同一個 id；搭配 upsert: true 覆寫殘留檔（spec §7）。 */
  sourceId: string;
  title: string;
  subject: BankSubject;
  pageCount: number;
  /** 依序呼叫：前一頁上傳完成才會要求下一頁，一次只有一頁在記憶體。 */
  renderPage: (pageIndex: number) => Promise<RenderedPage>;
  onProgress?: (uploaded: number, total: number) => void;
}

export async function createSource(input: CreateSourceInput): Promise<QuestionSource> {
  const userId = requireCurrentUserId();
  const pages: SourcePage[] = [];
  const uploadedPaths: string[] = [];

  try {
    for (let pageIndex = 0; pageIndex < input.pageCount; pageIndex += 1) {
      const rendered = await input.renderPage(pageIndex);
      const storagePath = createQuestionSourcePath(userId, input.sourceId, pageIndex);
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, rendered.blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      uploadedPaths.push(storagePath);
      pages.push({ storagePath, width: rendered.width, height: rendered.height, masks: [] });
      input.onProgress?.(pageIndex + 1, input.pageCount);
    }

    const now = Timestamp.now();
    await setDoc(doc(db, QUESTION_SOURCES_COLLECTION, input.sourceId), {
      userId,
      title: input.title,
      subject: input.subject,
      pages,
      createdAt: now,
      updatedAt: now,
    });
    return {
      id: input.sourceId,
      userId,
      title: input.title,
      subject: input.subject,
      pages,
      createdAt: now.toDate(),
      updatedAt: now.toDate(),
    };
  } catch (error) {
    await removeStorageFiles(uploadedPaths);
    throw error;
  }
}

export async function listSources(): Promise<QuestionSource[]> {
  const userId = requireCurrentUserId();
  const snapshot = await getDocs(
    query(
      collection(db, QUESTION_SOURCES_COLLECTION),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
    ),
  );
  return snapshot.docs
    .map((item) => toQuestionSource(item.id, item.data()))
    .filter((source): source is QuestionSource => source !== null);
}

function isPermissionDenied(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "permission-denied"
  );
}

export async function getSource(sourceId: string): Promise<QuestionSource | null> {
  const userId = requireCurrentUserId();
  try {
    const snapshot = await getDoc(doc(db, QUESTION_SOURCES_COLLECTION, sourceId));
    if (!snapshot.exists()) return null;
    const source = toQuestionSource(snapshot.id, snapshot.data());
    return source && source.userId === userId ? source : null;
  } catch (error) {
    if (isPermissionDenied(error)) return null;
    throw error;
  }
}

/**
 * 先刪題目、最後才刪來源文件：多批刪除不是原子操作，
 * 中途失敗時來源還在，重按刪除即可接續（spec §10）。
 */
export async function deleteSource(source: QuestionSource): Promise<void> {
  requireCurrentUserId();
  await deleteQuestionsForSource(source.id);
  await deleteDoc(doc(db, QUESTION_SOURCES_COLLECTION, source.id));
  await removeStorageFiles(source.pages.map((page) => page.storagePath));
}
```

- [ ] **Step 4: 執行確認通過**

Run: `npx vitest run src/services/questionSourceService.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/services/questionSourceService.ts src/services/questionSourceService.test.ts
git commit -m "feat(my-exams): add question source service with page-by-page upload" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Signed URL 快取

**Files:**
- Create: `src/hooks/useSignedPageUrls.ts`
- Test: `src/hooks/useSignedPageUrls.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `SIGNED_URL_TTL_SECONDS`、`SIGNED_URL_REFRESH_MARGIN_MS`；既有 `supabase`、`STORAGE_BUCKET`
- Produces:
  - `fetchSignedUrls(paths: readonly string[], force?: boolean): Promise<Record<string, string>>`
  - `resetSignedUrlCache(): void`（測試用）
  - `useSignedPageUrls(paths: readonly string[]): { urls: Record<string, string>; failed: boolean; refresh: (path: string) => Promise<void> }`

- [ ] **Step 1: 寫失敗測試**

Create `src/hooks/useSignedPageUrls.test.tsx`:

```tsx
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createSignedUrls: vi.fn() }));

vi.mock("../utils/supabaseClient", () => ({
  STORAGE_BUCKET: "ollie-reader",
  supabase: {
    storage: { from: vi.fn(() => ({ createSignedUrls: mocks.createSignedUrls })) },
  },
}));

import {
  fetchSignedUrls,
  resetSignedUrlCache,
  useSignedPageUrls,
} from "./useSignedPageUrls";

function signed(paths: string[], tag = "v1") {
  return {
    data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}?${tag}`, error: null })),
    error: null,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.createSignedUrls.mockReset();
  resetSignedUrlCache();
});

describe("fetchSignedUrls", () => {
  it("requests each unique path once and caches the result", async () => {
    mocks.createSignedUrls.mockImplementation(async (paths: string[]) => signed(paths));

    const first = await fetchSignedUrls(["a.jpg", "b.jpg", "a.jpg"]);
    expect(first).toEqual({
      "a.jpg": "https://signed/a.jpg?v1",
      "b.jpg": "https://signed/b.jpg?v1",
    });
    expect(mocks.createSignedUrls).toHaveBeenCalledWith(["a.jpg", "b.jpg"], 3600);

    await fetchSignedUrls(["a.jpg"]);
    expect(mocks.createSignedUrls).toHaveBeenCalledTimes(1);
  });

  it("refetches when fewer than 5 minutes remain", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(0);
    mocks.createSignedUrls.mockImplementationOnce(async (paths: string[]) => signed(paths, "v1"));
    await fetchSignedUrls(["a.jpg"]);

    now.mockReturnValue((3600 - 4 * 60) * 1000);
    mocks.createSignedUrls.mockImplementationOnce(async (paths: string[]) => signed(paths, "v2"));
    expect(await fetchSignedUrls(["a.jpg"])).toEqual({ "a.jpg": "https://signed/a.jpg?v2" });
  });

  it("forces a refresh when asked", async () => {
    mocks.createSignedUrls.mockImplementationOnce(async (paths: string[]) => signed(paths, "v1"));
    await fetchSignedUrls(["a.jpg"]);
    mocks.createSignedUrls.mockImplementationOnce(async (paths: string[]) => signed(paths, "v2"));
    expect(await fetchSignedUrls(["a.jpg"], true)).toEqual({ "a.jpg": "https://signed/a.jpg?v2" });
  });

  it("skips entries that failed individually and throws on a request error", async () => {
    mocks.createSignedUrls.mockResolvedValueOnce({
      data: [
        { path: "a.jpg", signedUrl: "https://signed/a", error: null },
        { path: "b.jpg", signedUrl: "", error: "not found" },
      ],
      error: null,
    });
    expect(await fetchSignedUrls(["a.jpg", "b.jpg"])).toEqual({ "a.jpg": "https://signed/a" });

    mocks.createSignedUrls.mockResolvedValueOnce({ data: null, error: new Error("offline") });
    await expect(fetchSignedUrls(["c.jpg"])).rejects.toThrow("offline");
  });
});

describe("useSignedPageUrls", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof useSignedPageUrls> | null = null;

  function Probe({ paths }: { paths: string[] }) {
    const result = useSignedPageUrls(paths);
    useEffect(() => {
      latest = result;
    });
    return null;
  }

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    root = createRoot(container);
    latest = null;
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it("exposes urls for the requested paths and can refresh one", async () => {
    mocks.createSignedUrls.mockImplementation(async (paths: string[]) => signed(paths, "v1"));
    await act(async () => {
      root.render(<Probe paths={["a.jpg", "b.jpg"]} />);
    });
    expect(latest?.urls["a.jpg"]).toBe("https://signed/a.jpg?v1");

    mocks.createSignedUrls.mockImplementation(async (paths: string[]) => signed(paths, "v2"));
    await act(async () => {
      await latest?.refresh("a.jpg");
    });
    expect(latest?.urls["a.jpg"]).toBe("https://signed/a.jpg?v2");
    expect(latest?.urls["b.jpg"]).toBe("https://signed/b.jpg?v1");
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npx vitest run src/hooks/useSignedPageUrls.test.tsx`
Expected: FAIL，找不到模組 `./useSignedPageUrls`。

- [ ] **Step 3: 實作**

Create `src/hooks/useSignedPageUrls.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import {
  SIGNED_URL_REFRESH_MARGIN_MS,
  SIGNED_URL_TTL_SECONDS,
} from "../constants/questionBank";
import { STORAGE_BUCKET, supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";

interface CacheEntry {
  url: string;
  expiresAt: number;
}

/** 模組層級快取：跨元件共用，同一頁圖不重複簽（spec §9）。 */
const cache = new Map<string, CacheEntry>();

export function resetSignedUrlCache(): void {
  cache.clear();
}

function isFresh(entry: CacheEntry | undefined, now: number): entry is CacheEntry {
  return entry !== undefined && entry.expiresAt - now > SIGNED_URL_REFRESH_MARGIN_MS;
}

export async function fetchSignedUrls(
  paths: readonly string[],
  force = false,
): Promise<Record<string, string>> {
  const now = Date.now();
  const missing = [...new Set(paths)].filter((path) => force || !isFresh(cache.get(path), now));

  if (missing.length > 0) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);
    if (error) throw error;
    const expiresAt = now + SIGNED_URL_TTL_SECONDS * 1000;
    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) {
        cache.set(item.path, { url: item.signedUrl, expiresAt });
      }
    }
  }

  const urls: Record<string, string> = {};
  for (const path of paths) {
    const entry = cache.get(path);
    if (entry) urls[path] = entry.url;
  }
  return urls;
}

export function useSignedPageUrls(paths: readonly string[]) {
  // 用內容當 key：呼叫端每次 render 產生新陣列也不會重抓。
  const key = [...new Set(paths)].sort().join("\n");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (key === "") return;
    let cancelled = false;
    fetchSignedUrls(key.split("\n"))
      .then((result) => {
        if (cancelled) return;
        setUrls((previous) => ({ ...previous, ...result }));
        setFailed(false);
      })
      .catch((error: unknown) => {
        logger.warn("[useSignedPageUrls] failed to sign page urls", error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const refresh = useCallback(async (path: string) => {
    try {
      const result = await fetchSignedUrls([path], true);
      setUrls((previous) => ({ ...previous, ...result }));
    } catch (error) {
      logger.warn("[useSignedPageUrls] refresh failed", error);
    }
  }, []);

  return { urls, failed, refresh };
}
```

- [ ] **Step 4: 執行確認通過**

Run: `npx vitest run src/hooks/useSignedPageUrls.test.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSignedPageUrls.ts src/hooks/useSignedPageUrls.test.tsx
git commit -m "feat(my-exams): cache signed page image urls" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 自動儲存

邏輯放在與 React 無關的 `AutosaveQueue` class（可用 fake timers 直接測），`useAutosave` 只負責接上 React 與瀏覽器事件。

**Files:**
- Create: `src/hooks/autosaveQueue.ts`
- Create: `src/hooks/useAutosave.ts`
- Test: `src/hooks/autosaveQueue.test.ts`
- Test: `src/hooks/useAutosave.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `AUTOSAVE_DELAY_MS`
- Produces:
  - `type AutosaveStatus = "idle" | "saving" | "saved" | "error"`
  - `interface PendingChanges { upsertIds: string[]; deleteIds: string[]; sourceDirty: boolean }`
  - `class AutosaveQueue`：`constructor(options: { commit; persistedIds: Iterable<string>; delayMs: number; onStatusChange })`、`markUpsert(id)`、`markDelete(id)`、`markSourceDirty()`、`flush(): Promise<void>`、`setCommit(commit)`、`start()`、`stop()`、`hasPending(): boolean`
  - `useAutosave(options: { commit: (changes: PendingChanges) => Promise<void>; persistedIds: readonly string[]; delayMs?: number }): { status: AutosaveStatus; markUpsert: (id: string) => void; markDelete: (id: string) => void; markSourceDirty: () => void; flush: () => Promise<void> }`

**行為規則（spec §8.4）：**
- 最後一次變更後 `delayMs` 才送出；送出的是「id 清單」，實際資料由 `commit` 從最新狀態組出來。
- 刪除優先：`markDelete` 會把 id 從 upsert 集合拿掉；只有「已寫入過」或「正在送出中」的 id 才會送 delete。
- 送出期間的新變更累積到下一批；同一 id 在送出期間又被修改，成功後仍保留在待送清單。
- 失敗時什麼都不丟，狀態變 `error`；下一次 `flush()`（重試按鈕或下一次變更）一併重送。
- `stop()` 後不再排程（StrictMode 的清除），`start()` 恢復。

- [ ] **Step 1: 寫佇列的失敗測試**

Create `src/hooks/autosaveQueue.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AutosaveQueue,
  type AutosaveStatus,
  type PendingChanges,
} from "./autosaveQueue";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function setup(persistedIds: string[] = []) {
  const commits: PendingChanges[] = [];
  const statuses: AutosaveStatus[] = [];
  let next: () => Promise<void> = async () => {};
  const queue = new AutosaveQueue({
    commit: (changes) => {
      commits.push(changes);
      return next();
    },
    persistedIds,
    delayMs: 1000,
    onStatusChange: (status) => statuses.push(status),
  });
  return {
    queue,
    commits,
    statuses,
    willCommit: (impl: () => Promise<void>) => {
      next = impl;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AutosaveQueue", () => {
  it("debounces changes into one commit", async () => {
    const { queue, commits, statuses } = setup();
    queue.markUpsert("a");
    await vi.advanceTimersByTimeAsync(500);
    queue.markUpsert("b");
    await vi.advanceTimersByTimeAsync(999);
    expect(commits).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(commits).toEqual([{ upsertIds: ["a", "b"], deleteIds: [], sourceDirty: false }]);
    expect(statuses).toEqual(["saving", "saved"]);
    expect(queue.hasPending()).toBe(false);
  });

  it("sends nothing for a question created and deleted before saving", async () => {
    const { queue, commits } = setup();
    queue.markUpsert("draft");
    queue.markDelete("draft");
    await vi.advanceTimersByTimeAsync(1000);
    expect(commits).toHaveLength(0);
  });

  it("deletes questions that already exist in Firestore", async () => {
    const { queue, commits } = setup(["saved-1"]);
    queue.markUpsert("saved-1");
    queue.markDelete("saved-1");
    await vi.advanceTimersByTimeAsync(1000);
    expect(commits).toEqual([{ upsertIds: [], deleteIds: ["saved-1"], sourceDirty: false }]);
  });

  it("reports source changes", async () => {
    const { queue, commits } = setup();
    queue.markSourceDirty();
    await vi.advanceTimersByTimeAsync(1000);
    expect(commits).toEqual([{ upsertIds: [], deleteIds: [], sourceDirty: true }]);
  });

  it("queues changes made while a commit is in flight for the next batch", async () => {
    const { queue, commits, willCommit } = setup();
    const inFlight = deferred();
    willCommit(() => inFlight.promise);

    queue.markUpsert("a");
    await vi.advanceTimersByTimeAsync(1000);
    expect(commits).toHaveLength(1);

    willCommit(async () => {});
    queue.markUpsert("a"); // 送出期間又改了一次
    queue.markUpsert("b");
    inFlight.resolve();
    await vi.advanceTimersByTimeAsync(1000);

    expect(commits[1]).toEqual({ upsertIds: ["a", "b"], deleteIds: [], sourceDirty: false });
  });

  it("deletes a new question that was removed while its first save was in flight", async () => {
    const { queue, commits, willCommit } = setup();
    const inFlight = deferred();
    willCommit(() => inFlight.promise);

    queue.markUpsert("fresh");
    await vi.advanceTimersByTimeAsync(1000);
    willCommit(async () => {});
    queue.markDelete("fresh");
    inFlight.resolve();
    await vi.advanceTimersByTimeAsync(1000);

    expect(commits[1]).toEqual({ upsertIds: [], deleteIds: ["fresh"], sourceDirty: false });
  });

  it("keeps everything after a failure and resends on the next flush", async () => {
    const { queue, commits, statuses, willCommit } = setup();
    willCommit(async () => {
      throw new Error("offline");
    });
    queue.markUpsert("a");
    queue.markSourceDirty();
    await vi.advanceTimersByTimeAsync(1000);
    expect(statuses.at(-1)).toBe("error");
    expect(queue.hasPending()).toBe(true);

    willCommit(async () => {});
    await queue.flush();
    expect(commits[1]).toEqual({ upsertIds: ["a"], deleteIds: [], sourceDirty: true });
    expect(statuses.at(-1)).toBe("saved");
  });

  it("flush() saves immediately without waiting for the debounce", async () => {
    const { queue, commits } = setup();
    queue.markUpsert("a");
    await queue.flush();
    expect(commits).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(commits).toHaveLength(1);
  });

  it("stop() cancels the scheduled save and start() resumes scheduling", async () => {
    const { queue, commits } = setup();
    queue.markUpsert("a");
    queue.stop();
    await vi.advanceTimersByTimeAsync(2000);
    expect(commits).toHaveLength(0);

    queue.start();
    queue.markUpsert("b");
    await vi.advanceTimersByTimeAsync(1000);
    expect(commits).toEqual([{ upsertIds: ["a", "b"], deleteIds: [], sourceDirty: false }]);
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npx vitest run src/hooks/autosaveQueue.test.ts`
Expected: FAIL，找不到模組 `./autosaveQueue`。

- [ ] **Step 3: 實作佇列**

Create `src/hooks/autosaveQueue.ts`:

```ts
import { logger } from "../utils/logger";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export interface PendingChanges {
  upsertIds: string[];
  deleteIds: string[];
  sourceDirty: boolean;
}

export interface AutosaveQueueOptions {
  commit: (changes: PendingChanges) => Promise<void>;
  /** 已存在 Firestore 的題目 id（刪除時才需要送 delete）。 */
  persistedIds: Iterable<string>;
  delayMs: number;
  onStatusChange: (status: AutosaveStatus) => void;
}

interface InFlight {
  upserts: ReadonlyMap<string, number>;
  promise: Promise<void>;
}

/**
 * 裁題畫面的自動儲存佇列（spec §8.4）。每個變更帶遞增版本號：
 * 成功後只移除「版本沒變」的項目，送出期間又被修改的 id 會留到下一批。
 */
export class AutosaveQueue {
  private commit: (changes: PendingChanges) => Promise<void>;
  private readonly delayMs: number;
  private readonly onStatusChange: (status: AutosaveStatus) => void;
  private readonly persisted: Set<string>;
  private readonly upserts = new Map<string, number>();
  private readonly deletes = new Set<string>();
  private sourceVersion: number | null = null;
  private version = 0;
  private inFlight: InFlight | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private active = true;

  constructor(options: AutosaveQueueOptions) {
    this.commit = options.commit;
    this.delayMs = options.delayMs;
    this.onStatusChange = options.onStatusChange;
    this.persisted = new Set(options.persistedIds);
  }

  setCommit(commit: (changes: PendingChanges) => Promise<void>): void {
    this.commit = commit;
  }

  start(): void {
    this.active = true;
  }

  stop(): void {
    this.active = false;
    this.clearTimer();
  }

  hasPending(): boolean {
    return this.upserts.size > 0 || this.deletes.size > 0 || this.sourceVersion !== null;
  }

  markUpsert = (id: string): void => {
    this.version += 1;
    this.upserts.set(id, this.version);
    this.deletes.delete(id);
    this.schedule();
  };

  markDelete = (id: string): void => {
    this.upserts.delete(id);
    if (this.persisted.has(id) || this.inFlight?.upserts.has(id)) {
      this.deletes.add(id);
    }
    this.schedule();
  };

  markSourceDirty = (): void => {
    this.version += 1;
    this.sourceVersion = this.version;
    this.schedule();
  };

  flush = async (): Promise<void> => {
    this.clearTimer();
    while (this.inFlight) {
      try {
        await this.inFlight.promise;
      } catch {
        // 失敗由原本那次 flush 處理
      }
    }
    if (!this.hasPending()) return;

    const upserts = new Map(this.upserts);
    const deletes = new Set(this.deletes);
    const sourceVersion = this.sourceVersion;
    const promise = this.commit({
      upsertIds: [...upserts.keys()],
      deleteIds: [...deletes],
      sourceDirty: sourceVersion !== null,
    });
    this.inFlight = { upserts, promise };
    this.onStatusChange("saving");

    try {
      await promise;
      for (const [id, version] of upserts) {
        this.persisted.add(id);
        if (this.upserts.get(id) === version) this.upserts.delete(id);
      }
      for (const id of deletes) {
        this.persisted.delete(id);
        this.deletes.delete(id);
      }
      if (this.sourceVersion === sourceVersion) this.sourceVersion = null;
      this.inFlight = null;
      this.onStatusChange(this.hasPending() ? "saving" : "saved");
    } catch (error) {
      this.inFlight = null;
      logger.warn("[autosave] commit failed", error);
      this.onStatusChange("error");
    }
  };

  private schedule(): void {
    if (!this.active) return;
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.delayMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
```

- [ ] **Step 4: 執行確認通過**

Run: `npx vitest run src/hooks/autosaveQueue.test.ts`
Expected: PASS。

- [ ] **Step 5: 寫 hook 的失敗測試**

Create `src/hooks/useAutosave.test.tsx`:

```tsx
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingChanges } from "./autosaveQueue";
import { useAutosave } from "./useAutosave";

let container: HTMLDivElement;
let root: Root;
let controls: ReturnType<typeof useAutosave> | null = null;

function Harness({ commit }: { commit: (changes: PendingChanges) => Promise<void> }) {
  const autosave = useAutosave({ commit, persistedIds: [] });
  useEffect(() => {
    controls = autosave;
  });
  return <span data-status={autosave.status} />;
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  controls = null;
});

afterEach(() => {
  vi.useRealTimers();
  setVisibility("visible");
  container.remove();
});

describe("useAutosave", () => {
  it("saves immediately when the page becomes hidden", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      root.render(<Harness commit={commit} />);
    });
    act(() => controls?.markUpsert("a"));

    setVisibility("hidden");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(commit).toHaveBeenCalledWith({ upsertIds: ["a"], deleteIds: [], sourceDirty: false });
    expect(container.querySelector("span")?.dataset.status).toBe("saved");
    act(() => root.unmount());
  });

  it("saves pending changes on unmount", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      root.render(<Harness commit={commit} />);
    });
    act(() => controls?.markSourceDirty());

    await act(async () => {
      root.unmount();
    });

    expect(commit).toHaveBeenCalledWith({ upsertIds: [], deleteIds: [], sourceDirty: true });
  });
});
```

- [ ] **Step 6: 執行確認失敗**

Run: `npx vitest run src/hooks/useAutosave.test.tsx`
Expected: FAIL，找不到模組 `./useAutosave`。

- [ ] **Step 7: 實作 hook**

Create `src/hooks/useAutosave.ts`:

```ts
import { useEffect, useState } from "react";
import { AUTOSAVE_DELAY_MS } from "../constants/questionBank";
import {
  AutosaveQueue,
  type AutosaveStatus,
  type PendingChanges,
} from "./autosaveQueue";

export interface UseAutosaveOptions {
  commit: (changes: PendingChanges) => Promise<void>;
  /** 只在第一次 render 讀取：呼叫端要在資料載入完成後才掛載。 */
  persistedIds: readonly string[];
  delayMs?: number;
}

export function useAutosave({
  commit,
  persistedIds,
  delayMs = AUTOSAVE_DELAY_MS,
}: UseAutosaveOptions) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [queue] = useState(
    () =>
      new AutosaveQueue({
        commit,
        persistedIds,
        delayMs,
        onStatusChange: setStatus,
      }),
  );

  useEffect(() => {
    queue.setCommit(commit);
  }, [queue, commit]);

  useEffect(() => {
    queue.start();
    const flushNow = () => {
      void queue.flush();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", flushNow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", flushNow);
      // StrictMode 會清除後再執行一次 effect：這裡先存、再暫停排程，上面的 start() 會恢復。
      flushNow();
      queue.stop();
    };
  }, [queue]);

  return {
    status,
    markUpsert: queue.markUpsert,
    markDelete: queue.markDelete,
    markSourceDirty: queue.markSourceDirty,
    flush: queue.flush,
  };
}
```

- [ ] **Step 8: 執行確認通過**

Run: `npx vitest run src/hooks/useAutosave.test.tsx src/hooks/autosaveQueue.test.ts`
Expected: PASS。

- [ ] **Step 9: Lint**

Run: `npm run lint`
Expected: 無錯誤（特別確認 `react-hooks` 沒有對 `useState(() => new AutosaveQueue(...))` 報錯）。

- [ ] **Step 10: Commit**

```bash
git add src/hooks/autosaveQueue.ts src/hooks/autosaveQueue.test.ts src/hooks/useAutosave.ts src/hooks/useAutosave.test.tsx
git commit -m "feat(my-exams): add debounced autosave queue" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: 裁題畫面的 reducer 與選取 key

**Files:**
- Create: `src/components/MyExams/cropEditorState.ts`
- Create: `src/components/MyExams/editorSelection.ts`
- Test: `src/components/MyExams/cropEditorState.test.ts`
- Test: `src/components/MyExams/editorSelection.test.ts`

**Interfaces:**
- Consumes: Task 1 型別與假資料
- Produces:
  - `interface CropEditorState { source: QuestionSource; questions: BankQuestion[] }`
  - `type QuestionPatch = Partial<{ subject: BankSubject; answer: string; answerSpace: AnswerSpace }>`
  - `type CropEditorAction`（`createQuestion`、`appendRegion`、`updateRegion`、`removeRegion`、`updateQuestion`、`deleteQuestion`、`addMask`、`updateMask`、`removeMask`、`renameSource`，欄位見下方程式碼）
  - `type EditorChange = { kind: "upsert"; id: string } | { kind: "delete"; id: string } | { kind: "source" }`
  - `cropEditorReducer(state: CropEditorState, action: CropEditorAction): CropEditorState`
  - `changeOf(action: CropEditorAction): EditorChange`
  - `type SelectionTarget = { kind: "question"; questionId: string; regionIndex: number } | { kind: "mask"; maskIndex: number }`
  - `questionSelectionKey(questionId: string, regionIndex: number): string`
  - `maskSelectionKey(maskIndex: number): string`
  - `parseSelectionKey(key: string): SelectionTarget | null`

- [ ] **Step 1: 寫 reducer 的失敗測試**

Create `src/components/MyExams/cropEditorState.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makePage, makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import {
  changeOf,
  cropEditorReducer,
  type CropEditorState,
} from "./cropEditorState";

const box = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
const other = { x: 0.5, y: 0.5, w: 0.3, h: 0.1 };

function initial(): CropEditorState {
  return {
    source: makeSource({ pages: [makePage(), makePage({ storagePath: "p1.jpg" })] }),
    questions: [makeQuestion({ id: "q1", regions: [{ pageIndex: 0, box }] })],
  };
}

describe("cropEditorReducer", () => {
  it("creates a question", () => {
    const question = makeQuestion({ id: "q2" });
    const next = cropEditorReducer(initial(), { type: "createQuestion", question });
    expect(next.questions.map((q) => q.id)).toEqual(["q1", "q2"]);
  });

  it("appends, updates and removes regions but always keeps one", () => {
    let state = cropEditorReducer(initial(), {
      type: "appendRegion",
      questionId: "q1",
      region: { pageIndex: 1, box: other },
    });
    expect(state.questions[0].regions).toEqual([
      { pageIndex: 0, box },
      { pageIndex: 1, box: other },
    ]);

    state = cropEditorReducer(state, { type: "updateRegion", questionId: "q1", regionIndex: 1, box });
    expect(state.questions[0].regions[1]).toEqual({ pageIndex: 1, box });

    state = cropEditorReducer(state, { type: "removeRegion", questionId: "q1", regionIndex: 0 });
    expect(state.questions[0].regions).toEqual([{ pageIndex: 1, box }]);

    const unchanged = cropEditorReducer(state, { type: "removeRegion", questionId: "q1", regionIndex: 0 });
    expect(unchanged.questions[0].regions).toHaveLength(1);
  });

  it("patches question fields and clears an emptied answer", () => {
    let state = cropEditorReducer(initial(), {
      type: "updateQuestion",
      questionId: "q1",
      patch: { subject: "science", answer: "(2)", answerSpace: "large" },
    });
    expect(state.questions[0]).toMatchObject({ subject: "science", answer: "(2)", answerSpace: "large" });

    state = cropEditorReducer(state, { type: "updateQuestion", questionId: "q1", patch: { answer: "" } });
    expect("answer" in state.questions[0]).toBe(false);
  });

  it("deletes a question", () => {
    expect(cropEditorReducer(initial(), { type: "deleteQuestion", questionId: "q1" }).questions).toEqual([]);
  });

  it("adds, updates and removes masks on one page only", () => {
    let state = cropEditorReducer(initial(), { type: "addMask", pageIndex: 1, box });
    state = cropEditorReducer(state, { type: "addMask", pageIndex: 1, box: other });
    expect(state.source.pages[0].masks).toEqual([]);
    expect(state.source.pages[1].masks).toEqual([box, other]);

    state = cropEditorReducer(state, { type: "updateMask", pageIndex: 1, maskIndex: 0, box: other });
    expect(state.source.pages[1].masks).toEqual([other, other]);

    state = cropEditorReducer(state, { type: "removeMask", pageIndex: 1, maskIndex: 1 });
    expect(state.source.pages[1].masks).toEqual([other]);
  });

  it("renames the source", () => {
    expect(cropEditorReducer(initial(), { type: "renameSource", title: "期中考" }).source.title).toBe("期中考");
  });
});

describe("changeOf", () => {
  it("maps each action to what autosave must write", () => {
    expect(changeOf({ type: "createQuestion", question: makeQuestion({ id: "q9" }) })).toEqual({ kind: "upsert", id: "q9" });
    expect(changeOf({ type: "updateRegion", questionId: "q1", regionIndex: 0, box })).toEqual({ kind: "upsert", id: "q1" });
    expect(changeOf({ type: "updateQuestion", questionId: "q1", patch: {} })).toEqual({ kind: "upsert", id: "q1" });
    expect(changeOf({ type: "deleteQuestion", questionId: "q1" })).toEqual({ kind: "delete", id: "q1" });
    expect(changeOf({ type: "addMask", pageIndex: 0, box })).toEqual({ kind: "source" });
    expect(changeOf({ type: "renameSource", title: "x" })).toEqual({ kind: "source" });
  });
});
```

- [ ] **Step 2: 寫選取 key 的失敗測試**

Create `src/components/MyExams/editorSelection.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  maskSelectionKey,
  parseSelectionKey,
  questionSelectionKey,
} from "./editorSelection";

describe("selection keys", () => {
  it("round-trips question and mask keys", () => {
    expect(parseSelectionKey(questionSelectionKey("abc123", 2))).toEqual({
      kind: "question",
      questionId: "abc123",
      regionIndex: 2,
    });
    expect(parseSelectionKey(maskSelectionKey(4))).toEqual({ kind: "mask", maskIndex: 4 });
  });

  it("rejects malformed keys", () => {
    expect(parseSelectionKey("q:abc")).toBeNull();
    expect(parseSelectionKey("q:abc:-1")).toBeNull();
    expect(parseSelectionKey("m:1.5")).toBeNull();
    expect(parseSelectionKey("x:1")).toBeNull();
  });
});
```

- [ ] **Step 3: 執行確認失敗**

Run: `npx vitest run src/components/MyExams/cropEditorState.test.ts src/components/MyExams/editorSelection.test.ts`
Expected: FAIL，找不到兩個模組。

- [ ] **Step 4: 實作 reducer**

Create `src/components/MyExams/cropEditorState.ts`:

```ts
import type {
  AnswerSpace,
  BankQuestion,
  BankSubject,
  Box,
  QuestionRegion,
  QuestionSource,
} from "../../types/questionBank";

export interface CropEditorState {
  source: QuestionSource;
  questions: BankQuestion[];
}

export type QuestionPatch = Partial<{
  subject: BankSubject;
  answer: string;
  answerSpace: AnswerSpace;
}>;

export type CropEditorAction =
  | { type: "createQuestion"; question: BankQuestion }
  | { type: "appendRegion"; questionId: string; region: QuestionRegion }
  | { type: "updateRegion"; questionId: string; regionIndex: number; box: Box }
  | { type: "removeRegion"; questionId: string; regionIndex: number }
  | { type: "updateQuestion"; questionId: string; patch: QuestionPatch }
  | { type: "deleteQuestion"; questionId: string }
  | { type: "addMask"; pageIndex: number; box: Box }
  | { type: "updateMask"; pageIndex: number; maskIndex: number; box: Box }
  | { type: "removeMask"; pageIndex: number; maskIndex: number }
  | { type: "renameSource"; title: string };

export type EditorChange =
  | { kind: "upsert"; id: string }
  | { kind: "delete"; id: string }
  | { kind: "source" };

type Regions = BankQuestion["regions"];

/** 陣列轉回「至少一個」的 tuple；呼叫端保證不為空。 */
function asRegions(list: QuestionRegion[]): Regions {
  const [first, ...rest] = list;
  return [first, ...rest];
}

function mapQuestion(
  state: CropEditorState,
  questionId: string,
  update: (question: BankQuestion) => BankQuestion,
): CropEditorState {
  return {
    ...state,
    questions: state.questions.map((question) =>
      question.id === questionId ? update(question) : question,
    ),
  };
}

function mapMasks(
  state: CropEditorState,
  pageIndex: number,
  update: (masks: Box[]) => Box[],
): CropEditorState {
  return {
    ...state,
    source: {
      ...state.source,
      pages: state.source.pages.map((page, index) =>
        index === pageIndex ? { ...page, masks: update(page.masks) } : page,
      ),
    },
  };
}

export function cropEditorReducer(
  state: CropEditorState,
  action: CropEditorAction,
): CropEditorState {
  switch (action.type) {
    case "createQuestion":
      return { ...state, questions: [...state.questions, action.question] };
    case "appendRegion":
      return mapQuestion(state, action.questionId, (question) => ({
        ...question,
        regions: [...question.regions, action.region],
      }));
    case "updateRegion":
      return mapQuestion(state, action.questionId, (question) => ({
        ...question,
        regions: asRegions(
          question.regions.map((region, index) =>
            index === action.regionIndex ? { ...region, box: action.box } : region,
          ),
        ),
      }));
    case "removeRegion":
      return mapQuestion(state, action.questionId, (question) =>
        question.regions.length <= 1
          ? question
          : {
              ...question,
              regions: asRegions(
                question.regions.filter((_, index) => index !== action.regionIndex),
              ),
            },
      );
    case "updateQuestion":
      return mapQuestion(state, action.questionId, (question) => {
        const next: BankQuestion = { ...question, ...action.patch };
        if (next.answer === "") delete next.answer;
        return next;
      });
    case "deleteQuestion":
      return {
        ...state,
        questions: state.questions.filter((question) => question.id !== action.questionId),
      };
    case "addMask":
      return mapMasks(state, action.pageIndex, (masks) => [...masks, action.box]);
    case "updateMask":
      return mapMasks(state, action.pageIndex, (masks) =>
        masks.map((mask, index) => (index === action.maskIndex ? action.box : mask)),
      );
    case "removeMask":
      return mapMasks(state, action.pageIndex, (masks) =>
        masks.filter((_, index) => index !== action.maskIndex),
      );
    case "renameSource":
      return { ...state, source: { ...state.source, title: action.title } };
  }
}

export function changeOf(action: CropEditorAction): EditorChange {
  switch (action.type) {
    case "createQuestion":
      return { kind: "upsert", id: action.question.id };
    case "appendRegion":
    case "updateRegion":
    case "removeRegion":
    case "updateQuestion":
      return { kind: "upsert", id: action.questionId };
    case "deleteQuestion":
      return { kind: "delete", id: action.questionId };
    case "addMask":
    case "updateMask":
    case "removeMask":
    case "renameSource":
      return { kind: "source" };
  }
}
```

- [ ] **Step 5: 實作選取 key**

Create `src/components/MyExams/editorSelection.ts`:

```ts
export type SelectionTarget =
  | { kind: "question"; questionId: string; regionIndex: number }
  | { kind: "mask"; maskIndex: number };

function toIndex(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

/** Firestore 自動產生的 id 不含冒號，可以安全地用冒號分隔。 */
export function questionSelectionKey(questionId: string, regionIndex: number): string {
  return `q:${questionId}:${regionIndex}`;
}

export function maskSelectionKey(maskIndex: number): string {
  return `m:${maskIndex}`;
}

export function parseSelectionKey(key: string): SelectionTarget | null {
  const parts = key.split(":");
  if (parts[0] === "q" && parts.length === 3 && parts[1]) {
    const regionIndex = toIndex(parts[2]);
    return regionIndex === null ? null : { kind: "question", questionId: parts[1], regionIndex };
  }
  if (parts[0] === "m" && parts.length === 2) {
    const maskIndex = toIndex(parts[1]);
    return maskIndex === null ? null : { kind: "mask", maskIndex };
  }
  return null;
}
```

- [ ] **Step 6: 執行確認通過**

Run: `npx vitest run src/components/MyExams/cropEditorState.test.ts src/components/MyExams/editorSelection.test.ts`
Expected: PASS。

- [ ] **Step 7: 型別檢查**

Run: `npx tsc -b`
Expected: 無錯誤（`appendRegion` 的 `[...question.regions, action.region]` 會被推論為非空 tuple）。

- [ ] **Step 8: Commit**

```bash
git add src/components/MyExams/cropEditorState.ts src/components/MyExams/cropEditorState.test.ts src/components/MyExams/editorSelection.ts src/components/MyExams/editorSelection.test.ts
git commit -m "feat(my-exams): add crop editor reducer and selection keys" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: `QuestionCrop` 元件

**Files:**
- Create: `src/components/MyExams/QuestionCrop.tsx`
- Test: `src/components/MyExams/QuestionCrop.test.tsx`

**Interfaces:**
- Consumes: Task 2 的 `regionImageStyle`、`regionAspectRatio`、`thumbnailMaxWidth`、`printRegionWidthPercent`
- Produces:
  - `type QuestionCropLayout = { kind: "fill" } | { kind: "thumbnail"; maxHeightPx: number } | { kind: "print"; scale: number }`
  - `QuestionCrop(props: { regions: readonly QuestionRegion[]; pages: readonly SourcePage[]; urls: Readonly<Record<string, string>>; loading: "lazy" | "eager"; layout: QuestionCropLayout; enhance?: boolean; onImageLoad?: (regionIndex: number) => void; onRetry?: (storagePath: string) => void })`

- [ ] **Step 1: 寫失敗測試**

Create `src/components/MyExams/QuestionCrop.test.tsx`:

```tsx
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makePage } from "../../testing/questionBankFixtures";
import { QuestionCrop } from "./QuestionCrop";

let container: HTMLDivElement;
let root: Root;

const page = makePage({
  storagePath: "p0.jpg",
  width: 1000,
  height: 2000,
  masks: [{ x: 0.3, y: 0.55, w: 0.1, h: 0.05 }],
});
const region = { pageIndex: 0, box: { x: 0.25, y: 0.5, w: 0.5, h: 0.25 } };
const urls = { "p0.jpg": "https://signed/p0" };

function render(ui: ReactElement): void {
  act(() => root.render(ui));
}

function image(): HTMLImageElement {
  const element = container.querySelector("img");
  if (!(element instanceof HTMLImageElement)) throw new Error("image not rendered");
  return element;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("QuestionCrop", () => {
  it("positions the full page image so only the box is visible", () => {
    render(<QuestionCrop regions={[region]} pages={[page]} urls={urls} loading="lazy" layout={{ kind: "fill" }} />);
    const img = image();
    expect(img.getAttribute("src")).toBe("https://signed/p0");
    expect(img.style.width).toBe("200%");
    expect(img.style.height).toBe("400%");
    expect(img.style.left).toBe("-50%");
    expect(img.style.top).toBe("-200%");
    // Tailwind preflight 的 max-width: 100% 會壓扁 200% 寬的圖
    expect(img.className).toContain("max-w-none");
  });

  it("draws masks as white SVG rects so they print without background graphics", () => {
    render(<QuestionCrop regions={[region]} pages={[page]} urls={urls} loading="lazy" layout={{ kind: "fill" }} />);
    const rect = container.querySelector("svg rect");
    expect(rect?.getAttribute("fill")).toBe("white");
    expect(rect?.getAttribute("x")).toBe("0.3");
    expect(rect?.getAttribute("width")).toBe("0.1");
  });

  it("passes the loading strategy through", () => {
    render(<QuestionCrop regions={[region]} pages={[page]} urls={urls} loading="eager" layout={{ kind: "fill" }} />);
    expect(image().getAttribute("loading")).toBe("eager");
  });

  it("sizes print regions as a percentage of the content column", () => {
    render(<QuestionCrop regions={[region]} pages={[page]} urls={urls} loading="eager" layout={{ kind: "print", scale: 1 }} />);
    const wrapper = container.querySelector<HTMLElement>('[data-testid="question-crop-region"]');
    expect(wrapper?.style.width).toBe("50%");
  });

  it("stacks multiple regions and reports each loaded image", () => {
    const onImageLoad = vi.fn();
    render(
      <QuestionCrop
        regions={[region, { pageIndex: 0, box: { x: 0, y: 0, w: 1, h: 0.1 } }]}
        pages={[page]}
        urls={urls}
        loading="eager"
        layout={{ kind: "fill" }}
        onImageLoad={onImageLoad}
      />,
    );
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);
    act(() => {
      images[1].dispatchEvent(new Event("load"));
    });
    expect(onImageLoad).toHaveBeenCalledWith(1);
  });

  it("shows a placeholder until the signed URL arrives", () => {
    render(<QuestionCrop regions={[region]} pages={[page]} urls={{}} loading="lazy" layout={{ kind: "fill" }} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("offers a retry after the image fails to load", () => {
    const onRetry = vi.fn();
    render(
      <QuestionCrop regions={[region]} pages={[page]} urls={urls} loading="lazy" layout={{ kind: "fill" }} onRetry={onRetry} />,
    );
    act(() => {
      image().dispatchEvent(new Event("error"));
    });
    expect(container.textContent).toContain("圖片載入失敗");

    const retry = [...container.querySelectorAll("button")].find((button) => button.textContent === "重試");
    act(() => retry?.click());
    expect(onRetry).toHaveBeenCalledWith("p0.jpg");
    expect(container.querySelector("img")).not.toBeNull();
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npx vitest run src/components/MyExams/QuestionCrop.test.tsx`
Expected: FAIL，找不到模組 `./QuestionCrop`。

- [ ] **Step 3: 實作**

Create `src/components/MyExams/QuestionCrop.tsx`:

```tsx
import { useState, type MouseEvent } from "react";
import type { QuestionRegion, SourcePage } from "../../types/questionBank";
import {
  printRegionWidthPercent,
  regionAspectRatio,
  regionImageStyle,
  thumbnailMaxWidth,
} from "./cropStyle";

export type QuestionCropLayout =
  | { kind: "fill" }
  | { kind: "thumbnail"; maxHeightPx: number }
  | { kind: "print"; scale: number };

interface QuestionCropProps {
  regions: readonly QuestionRegion[];
  pages: readonly SourcePage[];
  urls: Readonly<Record<string, string>>;
  /** 列表用 lazy；列印頁必須用 eager，否則畫面外的圖不會載入（spec §9）。 */
  loading: "lazy" | "eager";
  layout: QuestionCropLayout;
  enhance?: boolean;
  onImageLoad?: (regionIndex: number) => void;
  onRetry?: (storagePath: string) => void;
}

function regionWidth(
  layout: QuestionCropLayout,
  aspectRatio: number,
  region: QuestionRegion,
): string {
  switch (layout.kind) {
    case "fill":
      return "100%";
    case "thumbnail":
      return thumbnailMaxWidth(aspectRatio, layout.maxHeightPx);
    case "print":
      return `${printRegionWidthPercent(region.box, layout.scale)}%`;
  }
}

export function QuestionCrop({
  regions,
  pages,
  urls,
  loading,
  layout,
  enhance = false,
  onImageLoad,
  onRetry,
}: QuestionCropProps) {
  const [failedPaths, setFailedPaths] = useState<ReadonlySet<string>>(() => new Set());

  const markFailed = (path: string) =>
    setFailedPaths((previous) => new Set(previous).add(path));

  const retry = (event: MouseEvent<HTMLButtonElement>, path: string) => {
    // 卡片外層可能是 <Link>，不要讓重試變成換頁
    event.preventDefault();
    event.stopPropagation();
    setFailedPaths((previous) => {
      const next = new Set(previous);
      next.delete(path);
      return next;
    });
    onRetry?.(path);
  };

  return (
    <div className="flex w-full flex-col gap-1">
      {regions.map((region, regionIndex) => {
        const page = pages[region.pageIndex];
        if (!page) return null;
        const aspectRatio = regionAspectRatio(region.box, page);
        const imageStyle = regionImageStyle(region.box);
        const url = urls[page.storagePath];
        const failed = failedPaths.has(page.storagePath);

        return (
          <div
            key={regionIndex}
            data-testid="question-crop-region"
            className="relative overflow-hidden bg-white"
            style={{ aspectRatio, width: regionWidth(layout, aspectRatio, region) }}
          >
            {failed ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-base-200 text-xs text-base-content/70">
                <span>圖片載入失敗</span>
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={(event) => retry(event, page.storagePath)}
                >
                  重試
                </button>
              </div>
            ) : url ? (
              <>
                <img
                  src={url}
                  alt=""
                  loading={loading}
                  decoding="async"
                  draggable={false}
                  className={`absolute max-w-none select-none ${
                    enhance ? "grayscale contrast-130 brightness-105" : ""
                  }`}
                  style={imageStyle}
                  onLoad={() => onImageLoad?.(regionIndex)}
                  onError={() => markFailed(page.storagePath)}
                />
                <svg
                  className="pointer-events-none absolute [print-color-adjust:exact]"
                  style={imageStyle}
                  viewBox="0 0 1 1"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {page.masks.map((mask, maskIndex) => (
                    <rect
                      key={maskIndex}
                      x={mask.x}
                      y={mask.y}
                      width={mask.w}
                      height={mask.h}
                      fill="white"
                    />
                  ))}
                </svg>
              </>
            ) : (
              <div className="absolute inset-0 animate-pulse bg-base-200" />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 執行確認通過**

Run: `npx vitest run src/components/MyExams/QuestionCrop.test.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/components/MyExams/QuestionCrop.tsx src/components/MyExams/QuestionCrop.test.tsx
git commit -m "feat(my-exams): render question crops from page images" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: `CropCanvas` 元件

**Files:**
- Create: `src/components/MyExams/CropCanvas.tsx`
- Test: `src/components/MyExams/CropCanvas.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `boxFromPoints`、`isBoxTooSmall`、`moveBox`、`resizeBox`、`sameBox`、`toRelativePoint`、`Corner`、`Point`
- Produces:
  - `interface CanvasBox { key: string; box: Box; label?: string }`
  - `CropCanvas(props: { imageUrl: string | undefined; imageAlt: string; mode: "question" | "mask"; questionBoxes: readonly CanvasBox[]; maskBoxes: readonly CanvasBox[]; selectedKey: string | null; onSelect: (key: string | null) => void; onCreate: (box: Box) => void; onChange: (key: string, box: Box) => void })`
  - 行為：在空白處拖拉 → `onCreate`（太小忽略）；按住框拖曳 → 移動；拖選取框的四個角 → 改大小；完成時 `onChange`（沒變就不呼叫）。只有目前模式的框可以互動，另一種框只顯示。

- [ ] **Step 1: 寫失敗測試**

Create `src/components/MyExams/CropCanvas.test.tsx`:

```tsx
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CropCanvas } from "./CropCanvas";

let container: HTMLDivElement;
let root: Root;

type Props = ComponentProps<typeof CropCanvas>;

function renderCanvas(overrides: Partial<Props> = {}): Props {
  const props: Props = {
    imageUrl: "https://signed/p0",
    imageAlt: "第 1 頁",
    mode: "question",
    questionBoxes: [],
    maskBoxes: [],
    selectedKey: null,
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onChange: vi.fn(),
    ...overrides,
  };
  act(() => root.render(<CropCanvas {...props} />));
  const overlay = container.querySelector<HTMLElement>('[data-testid="crop-overlay"]');
  if (!overlay) throw new Error("overlay missing");
  overlay.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  return props;
}

function pointer(type: string, target: Element, clientX: number, clientY: number): void {
  const EventType = (window.PointerEvent ?? window.MouseEvent) as typeof MouseEvent;
  act(() => {
    target.dispatchEvent(new EventType(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0 }));
  });
}

function overlay(): HTMLElement {
  const element = container.querySelector<HTMLElement>('[data-testid="crop-overlay"]');
  if (!element) throw new Error("overlay missing");
  return element;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("CropCanvas", () => {
  it("creates a normalized box from a drag on empty space", () => {
    const props = renderCanvas();
    pointer("pointerdown", overlay(), 20, 10);
    pointer("pointermove", overlay(), 120, 60);
    pointer("pointerup", overlay(), 120, 60);

    expect(props.onSelect).toHaveBeenCalledWith(null);
    expect(props.onCreate).toHaveBeenCalledTimes(1);
    const [box] = (props.onCreate as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(box.x).toBeCloseTo(0.1);
    expect(box.y).toBeCloseTo(0.1);
    expect(box.w).toBeCloseTo(0.5);
    expect(box.h).toBeCloseTo(0.5);
  });

  it("ignores a tiny accidental drag", () => {
    const props = renderCanvas();
    pointer("pointerdown", overlay(), 20, 10);
    pointer("pointerup", overlay(), 21, 10);
    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it("selects and moves an existing box", () => {
    const props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, label: "1" }],
    });
    const boxElement = container.querySelector('[data-box-key="q:a:0"]');
    if (!boxElement) throw new Error("box missing");

    pointer("pointerdown", boxElement, 40, 20);
    pointer("pointermove", overlay(), 60, 30);
    pointer("pointerup", overlay(), 60, 30);

    expect(props.onSelect).toHaveBeenCalledWith("q:a:0");
    expect(props.onCreate).not.toHaveBeenCalled();
    const [key, box] = (props.onChange as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(key).toBe("q:a:0");
    expect(box.x).toBeCloseTo(0.2);
    expect(box.y).toBeCloseTo(0.2);
    expect(box.w).toBeCloseTo(0.2);
  });

  it("does not report a change for a click without movement", () => {
    const props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
    });
    const boxElement = container.querySelector('[data-box-key="q:a:0"]');
    if (!boxElement) throw new Error("box missing");
    pointer("pointerdown", boxElement, 40, 20);
    pointer("pointerup", overlay(), 40, 20);
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("resizes the selected box from a corner handle", () => {
    const props = renderCanvas({
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
      selectedKey: "q:a:0",
    });
    const handle = container.querySelector('[data-box-key="q:a:0"] [data-corner="se"]');
    if (!handle) throw new Error("handle missing");

    pointer("pointerdown", handle, 60, 30);
    pointer("pointermove", overlay(), 100, 80);
    pointer("pointerup", overlay(), 100, 80);

    const [key, box] = (props.onChange as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(key).toBe("q:a:0");
    expect(box.x).toBeCloseTo(0.1);
    expect(box.w).toBeCloseTo(0.4);
    expect(box.h).toBeCloseTo(0.7);
  });

  it("only lets the current mode's boxes be grabbed", () => {
    const props = renderCanvas({
      mode: "mask",
      questionBoxes: [{ key: "q:a:0", box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
    });
    expect(container.querySelector('[data-box-key="q:a:0"]')).toBeNull();
    pointer("pointerdown", overlay(), 40, 20);
    pointer("pointermove", overlay(), 80, 60);
    pointer("pointerup", overlay(), 80, 60);
    expect(props.onCreate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npx vitest run src/components/MyExams/CropCanvas.test.tsx`
Expected: FAIL，找不到模組 `./CropCanvas`。

- [ ] **Step 3: 實作**

Create `src/components/MyExams/CropCanvas.tsx`:

```tsx
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Box } from "../../types/questionBank";
import {
  boxFromPoints,
  isBoxTooSmall,
  moveBox,
  resizeBox,
  sameBox,
  toRelativePoint,
  type Corner,
  type Point,
} from "./boxGeometry";

export interface CanvasBox {
  key: string;
  box: Box;
  label?: string;
}

type Drag =
  | { type: "draw"; start: Point; current: Point }
  | { type: "move"; key: string; origin: Box; start: Point; current: Point }
  | { type: "resize"; key: string; corner: Corner; origin: Box; current: Point };

interface CropCanvasProps {
  imageUrl: string | undefined;
  imageAlt: string;
  mode: "question" | "mask";
  questionBoxes: readonly CanvasBox[];
  maskBoxes: readonly CanvasBox[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onCreate: (box: Box) => void;
  onChange: (key: string, box: Box) => void;
}

const CORNERS: readonly Corner[] = ["nw", "ne", "sw", "se"];

const CORNER_CLASS: Record<Corner, string> = {
  nw: "left-0 top-0 cursor-nwse-resize",
  ne: "left-full top-0 cursor-nesw-resize",
  sw: "left-0 top-full cursor-nesw-resize",
  se: "left-full top-full cursor-nwse-resize",
};

function dragResult(drag: Drag): Box {
  switch (drag.type) {
    case "draw":
      return boxFromPoints(drag.start, drag.current);
    case "move":
      return moveBox(drag.origin, drag.current.x - drag.start.x, drag.current.y - drag.start.y);
    case "resize":
      return resizeBox(drag.origin, drag.corner, drag.current);
  }
}

function boxStyle(box: Box) {
  return {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.w * 100}%`,
    height: `${box.h * 100}%`,
  };
}

function capturePointer(event: ReactPointerEvent<HTMLElement>): void {
  if (event.pointerId === undefined) return;
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // 不支援 pointer capture 的環境（如 jsdom）直接略過
  }
}

/**
 * 頁面大圖上的框。框用絕對定位的 HTML div（百分比位置、px 把手），
 * 不用非等比縮放的 SVG，線條與把手才不會變形（spec §8.2）。
 */
export function CropCanvas({
  imageUrl,
  imageAlt,
  mode,
  questionBoxes,
  maskBoxes,
  selectedKey,
  onSelect,
  onCreate,
  onChange,
}: CropCanvasProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const activeBoxes = mode === "question" ? questionBoxes : maskBoxes;
  const passiveBoxes = mode === "question" ? maskBoxes : questionBoxes;

  const pointFrom = (event: ReactPointerEvent): Point => {
    const rect = overlayRef.current?.getBoundingClientRect();
    return rect ? toRelativePoint(event.clientX, event.clientY, rect) : { x: 0, y: 0 };
  };

  const startDraw = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    capturePointer(event);
    onSelect(null);
    const point = pointFrom(event);
    setDrag({ type: "draw", start: point, current: point });
  };

  const startMove = (item: CanvasBox) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    capturePointer(event);
    onSelect(item.key);
    const point = pointFrom(event);
    setDrag({ type: "move", key: item.key, origin: item.box, start: point, current: point });
  };

  const startResize =
    (item: CanvasBox, corner: Corner) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      capturePointer(event);
      setDrag({ type: "resize", key: item.key, corner, origin: item.box, current: pointFrom(event) });
    };

  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    setDrag({ ...drag, current: pointFrom(event) });
  };

  const handleUp = () => {
    if (!drag) return;
    const box = dragResult(drag);
    setDrag(null);
    if (isBoxTooSmall(box)) return;
    if (drag.type === "draw") {
      onCreate(box);
    } else if (!sameBox(box, drag.origin)) {
      onChange(drag.key, box);
    }
  };

  const drawPreview = drag?.type === "draw" ? dragResult(drag) : null;

  return (
    <div className="relative select-none">
      {imageUrl ? (
        <img src={imageUrl} alt={imageAlt} draggable={false} className="block h-auto w-full" />
      ) : (
        <div className="aspect-[3/4] w-full animate-pulse bg-base-200" />
      )}
      <div
        ref={overlayRef}
        data-testid="crop-overlay"
        className={`absolute inset-0 touch-none ${mode === "question" ? "cursor-crosshair" : "cursor-cell"}`}
        onPointerDown={startDraw}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={() => setDrag(null)}
      >
        {passiveBoxes.map((item) => (
          <div
            key={item.key}
            className={`pointer-events-none absolute ${
              mode === "question"
                ? "border border-dashed border-warning bg-white/60"
                : "border border-primary/40"
            }`}
            style={boxStyle(item.box)}
          />
        ))}

        {activeBoxes.map((item) => {
          const selected = item.key === selectedKey;
          const box = drag && drag.type !== "draw" && drag.key === item.key ? dragResult(drag) : item.box;
          const look =
            mode === "question"
              ? selected
                ? "border-primary bg-primary/20"
                : "border-primary/70 bg-primary/10"
              : `border-dashed border-warning ${selected ? "bg-white/90" : "bg-white/70"}`;
          return (
            <div
              key={item.key}
              data-box-key={item.key}
              className={`absolute cursor-move border-2 ${look}`}
              style={boxStyle(box)}
              onPointerDown={startMove(item)}
            >
              {item.label && (
                <span className="pointer-events-none absolute left-0 top-0 rounded-br bg-primary px-1 text-xs font-semibold text-primary-content">
                  {item.label}
                </span>
              )}
              {selected &&
                CORNERS.map((corner) => (
                  <div
                    key={corner}
                    data-corner={corner}
                    className={`absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center ${CORNER_CLASS[corner]}`}
                    onPointerDown={startResize(item, corner)}
                  >
                    <span className="size-3 rounded-sm border-2 border-primary bg-white" />
                  </div>
                ))}
            </div>
          );
        })}

        {drawPreview && (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-primary"
            style={boxStyle(drawPreview)}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 執行確認通過**

Run: `npx vitest run src/components/MyExams/CropCanvas.test.tsx`
Expected: PASS。若 jsdom 版本的 `PointerEvent` 不接受 `clientX`，測試的 `pointer()` 會退回 `MouseEvent`，React 仍以事件名稱 `pointerdown` 分派。

- [ ] **Step 5: Commit**

```bash
git add src/components/MyExams/CropCanvas.tsx src/components/MyExams/CropCanvas.test.tsx
git commit -m "feat(my-exams): draw, move and resize crop boxes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: 上傳對話框

依賴 canvas、檔案選擇與 Supabase，沒有自動化測試（spec §14 未列），由 Task 16 手動驗證。

**Files:**
- Create: `src/components/MyExams/SourceUploadDialog.tsx`

**Interfaces:**
- Consumes: Task 1 常數與 `BANK_SUBJECTS`、`BANK_SUBJECT_LABELS`、`isBankSubject`；Task 3 的 `expandFilesToPages`、`renderPage`、`nextRotation`、`releasePdfFiles`、`UNREADABLE_FILE_MESSAGE`、`FileReadError`、`PageInput`；Task 6 的 `createSource`、`newQuestionSourceId`
- Produces: `SourceUploadDialog(props: { isOpen: boolean; onClose: () => void; onUploaded: (sourceId: string) => void })`

- [ ] **Step 1: 實作**

Create `src/components/MyExams/SourceUploadDialog.tsx`:

```tsx
import { useEffect, useId, useRef, useState } from "react";
import { RotateCw, Trash2, Upload } from "lucide-react";
import {
  ACCEPTED_UPLOAD_TYPES,
  MAX_SOURCE_PAGES,
  PAGE_LONG_EDGE_PX,
  THUMBNAIL_LONG_EDGE_PX,
} from "../../constants/questionBank";
import {
  BANK_SUBJECTS,
  BANK_SUBJECT_LABELS,
  isBankSubject,
  type BankSubject,
} from "../../types/questionBank";
import {
  expandFilesToPages,
  nextRotation,
  releasePdfFiles,
  renderPage,
  UNREADABLE_FILE_MESSAGE,
  type FileReadError,
  type PageInput,
} from "../../utils/pageImageProcessor";
import { createSource, newQuestionSourceId } from "../../services/questionSourceService";
import { logger } from "../../utils/logger";

interface PreviewPage {
  input: PageInput;
  thumbUrl: string | null;
  failed: boolean;
}

interface SourceUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: (sourceId: string) => void;
}

export function SourceUploadDialog({ isOpen, onClose, onUploaded }: SourceUploadDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<BankSubject | "">("");
  const [pages, setPages] = useState<PreviewPage[]>([]);
  const [fileErrors, setFileErrors] = useState<FileReadError[]>([]);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const filesRef = useRef<File[]>([]);
  const thumbUrlsRef = useRef<string[]>([]);

  const uploading = progress !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const reset = () => {
    thumbUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    thumbUrlsRef.current = [];
    void releasePdfFiles(filesRef.current);
    filesRef.current = [];
    setTitle("");
    setSubject("");
    setPages([]);
    setFileErrors([]);
    setLimitError(null);
    setProgress(null);
    setUploadError(null);
    setSourceId(null);
  };

  const handleClose = () => {
    if (uploading) return;
    reset();
    onClose();
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = [...fileList];
    setLimitError(null);
    const { pages: inputs, errors } = await expandFilesToPages(files);
    setFileErrors((previous) => [...previous, ...errors]);

    if (pages.length + inputs.length > MAX_SOURCE_PAGES) {
      setLimitError(`總頁數超過 ${MAX_SOURCE_PAGES} 頁，請拆開上傳`);
      void releasePdfFiles(files);
      return;
    }

    filesRef.current.push(...files);
    setPages((previous) => [
      ...previous,
      ...inputs.map((input) => ({ input, thumbUrl: null, failed: false })),
    ]);

    // 縮圖一張一張產生，避免一次解碼大量照片
    for (const input of inputs) {
      try {
        const { blob } = await renderPage(input, THUMBNAIL_LONG_EDGE_PX);
        const url = URL.createObjectURL(blob);
        thumbUrlsRef.current.push(url);
        setPages((previous) =>
          previous.map((page) => (page.input.key === input.key ? { ...page, thumbUrl: url } : page)),
        );
      } catch (error) {
        logger.warn("[SourceUploadDialog] thumbnail failed", error);
        setPages((previous) =>
          previous.map((page) => (page.input.key === input.key ? { ...page, failed: true } : page)),
        );
      }
    }
  };

  const rotate = (key: string) =>
    setPages((previous) =>
      previous.map((page) =>
        page.input.key === key
          ? { ...page, input: { ...page.input, rotation: nextRotation(page.input.rotation) } }
          : page,
      ),
    );

  const removePage = (key: string) =>
    setPages((previous) => previous.filter((page) => page.input.key !== key));

  const uploadable = pages.filter((page) => !page.failed && page.thumbUrl !== null);
  const thumbnailsPending = pages.some((page) => !page.failed && page.thumbUrl === null);
  const canUpload =
    !uploading && title.trim() !== "" && subject !== "" && uploadable.length > 0 && !thumbnailsPending;

  const handleUpload = async () => {
    if (!canUpload || subject === "") return;
    const id = sourceId ?? newQuestionSourceId();
    const inputs = uploadable.map((page) => page.input);
    setSourceId(id);
    setUploadError(null);
    setProgress({ done: 0, total: inputs.length });
    try {
      await createSource({
        sourceId: id,
        title: title.trim(),
        subject,
        pageCount: inputs.length,
        renderPage: (index) => renderPage(inputs[index], PAGE_LONG_EDGE_PX),
        onProgress: (done, total) => setProgress({ done, total }),
      });
      reset();
      onUploaded(id);
    } catch (error) {
      logger.error("[SourceUploadDialog] upload failed", error);
      setProgress(null);
      setUploadError("上傳失敗，請檢查網路後重試");
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
    >
      <div className="modal-box max-w-2xl">
        <h3 id={headingId} className="text-lg font-semibold">
          上傳題目
        </h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem]">
          <label className="flex flex-col gap-1 text-sm">
            標題
            <input
              className="input input-sm w-full"
              value={title}
              placeholder="例如：四上數學第二次月考"
              disabled={uploading}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            科目
            <select
              className="select select-sm w-full"
              value={subject}
              disabled={uploading}
              onChange={(event) =>
                setSubject(isBankSubject(event.target.value) ? event.target.value : "")
              }
            >
              <option value="">選擇科目</option>
              {BANK_SUBJECTS.map((item) => (
                <option key={item} value={item}>
                  {BANK_SUBJECT_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={`btn btn-outline btn-sm mt-4 ${uploading ? "btn-disabled" : ""}`}>
          <Upload className="size-4" />
          選擇照片或 PDF
          <input
            type="file"
            className="hidden"
            accept={ACCEPTED_UPLOAD_TYPES}
            multiple
            disabled={uploading}
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        <p className="mt-2 text-xs text-base-content/60">
          建議用手機內建的「掃描文件」拍，會自動拉正、去陰影。一次最多 {MAX_SOURCE_PAGES} 頁。
        </p>

        {limitError && (
          <p role="alert" className="mt-2 text-sm text-error">
            {limitError}
          </p>
        )}
        {fileErrors.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-error">
            {fileErrors.map((error, index) => (
              <li key={index}>
                {error.fileName}：{error.message}
              </li>
            ))}
          </ul>
        )}

        {pages.length > 0 && (
          <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {pages.map((page, index) => (
              <li key={page.input.key} className="flex flex-col gap-1">
                <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border border-base-300 bg-base-200">
                  {page.failed ? (
                    <span className="p-2 text-center text-xs text-error">{UNREADABLE_FILE_MESSAGE}</span>
                  ) : page.thumbUrl ? (
                    <img
                      src={page.thumbUrl}
                      alt={`第 ${index + 1} 頁`}
                      className="max-h-full max-w-full transition-transform"
                      style={{ transform: `rotate(${page.input.rotation}deg)` }}
                    />
                  ) : (
                    <span className="loading loading-spinner loading-sm" aria-label="產生縮圖中" />
                  )}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>第 {index + 1} 頁</span>
                  <span className="flex">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      aria-label={`旋轉第 ${index + 1} 頁`}
                      disabled={uploading || page.failed}
                      onClick={() => rotate(page.input.key)}
                    >
                      <RotateCw className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      aria-label={`刪除第 ${index + 1} 頁`}
                      disabled={uploading}
                      onClick={() => removePage(page.input.key)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {uploadError && (
          <p role="alert" className="mt-3 text-sm text-error">
            {uploadError}
          </p>
        )}

        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" disabled={uploading} onClick={handleClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!canUpload}
            onClick={() => void handleUpload()}
          >
            {progress ? `上傳中 ${progress.done}/${progress.total}` : uploadError ? "重試" : "上傳"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
```

- [ ] **Step 2: 型別與 lint**

Run: `npx tsc -b && npm run lint`
Expected: 無錯誤。

- [ ] **Step 3: Commit**

```bash
git add src/components/MyExams/SourceUploadDialog.tsx
git commit -m "feat(my-exams): add source upload dialog with previews" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: 題庫首頁（題庫、上傳紀錄）

**Files:**
- Create: `src/hooks/useQuestionBank.ts`
- Create: `src/components/MyExams/MyExamsPage.tsx`
- Create: `src/components/MyExams/QuestionBankGrid.tsx`
- Create: `src/components/MyExams/SourceList.tsx`
- Test: `src/components/MyExams/QuestionBankGrid.test.tsx`

**Interfaces:**
- Consumes: Task 5 `listBankQuestions`；Task 6 `listSources`、`deleteSource`；Task 7 `useSignedPageUrls`；Task 2 `orderBankQuestions`；Task 10 `QuestionCrop`；Task 12 `SourceUploadDialog`；既有 `useAuth`、`ConfirmModal`
- Produces:
  - `useQuestionBank(): { sources: QuestionSource[]; questions: BankQuestion[]; loading: boolean; error: string | null; reload: () => void }`
  - `MyExamsPage`（default export；`?tab=sources` 切到上傳紀錄）
  - `QuestionBankGrid(props: { sources: readonly QuestionSource[]; questions: readonly BankQuestion[]; onUpload: () => void })`
  - `SourceList(props: { sources: readonly QuestionSource[]; questions: readonly BankQuestion[]; onDeleted: () => void })`

- [ ] **Step 1: 寫題庫牆的失敗測試**

Create `src/components/MyExams/QuestionBankGrid.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../hooks/useSignedPageUrls", () => ({
  useSignedPageUrls: () => ({ urls: {}, failed: false, refresh: vi.fn() }),
}));

import { makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import { QuestionBankGrid } from "./QuestionBankGrid";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderGrid(questions = [
  makeQuestion({ id: "m1", subject: "math" }),
  makeQuestion({ id: "m2", subject: "math" }),
  makeQuestion({ id: "c1", subject: "chinese" }),
]) {
  act(() =>
    root.render(
      <MemoryRouter>
        <QuestionBankGrid sources={[makeSource()]} questions={questions} onUpload={vi.fn()} />
      </MemoryRouter>,
    ),
  );
}

function chip(label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find((item) =>
    item.textContent?.startsWith(label),
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`chip not found: ${label}`);
  return button;
}

describe("QuestionBankGrid", () => {
  it("shows subject counts and filters the cards", () => {
    renderGrid();
    expect(chip("全部").textContent).toBe("全部 3");
    expect(chip("數學").textContent).toBe("數學 2");
    expect(container.querySelectorAll("li")).toHaveLength(3);

    act(() => chip("國語").click());
    expect(container.querySelectorAll("li")).toHaveLength(1);
  });

  it("links each card to its question in the crop editor", () => {
    renderGrid([makeQuestion({ id: "m1" })]);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/my-exams/sources/source-1?q=m1");
  });

  it("shows an upload call to action when the bank is empty", () => {
    renderGrid([]);
    expect(container.textContent).toContain("題庫還是空的");
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npx vitest run src/components/MyExams/QuestionBankGrid.test.tsx`
Expected: FAIL，找不到模組 `./QuestionBankGrid`。

- [ ] **Step 3: 實作資料 hook**

Create `src/hooks/useQuestionBank.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listBankQuestions } from "../services/bankQuestionService";
import { listSources } from "../services/questionSourceService";
import type { BankQuestion, QuestionSource } from "../types/questionBank";
import { logger } from "../utils/logger";

interface QuestionBankState {
  sources: QuestionSource[];
  questions: BankQuestion[];
  loading: boolean;
  error: string | null;
}

export function useQuestionBank() {
  const { user } = useAuth();
  const [state, setState] = useState<QuestionBankState>({
    sources: [],
    questions: [],
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([listSources(), listBankQuestions()])
      .then(([sources, questions]) => {
        if (!cancelled) setState({ sources, questions, loading: false, error: null });
      })
      .catch((error: unknown) => {
        logger.error("[useQuestionBank] load failed", error);
        if (!cancelled) {
          setState((previous) => ({ ...previous, loading: false, error: "讀取題庫失敗" }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, version]);

  const reload = useCallback(() => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    setVersion((value) => value + 1);
  }, []);

  return { ...state, reload };
}
```

- [ ] **Step 4: 實作題庫牆**

Create `src/components/MyExams/QuestionBankGrid.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSignedPageUrls } from "../../hooks/useSignedPageUrls";
import {
  BANK_SUBJECTS,
  BANK_SUBJECT_LABELS,
  type BankQuestion,
  type BankSubject,
  type QuestionSource,
} from "../../types/questionBank";
import { orderBankQuestions } from "./questionOrdering";
import { QuestionCrop } from "./QuestionCrop";

interface QuestionBankGridProps {
  sources: readonly QuestionSource[];
  questions: readonly BankQuestion[];
  onUpload: () => void;
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`btn btn-sm rounded-full ${active ? "btn-primary" : "btn-ghost border border-base-300"}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function QuestionBankGrid({ sources, questions, onUpload }: QuestionBankGridProps) {
  const [filter, setFilter] = useState<BankSubject | "all">("all");
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const ordered = useMemo(
    () => orderBankQuestions(questions, sources).filter((question) => sourceById.has(question.sourceId)),
    [questions, sources, sourceById],
  );
  const visible = useMemo(
    () => (filter === "all" ? ordered : ordered.filter((question) => question.subject === filter)),
    [ordered, filter],
  );
  const paths = useMemo(
    () =>
      visible.flatMap((question) => {
        const source = sourceById.get(question.sourceId);
        return question.regions.flatMap((region) => {
          const page = source?.pages[region.pageIndex];
          return page ? [page.storagePath] : [];
        });
      }),
    [visible, sourceById],
  );
  const { urls, refresh } = useSignedPageUrls(paths);

  if (ordered.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-base-300 p-10 text-center">
        <p className="text-base-content/70">題庫還是空的。先上傳一份考卷或講義，把題目框出來。</p>
        <button type="button" className="btn btn-primary btn-sm mt-4" onClick={onUpload}>
          上傳題目
        </button>
      </div>
    );
  }

  const countOf = (subject: BankSubject) =>
    ordered.filter((question) => question.subject === subject).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} label={`全部 ${ordered.length}`} onClick={() => setFilter("all")} />
        {BANK_SUBJECTS.map((subject) => (
          <FilterChip
            key={subject}
            active={filter === subject}
            label={`${BANK_SUBJECT_LABELS[subject]} ${countOf(subject)}`}
            onClick={() => setFilter(subject)}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((question) => {
          const source = sourceById.get(question.sourceId);
          if (!source) return null;
          return (
            <li key={question.id}>
              <Link
                to={`/my-exams/sources/${source.id}?q=${question.id}`}
                className="card h-full border border-base-300 bg-base-100 p-2 shadow-sm transition-colors hover:border-primary"
              >
                <div className="flex justify-center">
                  <QuestionCrop
                    regions={question.regions}
                    pages={source.pages}
                    urls={urls}
                    loading="lazy"
                    layout={{ kind: "thumbnail", maxHeightPx: 160 }}
                    onRetry={(path) => void refresh(path)}
                  />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="badge badge-ghost badge-sm">{BANK_SUBJECT_LABELS[question.subject]}</span>
                  <span className="truncate text-base-content/60">{source.title}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: 執行確認通過**

Run: `npx vitest run src/components/MyExams/QuestionBankGrid.test.tsx`
Expected: PASS。

- [ ] **Step 6: 實作上傳紀錄**

Create `src/components/MyExams/SourceList.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { ConfirmModal } from "../common/ConfirmModal";
import { deleteSource } from "../../services/questionSourceService";
import {
  BANK_SUBJECT_LABELS,
  type BankQuestion,
  type QuestionSource,
} from "../../types/questionBank";
import { logger } from "../../utils/logger";

interface SourceListProps {
  sources: readonly QuestionSource[];
  questions: readonly BankQuestion[];
  onDeleted: () => void;
}

export function SourceList({ sources, questions, onDeleted }: SourceListProps) {
  const [target, setTarget] = useState<QuestionSource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countBySource = useMemo(() => {
    const counts = new Map<string, number>();
    for (const question of questions) {
      counts.set(question.sourceId, (counts.get(question.sourceId) ?? 0) + 1);
    }
    return counts;
  }, [questions]);

  const confirmDelete = async () => {
    if (!target) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSource(target);
      setTarget(null);
      onDeleted();
    } catch (deleteError) {
      logger.error("[SourceList] delete failed", deleteError);
      setError("刪除失敗，請再按一次刪除");
    } finally {
      setDeleting(false);
    }
  };

  if (sources.length === 0) {
    return <p className="py-10 text-center text-base-content/60">還沒有上傳紀錄。</p>;
  }

  return (
    <>
      <ul className="divide-y divide-base-300 rounded-lg border border-base-300 bg-base-100">
        {sources.map((source) => (
          <li key={source.id} className="flex items-center gap-3 p-3">
            <Link to={`/my-exams/sources/${source.id}`} className="min-w-0 flex-1">
              <p className="truncate font-medium">{source.title}</p>
              <p className="text-sm text-base-content/60">
                {BANK_SUBJECT_LABELS[source.subject]}・{source.pages.length} 頁・
                {countBySource.get(source.id) ?? 0} 題・{source.createdAt.toLocaleDateString("zh-TW")}
              </p>
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-error"
              aria-label={`刪除 ${source.title}`}
              onClick={() => {
                setError(null);
                setTarget(source);
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <ConfirmModal
        isOpen={target !== null}
        title="刪除這次上傳？"
        message={
          target
            ? `「${target.title}」的 ${countBySource.get(target.id) ?? 0} 題和所有頁面圖都會刪除，無法復原。`
            : ""
        }
        confirmText="刪除"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setTarget(null)}
        isLoading={deleting}
        errorMessage={error}
      />
    </>
  );
}
```

- [ ] **Step 7: 實作首頁**

Create `src/components/MyExams/MyExamsPage.tsx`:

```tsx
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Upload } from "lucide-react";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { QuestionBankGrid } from "./QuestionBankGrid";
import { SourceList } from "./SourceList";
import { SourceUploadDialog } from "./SourceUploadDialog";

type MyExamsTab = "bank" | "sources";

const TABS: readonly { id: MyExamsTab; label: string }[] = [
  { id: "bank", label: "題庫" },
  { id: "sources", label: "上傳紀錄" },
];

function toTab(value: string | null): MyExamsTab {
  return value === "sources" ? "sources" : "bank";
}

export default function MyExamsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = toTab(searchParams.get("tab"));
  const navigate = useNavigate();
  const [uploadOpen, setUploadOpen] = useState(false);
  const bank = useQuestionBank();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">自製考卷</h1>
          <p className="text-sm text-base-content/60">上傳照片或 PDF，框出題目，組成考卷印出來。</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setUploadOpen(true)}>
          <Upload className="size-4" />
          上傳題目
        </button>
      </header>

      <div role="tablist" className="tabs tabs-box w-fit">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`tab ${tab === item.id ? "tab-active" : ""}`}
            onClick={() => setSearchParams(item.id === "bank" ? {} : { tab: item.id })}
          >
            {item.label}
          </button>
        ))}
      </div>

      {bank.error && (
        <div role="alert" className="alert alert-error">
          <span>{bank.error}</span>
          <button type="button" className="btn btn-sm" onClick={bank.reload}>
            重試
          </button>
        </div>
      )}

      {bank.loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg" aria-label="載入題庫" />
        </div>
      ) : tab === "bank" ? (
        <QuestionBankGrid sources={bank.sources} questions={bank.questions} onUpload={() => setUploadOpen(true)} />
      ) : (
        <SourceList sources={bank.sources} questions={bank.questions} onDeleted={bank.reload} />
      )}

      <SourceUploadDialog
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(sourceId) => {
          setUploadOpen(false);
          navigate(`/my-exams/sources/${sourceId}`);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 8: 型別、lint、測試**

Run: `npx tsc -b && npm run lint && npx vitest run src/components/MyExams`
Expected: 全部通過。

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useQuestionBank.ts src/components/MyExams/MyExamsPage.tsx src/components/MyExams/QuestionBankGrid.tsx src/components/MyExams/QuestionBankGrid.test.tsx src/components/MyExams/SourceList.tsx
git commit -m "feat(my-exams): add question bank home with sources list" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: 裁題畫面

**Files:**
- Create: `src/components/MyExams/SourceCropEditor.tsx`
- Create: `src/components/MyExams/CropEditorWorkspace.tsx`
- Create: `src/components/MyExams/CropEditorToolbar.tsx`
- Create: `src/components/MyExams/PageThumbnailStrip.tsx`
- Create: `src/components/MyExams/QuestionCard.tsx`
- Test: `src/components/MyExams/CropEditorWorkspace.test.tsx`

**Interfaces:**
- Consumes: Task 2 `sortQuestionsInSource`、`regionsOnPage`、`questionsOnPage`、`isEditableTarget`；Task 5 `commitEditorChanges`、`newBankQuestionId`、`listQuestionsForSource`；Task 6 `getSource`；Task 7 `useSignedPageUrls`；Task 8 `useAutosave`、`AutosaveStatus`、`PendingChanges`；Task 9 reducer 與選取 key；Task 10 `QuestionCrop`；Task 11 `CropCanvas`、`CanvasBox`
- Produces:
  - `SourceCropEditor`（default export，路由 `/my-exams/sources/:id`）
  - `CropEditorWorkspace(props: { source: QuestionSource; initialQuestions: readonly BankQuestion[] })`

**行為（spec §8）：**
- 資料載入完成才掛載 `CropEditorWorkspace`（`useAutosave` 的 `persistedIds` 只讀第一次）。
- `?q=<id>`：切到該題第一個 region 的頁並選取。
- 框題目模式：畫框 → 新題（科目帶來源科目，`answerSpace: "none"`）；在「新增區塊」狀態時，畫的框加到那一題尾端（可以先換頁）。
- 遮蓋模式：畫框 → 加遮蓋。
- Delete／Backspace（焦點不在輸入欄時）：選取的是遮蓋 → 刪遮蓋；選取的是題目框 → 那題有多個區塊就刪該區塊，只有一個就刪整題。Esc：取消新增區塊並取消選取。
- 手機版：題目清單排在大圖下方（spec §8.1 的底部面板簡化為堆疊，裁題主要在電腦上做）。

- [ ] **Step 1: 寫失敗測試**

Create `src/components/MyExams/CropEditorWorkspace.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commitEditorChanges: vi.fn(),
  nextId: 0,
}));

vi.mock("../../services/bankQuestionService", () => ({
  commitEditorChanges: mocks.commitEditorChanges,
  newBankQuestionId: () => {
    mocks.nextId += 1;
    return `new-${mocks.nextId}`;
  },
}));
vi.mock("../../hooks/useSignedPageUrls", () => ({
  useSignedPageUrls: () => ({ urls: {}, failed: false, refresh: vi.fn() }),
}));

import { makePage, makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import { CropEditorWorkspace } from "./CropEditorWorkspace";

let container: HTMLDivElement;
let root: Root;

function renderWorkspace(entry = "/my-exams/sources/source-1") {
  const source = makeSource({ pages: [makePage(), makePage({ storagePath: "p1.jpg" })] });
  const questions = [
    makeQuestion({ id: "q1", answer: "(1)", regions: [{ pageIndex: 0, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } }] }),
    makeQuestion({ id: "q2", regions: [{ pageIndex: 1, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } }] }),
  ];
  act(() =>
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <CropEditorWorkspace source={source} initialQuestions={questions} />
      </MemoryRouter>,
    ),
  );
  const overlay = container.querySelector<HTMLElement>('[data-testid="crop-overlay"]');
  if (overlay) {
    overlay.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  }
}

function overlay(): HTMLElement {
  const element = container.querySelector<HTMLElement>('[data-testid="crop-overlay"]');
  if (!element) throw new Error("overlay missing");
  return element;
}

function pointer(type: string, target: Element, clientX: number, clientY: number): void {
  const EventType = (window.PointerEvent ?? window.MouseEvent) as typeof MouseEvent;
  act(() => {
    target.dispatchEvent(new EventType(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0 }));
  });
}

function draw(): void {
  pointer("pointerdown", overlay(), 20, 50);
  pointer("pointermove", overlay(), 120, 90);
  pointer("pointerup", overlay(), 120, 90);
}

function headings(): string[] {
  return [...container.querySelectorAll("article header span")].map((item) => item.textContent ?? "");
}

function pressKey(key: string, target: EventTarget = window): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  mocks.commitEditorChanges.mockReset().mockResolvedValue(undefined);
  mocks.nextId = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("CropEditorWorkspace", () => {
  it("creates a question from a drag and autosaves it", async () => {
    renderWorkspace();
    expect(headings()).toEqual(["第 1 題"]);

    draw();
    expect(headings()).toEqual(["第 1 題", "第 2 題"]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const [commit] = mocks.commitEditorChanges.mock.calls[0];
    expect(commit.upserts.map((question: { id: string }) => question.id)).toEqual(["new-1"]);
    expect(commit.upserts[0]).toMatchObject({ subject: "math", answerSpace: "none", sourceId: "source-1" });
  });

  it("opens the page of the question given by ?q=", () => {
    renderWorkspace("/my-exams/sources/source-1?q=q2");
    expect(container.textContent).toContain("這一頁的題目（1）");
    expect(container.querySelector('[data-box-key="q:q2:0"]')).not.toBeNull();
  });

  it("does not delete the selected question while typing in the answer field", () => {
    renderWorkspace("/my-exams/sources/source-1?q=q1");
    const answer = container.querySelector<HTMLInputElement>('input[placeholder^="例如"]');
    if (!answer) throw new Error("answer input missing");
    pressKey("Backspace", answer);
    expect(headings()).toEqual(["第 1 題"]);

    pressKey("Backspace");
    expect(headings()).toEqual([]);
  });

  it("draws masks in mask mode and saves the source", async () => {
    renderWorkspace();
    const maskButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "遮蓋");
    act(() => maskButton?.click());
    draw();
    expect(headings()).toEqual(["第 1 題"]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const [commit] = mocks.commitEditorChanges.mock.calls[0];
    expect(commit.source.pages[0].masks).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npx vitest run src/components/MyExams/CropEditorWorkspace.test.tsx`
Expected: FAIL，找不到模組 `./CropEditorWorkspace`。

- [ ] **Step 3: 實作工具列**

Create `src/components/MyExams/CropEditorToolbar.tsx`:

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { AutosaveStatus } from "../../hooks/autosaveQueue";

type EditorMode = "question" | "mask";

interface CropEditorToolbarProps {
  title: string;
  onRename: (title: string) => void;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  status: AutosaveStatus;
  onRetry: () => void;
  appendHint: string | null;
}

function SaveStatus({ status, onRetry }: { status: AutosaveStatus; onRetry: () => void }) {
  if (status === "error") {
    return (
      <button type="button" className="btn btn-ghost btn-xs text-error" onClick={onRetry}>
        儲存失敗・重試
      </button>
    );
  }
  const label = status === "saving" ? "儲存中…" : status === "saved" ? "已儲存" : "";
  return (
    <span className="text-xs text-base-content/60" aria-live="polite">
      {label}
    </span>
  );
}

export function CropEditorToolbar({
  title,
  onRename,
  mode,
  onModeChange,
  status,
  onRetry,
  appendHint,
}: CropEditorToolbarProps) {
  const [draft, setDraft] = useState(title);

  const commitTitle = () => {
    const next = draft.trim();
    if (next && next !== title) {
      onRename(next);
    } else {
      setDraft(title);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/my-exams" className="btn btn-ghost btn-sm" aria-label="返回自製考卷">
          <ArrowLeft className="size-4" />
        </Link>
        <input
          className="input input-sm min-w-0 flex-1 font-semibold"
          aria-label="來源標題"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <div className="join">
          <button
            type="button"
            aria-pressed={mode === "question"}
            className={`btn join-item btn-sm ${mode === "question" ? "btn-primary" : ""}`}
            onClick={() => onModeChange("question")}
          >
            框題目
          </button>
          <button
            type="button"
            aria-pressed={mode === "mask"}
            className={`btn join-item btn-sm ${mode === "mask" ? "btn-primary" : ""}`}
            onClick={() => onModeChange("mask")}
          >
            遮蓋
          </button>
        </div>
        <SaveStatus status={status} onRetry={onRetry} />
      </div>
      {appendHint && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{appendHint}</p>}
      <p className="text-xs text-base-content/60">
        {mode === "question"
          ? "在頁面上拖拉框出一題；點框可以移動，拉四個角調整大小。"
          : "遮蓋模式：框出要蓋掉的答案或紅筆，印出來會是白色。"}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: 實作頁面縮圖列**

Create `src/components/MyExams/PageThumbnailStrip.tsx`:

```tsx
import type { SourcePage } from "../../types/questionBank";

interface PageThumbnailStripProps {
  pages: readonly SourcePage[];
  urls: Readonly<Record<string, string>>;
  currentIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}

export function PageThumbnailStrip({
  pages,
  urls,
  currentIndex,
  onSelect,
  className = "",
}: PageThumbnailStripProps) {
  return (
    <nav aria-label="頁面" className={`max-h-[80vh] flex-col gap-2 overflow-y-auto ${className}`}>
      {pages.map((page, index) => {
        const url = urls[page.storagePath];
        const current = index === currentIndex;
        return (
          <button
            key={page.storagePath}
            type="button"
            aria-current={current ? "page" : undefined}
            className={`flex flex-col items-center gap-1 rounded-md border-2 p-0.5 ${
              current ? "border-primary" : "border-transparent hover:border-base-300"
            }`}
            onClick={() => onSelect(index)}
          >
            {url ? (
              <img src={url} alt={`第 ${index + 1} 頁`} loading="lazy" className="w-full rounded" />
            ) : (
              <div className="aspect-[3/4] w-full animate-pulse rounded bg-base-200" />
            )}
            <span className="text-xs">{index + 1}</span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 5: 實作題目卡片**

Create `src/components/MyExams/QuestionCard.tsx`:

```tsx
import { Trash2 } from "lucide-react";
import {
  ANSWER_SPACES,
  ANSWER_SPACE_LABELS,
  BANK_SUBJECTS,
  BANK_SUBJECT_LABELS,
  isAnswerSpace,
  isBankSubject,
  type BankQuestion,
  type SourcePage,
} from "../../types/questionBank";
import type { QuestionPatch } from "./cropEditorState";
import { QuestionCrop } from "./QuestionCrop";

interface QuestionCardProps {
  question: BankQuestion;
  number: number;
  isContinuation: boolean;
  pages: readonly SourcePage[];
  urls: Readonly<Record<string, string>>;
  selected: boolean;
  appending: boolean;
  onSelect: () => void;
  onUpdate: (patch: QuestionPatch) => void;
  onToggleAppend: () => void;
  onRemoveRegion: (regionIndex: number) => void;
  onDelete: () => void;
  onRetryImage: (storagePath: string) => void;
}

export function QuestionCard({
  question,
  number,
  isContinuation,
  pages,
  urls,
  selected,
  appending,
  onSelect,
  onUpdate,
  onToggleAppend,
  onRemoveRegion,
  onDelete,
  onRetryImage,
}: QuestionCardProps) {
  return (
    <article
      className={`card border bg-base-100 p-3 shadow-sm ${selected ? "border-primary" : "border-base-300"}`}
      onClick={onSelect}
    >
      <header className="flex items-center justify-between text-sm font-semibold">
        <span>
          第 {number} 題{isContinuation ? "（續）" : ""}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-xs text-error"
          aria-label={`刪除第 ${number} 題`}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="size-3.5" />
        </button>
      </header>

      <div className="mt-2 flex justify-center">
        <QuestionCrop
          regions={question.regions}
          pages={pages}
          urls={urls}
          loading="lazy"
          layout={{ kind: "thumbnail", maxHeightPx: 200 }}
          onRetry={onRetryImage}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2" onClick={(event) => event.stopPropagation()}>
        <label className="flex flex-col gap-1 text-xs">
          科目
          <select
            className="select select-xs w-full"
            value={question.subject}
            onChange={(event) => {
              if (isBankSubject(event.target.value)) onUpdate({ subject: event.target.value });
            }}
          >
            {BANK_SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {BANK_SUBJECT_LABELS[subject]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          作答留白
          <select
            className="select select-xs w-full"
            value={question.answerSpace}
            onChange={(event) => {
              if (isAnswerSpace(event.target.value)) onUpdate({ answerSpace: event.target.value });
            }}
          >
            {ANSWER_SPACES.map((space) => (
              <option key={space} value={space}>
                {ANSWER_SPACE_LABELS[space]}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-xs">
          答案（選填）
          <input
            className="input input-xs w-full"
            value={question.answer ?? ""}
            placeholder="例如：(3)、12 公分"
            onChange={(event) => onUpdate({ answer: event.target.value })}
          />
        </label>
      </div>

      {question.regions.length > 1 && (
        <ul className="mt-2 space-y-1 text-xs">
          {question.regions.map((region, regionIndex) => (
            <li key={regionIndex} className="flex items-center justify-between">
              <span>
                區塊 {regionIndex + 1}（第 {region.pageIndex + 1} 頁）
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveRegion(regionIndex);
                }}
              >
                移除
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className={`btn btn-xs mt-2 ${appending ? "btn-primary" : "btn-outline"}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleAppend();
        }}
      >
        {appending ? "取消新增區塊" : "新增區塊"}
      </button>
    </article>
  );
}
```

- [ ] **Step 6: 實作裁題畫面本體**

Create `src/components/MyExams/CropEditorWorkspace.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { BankQuestion, Box, QuestionSource } from "../../types/questionBank";
import { commitEditorChanges, newBankQuestionId } from "../../services/bankQuestionService";
import { useAutosave } from "../../hooks/useAutosave";
import type { PendingChanges } from "../../hooks/autosaveQueue";
import { useSignedPageUrls } from "../../hooks/useSignedPageUrls";
import { changeOf, cropEditorReducer, type CropEditorAction } from "./cropEditorState";
import { maskSelectionKey, parseSelectionKey, questionSelectionKey } from "./editorSelection";
import { isEditableTarget } from "./editorKeyboard";
import { questionsOnPage, regionsOnPage, sortQuestionsInSource } from "./questionOrdering";
import { CropCanvas, type CanvasBox } from "./CropCanvas";
import { CropEditorToolbar } from "./CropEditorToolbar";
import { PageThumbnailStrip } from "./PageThumbnailStrip";
import { QuestionCard } from "./QuestionCard";

type EditorMode = "question" | "mask";

interface CropEditorWorkspaceProps {
  source: QuestionSource;
  initialQuestions: readonly BankQuestion[];
}

export function CropEditorWorkspace({ source, initialQuestions }: CropEditorWorkspaceProps) {
  const [searchParams] = useSearchParams();
  const [state, dispatch] = useReducer(cropEditorReducer, {
    source,
    questions: [...initialQuestions],
  });
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [initialQuestion] = useState(() =>
    initialQuestions.find((question) => question.id === searchParams.get("q")),
  );
  const [pageIndex, setPageIndex] = useState(() => initialQuestion?.regions[0].pageIndex ?? 0);
  const [selectedKey, setSelectedKey] = useState<string | null>(() =>
    initialQuestion ? questionSelectionKey(initialQuestion.id, 0) : null,
  );
  const [mode, setMode] = useState<EditorMode>("question");
  const [appendTargetId, setAppendTargetId] = useState<string | null>(null);

  const commit = useCallback(async ({ upsertIds, deleteIds, sourceDirty }: PendingChanges) => {
    const current = stateRef.current;
    const byId = new Map(current.questions.map((question) => [question.id, question]));
    await commitEditorChanges({
      upserts: upsertIds
        .map((id) => byId.get(id))
        .filter((question): question is BankQuestion => question !== undefined),
      deleteIds,
      source: sourceDirty
        ? { id: current.source.id, title: current.source.title, pages: current.source.pages }
        : null,
    });
  }, []);

  const [persistedIds] = useState(() => initialQuestions.map((question) => question.id));
  const autosave = useAutosave({ commit, persistedIds });

  const apply = (action: CropEditorAction) => {
    dispatch(action);
    const change = changeOf(action);
    if (change.kind === "upsert") autosave.markUpsert(change.id);
    else if (change.kind === "delete") autosave.markDelete(change.id);
    else autosave.markSourceDirty();
  };

  const sorted = useMemo(() => sortQuestionsInSource(state.questions), [state.questions]);
  const pages = state.source.pages;
  const page = pages[pageIndex];
  const { urls, refresh } = useSignedPageUrls(pages.map((item) => item.storagePath));

  const questionBoxes: CanvasBox[] = regionsOnPage(sorted, pageIndex).map((entry) => ({
    key: questionSelectionKey(entry.question.id, entry.regionIndex),
    box: entry.box,
    label: entry.isContinuation ? `${entry.number}（續）` : String(entry.number),
  }));
  const maskBoxes: CanvasBox[] = page.masks.map((box, index) => ({ key: maskSelectionKey(index), box }));
  const cards = questionsOnPage(sorted, pageIndex);
  const selected = selectedKey ? parseSelectionKey(selectedKey) : null;
  const selectedQuestionId = selected?.kind === "question" ? selected.questionId : null;

  const handleCreate = (box: Box) => {
    if (mode === "mask") {
      apply({ type: "addMask", pageIndex, box });
      setSelectedKey(maskSelectionKey(page.masks.length));
      return;
    }
    if (appendTargetId) {
      const target = state.questions.find((question) => question.id === appendTargetId);
      if (target) {
        apply({ type: "appendRegion", questionId: target.id, region: { pageIndex, box } });
        setSelectedKey(questionSelectionKey(target.id, target.regions.length));
      }
      setAppendTargetId(null);
      return;
    }
    const now = new Date();
    const question: BankQuestion = {
      id: newBankQuestionId(),
      userId: state.source.userId,
      sourceId: state.source.id,
      subject: state.source.subject,
      regions: [{ pageIndex, box }],
      answerSpace: "none",
      createdAt: now,
      updatedAt: now,
    };
    apply({ type: "createQuestion", question });
    setSelectedKey(questionSelectionKey(question.id, 0));
  };

  const handleChange = (key: string, box: Box) => {
    const target = parseSelectionKey(key);
    if (target?.kind === "question") {
      apply({ type: "updateRegion", questionId: target.questionId, regionIndex: target.regionIndex, box });
    } else if (target?.kind === "mask") {
      apply({ type: "updateMask", pageIndex, maskIndex: target.maskIndex, box });
    }
  };

  const deleteSelection = () => {
    if (!selected) return;
    if (selected.kind === "mask") {
      apply({ type: "removeMask", pageIndex, maskIndex: selected.maskIndex });
    } else {
      const question = state.questions.find((item) => item.id === selected.questionId);
      if (!question) return;
      if (question.regions.length > 1) {
        apply({ type: "removeRegion", questionId: question.id, regionIndex: selected.regionIndex });
      } else {
        apply({ type: "deleteQuestion", questionId: question.id });
      }
    }
    setSelectedKey(null);
  };

  // 鍵盤處理用「最新函式」ref：只訂閱一次 keydown，卻總是看到最新狀態。
  const keyHandlerRef = useRef<(event: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandlerRef.current = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!selected) return;
        event.preventDefault();
        deleteSelection();
      } else if (event.key === "Escape") {
        setAppendTargetId(null);
        setSelectedKey(null);
      }
    };
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandlerRef.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const goToPage = (index: number) => {
    setPageIndex(index);
    setSelectedKey(null);
  };

  const switchMode = (next: EditorMode) => {
    setMode(next);
    setSelectedKey(null);
    setAppendTargetId(null);
  };

  return (
    <div className="space-y-3">
      <CropEditorToolbar
        title={state.source.title}
        onRename={(title) => apply({ type: "renameSource", title })}
        mode={mode}
        onModeChange={switchMode}
        status={autosave.status}
        onRetry={() => void autosave.flush()}
        appendHint={
          appendTargetId ? "新增區塊：在頁面上框出這一題的下一段（可以先切到別頁），按 Esc 取消。" : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[8rem_minmax(0,1fr)_20rem]">
        <PageThumbnailStrip
          pages={pages}
          urls={urls}
          currentIndex={pageIndex}
          onSelect={goToPage}
          className="hidden lg:flex"
        />

        <div className="min-w-0 space-y-2">
          <div className="flex items-center justify-between lg:hidden">
            <button type="button" className="btn btn-sm" disabled={pageIndex === 0} onClick={() => goToPage(pageIndex - 1)}>
              上一頁
            </button>
            <span className="text-sm">
              第 {pageIndex + 1} / {pages.length} 頁
            </span>
            <button
              type="button"
              className="btn btn-sm"
              disabled={pageIndex >= pages.length - 1}
              onClick={() => goToPage(pageIndex + 1)}
            >
              下一頁
            </button>
          </div>
          <CropCanvas
            imageUrl={urls[page.storagePath]}
            imageAlt={`第 ${pageIndex + 1} 頁`}
            mode={mode}
            questionBoxes={questionBoxes}
            maskBoxes={maskBoxes}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            onCreate={handleCreate}
            onChange={handleChange}
          />
        </div>

        <aside className="space-y-3">
          <h2 className="text-sm font-semibold text-base-content/70">這一頁的題目（{cards.length}）</h2>
          {cards.length === 0 && <p className="text-sm text-base-content/60">在頁面上拖拉，框出一題。</p>}
          {cards.map(({ question, number, isContinuation }) => (
            <QuestionCard
              key={question.id}
              question={question}
              number={number}
              isContinuation={isContinuation}
              pages={pages}
              urls={urls}
              selected={selectedQuestionId === question.id}
              appending={appendTargetId === question.id}
              onSelect={() =>
                setSelectedKey(
                  questionSelectionKey(
                    question.id,
                    Math.max(0, question.regions.findIndex((region) => region.pageIndex === pageIndex)),
                  ),
                )
              }
              onUpdate={(patch) => apply({ type: "updateQuestion", questionId: question.id, patch })}
              onToggleAppend={() => {
                setMode("question");
                setAppendTargetId(appendTargetId === question.id ? null : question.id);
              }}
              onRemoveRegion={(regionIndex) =>
                apply({ type: "removeRegion", questionId: question.id, regionIndex })
              }
              onDelete={() => {
                apply({ type: "deleteQuestion", questionId: question.id });
                setSelectedKey(null);
                if (appendTargetId === question.id) setAppendTargetId(null);
              }}
              onRetryImage={(path) => void refresh(path)}
            />
          ))}
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: 實作資料載入外殼**

Create `src/components/MyExams/SourceCropEditor.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSource } from "../../services/questionSourceService";
import { listQuestionsForSource } from "../../services/bankQuestionService";
import type { BankQuestion, QuestionSource } from "../../types/questionBank";
import { logger } from "../../utils/logger";
import { CropEditorWorkspace } from "./CropEditorWorkspace";

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; source: QuestionSource; questions: BankQuestion[] };

export default function SourceCropEditor() {
  const { id = "" } = useParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSource(id), listQuestionsForSource(id)])
      .then(([source, questions]) => {
        if (cancelled) return;
        setState(source ? { status: "ready", source, questions } : { status: "missing" });
      })
      .catch((error: unknown) => {
        logger.error("[SourceCropEditor] load failed", error);
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  if (state.status === "loading") {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg" aria-label="載入中" />
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <div className="py-16 text-center">
        <p className="text-base-content/70">找不到這份資料。</p>
        <Link to="/my-exams" className="btn btn-sm mt-4">
          返回自製考卷
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="py-16 text-center">
        <p className="text-error">載入失敗。</p>
        <button
          type="button"
          className="btn btn-sm mt-4"
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((value) => value + 1);
          }}
        >
          重試
        </button>
      </div>
    );
  }

  return (
    <CropEditorWorkspace
      key={state.source.id}
      source={state.source}
      initialQuestions={state.questions}
    />
  );
}
```

- [ ] **Step 8: 執行確認通過**

Run: `npx vitest run src/components/MyExams/CropEditorWorkspace.test.tsx`
Expected: PASS。

- [ ] **Step 9: 型別、lint、全部測試**

Run: `npx tsc -b && npm run lint && npm run test`
Expected: 全部通過。若 `react-hooks` 對 `keyHandlerRef.current = ...`（在 effect 內賦值）有意見，保持在 effect 內，不要移到 render 本體。

- [ ] **Step 10: Commit**

```bash
git add src/components/MyExams/SourceCropEditor.tsx src/components/MyExams/CropEditorWorkspace.tsx src/components/MyExams/CropEditorWorkspace.test.tsx src/components/MyExams/CropEditorToolbar.tsx src/components/MyExams/PageThumbnailStrip.tsx src/components/MyExams/QuestionCard.tsx
git commit -m "feat(my-exams): add crop editor with masks and autosave" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: 註冊分頁與標題前綴比對

**Files:**
- Create: `src/utils/navLabel.ts`
- Test: `src/utils/navLabel.test.ts`
- Modify: `src/App.tsx`（lucide import、lazy imports、`navItems`、`currentLabel`、兩處 `isActive`、`<Routes>`）

**Interfaces:**
- Consumes: Task 13 `MyExamsPage`（default）、Task 14 `SourceCropEditor`（default）
- Produces:
  - `isNavItemActive(to: string, pathname: string): boolean`
  - `findNavLabel(items: readonly { to: string; label: string }[], pathname: string): string | undefined`

- [ ] **Step 1: 寫失敗測試**

Create `src/utils/navLabel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findNavLabel, isNavItemActive } from "./navLabel";

const items = [
  { to: "/exams", label: "考卷練習" },
  { to: "/my-exams", label: "自製考卷" },
  { to: "/games", label: "小遊戲" },
];

describe("isNavItemActive", () => {
  it("matches the item and its sub-pages only", () => {
    expect(isNavItemActive("/my-exams", "/my-exams")).toBe(true);
    expect(isNavItemActive("/my-exams", "/my-exams/sources/abc")).toBe(true);
    expect(isNavItemActive("/exams", "/my-exams")).toBe(false);
    expect(isNavItemActive("/my-exams", "/my-exams-old")).toBe(false);
  });
});

describe("findNavLabel", () => {
  it("labels sub-pages with their section", () => {
    expect(findNavLabel(items, "/my-exams/sources/abc")).toBe("自製考卷");
    expect(findNavLabel(items, "/games/spirit")).toBe("小遊戲");
    expect(findNavLabel(items, "/settings")).toBeUndefined();
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npx vitest run src/utils/navLabel.test.ts`
Expected: FAIL，找不到模組 `./navLabel`。

- [ ] **Step 3: 實作**

Create `src/utils/navLabel.ts`:

```ts
/** 分頁與它的子頁面都算「在這個分頁」（/my-exams/sources/:id 也顯示「自製考卷」）。 */
export function isNavItemActive(to: string, pathname: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function findNavLabel(
  items: readonly { to: string; label: string }[],
  pathname: string,
): string | undefined {
  return items.find((item) => isNavItemActive(item.to, pathname))?.label;
}
```

- [ ] **Step 4: 執行確認通過**

Run: `npx vitest run src/utils/navLabel.test.ts`
Expected: PASS。

- [ ] **Step 5: 修改 `src/App.tsx`**

1. lucide-react 的 import 清單（約第 11–28 行）在 `ClipboardCheck,` 下一行加上 `Printer,`。
2. 在 `import { lazyWithReload } from "./utils/lazyWithReload";` 下一行加：

```ts
import { findNavLabel, isNavItemActive } from "./utils/navLabel";
```

3. 在 `const ExamPracticePage = lazyWithReload(...)` 之後加：

```ts
const MyExamsPage = lazyWithReload(
  () => import("./components/MyExams/MyExamsPage"),
);
const SourceCropEditor = lazyWithReload(
  () => import("./components/MyExams/SourceCropEditor"),
);
```

4. `navItems` 裡 `{ to: "/exams", label: "考卷練習", icon: ClipboardCheck },` 下一行加：

```ts
    { to: "/my-exams", label: "自製考卷", icon: Printer },
```

5. 把

```ts
  const currentLabel =
    navItems.find((item) => item.to === location.pathname)?.label ??
    (location.pathname === "/settings" ? "設定" : "Ollie Reader");
```

換成

```ts
  const currentLabel =
    findNavLabel(navItems, location.pathname) ??
    (location.pathname === "/settings" ? "設定" : "Ollie Reader");
```

6. 兩處 `const isActive = location.pathname === item.to;`（桌機側欄約第 489 行、手機抽屜約第 667 行）都換成：

```ts
            const isActive = isNavItemActive(item.to, location.pathname);
```

（手機抽屜那處的縮排比較深，保留原本的縮排。）

7. `<Routes>` 裡 `<Route path="/exams" element={<ExamPracticePage />} />` 下一行加：

```tsx
                      <Route path="/my-exams" element={<MyExamsPage />} />
                      <Route
                        path="/my-exams/sources/:id"
                        element={<SourceCropEditor />}
                      />
```

- [ ] **Step 6: 型別、lint、全部測試、build**

Run: `npx tsc -b && npm run lint && npm run test && npm run build`
Expected: 全部通過。

- [ ] **Step 7: Commit**

```bash
git add src/utils/navLabel.ts src/utils/navLabel.test.ts src/App.tsx
git commit -m "feat(my-exams): register the my-exams tab and routes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: M1 驗收

**前置：** 先向使用者確認 spec §15 的 console 設定（Supabase RLS 的 `'question-bank'`、Firestore 規則、`questionSources` 複合索引）已完成；沒完成就停下來請使用者設定，不要自行繞過。

- [ ] **Step 1: 全部自動檢查**

Run: `npm run lint && npm run test && npm run build`
Expected: 全部通過。把輸出摘要記下來。

- [ ] **Step 2: 啟動 dev server**

若 `.claude/launch.json` 沒有 `npm run dev`（port 5173）的設定就新增一筆，再用 preview 工具啟動並打開 `/my-exams`（需要使用者已在該瀏覽器登入 Google）。

- [ ] **Step 3: 瀏覽器實測清單（逐項記錄結果）**

- [ ] 側欄出現「自製考卷」，點進去標題列顯示「自製考卷」；進入裁題畫面後標題與側欄高亮仍是「自製考卷」。
- [ ] 上傳 2 張手機照片（含一張橫拍、一張 EXIF 旋轉過的）＋ 1 份多頁 PDF：縮圖方向正確，可旋轉、可刪頁，進度顯示「上傳中 n/N」，完成後進入裁題畫面。
- [ ] 選一個 `.txt` 檔：顯示「無法讀取，請轉成 JPG 或 PDF」，其他檔案照常處理。
- [ ] 裁題：拖拉新增題目、移動、拉四角改大小；「新增區塊」後切到下一頁框第二段，卡片顯示「區塊 2（第 2 頁）」，第 2 頁的框標「N（續）」。
- [ ] 遮蓋模式畫框蓋住答案，題目卡片預覽裡該處變白。
- [ ] 在答案欄按 Backspace 只刪字；點框後按 Delete 會刪除。
- [ ] 狀態顯示「儲存中…」→「已儲存」；重新整理頁面後題目、遮蓋、標題、答案都還在。
- [ ] 回首頁「題庫」看到裁好的縮圖、科目篩選的數字正確；點卡片回到該題並選取。
- [ ] 「上傳紀錄」刪除一份來源：題目消失，Supabase Storage 的頁面圖也被刪除。
- [ ] 手機寬度（resize 到 375px）：可以上傳、畫框、移動（能用即可）。
- [ ] 若有 iPhone：從相簿選 HEIC 照片，確認能正常產生縮圖（代表收到的是 JPEG）；一次選 30 頁上傳不會當掉。無法實測就在回報中註明「未實測」。

- [ ] **Step 4: 回報**

整理：自動檢查結果、實測清單每項的結果（通過／失敗／未實測）、發現的問題。有失敗項目就用 superpowers:systematic-debugging 處理，不要直接宣告完成。
