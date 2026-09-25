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
