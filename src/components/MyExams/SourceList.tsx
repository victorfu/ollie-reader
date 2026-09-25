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
