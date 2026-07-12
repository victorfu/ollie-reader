import { useState } from "react";
import { FileText, NotebookPen, Play, RotateCcw } from "lucide-react";
import type {
  ExamPaper,
  ExamScope,
  ExamScopeId,
  ExamScopeProgress,
  ExamSessionMode,
  ExamSubject,
} from "../../types/exam";
import { findQuestionsByIds, listScopes } from "../../data/exams";
import { ConfirmModal } from "../common/ConfirmModal";
import {
  clearSubjectProgress,
  readScopeProgress,
} from "./examProgressStorage";

const SUBJECTS: { id: ExamSubject; label: string }[] = [
  { id: "chinese", label: "國語" },
  { id: "math", label: "數學" },
  { id: "english", label: "英文" },
];

interface ExamHubProps {
  paper: ExamPaper;
  subject: ExamSubject;
  onSelectSubject: (subject: ExamSubject) => void;
  onStart: (scopeId: ExamScopeId, mode?: ExamSessionMode) => void;
}

interface ScopeEntry {
  scope: ExamScope;
  progress: ExamScopeProgress | null;
  retryCount: number;
}

export function ExamHub({ paper, subject, onSelectSubject, onStart }: ExamHubProps) {
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const entries: ScopeEntry[] = listScopes(paper).map((scope) => {
    const progress = readScopeProgress(subject, scope.id);
    const retryCount = progress
      ? findQuestionsByIds(paper, progress.lastWrongIds).length
      : 0;
    return { scope, progress, retryCount };
  });
  const hasProgress = entries.some(({ progress }) => progress !== null);

  const handleResetProgress = () => {
    clearSubjectProgress(subject);
    setIsResetConfirmOpen(false);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 科別切換 */}
      <div className="flex justify-center">
        <div
          role="group"
          aria-label="選擇考科"
          className="inline-flex rounded-full border border-border-hairline bg-card p-1 shadow-soft"
        >
          {SUBJECTS.map((item) => {
            const isActive = item.id === subject;
            return (
              <button
                key={item.id}
                aria-pressed={isActive}
                onClick={() => onSelectSubject(item.id)}
                className={`min-h-[44px] rounded-full px-6 text-sm font-semibold transition-all active:scale-[0.98] sm:px-8 ${
                  isActive
                    ? "bg-accent text-white shadow-sm"
                    : "text-muted-foreground hover:bg-accent/10"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 卷名 + 紙本連結 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold tracking-tight">{paper.title}</h2>
        <div className="flex items-center gap-1">
          {paper.questionPdf && (
            <a
              href={encodeURI(paper.questionPdf)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm gap-1.5 rounded-full"
            >
              <FileText size={16} strokeWidth={1.75} />
              {paper.questionPdfLabel ?? "題目卷"}
            </a>
          )}
          {paper.answerPdf && paper.answerPdfLabel && (
            <a
              href={encodeURI(paper.answerPdf)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm gap-1.5 rounded-full"
            >
              <NotebookPen size={16} strokeWidth={1.75} />
              {paper.answerPdfLabel}
            </a>
          )}
          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            disabled={!hasProgress}
            className="btn btn-error btn-outline btn-sm gap-1.5 rounded-full"
          >
            <RotateCcw size={16} strokeWidth={1.75} />
            重設進度
          </button>
        </div>
      </div>

      {/* 範圍卡片 */}
      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map(({ scope, progress, retryCount }) => {
          const hasBest = progress !== null && progress.bestTotal > 0;
          return (
            <article
              key={scope.id}
              className="flex flex-col gap-3 rounded-xl border border-border-hairline bg-card p-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold">{scope.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {scope.subtitle ?? `共 ${scope.questionCount} 題`}
                  </p>
                </div>
                <span className="rounded-full bg-accent-tint px-2.5 py-1 text-xs font-semibold text-accent">
                  {scope.questionCount} 題
                </span>
              </div>

              <p className="text-sm text-muted-foreground">
                {hasBest ? (
                  <>
                    最佳成績{" "}
                    <span className="font-semibold text-foreground">
                      {progress.bestScore} / {progress.bestTotal}
                    </span>
                    {progress.bestScore === progress.bestTotal && " 🏆"}
                  </>
                ) : (
                  "尚未挑戰"
                )}
              </p>

              <div className="mt-auto flex flex-wrap gap-2">
                <button
                  onClick={() => onStart(scope.id)}
                  className="btn btn-primary btn-sm min-h-[44px] flex-1 gap-1.5 rounded-lg"
                >
                  <Play size={16} strokeWidth={2} />
                  開始練習
                </button>
                {retryCount > 0 && (
                  <button
                    onClick={() => onStart(scope.id, "retry")}
                    className="btn btn-outline btn-sm min-h-[44px] flex-1 gap-1.5 rounded-lg"
                  >
                    <RotateCcw size={16} strokeWidth={2} />
                    錯題重練（{retryCount}）
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        答完每一題會立即顯示對錯{paper.subject === "math" ? "" : "與解析"}
        ，可以重複練習到全對為止！
      </p>

      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title={`重設${paper.title}進度？`}
        message={`將清除${paper.title}所有區段與完整測驗的最佳成績、最近成績及錯題紀錄；其他科目不受影響，且無法復原。`}
        confirmText="重設進度"
        cancelText="取消"
        confirmVariant="error"
        onConfirm={handleResetProgress}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
}
