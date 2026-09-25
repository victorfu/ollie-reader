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
