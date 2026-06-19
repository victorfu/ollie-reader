# 生詞本 Master-Detail 重新設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/vocabulary` so the 單字 (words) tab is a macOS-style master-detail (list + detail panel), the 句子翻譯 (sentences) tab stays a single-column reading list, both share one cohesive shell, and the card-size anomaly is gone.

**Architecture:** The words tab becomes a two-column document-scroll layout: a compact list pane of word rows on the left and a sticky, independently-scrolling detail panel on the right (desktop); below `lg` it collapses to a single list with the detail shown as a modal/sheet. The big detail content is extracted from the existing `WordDetail` modal into a reusable `WordDetailPanel` used by both the desktop panel and the mobile modal. The sentences tab keeps its current component, lightly restyled. No data-layer changes.

**Tech Stack:** React 19 + TypeScript (strict), Vite, Tailwind CSS v4 + DaisyUI, Framer Motion, lucide-react / local SVG icons.

**Verification model:** This repo has **no unit-test framework** (no vitest/jest/testing-library) and CLAUDE.md does not require tests. Each task is verified with `npm run build` (real type-check via `tsc -b` + vite build), `npm run lint` (eslint), and explicit manual checks. Commit after each task.

> ⚠️ Note: `src/index.css`'s `.auto-grid` is shared by SceneHub / StageMap / TopicSelector / EpisodeList — **do NOT modify it.** The words grid is being replaced by a list, so the anomaly disappears without touching the shared utility.

> ⚠️ Naming: there is an unrelated local `WordDetail` in `src/components/PdfReader/WordPanel.tsx`. Do not touch it. Our new file is `WordDetailPanel.tsx` in `src/components/Vocabulary/`.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/hooks/useMediaQuery.ts` | **Create.** Tiny `matchMedia` hook; export `useMediaQuery(query)` + `useIsDesktop()` (`min-width: 1024px`, the Tailwind `lg`). |
| `src/components/Vocabulary/VocabularyRow.tsx` | **Create.** Compact, presentational word row for the list pane. |
| `src/components/Vocabulary/WordDetailPanel.tsx` | **Create.** Presentational detail content extracted from `WordDetail` (definitions/examples/tags/difficulty/stats/speak/regenerate + its toast & edit state). No modal chrome. |
| `src/components/Vocabulary/WordDetail.tsx` | **Modify.** Slim down to a modal wrapper (mobile) that renders `<WordDetailPanel>` inside `modal-box` + backdrop + close button. |
| `src/components/Vocabulary/VocabularyBook.tsx` | **Modify.** Rewrite the words-tab render into the master-detail layout; restyle segmented control; consolidate toolbars; add `useIsDesktop` + auto-select-first. All hooks/handlers/state preserved. |
| `src/components/Vocabulary/VocabularyCard.tsx` | **Delete** at the end (no longer used) — only after confirming no remaining imports. |
| `src/components/SentenceTranslation/SentenceTranslationBook.tsx` | **Modify (light).** Align toolbar/search styling and sticky date-header offset with the new shell. |

---

### Task 1: `useMediaQuery` hook

**Files:**
- Create: `src/hooks/useMediaQuery.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query. SSR-safe-ish: computes the initial value
 * synchronously when `window` is available (this app is a Vite SPA).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True at the Tailwind `lg` breakpoint and up (>= 1024px). */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
```

- [ ] **Step 2: Type-check & lint**

Run: `npm run build && npm run lint`
Expected: PASS (no type errors, no eslint errors).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMediaQuery.ts
git commit -m "feat(hooks): add useMediaQuery / useIsDesktop"
```

---

### Task 2: Extract `WordDetailPanel` and slim `WordDetail` to a modal wrapper

**Files:**
- Create: `src/components/Vocabulary/WordDetailPanel.tsx`
- Modify: `src/components/Vocabulary/WordDetail.tsx`

The goal: move ALL of the current detail body + its state (`word`, `isEditing`, `isRegenerating`, `toast`, `editedTags`, `editedDifficulty`, `newTag`, `handleSave`, `handleAddTag`, `handleRemoveTag`, `tagSuggestions`, `handleSpeak`, `handleRegenerate`) into `WordDetailPanel`. `WordDetail` becomes a thin modal that renders the panel.

- [ ] **Step 1: Create `WordDetailPanel.tsx`**

Paste the full content below. (It is the body of the existing `WordDetail` minus the `.modal`/`.modal-box`/`.modal-backdrop` wrappers and minus the top-right ✕ close button. The outer element is a plain scroll-friendly `div`.)

```tsx
import { useState, useMemo } from "react";
import { useSpeechState } from "../../hooks/useSpeechState";
import { useSettings } from "../../hooks/useSettings";
import { Toast } from "../common/Toast";
import { SpeakerIcon, RefreshIcon } from "../icons";
import type { VocabularyWord } from "../../types/vocabulary";

export interface WordDetailPanelProps {
  word: VocabularyWord;
  onUpdateWord: (
    wordId: string,
    updates: Partial<VocabularyWord>,
  ) => Promise<{ success: boolean; message?: string }>;
  onRegenerateWordDetails: (
    wordId: string,
    word: string,
  ) => Promise<{
    success: boolean;
    message?: string;
    updatedWord?: Partial<VocabularyWord>;
  }>;
  availableTags?: string[];
}

export const WordDetailPanel = ({
  word: initialWord,
  onUpdateWord,
  onRegenerateWordDetails,
  availableTags = [],
}: WordDetailPanelProps) => {
  const { speak } = useSpeechState();
  const { showChineseTranslation, updateShowChineseTranslation } = useSettings();
  const [word, setWord] = useState<VocabularyWord>(initialWord);
  const [isEditing, setIsEditing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [editedTags, setEditedTags] = useState<string[]>([...word.tags]);
  const [editedDifficulty, setEditedDifficulty] = useState(
    word.difficulty || "",
  );
  const [newTag, setNewTag] = useState("");

  const handleSave = async () => {
    const updates = {
      tags: editedTags,
      difficulty: editedDifficulty as "easy" | "medium" | "hard" | undefined,
    };
    const result = await onUpdateWord(word.id!, updates);
    if (!result.success) {
      setToast({ message: result.message || "儲存失敗，請稍後再試", type: "error" });
      return;
    }
    setWord((prev) => ({ ...prev, ...updates }));
    setIsEditing(false);
    setToast({ message: "已儲存標籤與難度", type: "success" });
  };

  const handleAddTag = (tag?: string) => {
    const trimmedTag = (tag ?? newTag).trim();
    if (!trimmedTag) return;
    if (!editedTags.includes(trimmedTag)) {
      setEditedTags((prev) => [...prev, trimmedTag]);
    }
    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditedTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const tagSuggestions = useMemo(() => {
    return availableTags.filter(
      (tag) =>
        !editedTags.includes(tag) &&
        (newTag.trim() === "" || tag.toLowerCase().includes(newTag.toLowerCase())),
    );
  }, [availableTags, editedTags, newTag]);

  const handleRegenerate = async () => {
    if (!word.id || isRegenerating) return;
    setIsRegenerating(true);
    setToast(null);
    try {
      const result = await onRegenerateWordDetails(word.id, word.word);
      if (result.success && result.updatedWord) {
        setWord((prev) => ({ ...prev, ...result.updatedWord }));
        setToast({ message: "已重新生成解釋！", type: "success" });
      } else {
        setToast({ message: result.message || "重新生成失敗", type: "error" });
      }
    } catch {
      setToast({ message: "重新生成時發生錯誤", type: "error" });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="h-full">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight truncate">
              {word.word}
            </h2>
            <button
              type="button"
              onClick={() => speak(word.word)}
              className="btn btn-circle btn-sm btn-ghost shrink-0"
              title="發音"
            >
              <SpeakerIcon />
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="btn btn-circle btn-sm btn-ghost shrink-0"
              title="重新生成解釋"
            >
              {isRegenerating ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <RefreshIcon />
              )}
            </button>
          </div>
          {word.phonetic && (
            <p className="text-lg text-muted-foreground">{word.phonetic}</p>
          )}
        </div>
      </div>

      {/* Tags and Difficulty */}
      <div className="mb-6">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="label">
                <span className="label-text">標籤</span>
              </label>
              {editedTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {editedTags.map((tag) => (
                    <span key={tag} className="badge badge-primary gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-error"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input input-bordered input-sm flex-1"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="輸入標籤後按 Enter 或點擊新增"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddTag()}
                  className="btn btn-sm btn-primary"
                  disabled={!newTag.trim()}
                >
                  新增
                </button>
              </div>
              {tagSuggestions.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground mb-1 block">
                    快速選擇：
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {tagSuggestions.slice(0, 10).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddTag(tag)}
                        className="badge badge-outline badge-sm cursor-pointer hover:badge-primary transition-colors"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="label">
                <span className="label-text">難度</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={editedDifficulty}
                onChange={(e) => setEditedDifficulty(e.target.value)}
              >
                <option value="">未設定</option>
                <option value="easy">簡單</option>
                <option value="medium">中等</option>
                <option value="hard">困難</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleSave} className="btn btn-primary btn-sm">
                儲存
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditedTags([...word.tags]);
                  setEditedDifficulty(word.difficulty || "");
                }}
                className="btn btn-ghost btn-sm"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            {word.difficulty && (
              <span
                className={`badge ${
                  word.difficulty === "easy"
                    ? "badge-success"
                    : word.difficulty === "medium"
                      ? "badge-warning"
                      : "badge-error"
                }`}
              >
                {word.difficulty === "easy"
                  ? "簡單"
                  : word.difficulty === "medium"
                    ? "中等"
                    : "困難"}
              </span>
            )}
            {word.tags.map((tag) => (
              <span key={tag} className="badge badge-outline">
                {tag}
              </span>
            ))}
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="btn btn-ghost btn-xs"
            >
              編輯標籤
            </button>
          </div>
        )}
      </div>

      {/* Definitions */}
      {word.definitions.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg">📖 定義</h3>
            <label className="flex items-center gap-2 cursor-pointer text-sm select-none">
              <span className="text-muted-foreground">顯示中文</span>
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-accent"
                checked={showChineseTranslation}
                onChange={(e) => updateShowChineseTranslation(e.target.checked)}
              />
            </label>
          </div>
          <div className="space-y-3">
            {word.definitions.map((def, index) => (
              <div key={index} className="pl-4 border-l-4 border-accent">
                <div className="flex justify-between items-start gap-2">
                  <p className="font-medium text-accent capitalize mb-1">
                    {def.partOfSpeech}
                  </p>
                  <button
                    type="button"
                    onClick={() => speak(def.definition)}
                    className="btn btn-circle btn-xs btn-ghost shrink-0"
                    title="朗讀定義"
                  >
                    <SpeakerIcon />
                  </button>
                </div>
                <p className="text-base-content">
                  {def.definition || def.definitionChinese}
                </p>
                {showChineseTranslation && def.definitionChinese && def.definition && (
                  <p className="text-muted-foreground text-sm mt-1">
                    {def.definitionChinese}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Examples */}
      {word.examples.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-3">💡 例句</h3>
          <div className="space-y-3">
            {word.examples.map((example, index) => (
              <div
                key={index}
                className="bg-base-200/60 border border-border-hairline p-3 rounded-lg"
              >
                <div className="flex justify-between items-start gap-2 mb-1">
                  <p className="italic flex-1">{example.sentence}</p>
                  <button
                    type="button"
                    onClick={() => speak(example.sentence)}
                    className="btn btn-circle btn-xs btn-ghost shrink-0"
                    title="朗讀例句"
                  >
                    <SpeakerIcon />
                  </button>
                </div>
                {example.translation && (
                  <p className="text-sm text-muted-foreground">{example.translation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats surface-card rounded-xl w-full">
        <div className="stat">
          <div className="stat-title">加入時間</div>
          <div className="stat-value text-lg">
            {new Date(word.createdAt).toLocaleString("zh-TW", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};
```

> Note: the original used inline `<svg>` for speaker/regenerate. We switch to the shared `SpeakerIcon` / `RefreshIcon` from `../icons` (already used elsewhere) to cut duplication. If a verify step shows an icon looks wrong, fall back to the inline svg from the original `WordDetail` — but prefer the shared icons.

- [ ] **Step 2: Rewrite `WordDetail.tsx` as a modal wrapper**

Replace the entire file with:

```tsx
import { WordDetailPanel } from "./WordDetailPanel";
import type { VocabularyWord } from "../../types/vocabulary";

interface WordDetailProps {
  word: VocabularyWord;
  onClose: () => void;
  onUpdateWord: (
    wordId: string,
    updates: Partial<VocabularyWord>,
  ) => Promise<{ success: boolean; message?: string }>;
  onRegenerateWordDetails: (
    wordId: string,
    word: string,
  ) => Promise<{
    success: boolean;
    message?: string;
    updatedWord?: Partial<VocabularyWord>;
  }>;
  availableTags?: string[];
}

/** Mobile / fallback presentation: the word detail inside a modal sheet. */
export const WordDetail = ({
  word,
  onClose,
  onUpdateWord,
  onRegenerateWordDetails,
  availableTags = [],
}: WordDetailProps) => {
  return (
    <div className="modal modal-open modal-bottom sm:modal-middle">
      <div className="modal-box max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border-hairline shadow-floating">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-sm btn-circle absolute right-3 top-3 z-10"
          aria-label="關閉"
        >
          ✕
        </button>
        <WordDetailPanel
          key={word.id}
          word={word}
          onUpdateWord={onUpdateWord}
          onRegenerateWordDetails={onRegenerateWordDetails}
          availableTags={availableTags}
        />
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};
```

- [ ] **Step 3: Type-check & lint**

Run: `npm run build && npm run lint`
Expected: PASS. (`VocabularyBook` still imports and renders `<WordDetail>` exactly as before, so the app is unchanged behaviorally.)

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`, open `/vocabulary`, click a word card → the detail modal still opens, shows definitions/examples/tags, edit-tags + 重新生成 + 發音 still work, ✕ and backdrop close it.

> Sandbox note: if Firebase App Check blocks rendering in a headless/sandbox browser, this is environmental — rely on build + lint here and ask the user to confirm visually.

- [ ] **Step 5: Commit**

```bash
git add src/components/Vocabulary/WordDetailPanel.tsx src/components/Vocabulary/WordDetail.tsx
git commit -m "refactor(vocabulary): extract WordDetailPanel from WordDetail modal"
```

---

### Task 3: `VocabularyRow` list row

**Files:**
- Create: `src/components/Vocabulary/VocabularyRow.tsx`

- [ ] **Step 1: Create the row component**

```tsx
import { motion } from "framer-motion";
import type { VocabularyWord } from "../../types/vocabulary";
import { SpeakerIcon, TrashIcon } from "../icons";
import { useSettings } from "../../hooks/useSettings";

interface VocabularyRowProps {
  word: VocabularyWord;
  isActive: boolean;
  onSelect: () => void;
  onPlay: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

const difficultyDot: Record<string, string> = {
  easy: "bg-success",
  medium: "bg-warning",
  hard: "bg-error",
};

export const VocabularyRow = ({
  word,
  isActive,
  onSelect,
  onPlay,
  onDelete,
}: VocabularyRowProps) => {
  const { showChineseTranslation } = useSettings();
  const def = word.definitions[0];
  const previewDef = def
    ? showChineseTranslation && def.definitionChinese
      ? def.definitionChinese
      : def.definition || def.definitionChinese
    : "";

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onSelect}
      aria-current={isActive ? "true" : undefined}
      className={`group flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left transition-colors ${
        isActive
          ? "bg-accent-tint text-accent"
          : "hover:bg-base-content/5"
      }`}
    >
      {word.emoji && (
        <span className="text-lg leading-6 shrink-0" role="img" aria-label={word.word}>
          {word.emoji}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {word.difficulty && (
            <span
              className={`size-1.5 shrink-0 rounded-full ${
                difficultyDot[word.difficulty] ?? "bg-base-content/30"
              }`}
              title={word.difficulty}
            />
          )}
          <span className="truncate text-sm font-semibold tracking-tight">
            {word.word}
          </span>
          {word.phonetic && (
            <span className="truncate text-xs text-muted-foreground font-serif italic">
              {word.phonetic}
            </span>
          )}
        </span>
        {previewDef && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {def?.partOfSpeech ? (
              <span className="mr-1 uppercase tracking-wider text-[10px] text-muted-foreground/70">
                {def.partOfSpeech}
              </span>
            ) : null}
            {previewDef}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <span
          role="button"
          tabIndex={-1}
          onClick={onPlay}
          className="btn btn-ghost btn-xs btn-circle text-accent/70 hover:text-accent"
          title="播放發音"
        >
          <SpeakerIcon />
        </span>
        <span
          role="button"
          tabIndex={-1}
          onClick={onDelete}
          className="btn btn-ghost btn-xs btn-circle text-error/60 hover:text-error"
          title="刪除單字"
        >
          <TrashIcon className="h-4 w-4" />
        </span>
      </span>
    </motion.button>
  );
};
```

> Why `role="button"` spans instead of nested `<button>`: a `<button>` cannot legally contain another `<button>`. The row itself is the button; the play/delete affordances are click targets inside it that `stopPropagation` (the parent passes handlers that already call `e.stopPropagation()`).

- [ ] **Step 2: Type-check & lint**

Run: `npm run build && npm run lint`
Expected: PASS. (Unused-export is fine; it's wired up in Task 4.)

- [ ] **Step 3: Commit**

```bash
git add src/components/Vocabulary/VocabularyRow.tsx
git commit -m "feat(vocabulary): add compact VocabularyRow for master-detail list"
```

---

### Task 4: Rebuild the words tab as master-detail in `VocabularyBook`

**Files:**
- Modify: `src/components/Vocabulary/VocabularyBook.tsx`

**Preserve unchanged:** every hook call, all state, and all handlers (`handleManualSubmit`, `handleOpenReviewSettings`, `handleStartReview`, `handleFilterChange`, `handleDelete`, `confirmDelete`, `cancelDelete`, `handleLoadMore`, `handleUpdateWord`, search effect, `wordGroups` memo, `loadMoreRef` + IntersectionObserver effect, the `isReviewMode` early-return with `<FlashcardMode>`, `<ReviewSettingsModal>`, `<ConfirmModal>`, `<Toast>`). Only the imports, two small additions, and the **return JSX** change.

- [ ] **Step 1: Update imports**

Remove the `VocabularyCard` import. Add `VocabularyRow`, `WordDetailPanel`, and `useIsDesktop`. The top import block should include:

```tsx
import { VocabularyRow } from "./VocabularyRow";
import { WordDetailPanel } from "./WordDetailPanel";
import { useIsDesktop } from "../../hooks/useMediaQuery";
```

and the line `import { VocabularyCard } from "../Vocabulary/VocabularyCard";` must be deleted. Keep `import { WordDetail } from "../Vocabulary/WordDetail";` (used for the mobile modal).

- [ ] **Step 2: Add desktop detection + auto-select effect**

Just after the existing `const { speak } = useSpeechState();` line, add:

```tsx
  const isDesktop = useIsDesktop();
```

Then, after the `wordGroups` memo (just before the `isReviewMode` early return), add an effect that keeps a word selected on desktop so the detail pane is never empty:

```tsx
  // Desktop master-detail: keep a word selected so the detail pane isn't empty.
  useEffect(() => {
    if (!isDesktop) return;
    if (selectedWord) return;
    if (searchResults === null && words.length > 0) {
      setSelectedWord(words[0]);
    }
  }, [isDesktop, selectedWord, searchResults, words]);
```

- [ ] **Step 3: Replace the component's `return (...)` JSX**

Replace everything from `return (` (the main return, ~line 390, NOT the `isReviewMode` return) down to the matching closing `);` at end of component with the block below. Handler/state names referenced here all already exist in the file.

```tsx
  // Words currently shown in the list pane (search results or date groups).
  const showingSearch = searchResults !== null;

  return (
    <div className="flex h-[calc(100dvh-3.5rem-2rem)] flex-col md:h-[calc(100dvh-3.5rem-3rem)]">
      {toastMessage && (
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      <ReviewSettingsModal
        isOpen={showReviewSettings}
        onClose={() => setShowReviewSettings(false)}
        onStart={handleStartReview}
        totalWords={totalWordCount}
        availableTags={availableTags}
        isLoading={isLoadingReview}
      />

      {/* Segmented control */}
      <div className="mb-4 flex shrink-0 gap-1 rounded-xl surface-card p-1">
        <button
          type="button"
          className={`h-10 flex-1 rounded-lg text-sm font-medium transition-all active:scale-[0.98] ${
            activeTab === "words"
              ? "bg-primary text-primary-content shadow-soft"
              : "text-muted-foreground hover:bg-accent-tint hover:text-accent"
          }`}
          onClick={() => setActiveTab("words")}
        >
          📖 單字
        </button>
        <button
          type="button"
          className={`h-10 flex-1 rounded-lg text-sm font-medium transition-all active:scale-[0.98] ${
            activeTab === "sentences"
              ? "bg-primary text-primary-content shadow-soft"
              : "text-muted-foreground hover:bg-accent-tint hover:text-accent"
          }`}
          onClick={() => setActiveTab("sentences")}
        >
          🌐 句子翻譯
        </button>
      </div>

      {/* WORDS TAB */}
      {activeTab === "words" && (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-6">
          {/* List pane */}
          <aside className="flex min-h-0 flex-col lg:w-72 lg:shrink-0 xl:w-80 2xl:w-96">
            {/* Compact toolbar */}
            <div className="shrink-0 space-y-2">
              <form className="flex gap-2" onSubmit={handleManualSubmit}>
                <input
                  id={manualWordFieldId}
                  type="text"
                  placeholder="手動新增英文單字"
                  className="input input-bordered input-sm min-w-0 flex-1"
                  value={manualWord}
                  onChange={(e) => setManualWord(e.target.value)}
                  disabled={isAddingManualWord}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm active:scale-[0.98]"
                  disabled={isAddingManualWord || isAdding || manualWord.trim().length === 0}
                >
                  {isAddingManualWord || isAdding ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    "新增"
                  )}
                </button>
              </form>

              <div className="relative">
                <input
                  type="text"
                  placeholder="搜尋單字..."
                  className="input input-bordered input-sm w-full pr-16"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery.trim() && (
                  <div className="absolute inset-y-0 right-2 flex items-center gap-1 text-xs text-muted-foreground">
                    {isSearching && <span className="loading loading-spinner loading-xs" />}
                    <span>{isSearching ? "更新中" : `${searchResults?.length ?? 0}`}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="select select-bordered select-sm min-w-0 flex-1"
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange("sortBy", e.target.value)}
                >
                  <option value="createdAt">加入時間</option>
                  <option value="word">字母順序</option>
                </select>
                <select
                  className="select select-bordered select-sm min-w-0 flex-1"
                  value={filters.sortOrder}
                  onChange={(e) => handleFilterChange("sortOrder", e.target.value)}
                >
                  <option value="desc">降序</option>
                  <option value="asc">升序</option>
                </select>
                {words.length > 0 && !loading && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm shrink-0 active:scale-[0.98]"
                    onClick={handleOpenReviewSettings}
                    disabled={isLoadingReview}
                    title="開始複習"
                  >
                    {isLoadingReview ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      "複習"
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable list */}
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-hide">
              {/* Initial loading */}
              {loading && words.length === 0 && (
                <div className="space-y-2 py-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-lg bg-base-300/60 animate-pulse" />
                  ))}
                </div>
              )}

              {/* Empty: no words at all */}
              {!loading && !showingSearch && words.length === 0 && (
                <div className="rounded-xl surface-card p-6 text-center">
                  <div className="mb-2 text-4xl">📖</div>
                  <p className="text-sm text-muted-foreground">
                    還沒有收藏的單字。在閱讀 PDF 時選取單字加入生詞本，或用上方輸入框手動新增。
                  </p>
                </div>
              )}

              {/* Search results as rows */}
              {!loading && showingSearch && (
                <div className="space-y-1">
                  {searchResults!.length === 0 ? (
                    <div className="rounded-xl surface-card p-6 text-center">
                      <div className="mb-2 text-3xl">🔍</div>
                      <p className="text-sm text-muted-foreground">
                        找不到符合「{debouncedSearchQuery || searchQuery.trim()}」的單字
                      </p>
                    </div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {searchResults!.map((word) => (
                        <VocabularyRow
                          key={word.id}
                          word={word}
                          isActive={selectedWord?.id === word.id}
                          onSelect={() => setSelectedWord(word)}
                          onPlay={(e) => {
                            e.stopPropagation();
                            speak(word.word);
                          }}
                          onDelete={(e) => {
                            e.stopPropagation();
                            handleDelete(word.id!);
                          }}
                        />
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              )}

              {/* Date groups as rows */}
              {!loading && !showingSearch && words.length > 0 && (
                <div className="space-y-4">
                  {Object.entries(wordGroups).map(([date, groupWords]) => (
                    <div key={date}>
                      <h2 className="sticky top-0 z-10 mb-1 flex items-center gap-2 rounded-lg toolbar px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-accent/60" />
                        {date}
                        <span className="rounded-full bg-base-200 px-1.5 py-0.5 text-[10px] font-normal">
                          {groupWords.length}
                        </span>
                      </h2>
                      <div className="space-y-1">
                        <AnimatePresence mode="popLayout">
                          {groupWords.map((word) => (
                            <VocabularyRow
                              key={word.id}
                              word={word}
                              isActive={selectedWord?.id === word.id}
                              onSelect={() => setSelectedWord(word)}
                              onPlay={(e) => {
                                e.stopPropagation();
                                speak(word.word);
                              }}
                              onDelete={(e) => {
                                e.stopPropagation();
                                handleDelete(word.id!);
                              }}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  ))}
                  <div ref={loadMoreRef} className="py-4 text-center">
                    {hasMore && isLoadingMore && (
                      <span className="loading loading-spinner loading-md text-primary" />
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Detail pane (desktop only) */}
          <section className="hidden min-h-0 flex-1 overflow-y-auto rounded-2xl surface-card p-6 lg:block">
            {selectedWord ? (
              <WordDetailPanel
                key={selectedWord.id}
                word={selectedWord}
                onUpdateWord={handleUpdateWord}
                onRegenerateWordDetails={regenerateWordDetails}
                availableTags={availableTags}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <div className="mb-3 text-5xl">📖</div>
                <p className="text-sm">選擇一個單字以查看詳情</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* SENTENCES TAB */}
      {activeTab === "sentences" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SentenceTranslationBook embedded />
        </div>
      )}

      {/* Mobile / tablet: detail as a modal sheet */}
      {!isDesktop && selectedWord && (
        <WordDetail
          word={selectedWord}
          onClose={() => setSelectedWord(null)}
          onUpdateWord={handleUpdateWord}
          onRegenerateWordDetails={regenerateWordDetails}
          availableTags={availableTags}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={deleteWordId !== null}
        title="刪除單字"
        message="確定要刪除這個單字嗎？此操作無法復原。"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        confirmText="刪除"
        cancelText="取消"
        confirmVariant="error"
        isLoading={isDeleting}
      />
    </div>
  );
```

- [ ] **Step 4: Type-check & lint**

Run: `npm run build && npm run lint`
Expected: PASS. If eslint flags `searchResults!` non-null assertions, they are guarded by the surrounding `showingSearch`/length checks; keep them. If the project's eslint forbids `!`, replace `searchResults!` with a locally narrowed `const results = searchResults ?? [];` above the JSX and map over `results`.

- [ ] **Step 5: Manual verification (desktop)**

Run `npm run dev`, open `/vocabulary` at a wide window (≥1024px):
- Two columns: list left, detail right. First word auto-selected; detail populated.
- Clicking a row highlights it and updates the detail pane. **No giant full-width cards** — rows are uniform height regardless of how many are in a date group (the original bug is gone).
- Search filters the list to rows; sort changes order; 複習 opens the review modal; 手動新增 adds a word; delete (hover a row) → confirm → removed.
- Scroll the list to the bottom → infinite scroll loads more.

- [ ] **Step 6: Manual verification (mobile)**

Resize to < 1024px (or device toolbar):
- Single column list; detail pane hidden. Tapping a row opens the detail **modal sheet**; ✕/backdrop closes it.
- Segmented control still switches 單字 / 句子翻譯.

- [ ] **Step 7: Commit**

```bash
git add src/components/Vocabulary/VocabularyBook.tsx
git commit -m "feat(vocabulary): redesign words tab as macOS master-detail"
```

---

### Task 5: Light style-align the sentences tab

**Files:**
- Modify: `src/components/SentenceTranslation/SentenceTranslationBook.tsx`

Goal: it now lives inside the words page's scroll container (`overflow-y-auto`). Its sticky date headers use `top-14`, which assumes document scroll; inside the new scroll container they should stick to the container top.

- [ ] **Step 1: Fix sticky date-header offset**

In `SentenceTranslationBook.tsx` find the date header (currently around line 264):

```tsx
<h2 className="text-sm font-medium text-muted-foreground mb-3 sticky top-14 toolbar rounded-lg py-2 -mx-2 px-2 z-10">
```

Change `top-14` to `top-0`:

```tsx
<h2 className="text-sm font-medium text-muted-foreground mb-3 sticky top-0 toolbar rounded-lg py-2 -mx-2 px-2 z-10">
```

- [ ] **Step 2: Type-check, lint, manual**

Run: `npm run build && npm run lint`
Expected: PASS.
Manual: on `/vocabulary` → 句子翻譯 tab, scroll; date headers stick to the top of the list area without a gap, manual-add + search + delete still work.

- [ ] **Step 3: Commit**

```bash
git add src/components/SentenceTranslation/SentenceTranslationBook.tsx
git commit -m "style(sentences): stick date headers to scroll container in vocab shell"
```

---

### Task 6: Remove the now-unused `VocabularyCard` + final pass

**Files:**
- Delete: `src/components/Vocabulary/VocabularyCard.tsx`

- [ ] **Step 1: Confirm no remaining references**

Run: `grep -rn "VocabularyCard" src`
Expected: no matches (the import was removed in Task 4). If any remain, fix them before deleting.

- [ ] **Step 2: Delete the file**

```bash
git rm src/components/Vocabulary/VocabularyCard.tsx
```

- [ ] **Step 3: Full type-check + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 4: Final manual sweep**

`/vocabulary` desktop + mobile: both tabs, selection, search, sort, review, add, delete, edit-tags, regenerate, speak, infinite scroll, empty states. Confirm the card-size anomaly is gone and the page visually matches the new sidebar shell.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(vocabulary): remove unused VocabularyCard"
```

---

## Self-Review

**Spec coverage:**
- Master-detail words tab → Task 4. ✅
- Sentences single-column, restyled → Task 5. ✅
- Card-size anomaly fixed (grid → list; `.auto-grid` untouched) → Task 4 + ⚠️ note. ✅
- `WordDetailPanel` extraction, reused by desktop pane + mobile modal → Tasks 2 & 4. ✅
- Responsive: two-pane `lg+`, list+sheet below → Task 4 (Steps 5–6). ✅
- Toolbar consolidation; remove `max-w-7xl` → Task 4. ✅
- No data-layer changes → all hooks/handlers preserved (Task 4 preamble). ✅
- Desktop auto-select-first → Task 4 Step 2. ✅
- Component/file changes table matches Tasks 1–6. ✅

**Placeholder scan:** No TBD/TODO; every code step has full code; commands have expected output. ✅

**Type consistency:** `WordDetailPanelProps` (Task 2) is consumed identically in Task 4 (`word`, `onUpdateWord`, `onRegenerateWordDetails`, `availableTags`). `VocabularyRowProps` (Task 3) matches its usage in Task 4 (`word`, `isActive`, `onSelect`, `onPlay`, `onDelete`). `useIsDesktop` (Task 1) matches import/use in Task 4. ✅

**Known fragility to verify during execution:** the `h-[calc(100dvh-3.5rem-3rem)]` height assumes the app shell's header `h-14` (3.5rem) and the main wrapper's vertical padding (`py-4` base = 2rem, `md:py-6` = 3rem). If the detail/list panes show an unexpected outer scrollbar, re-check these constants against `src/App.tsx` (header height) and the `<main>` wrapper padding, and adjust the calc. Verify visually in Task 4 Step 5.
