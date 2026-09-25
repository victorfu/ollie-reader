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
