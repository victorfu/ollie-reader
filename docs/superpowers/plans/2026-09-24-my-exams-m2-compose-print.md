# 自製考卷 M2：組卷與列印 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 M1 的題庫上加上組卷與列印：依科目與題數隨機抽題、手動替換／移除／加題／調整順序，存成考卷，並印出 A4 試卷（可附答案頁）。

**Architecture:** 抽題與清單操作全是純函式（`pickRandomQuestions`、`sheetComposition`），元件只負責呼叫。考卷存在 Firestore `examSheets`，只存有序的題目 id。列印頁是 `App.tsx` 登入檢查之後的獨立全螢幕分支，由與主題無關的 `PrintPaper`（固定白底黑字）排版，所有圖片 eager 載入，全部載完才能按「列印」。

**Tech Stack:** React 19、React Router 7、TypeScript strict、Tailwind CSS v4 + DaisyUI 5、Firebase Firestore、Vitest + jsdom、lucide-react。

**Spec:** `docs/superpowers/specs/2026-09-24-my-exams-question-bank-design.md`（本計畫實作 §16 的 **M2**；前提是 `docs/superpowers/plans/2026-09-24-my-exams-m1-question-bank.md` 已完成）

## Global Constraints

- 沿用 M1 計畫的 Global Constraints（strict TS、`erasableSyntaxOnly`、測試碼也要過 `tsc -b`、`react-hooks` 7 規則、StrictMode、無 @testing-library、`logger`、繁體中文、Conventional Commits＋`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`）。
- 組卷時科目順序固定為 `BANK_SUBJECTS`（國語 → 數學 → 英文 → 自然 → 社會），同科內順序隨機。
- 勾選科目時的預設題數：`min(10, 該科題數)`；題數範圍 1 到該科題數；題庫沒有題目的科目不能勾。
- 標題留空時，儲存用 `自製考卷 YYYY/MM/DD`（當天日期，在事件處理函式裡產生，不在 render 期間呼叫 `new Date()`）。
- 列印：`@page { size: A4; margin: 12mm; }`；紙張容器 `w-[186mm] max-w-full`、**固定 `bg-white text-black`，不用主題 token**；每題 `break-inside-avoid`；答案頁 `break-before-page`、3 欄；作答留白 無 0／小 2cm／中 4cm／大 7cm；題目大小 小 0.85／標準 1／大 1.15。
- 列印頁的 `QuestionCrop` 一律 `loading="eager"`；圖片全部載入前「列印」按鈕停用並顯示「圖片載入中 n/m」。
- 列印設定存在 localStorage key `"ollie-my-exams-print-preferences"`，讀寫都包 try/catch；預設 `{ enhance: false, scale: "normal", includeAnswers: true }`。
- 考卷引用的題目若已刪除：列印時略過（題號連續）並提示「有 N 題已從題庫刪除，列印時會略過」；編輯時自動移除並提示「有 N 題已從題庫刪除，已自動移除」。

## 手動前置作業

Task 9 瀏覽器實測前，`examSheets` 的 Firestore 規則與複合索引（`userId ASC, createdAt DESC`）必須已在 console 設定（spec §15）。執行 Task 9 前先向使用者確認。

## 檔案結構

| 檔案 | 任務 | 職責 |
|------|------|------|
| `src/testing/seededRng.ts` | 1 | 測試用可重現亂數 |
| `src/components/MyExams/pickRandomQuestions.ts` | 1 | 不放回隨機抽題 |
| `src/components/MyExams/sheetComposition.ts` | 1 | 組卷與清單操作的純函式 |
| `src/services/firestoreErrors.ts` | 2 | `isPermissionDenied`（從 questionSourceService 抽出共用） |
| `src/services/questionBankMappers.ts` | 2 | 新增 `toExamSheet` |
| `src/services/examSheetService.ts` | 2 | 考卷 CRUD |
| `src/hooks/useQuestionBank.ts` | 3 | 多載入考卷 |
| `src/components/MyExams/SheetList.tsx` | 3 | 考卷列表 |
| `src/components/MyExams/MyExamsPage.tsx` | 3 | 新增「考卷」tab 與「組新考卷」 |
| `src/components/MyExams/QuestionPicker.tsx` | 4 | 題庫挑選器 |
| `src/components/MyExams/SheetComposerForm.tsx` | 5 | 組卷表單 |
| `src/components/MyExams/SheetComposerPage.tsx` | 5 | 組卷的資料載入（新增／編輯） |
| `src/components/MyExams/printSettings.ts` | 6 | 列印設定常數與 localStorage |
| `src/components/MyExams/PrintPaper.tsx` | 7 | 紙張排版 |
| `src/components/MyExams/PrintToolbar.tsx` | 7 | 螢幕工具列 |
| `src/components/MyExams/SheetPrintView.tsx` | 7 | 列印頁（資料載入＋狀態） |
| `src/index.css` | 7 | `@page` 與列印背景 |
| `src/App.tsx` | 8 | 組卷 routes、列印獨立分支 |

---

### Task 1: 抽題與組卷的純函式

**Files:**
- Create: `src/testing/seededRng.ts`
- Create: `src/components/MyExams/pickRandomQuestions.ts`
- Create: `src/components/MyExams/sheetComposition.ts`
- Test: `src/components/MyExams/pickRandomQuestions.test.ts`
- Test: `src/components/MyExams/sheetComposition.test.ts`

**Interfaces:**
- Consumes: M1 的 `BankQuestion`、`BankSubject`、`BANK_SUBJECTS`、`makeQuestion`
- Produces:
  - `seededRng(seed: number): () => number`
  - `type Rng = () => number`
  - `pickRandomQuestions(pool: readonly BankQuestion[], count: number, rng?: Rng, excludeIds?: ReadonlySet<string>): BankQuestion[]`
  - `type SubjectCounts = Partial<Record<BankSubject, number>>`
  - `DEFAULT_SUBJECT_COUNT = 10`
  - `countBySubject(bank: readonly BankQuestion[]): Record<BankSubject, number>`
  - `buildSheetQuestions(bank: readonly BankQuestion[], counts: SubjectCounts, rng?: Rng): BankQuestion[]`
  - `canReplaceAt(list: readonly BankQuestion[], index: number, bank: readonly BankQuestion[]): boolean`
  - `replaceAt(list: readonly BankQuestion[], index: number, bank: readonly BankQuestion[], rng?: Rng): BankQuestion[]`
  - `moveAt<T>(list: readonly T[], index: number, delta: -1 | 1): T[]`
  - `removeAt<T>(list: readonly T[], index: number): T[]`
  - `appendUnique(list: readonly BankQuestion[], additions: readonly BankQuestion[]): BankQuestion[]`
  - `resolveSheetQuestions(ids: readonly string[], bank: readonly BankQuestion[]): { questions: BankQuestion[]; missingCount: number }`
  - `defaultSheetTitle(date: Date): string`

- [ ] **Step 1: 建立可重現亂數**

Create `src/testing/seededRng.ts`:

```ts
/** mulberry32：測試用的可重現亂數，回傳 [0, 1)。 */
export function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 2: 寫抽題的失敗測試**

Create `src/components/MyExams/pickRandomQuestions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeQuestion } from "../../testing/questionBankFixtures";
import { seededRng } from "../../testing/seededRng";
import { pickRandomQuestions } from "./pickRandomQuestions";

const pool = Array.from({ length: 10 }, (_, index) => makeQuestion({ id: `q${index}` }));
const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

describe("pickRandomQuestions", () => {
  it("picks the requested number of distinct questions from the pool", () => {
    const picked = pickRandomQuestions(pool, 4, seededRng(1));
    expect(picked).toHaveLength(4);
    expect(new Set(ids(picked)).size).toBe(4);
    expect(ids(picked).every((id) => ids(pool).includes(id))).toBe(true);
  });

  it("never picks excluded questions", () => {
    const excluded = new Set(["q0", "q1", "q2", "q3", "q4", "q5", "q6", "q7"]);
    expect(ids(pickRandomQuestions(pool, 5, seededRng(2), excluded)).sort()).toEqual(["q8", "q9"]);
  });

  it("returns everything available when asked for more", () => {
    expect(pickRandomQuestions(pool, 50, seededRng(3))).toHaveLength(10);
  });

  it("returns nothing for a zero or negative count", () => {
    expect(pickRandomQuestions(pool, 0, seededRng(4))).toEqual([]);
    expect(pickRandomQuestions(pool, -3, seededRng(4))).toEqual([]);
  });

  it("is reproducible for the same seed and does not mutate the pool", () => {
    const snapshot = ids(pool);
    expect(ids(pickRandomQuestions(pool, 5, seededRng(7)))).toEqual(ids(pickRandomQuestions(pool, 5, seededRng(7))));
    expect(ids(pool)).toEqual(snapshot);
  });
});
```

- [ ] **Step 3: 執行確認失敗**

Run: `npx vitest run src/components/MyExams/pickRandomQuestions.test.ts`
Expected: FAIL，找不到模組 `./pickRandomQuestions`。

- [ ] **Step 4: 實作抽題**

Create `src/components/MyExams/pickRandomQuestions.ts`:

```ts
import type { BankQuestion } from "../../types/questionBank";

export type Rng = () => number;

/**
 * 從 pool 排除 excludeIds 後，不放回地抽 min(count, 剩餘數) 題；
 * 回傳順序即隨機順序（部分 Fisher–Yates，做法同 src/data/exams/mixed.ts）。
 * 之後要加錯題權重，只改這個函式（spec §11.2）。
 */
export function pickRandomQuestions(
  pool: readonly BankQuestion[],
  count: number,
  rng: Rng = Math.random,
  excludeIds: ReadonlySet<string> = new Set(),
): BankQuestion[] {
  const candidates = pool.filter((question) => !excludeIds.has(question.id));
  const size = Math.max(0, Math.min(Math.floor(count), candidates.length));
  for (let index = 0; index < size; index += 1) {
    const swap = index + Math.floor(rng() * (candidates.length - index));
    [candidates[index], candidates[swap]] = [candidates[swap], candidates[index]];
  }
  return candidates.slice(0, size);
}
```

- [ ] **Step 5: 執行確認通過**

Run: `npx vitest run src/components/MyExams/pickRandomQuestions.test.ts`
Expected: PASS。

- [ ] **Step 6: 寫組卷操作的失敗測試**

Create `src/components/MyExams/sheetComposition.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeQuestion } from "../../testing/questionBankFixtures";
import { seededRng } from "../../testing/seededRng";
import {
  appendUnique,
  buildSheetQuestions,
  canReplaceAt,
  countBySubject,
  defaultSheetTitle,
  moveAt,
  removeAt,
  replaceAt,
  resolveSheetQuestions,
} from "./sheetComposition";

const math = ["m1", "m2", "m3"].map((id) => makeQuestion({ id, subject: "math" }));
const chinese = ["c1", "c2"].map((id) => makeQuestion({ id, subject: "chinese" }));
const bank = [...math, ...chinese];
const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

describe("countBySubject", () => {
  it("counts every subject, including empty ones", () => {
    expect(countBySubject(bank)).toEqual({ chinese: 2, math: 3, english: 0, science: 0, social: 0 });
  });
});

describe("buildSheetQuestions", () => {
  it("draws each subject separately and orders subjects chinese → math → …", () => {
    const sheet = buildSheetQuestions(bank, { math: 2, chinese: 1 }, seededRng(1));
    expect(sheet.map((question) => question.subject)).toEqual(["chinese", "math", "math"]);
    expect(new Set(ids(sheet)).size).toBe(3);
  });

  it("skips subjects with no or zero count", () => {
    expect(buildSheetQuestions(bank, { math: 0 }, seededRng(1))).toEqual([]);
    expect(buildSheetQuestions(bank, {}, seededRng(1))).toEqual([]);
  });
});

describe("canReplaceAt / replaceAt", () => {
  it("replaces with an unused question of the same subject", () => {
    const list = [math[0], math[1], chinese[0]];
    expect(canReplaceAt(list, 0, bank)).toBe(true);
    const next = replaceAt(list, 0, bank, seededRng(5));
    expect(ids(next)).toEqual(["m3", "m2", "c1"]);
  });

  it("reports when every question of that subject is already used", () => {
    const list = [...math];
    expect(canReplaceAt(list, 1, bank)).toBe(false);
    expect(ids(replaceAt(list, 1, bank, seededRng(5)))).toEqual(["m1", "m2", "m3"]);
  });

  it("is false for an index outside the list", () => {
    expect(canReplaceAt([math[0]], 3, bank)).toBe(false);
  });
});

describe("moveAt / removeAt / appendUnique", () => {
  it("swaps with the neighbour and ignores moves past the ends", () => {
    expect(moveAt(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveAt(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveAt(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveAt(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });

  it("removes one item", () => {
    expect(removeAt(["a", "b", "c"], 1)).toEqual(["a", "c"]);
  });

  it("appends only questions that are not in the list yet", () => {
    expect(ids(appendUnique([math[0]], [math[0], chinese[1]]))).toEqual(["m1", "c2"]);
  });
});

describe("resolveSheetQuestions", () => {
  it("keeps the saved order and counts deleted questions", () => {
    expect(resolveSheetQuestions(["c2", "gone", "m1"], bank)).toEqual({
      questions: [chinese[1], math[0]],
      missingCount: 1,
    });
  });
});

describe("defaultSheetTitle", () => {
  it("uses today's date with zero padding", () => {
    expect(defaultSheetTitle(new Date(2026, 8, 4))).toBe("自製考卷 2026/09/04");
  });
});
```

- [ ] **Step 7: 執行確認失敗**

Run: `npx vitest run src/components/MyExams/sheetComposition.test.ts`
Expected: FAIL，找不到模組 `./sheetComposition`。

- [ ] **Step 8: 實作組卷操作**

Create `src/components/MyExams/sheetComposition.ts`:

```ts
import {
  BANK_SUBJECTS,
  type BankQuestion,
  type BankSubject,
} from "../../types/questionBank";
import { pickRandomQuestions, type Rng } from "./pickRandomQuestions";

export type SubjectCounts = Partial<Record<BankSubject, number>>;

/** 勾選科目時的預設題數（實際取 min(這個值, 該科題數)）。 */
export const DEFAULT_SUBJECT_COUNT = 10;

export function countBySubject(bank: readonly BankQuestion[]): Record<BankSubject, number> {
  const counts = Object.fromEntries(BANK_SUBJECTS.map((subject) => [subject, 0])) as Record<
    BankSubject,
    number
  >;
  for (const question of bank) counts[question.subject] += 1;
  return counts;
}

/** 每科各自不放回抽題，依 BANK_SUBJECTS 順序串接（spec §11.2）。 */
export function buildSheetQuestions(
  bank: readonly BankQuestion[],
  counts: SubjectCounts,
  rng: Rng = Math.random,
): BankQuestion[] {
  return BANK_SUBJECTS.flatMap((subject) => {
    const count = counts[subject] ?? 0;
    if (count <= 0) return [];
    return pickRandomQuestions(
      bank.filter((question) => question.subject === subject),
      count,
      rng,
    );
  });
}

function unusedSameSubject(
  list: readonly BankQuestion[],
  index: number,
  bank: readonly BankQuestion[],
): BankQuestion[] {
  const target = list[index];
  if (!target) return [];
  const used = new Set(list.map((question) => question.id));
  return bank.filter((question) => question.subject === target.subject && !used.has(question.id));
}

export function canReplaceAt(
  list: readonly BankQuestion[],
  index: number,
  bank: readonly BankQuestion[],
): boolean {
  return unusedSameSubject(list, index, bank).length > 0;
}

/** 換成同科、還不在卷裡的隨機一題；沒有可換的就原樣回傳。 */
export function replaceAt(
  list: readonly BankQuestion[],
  index: number,
  bank: readonly BankQuestion[],
  rng: Rng = Math.random,
): BankQuestion[] {
  const [replacement] = pickRandomQuestions(unusedSameSubject(list, index, bank), 1, rng);
  if (!replacement) return [...list];
  return list.map((question, position) => (position === index ? replacement : question));
}

export function moveAt<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  const next = [...list];
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function removeAt<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, position) => position !== index);
}

export function appendUnique(
  list: readonly BankQuestion[],
  additions: readonly BankQuestion[],
): BankQuestion[] {
  const used = new Set(list.map((question) => question.id));
  return [...list, ...additions.filter((question) => !used.has(question.id))];
}

/** 依考卷存的 id 順序找回題目；找不到的（已刪除）只計數。 */
export function resolveSheetQuestions(
  ids: readonly string[],
  bank: readonly BankQuestion[],
): { questions: BankQuestion[]; missingCount: number } {
  const byId = new Map(bank.map((question) => [question.id, question]));
  const questions: BankQuestion[] = [];
  let missingCount = 0;
  for (const id of ids) {
    const question = byId.get(id);
    if (question) questions.push(question);
    else missingCount += 1;
  }
  return { questions, missingCount };
}

export function defaultSheetTitle(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `自製考卷 ${date.getFullYear()}/${month}/${day}`;
}
```

- [ ] **Step 9: 執行確認通過**

Run: `npx vitest run src/components/MyExams/sheetComposition.test.ts src/components/MyExams/pickRandomQuestions.test.ts`
Expected: PASS。若 `replaceAt` 的期望值 `m3` 因種子不同而失敗，代表實作跟測試不一致——同科未使用的題目只有 `m3`，不論種子都應該是 `m3`，請檢查 `unusedSameSubject`。

- [ ] **Step 10: Commit**

```bash
git add src/testing/seededRng.ts src/components/MyExams/pickRandomQuestions.ts src/components/MyExams/pickRandomQuestions.test.ts src/components/MyExams/sheetComposition.ts src/components/MyExams/sheetComposition.test.ts
git commit -m "feat(my-exams): add random picking and sheet composition helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 考卷 service

**Files:**
- Create: `src/services/firestoreErrors.ts`
- Create: `src/services/examSheetService.ts`
- Modify: `src/services/questionSourceService.ts`（改用共用的 `isPermissionDenied`）
- Modify: `src/services/questionBankMappers.ts`（新增 `toExamSheet`）
- Test: `src/services/examSheetService.test.ts`
- Test: `src/services/questionBankMappers.test.ts`（新增 describe）

**Interfaces:**
- Consumes: M1 的 `requireCurrentUserId`、`EXAM_SHEETS_COLLECTION`、`ExamSheet`
- Produces:
  - `isPermissionDenied(error: unknown): boolean`
  - `toExamSheet(id: string, data: DocumentData): ExamSheet | null`
  - `interface SheetInput { title: string; questionIds: readonly string[] }`
  - `listSheets(): Promise<ExamSheet[]>`（新到舊）
  - `getSheet(sheetId: string): Promise<ExamSheet | null>`
  - `createSheet(input: SheetInput): Promise<ExamSheet>`
  - `updateSheet(sheetId: string, input: SheetInput): Promise<void>`
  - `deleteSheet(sheetId: string): Promise<void>`

- [ ] **Step 1: 抽出共用的錯誤判斷**

Create `src/services/firestoreErrors.ts`:

```ts
/** Firestore 規則擋下時的錯誤；讀別人的文件會得到這個。 */
export function isPermissionDenied(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "permission-denied"
  );
}
```

在 `src/services/questionSourceService.ts`：刪除檔案內的 `function isPermissionDenied(...) { ... }` 整段，並在 import 區加上：

```ts
import { isPermissionDenied } from "./firestoreErrors";
```

Run: `npx vitest run src/services/questionSourceService.test.ts`
Expected: PASS（行為不變）。

- [ ] **Step 2: 寫 `toExamSheet` 的失敗測試**

在 `src/services/questionBankMappers.test.ts` 的 import 清單加上 `toExamSheet`，並在檔案最後加上：

```ts
describe("toExamSheet", () => {
  it("maps a sheet and keeps only string question ids in order", () => {
    expect(
      toExamSheet("sheet-1", {
        userId: "user-1",
        title: "期中考複習",
        questionIds: ["q2", 3, "q1"],
        createdAt: stamp("2026-09-01T00:00:00Z"),
        updatedAt: stamp("2026-09-02T00:00:00Z"),
      }),
    ).toEqual({
      id: "sheet-1",
      userId: "user-1",
      title: "期中考複習",
      questionIds: ["q2", "q1"],
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: new Date("2026-09-02T00:00:00Z"),
    });
  });

  it("rejects a sheet without an owner", () => {
    expect(toExamSheet("sheet-1", { title: "x", questionIds: [] })).toBeNull();
  });
});
```

- [ ] **Step 3: 寫 service 的失敗測試**

Create `src/services/examSheetService.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: "user-1" } as { uid: string } | null },
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  doc: vi.fn((_db: unknown, name: string, id: string) => ({ path: `${name}/${id}` })),
  addDoc: mocks.addDoc,
  updateDoc: mocks.updateDoc,
  deleteDoc: mocks.deleteDoc,
  getDoc: mocks.getDoc,
  getDocs: mocks.getDocs,
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ ref, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ kind: "where", field, op, value })),
  orderBy: vi.fn((field: string, direction: string) => ({ kind: "orderBy", field, direction })),
  Timestamp: {
    now: vi.fn(() => ({ kind: "now", toDate: () => new Date("2026-09-24T00:00:00Z") })),
  },
}));
vi.mock("../utils/firebaseUtil", () => ({ db: {}, auth: mocks.auth }));

import {
  createSheet,
  deleteSheet,
  getSheet,
  listSheets,
  updateSheet,
} from "./examSheetService";

const stamp = { toDate: () => new Date("2026-09-01T00:00:00Z") };
const sheetData = { userId: "user-1", title: "複習", questionIds: ["q1"], createdAt: stamp, updatedAt: stamp };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.currentUser = { uid: "user-1" };
});

describe("examSheetService", () => {
  it("creates a sheet owned by the current user", async () => {
    mocks.addDoc.mockResolvedValue({ id: "sheet-1" });
    const sheet = await createSheet({ title: "複習", questionIds: ["q2", "q1"] });

    const [collectionRef, data] = mocks.addDoc.mock.calls[0];
    expect(collectionRef).toEqual({ name: "examSheets" });
    expect(data).toMatchObject({ userId: "user-1", title: "複習", questionIds: ["q2", "q1"] });
    expect(sheet).toMatchObject({ id: "sheet-1", questionIds: ["q2", "q1"] });
  });

  it("updates title and question order", async () => {
    await updateSheet("sheet-1", { title: "新標題", questionIds: ["q1"] });
    expect(mocks.updateDoc).toHaveBeenCalledWith(
      { path: "examSheets/sheet-1" },
      expect.objectContaining({ title: "新標題", questionIds: ["q1"], updatedAt: expect.objectContaining({ kind: "now" }) }),
    );
  });

  it("deletes a sheet", async () => {
    await deleteSheet("sheet-1");
    expect(mocks.deleteDoc).toHaveBeenCalledWith({ path: "examSheets/sheet-1" });
  });

  it("lists the current user's sheets newest first", async () => {
    mocks.getDocs.mockResolvedValue({ docs: [{ id: "sheet-1", data: () => sheetData }] });
    expect((await listSheets()).map((sheet) => sheet.id)).toEqual(["sheet-1"]);
    const [query] = mocks.getDocs.mock.calls[0];
    expect(query.constraints).toEqual([
      { kind: "where", field: "userId", op: "==", value: "user-1" },
      { kind: "orderBy", field: "createdAt", direction: "desc" },
    ]);
  });

  it("returns null for missing, foreign or forbidden sheets", async () => {
    mocks.getDoc.mockResolvedValueOnce({ id: "s", exists: () => false, data: () => undefined });
    expect(await getSheet("s")).toBeNull();
    mocks.getDoc.mockResolvedValueOnce({ id: "s", exists: () => true, data: () => ({ ...sheetData, userId: "other" }) });
    expect(await getSheet("s")).toBeNull();
    mocks.getDoc.mockRejectedValueOnce({ code: "permission-denied" });
    expect(await getSheet("s")).toBeNull();
  });

  it("refuses to write without a signed-in user", async () => {
    mocks.auth.currentUser = null;
    await expect(createSheet({ title: "x", questionIds: [] })).rejects.toThrow("尚未登入");
  });
});
```

- [ ] **Step 4: 執行確認失敗**

Run: `npx vitest run src/services/examSheetService.test.ts src/services/questionBankMappers.test.ts`
Expected: FAIL（找不到 `./examSheetService`、`toExamSheet` 未定義）。

- [ ] **Step 5: 實作 mapper**

在 `src/services/questionBankMappers.ts` 的 type import 加上 `type ExamSheet`，並在檔案最後加上：

```ts
export function toExamSheet(id: string, data: DocumentData): ExamSheet | null {
  if (typeof data.userId !== "string") {
    logger.warn("[questionBank] skip invalid sheet", id);
    return null;
  }
  const rawIds: unknown[] = Array.isArray(data.questionIds) ? data.questionIds : [];
  return {
    id,
    userId: data.userId,
    title: typeof data.title === "string" ? data.title : "",
    questionIds: rawIds.filter((value): value is string => typeof value === "string"),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}
```

- [ ] **Step 6: 實作 service**

Create `src/services/examSheetService.ts`:

```ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import { EXAM_SHEETS_COLLECTION } from "../constants/questionBank";
import type { ExamSheet } from "../types/questionBank";
import { isPermissionDenied } from "./firestoreErrors";
import { toExamSheet } from "./questionBankMappers";
import { requireCurrentUserId } from "./requireCurrentUserId";

export interface SheetInput {
  title: string;
  questionIds: readonly string[];
}

export async function listSheets(): Promise<ExamSheet[]> {
  const userId = requireCurrentUserId();
  const snapshot = await getDocs(
    query(
      collection(db, EXAM_SHEETS_COLLECTION),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
    ),
  );
  return snapshot.docs
    .map((item) => toExamSheet(item.id, item.data()))
    .filter((sheet): sheet is ExamSheet => sheet !== null);
}

export async function getSheet(sheetId: string): Promise<ExamSheet | null> {
  const userId = requireCurrentUserId();
  try {
    const snapshot = await getDoc(doc(db, EXAM_SHEETS_COLLECTION, sheetId));
    if (!snapshot.exists()) return null;
    const sheet = toExamSheet(snapshot.id, snapshot.data());
    return sheet && sheet.userId === userId ? sheet : null;
  } catch (error) {
    if (isPermissionDenied(error)) return null;
    throw error;
  }
}

export async function createSheet(input: SheetInput): Promise<ExamSheet> {
  const userId = requireCurrentUserId();
  const now = Timestamp.now();
  const questionIds = [...input.questionIds];
  const ref = await addDoc(collection(db, EXAM_SHEETS_COLLECTION), {
    userId,
    title: input.title,
    questionIds,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id: ref.id,
    userId,
    title: input.title,
    questionIds,
    createdAt: now.toDate(),
    updatedAt: now.toDate(),
  };
}

export async function updateSheet(sheetId: string, input: SheetInput): Promise<void> {
  requireCurrentUserId();
  await updateDoc(doc(db, EXAM_SHEETS_COLLECTION, sheetId), {
    title: input.title,
    questionIds: [...input.questionIds],
    updatedAt: Timestamp.now(),
  });
}

export async function deleteSheet(sheetId: string): Promise<void> {
  requireCurrentUserId();
  await deleteDoc(doc(db, EXAM_SHEETS_COLLECTION, sheetId));
}
```

- [ ] **Step 7: 執行確認通過**

Run: `npx vitest run src/services`
Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add src/services/firestoreErrors.ts src/services/examSheetService.ts src/services/examSheetService.test.ts src/services/questionSourceService.ts src/services/questionBankMappers.ts src/services/questionBankMappers.test.ts
git commit -m "feat(my-exams): add exam sheet service" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 考卷列表與首頁「考卷」tab

**Files:**
- Modify: `src/hooks/useQuestionBank.ts`（多載入考卷）
- Create: `src/components/MyExams/SheetList.tsx`
- Modify: `src/components/MyExams/MyExamsPage.tsx`
- Test: `src/components/MyExams/SheetList.test.tsx`

**Interfaces:**
- Consumes: Task 2 `listSheets`、`deleteSheet`；既有 `ConfirmModal`
- Produces:
  - `useQuestionBank()` 回傳值多了 `sheets: ExamSheet[]`
  - `SheetList(props: { sheets: readonly ExamSheet[]; onDeleted: () => void })`
  - 首頁 `?tab=sheets` 顯示考卷列表；header 多一個「組新考卷」連到 `/my-exams/sheets/new`

- [ ] **Step 1: 修改 `useQuestionBank`**

把 `src/hooks/useQuestionBank.ts` 改成：

```ts
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listBankQuestions } from "../services/bankQuestionService";
import { listSheets } from "../services/examSheetService";
import { listSources } from "../services/questionSourceService";
import type { BankQuestion, ExamSheet, QuestionSource } from "../types/questionBank";
import { logger } from "../utils/logger";

interface QuestionBankState {
  sources: QuestionSource[];
  questions: BankQuestion[];
  sheets: ExamSheet[];
  loading: boolean;
  error: string | null;
}

export function useQuestionBank() {
  const { user } = useAuth();
  const [state, setState] = useState<QuestionBankState>({
    sources: [],
    questions: [],
    sheets: [],
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([listSources(), listBankQuestions(), listSheets()])
      .then(([sources, questions, sheets]) => {
        if (!cancelled) setState({ sources, questions, sheets, loading: false, error: null });
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

- [ ] **Step 2: 寫考卷列表的失敗測試**

Create `src/components/MyExams/SheetList.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ deleteSheet: vi.fn() }));
vi.mock("../../services/examSheetService", () => ({ deleteSheet: mocks.deleteSheet }));

import type { ExamSheet } from "../../types/questionBank";
import { SheetList } from "./SheetList";

let container: HTMLDivElement;
let root: Root;

const sheet: ExamSheet = {
  id: "sheet-1",
  userId: "user-1",
  title: "期中考複習",
  questionIds: ["q1", "q2", "q3"],
  createdAt: new Date("2026-09-20T00:00:00Z"),
  updatedAt: new Date("2026-09-20T00:00:00Z"),
};

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (item) => item.textContent === label || item.getAttribute("aria-label") === label,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button not found: ${label}`);
  return found;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    },
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
  });
  mocks.deleteSheet.mockReset().mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("SheetList", () => {
  it("links to print and edit", () => {
    act(() =>
      root.render(
        <MemoryRouter>
          <SheetList sheets={[sheet]} onDeleted={vi.fn()} />
        </MemoryRouter>,
      ),
    );
    expect(container.textContent).toContain("期中考複習");
    expect(container.textContent).toContain("3 題");
    const hrefs = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["/my-exams/sheets/sheet-1/print", "/my-exams/sheets/sheet-1/edit"]);
  });

  it("deletes after confirmation", async () => {
    const onDeleted = vi.fn();
    act(() =>
      root.render(
        <MemoryRouter>
          <SheetList sheets={[sheet]} onDeleted={onDeleted} />
        </MemoryRouter>,
      ),
    );
    act(() => button("刪除 期中考複習").click());
    await act(async () => {
      button("刪除").click();
    });
    expect(mocks.deleteSheet).toHaveBeenCalledWith("sheet-1");
    expect(onDeleted).toHaveBeenCalled();
  });

  it("shows an empty state", () => {
    act(() =>
      root.render(
        <MemoryRouter>
          <SheetList sheets={[]} onDeleted={vi.fn()} />
        </MemoryRouter>,
      ),
    );
    expect(container.textContent).toContain("還沒有考卷");
  });
});
```

- [ ] **Step 3: 執行確認失敗**

Run: `npx vitest run src/components/MyExams/SheetList.test.tsx`
Expected: FAIL，找不到模組 `./SheetList`。

- [ ] **Step 4: 實作考卷列表**

Create `src/components/MyExams/SheetList.tsx`:

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Printer, Trash2 } from "lucide-react";
import { ConfirmModal } from "../common/ConfirmModal";
import { deleteSheet } from "../../services/examSheetService";
import type { ExamSheet } from "../../types/questionBank";
import { logger } from "../../utils/logger";

interface SheetListProps {
  sheets: readonly ExamSheet[];
  onDeleted: () => void;
}

export function SheetList({ sheets, onDeleted }: SheetListProps) {
  const [target, setTarget] = useState<ExamSheet | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!target) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSheet(target.id);
      setTarget(null);
      onDeleted();
    } catch (deleteError) {
      logger.error("[SheetList] delete failed", deleteError);
      setError("刪除失敗，請重試");
    } finally {
      setDeleting(false);
    }
  };

  if (sheets.length === 0) {
    return <p className="py-10 text-center text-base-content/60">還沒有考卷。按右上角「組新考卷」開始。</p>;
  }

  return (
    <>
      <ul className="divide-y divide-base-300 rounded-lg border border-base-300 bg-base-100">
        {sheets.map((sheet) => (
          <li key={sheet.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{sheet.title}</p>
              <p className="text-sm text-base-content/60">
                {sheet.createdAt.toLocaleDateString("zh-TW")}・{sheet.questionIds.length} 題
              </p>
            </div>
            <Link to={`/my-exams/sheets/${sheet.id}/print`} className="btn btn-sm">
              <Printer className="size-4" />
              列印
            </Link>
            <Link to={`/my-exams/sheets/${sheet.id}/edit`} className="btn btn-ghost btn-sm">
              <Pencil className="size-4" />
              編輯
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-error"
              aria-label={`刪除 ${sheet.title}`}
              onClick={() => {
                setError(null);
                setTarget(sheet);
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <ConfirmModal
        isOpen={target !== null}
        title="刪除這張考卷？"
        message={target ? `「${target.title}」會被刪除，題庫裡的題目不受影響。` : ""}
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

- [ ] **Step 5: 修改首頁**

在 `src/components/MyExams/MyExamsPage.tsx`：

1. import 區：`import { useNavigate, useSearchParams } from "react-router-dom";` 改成 `import { Link, useNavigate, useSearchParams } from "react-router-dom";`；`import { Upload } from "lucide-react";` 改成 `import { FilePlus2, Upload } from "lucide-react";`；加上 `import { SheetList } from "./SheetList";`。
2. 把 tab 型別、清單與 `toTab` 換成：

```tsx
type MyExamsTab = "bank" | "sources" | "sheets";

const TABS: readonly { id: MyExamsTab; label: string }[] = [
  { id: "bank", label: "題庫" },
  { id: "sources", label: "上傳紀錄" },
  { id: "sheets", label: "考卷" },
];

function toTab(value: string | null): MyExamsTab {
  return value === "sources" || value === "sheets" ? value : "bank";
}
```

3. header 裡原本的「上傳題目」按鈕換成：

```tsx
        <div className="flex gap-2">
          <Link to="/my-exams/sheets/new" className="btn btn-sm">
            <FilePlus2 className="size-4" />
            組新考卷
          </Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" />
            上傳題目
          </button>
        </div>
```

4. 內容區的三元運算換成：

```tsx
      {bank.loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg" aria-label="載入題庫" />
        </div>
      ) : tab === "bank" ? (
        <QuestionBankGrid sources={bank.sources} questions={bank.questions} onUpload={() => setUploadOpen(true)} />
      ) : tab === "sources" ? (
        <SourceList sources={bank.sources} questions={bank.questions} onDeleted={bank.reload} />
      ) : (
        <SheetList sheets={bank.sheets} onDeleted={bank.reload} />
      )}
```

- [ ] **Step 6: 執行確認通過**

Run: `npx tsc -b && npx vitest run src/components/MyExams`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useQuestionBank.ts src/components/MyExams/SheetList.tsx src/components/MyExams/SheetList.test.tsx src/components/MyExams/MyExamsPage.tsx
git commit -m "feat(my-exams): list saved exam sheets on the home page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 題庫挑選器

**Files:**
- Create: `src/components/MyExams/QuestionPicker.tsx`
- Test: `src/components/MyExams/QuestionPicker.test.tsx`

**Interfaces:**
- Consumes: M1 `orderBankQuestions`、`QuestionCrop`、`useSignedPageUrls`、`BANK_SUBJECTS`、`BANK_SUBJECT_LABELS`
- Produces: `QuestionPicker(props: { isOpen: boolean; bank: readonly BankQuestion[]; sources: readonly QuestionSource[]; excludeIds: ReadonlySet<string>; onAdd: (questions: BankQuestion[]) => void; onClose: () => void })`
  - 行為：已在卷裡的題目不顯示；可依科目篩選；點卡片切換勾選；「加入 N 題」依畫面順序回傳勾選的題目；關閉時清空勾選。只有開啟時才取 signed URL。

- [ ] **Step 1: 寫失敗測試**

Create `src/components/MyExams/QuestionPicker.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useSignedPageUrls: vi.fn() }));
vi.mock("../../hooks/useSignedPageUrls", () => ({ useSignedPageUrls: mocks.useSignedPageUrls }));

import { makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import { QuestionPicker } from "./QuestionPicker";

let container: HTMLDivElement;
let root: Root;

const at = (second: number) => new Date(`2026-09-01T00:00:0${second}Z`);
const bank = [
  makeQuestion({ id: "m1", subject: "math", createdAt: at(1) }),
  makeQuestion({ id: "m2", subject: "math", createdAt: at(2) }),
  makeQuestion({ id: "c1", subject: "chinese", createdAt: at(3) }),
];

function cards(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>("button[data-question-id]")];
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((item) => item.textContent?.startsWith(label));
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button not found: ${label}`);
  return found;
}

function render(onAdd = vi.fn(), excludeIds = new Set(["m2"])) {
  act(() =>
    root.render(
      <QuestionPicker
        isOpen
        bank={bank}
        sources={[makeSource()]}
        excludeIds={excludeIds}
        onAdd={onAdd}
        onClose={vi.fn()}
      />,
    ),
  );
  return onAdd;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } },
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } },
  });
  mocks.useSignedPageUrls.mockReturnValue({ urls: {}, failed: false, refresh: vi.fn() });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("QuestionPicker", () => {
  it("hides questions that are already on the sheet", () => {
    render();
    expect(cards().map((card) => card.dataset.questionId)).toEqual(["m1", "c1"]);
  });

  it("filters by subject", () => {
    render();
    act(() => button("國語").click());
    expect(cards().map((card) => card.dataset.questionId)).toEqual(["c1"]);
  });

  it("adds the selected questions in display order", () => {
    const onAdd = render();
    const addButton = button("加入");
    expect(addButton.disabled).toBe(true);

    act(() => cards()[1].click());
    act(() => cards()[0].click());
    expect(button("加入").textContent).toBe("加入 2 題");

    act(() => button("加入").click());
    expect(onAdd.mock.calls[0][0].map((question: { id: string }) => question.id)).toEqual(["m1", "c1"]);
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npx vitest run src/components/MyExams/QuestionPicker.test.tsx`
Expected: FAIL，找不到模組 `./QuestionPicker`。

- [ ] **Step 3: 實作**

Create `src/components/MyExams/QuestionPicker.tsx`:

```tsx
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
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

interface QuestionPickerProps {
  isOpen: boolean;
  bank: readonly BankQuestion[];
  sources: readonly QuestionSource[];
  excludeIds: ReadonlySet<string>;
  onAdd: (questions: BankQuestion[]) => void;
  onClose: () => void;
}

export function QuestionPicker({ isOpen, bank, sources, excludeIds, onAdd, onClose }: QuestionPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [filter, setFilter] = useState<BankSubject | "all">("all");
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const candidates = useMemo(
    () =>
      orderBankQuestions(bank, sources).filter(
        (question) => !excludeIds.has(question.id) && sourceById.has(question.sourceId),
      ),
    [bank, sources, excludeIds, sourceById],
  );
  const visible = filter === "all" ? candidates : candidates.filter((question) => question.subject === filter);
  const paths = isOpen
    ? visible.flatMap((question) =>
        question.regions.flatMap((region) => {
          const page = sourceById.get(question.sourceId)?.pages[region.pageIndex];
          return page ? [page.storagePath] : [];
        }),
      )
    : [];
  const { urls, refresh } = useSignedPageUrls(paths);

  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const close = () => {
    setSelected(new Set());
    setFilter("all");
    onClose();
  };

  const add = () => {
    onAdd(candidates.filter((question) => selected.has(question.id)));
    setSelected(new Set());
    setFilter("all");
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="modal-box max-w-3xl">
        <h3 id={headingId} className="text-lg font-semibold">
          加入指定題目
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["all", ...BANK_SUBJECTS] as const).map((subject) => (
            <button
              key={subject}
              type="button"
              aria-pressed={filter === subject}
              className={`btn btn-sm rounded-full ${filter === subject ? "btn-primary" : "btn-ghost border border-base-300"}`}
              onClick={() => setFilter(subject)}
            >
              {subject === "all" ? "全部" : BANK_SUBJECT_LABELS[subject]}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-base-content/60">沒有可以加入的題目。</p>
        ) : (
          <ul className="mt-4 grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {visible.map((question) => {
              const source = sourceById.get(question.sourceId);
              if (!source) return null;
              const checked = selected.has(question.id);
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    data-question-id={question.id}
                    aria-pressed={checked}
                    className={`relative flex h-full w-full flex-col items-center gap-2 rounded-lg border-2 bg-base-100 p-2 text-left ${
                      checked ? "border-primary" : "border-base-300"
                    }`}
                    onClick={() => toggle(question.id)}
                  >
                    {checked && (
                      <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-content">
                        <Check className="size-3" />
                      </span>
                    )}
                    <QuestionCrop
                      regions={question.regions}
                      pages={source.pages}
                      urls={urls}
                      loading="lazy"
                      layout={{ kind: "thumbnail", maxHeightPx: 120 }}
                      onRetry={(path) => void refresh(path)}
                    />
                    <span className="w-full truncate text-xs text-base-content/60">
                      {BANK_SUBJECT_LABELS[question.subject]}・{source.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
            取消
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={selected.size === 0} onClick={add}>
            加入 {selected.size} 題
          </button>
        </div>
      </div>
    </dialog>
  );
}
```

- [ ] **Step 4: 執行確認通過**

Run: `npx vitest run src/components/MyExams/QuestionPicker.test.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/components/MyExams/QuestionPicker.tsx src/components/MyExams/QuestionPicker.test.tsx
git commit -m "feat(my-exams): add question picker dialog" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 組卷畫面

**Files:**
- Create: `src/components/MyExams/SheetComposerForm.tsx`
- Create: `src/components/MyExams/SheetComposerPage.tsx`
- Test: `src/components/MyExams/SheetComposerForm.test.tsx`

**Interfaces:**
- Consumes: Task 1 全部函式與 `Rng`；Task 2 `createSheet`、`updateSheet`；Task 3 `useQuestionBank`（含 `sheets`）；Task 4 `QuestionPicker`；M1 `QuestionCrop`、`useSignedPageUrls`；既有 `ConfirmModal`
- Produces:
  - `SheetComposerForm(props: { sheetId: string | null; initialTitle: string; initialQuestions: readonly BankQuestion[]; missingCount: number; bank: readonly BankQuestion[]; sources: readonly QuestionSource[]; rng?: Rng })`
  - `SheetComposerPage`（default export；`/my-exams/sheets/new` 與 `/my-exams/sheets/:id/edit`）
  - 儲存後導向 `/my-exams/sheets/:id/print`

- [ ] **Step 1: 寫失敗測試**

Create `src/components/MyExams/SheetComposerForm.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createSheet: vi.fn(), updateSheet: vi.fn() }));
vi.mock("../../services/examSheetService", () => ({
  createSheet: mocks.createSheet,
  updateSheet: mocks.updateSheet,
}));
vi.mock("../../hooks/useSignedPageUrls", () => ({
  useSignedPageUrls: () => ({ urls: {}, failed: false, refresh: vi.fn() }),
}));

import { makeQuestion, makeSource } from "../../testing/questionBankFixtures";
import { seededRng } from "../../testing/seededRng";
import type { BankQuestion } from "../../types/questionBank";
import { SheetComposerForm } from "./SheetComposerForm";

let container: HTMLDivElement;
let root: Root;

const bank = [
  ...["m1", "m2", "m3", "m4"].map((id) => makeQuestion({ id, subject: "math" })),
  makeQuestion({ id: "c1", subject: "chinese" }),
];

function renderForm(props: Partial<Parameters<typeof SheetComposerForm>[0]> = {}) {
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/my-exams/sheets/new"]}>
        <Routes>
          <Route
            path="/my-exams/sheets/new"
            element={
              <SheetComposerForm
                sheetId={null}
                initialTitle=""
                initialQuestions={[]}
                missingCount={0}
                bank={bank}
                sources={[makeSource()]}
                rng={seededRng(11)}
                {...props}
              />
            }
          />
          <Route path="/my-exams/sheets/:id/print" element={<p>列印頁</p>} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}

function button(label: string, scope: ParentNode = container): HTMLButtonElement {
  const found = [...scope.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label || item.getAttribute("aria-label") === label,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button not found: ${label}`);
  return found;
}

function rows(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("li[data-question-id]")];
}

function rowIds(): string[] {
  return rows().map((row) => row.dataset.questionId ?? "");
}

function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } },
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } },
  });
  mocks.createSheet.mockReset().mockResolvedValue({ id: "sheet-9" });
  mocks.updateSheet.mockReset().mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("SheetComposerForm", () => {
  it("draws, replaces, removes, reorders and saves", async () => {
    renderForm();

    const mathCheckbox = container.querySelector<HTMLInputElement>('input[aria-label="出數學"]');
    const chineseCheckbox = container.querySelector<HTMLInputElement>('input[aria-label="出國語"]');
    const englishCheckbox = container.querySelector<HTMLInputElement>('input[aria-label="出英文"]');
    expect(englishCheckbox?.disabled).toBe(true);
    act(() => mathCheckbox?.click());
    expect(container.querySelector('[data-testid="count-math"]')?.textContent).toBe("4");

    act(() => button("隨機抽題").click());
    expect(rows()).toHaveLength(4);
    expect(button("換一題", rows()[0]).disabled).toBe(true);

    act(() => button("減少數學題數").click());
    act(() => chineseCheckbox?.click());
    act(() => button("隨機抽題").click());
    // 清單非空 → 先確認
    act(() => button("重新抽題").click());
    expect(rows()).toHaveLength(4);
    expect(rowIds()[0]).toBe("c1");
    expect(rowIds().slice(1).every((id) => id.startsWith("m"))).toBe(true);

    const before = rowIds();
    act(() => button("換一題", rows()[1]).click());
    const after = rowIds();
    expect(after[1]).not.toBe(before[1]);
    expect(after[1].startsWith("m")).toBe(true);
    expect(new Set(after).size).toBe(4);

    act(() => button("移除", rows()[3]).click());
    expect(rows()).toHaveLength(3);

    const beforeMove = rowIds();
    act(() => button("下移", rows()[0]).click());
    expect(rowIds()).toEqual([beforeMove[1], beforeMove[0], beforeMove[2]]);

    const title = container.querySelector<HTMLInputElement>('input[aria-label="考卷標題"]');
    if (!title) throw new Error("title input missing");
    typeInto(title, "期中考複習");

    const finalIds = rowIds();
    await act(async () => {
      button("儲存並列印").click();
    });
    expect(mocks.createSheet).toHaveBeenCalledWith({ title: "期中考複習", questionIds: finalIds });
    expect(container.textContent).toContain("列印頁");
  });

  it("updates an existing sheet and reports removed questions", async () => {
    const initial: BankQuestion[] = [bank[0], bank[4]];
    renderForm({ sheetId: "sheet-1", initialTitle: "舊考卷", initialQuestions: initial, missingCount: 2 });

    expect(container.textContent).toContain("有 2 題已從題庫刪除，已自動移除");
    expect(rowIds()).toEqual(["m1", "c1"]);

    await act(async () => {
      button("儲存並列印").click();
    });
    expect(mocks.updateSheet).toHaveBeenCalledWith("sheet-1", { title: "舊考卷", questionIds: ["m1", "c1"] });
  });

  it("cannot save an empty sheet", () => {
    renderForm();
    expect(button("儲存並列印").disabled).toBe(true);
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npx vitest run src/components/MyExams/SheetComposerForm.test.tsx`
Expected: FAIL，找不到模組 `./SheetComposerForm`。

- [ ] **Step 3: 實作表單**

Create `src/components/MyExams/SheetComposerForm.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, Minus, Plus, Shuffle } from "lucide-react";
import { ConfirmModal } from "../common/ConfirmModal";
import { createSheet, updateSheet } from "../../services/examSheetService";
import { useSignedPageUrls } from "../../hooks/useSignedPageUrls";
import {
  BANK_SUBJECTS,
  BANK_SUBJECT_LABELS,
  type BankQuestion,
  type BankSubject,
  type QuestionSource,
} from "../../types/questionBank";
import { logger } from "../../utils/logger";
import type { Rng } from "./pickRandomQuestions";
import { QuestionCrop } from "./QuestionCrop";
import { QuestionPicker } from "./QuestionPicker";
import {
  appendUnique,
  buildSheetQuestions,
  canReplaceAt,
  countBySubject,
  DEFAULT_SUBJECT_COUNT,
  defaultSheetTitle,
  moveAt,
  removeAt,
  replaceAt,
  type SubjectCounts,
} from "./sheetComposition";

interface SheetComposerFormProps {
  sheetId: string | null;
  initialTitle: string;
  initialQuestions: readonly BankQuestion[];
  missingCount: number;
  bank: readonly BankQuestion[];
  sources: readonly QuestionSource[];
  rng?: Rng;
}

export function SheetComposerForm({
  sheetId,
  initialTitle,
  initialQuestions,
  missingCount,
  bank,
  sources,
  rng = Math.random,
}: SheetComposerFormProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(initialTitle);
  const [counts, setCounts] = useState<SubjectCounts>({});
  const [list, setList] = useState<BankQuestion[]>(() => [...initialQuestions]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = useMemo(() => countBySubject(bank), [bank]);
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const total = BANK_SUBJECTS.reduce((sum, subject) => sum + (counts[subject] ?? 0), 0);
  const paths = list.flatMap((question) =>
    question.regions.flatMap((region) => {
      const page = sourceById.get(question.sourceId)?.pages[region.pageIndex];
      return page ? [page.storagePath] : [];
    }),
  );
  const { urls, refresh } = useSignedPageUrls(paths);

  const toggleSubject = (subject: BankSubject, checked: boolean) =>
    setCounts((previous) => {
      const next = { ...previous };
      if (checked) next[subject] = Math.min(DEFAULT_SUBJECT_COUNT, available[subject]);
      else delete next[subject];
      return next;
    });

  const changeCount = (subject: BankSubject, delta: -1 | 1) =>
    setCounts((previous) => {
      const current = previous[subject];
      if (current === undefined) return previous;
      const value = Math.min(available[subject], Math.max(1, current + delta));
      return { ...previous, [subject]: value };
    });

  const applyDraw = () => {
    setList(buildSheetQuestions(bank, counts, rng));
    setConfirmOpen(false);
  };

  const requestDraw = () => {
    if (list.length > 0) setConfirmOpen(true);
    else applyDraw();
  };

  const save = async () => {
    if (list.length === 0) return;
    setSaving(true);
    setError(null);
    const input = {
      title: title.trim() || defaultSheetTitle(new Date()),
      questionIds: list.map((question) => question.id),
    };
    try {
      let id = sheetId;
      if (id) {
        await updateSheet(id, input);
      } else {
        id = (await createSheet(input)).id;
      }
      navigate(`/my-exams/sheets/${id}/print`);
    } catch (saveError) {
      logger.error("[SheetComposerForm] save failed", saveError);
      setError("儲存失敗，請重試");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center gap-2">
        <Link to="/my-exams?tab=sheets" className="btn btn-ghost btn-sm" aria-label="返回自製考卷">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{sheetId ? "編輯考卷" : "組新考卷"}</h1>
      </header>

      {missingCount > 0 && (
        <div role="status" className="alert alert-warning">
          有 {missingCount} 題已從題庫刪除，已自動移除。
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        標題
        <input
          className="input input-sm w-full"
          aria-label="考卷標題"
          value={title}
          placeholder="自製考卷（留空會自動加上今天的日期）"
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <section className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4">
        <h2 className="font-semibold">抽題設定</h2>
        <ul className="space-y-2">
          {BANK_SUBJECTS.map((subject) => {
            const label = BANK_SUBJECT_LABELS[subject];
            const count = counts[subject];
            return (
              <li key={subject} className="flex items-center gap-3">
                <label className="flex min-w-28 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    aria-label={`出${label}`}
                    checked={count !== undefined}
                    disabled={available[subject] === 0}
                    onChange={(event) => toggleSubject(subject, event.target.checked)}
                  />
                  {label}
                  <span className="text-xs text-base-content/50">（{available[subject]}）</span>
                </label>
                {count !== undefined && (
                  <div className="join">
                    <button
                      type="button"
                      className="btn join-item btn-xs"
                      aria-label={`減少${label}題數`}
                      disabled={count <= 1}
                      onClick={() => changeCount(subject, -1)}
                    >
                      <Minus className="size-3" />
                    </button>
                    <span data-testid={`count-${subject}`} className="join-item flex w-10 items-center justify-center border border-base-300 text-sm">
                      {count}
                    </span>
                    <button
                      type="button"
                      className="btn join-item btn-xs"
                      aria-label={`增加${label}題數`}
                      disabled={count >= available[subject]}
                      onClick={() => changeCount(subject, 1)}
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between">
          <span className="text-sm text-base-content/70">總題數 {total}</span>
          <button type="button" className="btn btn-primary btn-sm" disabled={total === 0} onClick={requestDraw}>
            <Shuffle className="size-4" />
            隨機抽題
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">題目（{list.length}）</h2>
        {list.length === 0 ? (
          <p className="text-sm text-base-content/60">先設定科目與題數後按「隨機抽題」，或直接加入指定題目。</p>
        ) : (
          <ol className="space-y-2">
            {list.map((question, index) => {
              const source = sourceById.get(question.sourceId);
              const replaceable = canReplaceAt(list, index, bank);
              return (
                <li
                  key={question.id}
                  data-question-id={question.id}
                  className="flex items-center gap-3 rounded-lg border border-base-300 bg-base-100 p-2"
                >
                  <span className="w-6 text-right text-sm font-semibold">{index + 1}.</span>
                  <div className="flex w-32 shrink-0 justify-center">
                    {source && (
                      <QuestionCrop
                        regions={question.regions}
                        pages={source.pages}
                        urls={urls}
                        loading="lazy"
                        layout={{ kind: "thumbnail", maxHeightPx: 96 }}
                        onRetry={(path) => void refresh(path)}
                      />
                    )}
                  </div>
                  <span className="badge badge-ghost badge-sm">{BANK_SUBJECT_LABELS[question.subject]}</span>
                  <div className="ml-auto flex flex-wrap justify-end gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      disabled={!replaceable}
                      title={replaceable ? undefined : "沒有其他題目"}
                      onClick={() => setList((previous) => replaceAt(previous, index, bank, rng))}
                    >
                      換一題
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      aria-label="上移"
                      disabled={index === 0}
                      onClick={() => setList((previous) => moveAt(previous, index, -1))}
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      aria-label="下移"
                      disabled={index === list.length - 1}
                      onClick={() => setList((previous) => moveAt(previous, index, 1))}
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => setList((previous) => removeAt(previous, index))}
                    >
                      移除
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setPickerOpen(true)}>
          加入指定題目
        </button>
      </section>

      <footer className="flex items-center justify-end gap-3">
        {error && (
          <span role="alert" className="text-sm text-error">
            {error}
          </span>
        )}
        <button
          type="button"
          className="btn btn-primary"
          disabled={list.length === 0 || saving}
          onClick={() => void save()}
        >
          儲存並列印
        </button>
      </footer>

      <QuestionPicker
        isOpen={pickerOpen}
        bank={bank}
        sources={sources}
        excludeIds={new Set(list.map((question) => question.id))}
        onAdd={(questions) => {
          setList((previous) => appendUnique(previous, questions));
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
      <ConfirmModal
        isOpen={confirmOpen}
        title="重新抽題？"
        message="目前的題目清單會被新抽的題目取代。"
        confirmText="重新抽題"
        confirmVariant="primary"
        onConfirm={applyDraw}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 4: 執行確認通過**

Run: `npx vitest run src/components/MyExams/SheetComposerForm.test.tsx`
Expected: PASS。注意第一個測試裡 ConfirmModal 與 QuestionPicker 都有「取消」按鈕，所以測試只用唯一的按鈕文字（「重新抽題」、「換一題」等）。

- [ ] **Step 5: 實作資料載入頁**

Create `src/components/MyExams/SheetComposerPage.tsx`:

```tsx
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { resolveSheetQuestions } from "./sheetComposition";
import { SheetComposerForm } from "./SheetComposerForm";

export default function SheetComposerPage() {
  const { id } = useParams();
  const bank = useQuestionBank();

  // 來源已刪除的題目不應存在，保險起見仍排除
  const validBank = useMemo(() => {
    const sourceIds = new Set(bank.sources.map((source) => source.id));
    return bank.questions.filter((question) => sourceIds.has(question.sourceId));
  }, [bank.sources, bank.questions]);

  if (bank.loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg" aria-label="載入題庫" />
      </div>
    );
  }

  if (bank.error) {
    return (
      <div className="py-16 text-center">
        <p className="text-error">{bank.error}</p>
        <button type="button" className="btn btn-sm mt-4" onClick={bank.reload}>
          重試
        </button>
      </div>
    );
  }

  if (!id) {
    return (
      <SheetComposerForm
        key="new"
        sheetId={null}
        initialTitle=""
        initialQuestions={[]}
        missingCount={0}
        bank={validBank}
        sources={bank.sources}
      />
    );
  }

  const sheet = bank.sheets.find((item) => item.id === id);
  if (!sheet) {
    return (
      <div className="py-16 text-center">
        <p className="text-base-content/70">找不到這份資料。</p>
        <Link to="/my-exams?tab=sheets" className="btn btn-sm mt-4">
          返回自製考卷
        </Link>
      </div>
    );
  }

  const { questions, missingCount } = resolveSheetQuestions(sheet.questionIds, validBank);
  return (
    <SheetComposerForm
      key={sheet.id}
      sheetId={sheet.id}
      initialTitle={sheet.title}
      initialQuestions={questions}
      missingCount={missingCount}
      bank={validBank}
      sources={bank.sources}
    />
  );
}
```

- [ ] **Step 6: 型別、lint**

Run: `npx tsc -b && npm run lint`
Expected: 無錯誤。

- [ ] **Step 7: Commit**

```bash
git add src/components/MyExams/SheetComposerForm.tsx src/components/MyExams/SheetComposerForm.test.tsx src/components/MyExams/SheetComposerPage.tsx
git commit -m "feat(my-exams): compose exam sheets from the question bank" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 列印設定

**Files:**
- Create: `src/components/MyExams/printSettings.ts`
- Test: `src/components/MyExams/printSettings.test.ts`

**Interfaces:**
- Consumes: M1 `AnswerSpace`
- Produces:
  - `type PrintScale = "small" | "normal" | "large"`、`PRINT_SCALES`、`PRINT_SCALE_FACTORS`、`PRINT_SCALE_LABELS`
  - `ANSWER_SPACE_CM: Record<AnswerSpace, number>`
  - `interface PrintPreferences { enhance: boolean; scale: PrintScale; includeAnswers: boolean }`
  - `DEFAULT_PRINT_PREFERENCES`、`PRINT_PREFERENCES_KEY`
  - `readPrintPreferences(): PrintPreferences`
  - `writePrintPreferences(preferences: PrintPreferences): void`

- [ ] **Step 1: 寫失敗測試**

Create `src/components/MyExams/printSettings.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANSWER_SPACE_CM,
  DEFAULT_PRINT_PREFERENCES,
  PRINT_PREFERENCES_KEY,
  PRINT_SCALE_FACTORS,
  readPrintPreferences,
  writePrintPreferences,
} from "./printSettings";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("print constants", () => {
  it("match the spec", () => {
    expect(PRINT_SCALE_FACTORS).toEqual({ small: 0.85, normal: 1, large: 1.15 });
    expect(ANSWER_SPACE_CM).toEqual({ none: 0, small: 2, medium: 4, large: 7 });
    expect(DEFAULT_PRINT_PREFERENCES).toEqual({ enhance: false, scale: "normal", includeAnswers: true });
  });
});

describe("readPrintPreferences", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(readPrintPreferences()).toEqual(DEFAULT_PRINT_PREFERENCES);
  });

  it("round-trips stored preferences", () => {
    writePrintPreferences({ enhance: true, scale: "large", includeAnswers: false });
    expect(readPrintPreferences()).toEqual({ enhance: true, scale: "large", includeAnswers: false });
  });

  it("falls back per field for invalid values", () => {
    window.localStorage.setItem(PRINT_PREFERENCES_KEY, JSON.stringify({ enhance: "yes", scale: "huge", includeAnswers: false }));
    expect(readPrintPreferences()).toEqual({ enhance: false, scale: "normal", includeAnswers: false });
  });

  it("survives broken JSON and blocked storage", () => {
    window.localStorage.setItem(PRINT_PREFERENCES_KEY, "{not json");
    expect(readPrintPreferences()).toEqual(DEFAULT_PRINT_PREFERENCES);

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readPrintPreferences()).toEqual(DEFAULT_PRINT_PREFERENCES);
  });
});

describe("writePrintPreferences", () => {
  it("does not throw when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writePrintPreferences(DEFAULT_PRINT_PREFERENCES)).not.toThrow();
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npx vitest run src/components/MyExams/printSettings.test.ts`
Expected: FAIL，找不到模組 `./printSettings`。

- [ ] **Step 3: 實作**

Create `src/components/MyExams/printSettings.ts`:

```ts
import type { AnswerSpace } from "../../types/questionBank";

export type PrintScale = "small" | "normal" | "large";

export const PRINT_SCALES: readonly PrintScale[] = ["small", "normal", "large"];

export const PRINT_SCALE_FACTORS: Record<PrintScale, number> = {
  small: 0.85,
  normal: 1,
  large: 1.15,
};

export const PRINT_SCALE_LABELS: Record<PrintScale, string> = {
  small: "小",
  normal: "標準",
  large: "大",
};

/** 題目下方的作答留白（spec §12.2）。 */
export const ANSWER_SPACE_CM: Record<AnswerSpace, number> = {
  none: 0,
  small: 2,
  medium: 4,
  large: 7,
};

export interface PrintPreferences {
  enhance: boolean;
  scale: PrintScale;
  includeAnswers: boolean;
}

export const DEFAULT_PRINT_PREFERENCES: PrintPreferences = {
  enhance: false,
  scale: "normal",
  includeAnswers: true,
};

export const PRINT_PREFERENCES_KEY = "ollie-my-exams-print-preferences";

function isPrintScale(value: unknown): value is PrintScale {
  return typeof value === "string" && (PRINT_SCALES as readonly string[]).includes(value);
}

export function readPrintPreferences(): PrintPreferences {
  try {
    const raw = window.localStorage.getItem(PRINT_PREFERENCES_KEY);
    if (!raw) return DEFAULT_PRINT_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_PRINT_PREFERENCES;
    const stored = parsed as Record<string, unknown>;
    return {
      enhance: typeof stored.enhance === "boolean" ? stored.enhance : DEFAULT_PRINT_PREFERENCES.enhance,
      scale: isPrintScale(stored.scale) ? stored.scale : DEFAULT_PRINT_PREFERENCES.scale,
      includeAnswers:
        typeof stored.includeAnswers === "boolean"
          ? stored.includeAnswers
          : DEFAULT_PRINT_PREFERENCES.includeAnswers,
    };
  } catch {
    return DEFAULT_PRINT_PREFERENCES;
  }
}

export function writePrintPreferences(preferences: PrintPreferences): void {
  try {
    window.localStorage.setItem(PRINT_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // 私密瀏覽或被封鎖時略過；設定只是方便用
  }
}
```

- [ ] **Step 4: 執行確認通過**

Run: `npx vitest run src/components/MyExams/printSettings.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/components/MyExams/printSettings.ts src/components/MyExams/printSettings.test.ts
git commit -m "feat(my-exams): persist print preferences" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 列印版面

**Files:**
- Create: `src/components/MyExams/PrintPaper.tsx`
- Create: `src/components/MyExams/PrintToolbar.tsx`
- Create: `src/components/MyExams/SheetPrintView.tsx`
- Modify: `src/index.css`（檔案最後加上 `@page` 與列印背景）
- Test: `src/components/MyExams/PrintPaper.test.tsx`
- Test: `src/components/MyExams/PrintToolbar.test.tsx`

**Interfaces:**
- Consumes: Task 1 `resolveSheetQuestions`；Task 3 `useQuestionBank`；Task 6 全部；M1 `QuestionCrop`、`useSignedPageUrls`
- Produces:
  - `interface PrintItem { question: BankQuestion; pages: readonly SourcePage[] }`
  - `PrintPaper(props: { title: string; items: readonly PrintItem[]; urls: Readonly<Record<string, string>>; scale: number; enhance: boolean; includeAnswers: boolean; onImageLoad: (key: string) => void })`（key 格式 `${questionId}:${regionIndex}`）
  - `PrintToolbar(props: { onBack: () => void; onPrint: () => void; loadedCount: number; totalCount: number; preferences: PrintPreferences; onChange: (next: PrintPreferences) => void; hasAnswers: boolean; missingCount: number })`
  - `SheetPrintView`（default export；路由 `/my-exams/sheets/:id/print`，由 Task 8 接上）

- [ ] **Step 1: 寫紙張的失敗測試**

Create `src/components/MyExams/PrintPaper.test.tsx`:

```tsx
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makePage, makeQuestion } from "../../testing/questionBankFixtures";
import { PrintPaper } from "./PrintPaper";

let container: HTMLDivElement;
let root: Root;

const page = makePage({ storagePath: "p0.jpg", masks: [{ x: 0.2, y: 0.2, w: 0.1, h: 0.05 }] });
const items = [
  { question: makeQuestion({ id: "q1", answer: "(3)", answerSpace: "medium" }), pages: [page] },
  { question: makeQuestion({ id: "q2", answerSpace: "none" }), pages: [page] },
  { question: makeQuestion({ id: "q3", answer: "12 公分" }), pages: [page] },
];

function render(overrides: Partial<ComponentProps<typeof PrintPaper>> = {}) {
  act(() =>
    root.render(
      <PrintPaper
        title="期中考複習"
        items={items}
        urls={{ "p0.jpg": "https://signed/p0" }}
        scale={1}
        enhance={false}
        includeAnswers
        onImageLoad={vi.fn()}
        {...overrides}
      />,
    ),
  );
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

describe("PrintPaper", () => {
  it("uses fixed light colors instead of theme tokens (dark mode prints black text)", () => {
    render();
    const paper = container.firstElementChild as HTMLElement;
    expect(paper.className).toContain("bg-white");
    expect(paper.className).toContain("text-black");
    expect(container.innerHTML).not.toContain("base-content");
  });

  it("numbers questions continuously and loads every image eagerly", () => {
    render();
    const numbers = [...container.querySelectorAll("li[data-question-id] > span")].map((item) => item.textContent);
    expect(numbers).toEqual(["1.", "2.", "3."]);
    const images = [...container.querySelectorAll("img")];
    expect(images).toHaveLength(3);
    expect(images.every((image) => image.getAttribute("loading") === "eager")).toBe(true);
  });

  it("draws masks as SVG rects", () => {
    render();
    expect(container.querySelectorAll("svg rect")).toHaveLength(3);
  });

  it("adds answer space below questions", () => {
    render();
    const spaces = [...container.querySelectorAll<HTMLElement>('[data-testid="answer-space"]')];
    expect(spaces.map((space) => space.style.height)).toEqual(["4cm"]);
  });

  it("prints an answer page with a dash for missing answers", () => {
    render();
    const answerPage = container.querySelector('[data-testid="answer-page"]');
    expect(answerPage?.className).toContain("break-before-page");
    expect([...(answerPage?.querySelectorAll("li") ?? [])].map((item) => item.textContent)).toEqual([
      "1. (3)",
      "2. —",
      "3. 12 公分",
    ]);
  });

  it("omits the answer page when turned off", () => {
    render({ includeAnswers: false });
    expect(container.querySelector('[data-testid="answer-page"]')).toBeNull();
  });

  it("reports image loads with question and region keys", () => {
    const onImageLoad = vi.fn();
    render({ onImageLoad });
    act(() => {
      container.querySelectorAll("img")[1].dispatchEvent(new Event("load"));
    });
    expect(onImageLoad).toHaveBeenCalledWith("q2:0");
  });
});
```

- [ ] **Step 2: 寫工具列的失敗測試**

Create `src/components/MyExams/PrintToolbar.test.tsx`:

```tsx
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PRINT_PREFERENCES } from "./printSettings";
import { PrintToolbar } from "./PrintToolbar";

let container: HTMLDivElement;
let root: Root;

type Props = ComponentProps<typeof PrintToolbar>;

function render(overrides: Partial<Props> = {}): Props {
  const props: Props = {
    onBack: vi.fn(),
    onPrint: vi.fn(),
    loadedCount: 3,
    totalCount: 3,
    preferences: DEFAULT_PRINT_PREFERENCES,
    onChange: vi.fn(),
    hasAnswers: true,
    missingCount: 0,
    ...overrides,
  };
  act(() => root.render(<PrintToolbar {...props} />));
  return props;
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button not found: ${label}`);
  return found;
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

describe("PrintToolbar", () => {
  it("is hidden when printing", () => {
    render();
    expect((container.firstElementChild as HTMLElement).className).toContain("print:hidden");
  });

  it("blocks printing until every image has loaded", () => {
    render({ loadedCount: 1, totalCount: 3 });
    expect(button("圖片載入中 1/3").disabled).toBe(true);
  });

  it("prints when ready", () => {
    const props = render();
    act(() => button("列印").click());
    expect(props.onPrint).toHaveBeenCalled();
  });

  it("disables the answer page toggle when no question has an answer", () => {
    render({ hasAnswers: false });
    const toggle = container.querySelector<HTMLInputElement>('input[aria-label="附答案頁"]');
    expect(toggle?.disabled).toBe(true);
    expect(toggle?.checked).toBe(false);
  });

  it("changes the question size", () => {
    const props = render();
    act(() => button("大").click());
    expect(props.onChange).toHaveBeenCalledWith({ ...DEFAULT_PRINT_PREFERENCES, scale: "large" });
  });

  it("warns about deleted questions", () => {
    render({ missingCount: 2 });
    expect(container.textContent).toContain("有 2 題已從題庫刪除，列印時會略過");
  });
});
```

- [ ] **Step 3: 執行確認失敗**

Run: `npx vitest run src/components/MyExams/PrintPaper.test.tsx src/components/MyExams/PrintToolbar.test.tsx`
Expected: FAIL，找不到兩個模組。

- [ ] **Step 4: 實作紙張**

Create `src/components/MyExams/PrintPaper.tsx`:

```tsx
import type { BankQuestion, SourcePage } from "../../types/questionBank";
import { ANSWER_SPACE_CM } from "./printSettings";
import { QuestionCrop } from "./QuestionCrop";

export interface PrintItem {
  question: BankQuestion;
  pages: readonly SourcePage[];
}

interface PrintPaperProps {
  title: string;
  items: readonly PrintItem[];
  urls: Readonly<Record<string, string>>;
  scale: number;
  enhance: boolean;
  includeAnswers: boolean;
  onImageLoad: (key: string) => void;
}

/**
 * 紙張一律固定白底黑字：ThemeContext 深色模式會在 <html> 加 .dark，
 * 用主題 token 會讓卷頭印成白字（spec §12.2）。
 */
export function PrintPaper({ title, items, urls, scale, enhance, includeAnswers, onImageLoad }: PrintPaperProps) {
  return (
    <div className="mx-auto w-[186mm] max-w-full bg-white text-black print:w-full">
      <header className="border-b border-black pb-2">
        <h1 className="text-center text-xl font-semibold">{title}</h1>
        <div className="mt-2 flex justify-between gap-4 text-sm">
          <span>姓名＿＿＿＿＿＿</span>
          <span>日期＿＿＿＿＿＿</span>
          <span>分數＿＿＿＿＿＿</span>
        </div>
      </header>

      <ol className="mt-3">
        {items.map(({ question, pages }, index) => {
          const spaceCm = ANSWER_SPACE_CM[question.answerSpace];
          return (
            <li key={question.id} data-question-id={question.id} className="flex gap-2 py-2 break-inside-avoid">
              <span className="w-8 shrink-0 text-right font-semibold">{index + 1}.</span>
              <div className="min-w-0 flex-1">
                <QuestionCrop
                  regions={question.regions}
                  pages={pages}
                  urls={urls}
                  loading="eager"
                  layout={{ kind: "print", scale }}
                  enhance={enhance}
                  onImageLoad={(regionIndex) => onImageLoad(`${question.id}:${regionIndex}`)}
                />
                {spaceCm > 0 && (
                  <div aria-hidden="true" data-testid="answer-space" style={{ height: `${spaceCm}cm` }} />
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {includeAnswers && (
        <section data-testid="answer-page" className="break-before-page pt-2">
          <h2 className="border-b border-black pb-1 text-lg font-semibold">答案</h2>
          <ol className="mt-2 columns-3 gap-6 text-sm">
            {items.map(({ question }, index) => (
              <li key={question.id} className="break-inside-avoid py-0.5">
                {index + 1}. {question.answer ?? "—"}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 5: 實作工具列**

Create `src/components/MyExams/PrintToolbar.tsx`:

```tsx
import { ArrowLeft, Printer } from "lucide-react";
import {
  PRINT_SCALES,
  PRINT_SCALE_LABELS,
  type PrintPreferences,
} from "./printSettings";

interface PrintToolbarProps {
  onBack: () => void;
  onPrint: () => void;
  loadedCount: number;
  totalCount: number;
  preferences: PrintPreferences;
  onChange: (next: PrintPreferences) => void;
  hasAnswers: boolean;
  missingCount: number;
}

export function PrintToolbar({
  onBack,
  onPrint,
  loadedCount,
  totalCount,
  preferences,
  onChange,
  hasAnswers,
  missingCount,
}: PrintToolbarProps) {
  const ready = loadedCount >= totalCount;

  return (
    <div className="sticky top-0 z-10 mb-4 space-y-2 border-b border-base-300 bg-base-100/90 px-4 py-2 backdrop-blur-md print:hidden">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost btn-sm" aria-label="返回" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </button>

        <div className="join" role="group" aria-label="題目大小">
          {PRINT_SCALES.map((scale) => (
            <button
              key={scale}
              type="button"
              aria-pressed={preferences.scale === scale}
              className={`btn join-item btn-sm ${preferences.scale === scale ? "btn-primary" : ""}`}
              onClick={() => onChange({ ...preferences, scale })}
            >
              {PRINT_SCALE_LABELS[scale]}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            aria-label="列印增強"
            checked={preferences.enhance}
            onChange={(event) => onChange({ ...preferences, enhance: event.target.checked })}
          />
          列印增強
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            aria-label="附答案頁"
            checked={hasAnswers && preferences.includeAnswers}
            disabled={!hasAnswers}
            onChange={(event) => onChange({ ...preferences, includeAnswers: event.target.checked })}
          />
          附答案頁
        </label>

        <button type="button" className="btn btn-primary btn-sm ml-auto" disabled={!ready} onClick={onPrint}>
          {ready ? (
            <>
              <Printer className="size-4" />
              列印
            </>
          ) : (
            `圖片載入中 ${loadedCount}/${totalCount}`
          )}
        </button>
      </div>
      {missingCount > 0 && (
        <p className="mx-auto max-w-4xl text-sm text-warning">
          有 {missingCount} 題已從題庫刪除，列印時會略過。
        </p>
      )}
    </div>
  );
}
```

`PrintToolbar.test.tsx` 的 `button("列印")` 用 `textContent?.trim()` 比對，圖示是 SVG、沒有文字，所以按鈕文字就是「列印」。

- [ ] **Step 6: 執行確認通過**

Run: `npx vitest run src/components/MyExams/PrintPaper.test.tsx src/components/MyExams/PrintToolbar.test.tsx`
Expected: PASS。

- [ ] **Step 7: 實作列印頁**

Create `src/components/MyExams/SheetPrintView.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { useSignedPageUrls } from "../../hooks/useSignedPageUrls";
import { PrintPaper, type PrintItem } from "./PrintPaper";
import { PrintToolbar } from "./PrintToolbar";
import {
  PRINT_SCALE_FACTORS,
  readPrintPreferences,
  writePrintPreferences,
  type PrintPreferences,
} from "./printSettings";
import { resolveSheetQuestions } from "./sheetComposition";

export default function SheetPrintView() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const bank = useQuestionBank();
  const [preferences, setPreferences] = useState<PrintPreferences>(readPrintPreferences);
  const [loadedKeys, setLoadedKeys] = useState<ReadonlySet<string>>(() => new Set());

  const sheet = bank.sheets.find((item) => item.id === id);
  const sourceById = useMemo(() => new Map(bank.sources.map((source) => [source.id, source])), [bank.sources]);
  const { items, missingCount } = useMemo(() => {
    if (!sheet) return { items: [] as PrintItem[], missingCount: 0 };
    const validBank = bank.questions.filter((question) => sourceById.has(question.sourceId));
    const resolved = resolveSheetQuestions(sheet.questionIds, validBank);
    return {
      items: resolved.questions.map((question) => ({
        question,
        pages: sourceById.get(question.sourceId)?.pages ?? [],
      })),
      missingCount: resolved.missingCount,
    };
  }, [sheet, bank.questions, sourceById]);

  const regionKeys = items.flatMap(({ question, pages }) =>
    question.regions.flatMap((region, regionIndex) =>
      pages[region.pageIndex] ? [`${question.id}:${regionIndex}`] : [],
    ),
  );
  const paths = items.flatMap(({ question, pages }) =>
    question.regions.flatMap((region) => {
      const page = pages[region.pageIndex];
      return page ? [page.storagePath] : [];
    }),
  );
  const { urls } = useSignedPageUrls(paths);
  const loadedCount = regionKeys.filter((key) => loadedKeys.has(key)).length;
  const hasAnswers = items.some(({ question }) => Boolean(question.answer));

  const updatePreferences = (next: PrintPreferences) => {
    setPreferences(next);
    writePrintPreferences(next);
  };

  const markLoaded = (key: string) =>
    setLoadedKeys((previous) => (previous.has(key) ? previous : new Set(previous).add(key)));

  const back = () => navigate("/my-exams?tab=sheets");

  if (bank.loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg" aria-label="載入考卷" />
      </div>
    );
  }

  if (bank.error || !sheet) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-base-200">
        <p className="text-base-content/70">{bank.error ?? "找不到這份資料。"}</p>
        <button type="button" className="btn btn-sm" onClick={back}>
          返回自製考卷
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-base-200 pb-8 print:bg-white print:pb-0">
      <PrintToolbar
        onBack={back}
        onPrint={() => window.print()}
        loadedCount={loadedCount}
        totalCount={regionKeys.length}
        preferences={preferences}
        onChange={updatePreferences}
        hasAnswers={hasAnswers}
        missingCount={missingCount}
      />
      <div className="mx-auto w-fit max-w-full bg-white px-4 py-6 shadow-lg print:p-0 print:shadow-none">
        <PrintPaper
          title={sheet.title}
          items={items}
          urls={urls}
          scale={PRINT_SCALE_FACTORS[preferences.scale]}
          enhance={preferences.enhance}
          includeAnswers={hasAnswers && preferences.includeAnswers}
          onImageLoad={markLoaded}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: 加上列印樣式**

在 `src/index.css` 檔案**最後**加上：

```css
/* 自製考卷列印（spec §12.2）：A4、12mm 邊界。
   即使使用者勾選「背景圖形」，深色主題的頁面背景也不會印出來。 */
@page {
  size: A4;
  margin: 12mm;
}

@media print {
  html,
  body {
    background: #fff !important;
  }
}
```

- [ ] **Step 9: 型別、lint、測試**

Run: `npx tsc -b && npm run lint && npx vitest run src/components/MyExams`
Expected: 全部通過。

- [ ] **Step 10: Commit**

```bash
git add src/components/MyExams/PrintPaper.tsx src/components/MyExams/PrintPaper.test.tsx src/components/MyExams/PrintToolbar.tsx src/components/MyExams/PrintToolbar.test.tsx src/components/MyExams/SheetPrintView.tsx src/index.css
git commit -m "feat(my-exams): add printable exam sheet layout" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 組卷 routes 與列印獨立分支

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: Task 5 `SheetComposerPage`、Task 7 `SheetPrintView`（皆 default export）
- Produces:
  - `/my-exams/sheets/new`、`/my-exams/sheets/:id/edit` 在 App 版面內
  - `/my-exams/sheets/:id/print` 是**登入檢查之後**的獨立全螢幕分支（沒有側欄、標題列）

- [ ] **Step 1: 修改 `src/App.tsx`**

1. react-router-dom 的 import 清單加上 `matchPath,`。
2. 在 M1 加的 `SourceCropEditor` lazy import 之後加：

```ts
const SheetComposerPage = lazyWithReload(
  () => import("./components/MyExams/SheetComposerPage"),
);
const SheetPrintView = lazyWithReload(
  () => import("./components/MyExams/SheetPrintView"),
);
```

3. 找到「已登入者不停留在 /login」那段：

```tsx
  // 已登入者不停留在 /login：導回登入前的頁面（沒有就進閱讀器）。
  if (normalizedPathname === "/login") {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== "/login" ? from : "/reader"} replace />;
  }
```

在它**正下方**加上（小遊戲的獨立分支在登入檢查之前，這個必須在之後，因為要讀 Firestore）：

```tsx
  // 列印頁：獨立全螢幕（沒有側欄與標題列），但必須已登入（spec §5.1）。
  if (matchPath("/my-exams/sheets/:id/print", normalizedPathname)) {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/my-exams/sheets/:id/print" element={<SheetPrintView />} />
        </Routes>
      </Suspense>
    );
  }
```

4. `<Routes>` 裡 M1 加的 `/my-exams/sources/:id` 之後加：

```tsx
                      <Route
                        path="/my-exams/sheets/new"
                        element={<SheetComposerPage />}
                      />
                      <Route
                        path="/my-exams/sheets/:id/edit"
                        element={<SheetComposerPage />}
                      />
```

- [ ] **Step 2: 確認分支位置**

Run: `grep -n "matchPath(\"/my-exams" src/App.tsx; grep -n "normalizedPathname === \"/login\"" src/App.tsx`
Expected: `matchPath` 那行的行號**大於** `/login` 那行；且兩者都在所有 hook 呼叫（`useAuth`、`useLocation`、`useEffect` 等，約第 268–310 行）之後。

- [ ] **Step 3: 全部檢查**

Run: `npx tsc -b && npm run lint && npm run test && npm run build`
Expected: 全部通過。

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(my-exams): route sheet composer and standalone print view" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: M2 驗收

**前置：** 先向使用者確認 `examSheets` 的 Firestore 規則與複合索引已設定（spec §15）；沒完成就停下來請使用者設定。

- [ ] **Step 1: 全部自動檢查**

Run: `npm run lint && npm run test && npm run build`
Expected: 全部通過。記下輸出摘要。

- [ ] **Step 2: 啟動 dev server** 並打開 `/my-exams`（沿用 M1 驗收的 launch 設定）。

- [ ] **Step 3: 瀏覽器實測清單（逐項記錄結果）**

- [ ] 首頁有「考卷」tab 與「組新考卷」按鈕。
- [ ] 組卷：勾兩個科目、調整題數、隨機抽題；清單非空時再抽會先確認；換一題、上移下移、移除、加入指定題目都正常；同科題目用完時「換一題」停用。
- [ ] 儲存並列印：進入列印頁，沒有側欄與標題列；圖片全部載入前「列印」按鈕顯示「圖片載入中 n/m」。
- [ ] Chrome 列印預覽，**「背景圖形」關閉**：遮蓋框仍蓋住答案；題目沒有被切到兩頁；答案頁在新的一頁、3 欄。
- [ ] 切到**深色模式**再開列印預覽：卷頭、題號、答案頁都是黑字白底。
- [ ] 題目大小「小／標準／大」會改變裁圖大小；「列印增強」讓照片變灰階、背景變白；設定重新整理後仍記得。
- [ ] 手機寬度（375px）開列印頁：沒有橫向捲動。
- [ ] 在「上傳紀錄」刪除一份被考卷用到的來源，再開那張考卷：列印頁提示「有 N 題已從題庫刪除，列印時會略過」且題號連續；編輯頁提示「已自動移除」。
- [ ] 若有 iPhone：用 Safari 開列印頁，列印或存成 PDF 一次。無法實測就註明「未實測」。

- [ ] **Step 4: 回報**

整理自動檢查結果與實測清單每項的結果（通過／失敗／未實測）。有失敗項目就用 superpowers:systematic-debugging 處理，不要直接宣告完成。
