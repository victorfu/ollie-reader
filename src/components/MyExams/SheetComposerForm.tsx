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
