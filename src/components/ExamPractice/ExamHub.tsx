import { useState } from "react";
import { FileText, NotebookPen, Play, RotateCcw } from "lucide-react";
import type {
  ExamPaper,
  ExamScope,
  ExamScopeId,
  ExamScopeProgress,
  ExamSessionMode,
  ExamSubject,
  ExamTab,
} from "../../types/exam";
import { findQuestionsByIds, listScopes } from "../../data/exams";
import { useLanguage } from "../../hooks/useLanguage";
import { ConfirmModal } from "../common/ConfirmModal";
import { T } from "../common/T";
import { ExamSubjectSwitcher } from "./ExamSubjectSwitcher";
import {
  clearSubjectProgress,
  readScopeProgress,
} from "./examProgressStorage";
import {
  paperTitle,
  paperTitleKey,
  pdfLabelKey,
  scopeSubtitleMessage,
  scopeTitleKey,
} from "./examUi";

interface ExamHubProps {
  paper: ExamPaper;
  subject: ExamSubject;
  onSelectSubject: (tab: ExamTab) => void;
  onStart: (scopeId: ExamScopeId, mode?: ExamSessionMode) => void;
}

interface ScopeEntry {
  scope: ExamScope;
  progress: ExamScopeProgress | null;
  retryCount: number;
}

export function ExamHub({ paper, subject, onSelectSubject, onStart }: ExamHubProps) {
  const { t } = useLanguage();
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const title = paperTitle(paper, t);
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

  const titleKey = paperTitleKey(paper);

  /** 資料值標籤:有對應 key 就翻譯,否則原樣顯示。 */
  const pdfLinkLabel = (label: string) => {
    const key = pdfLabelKey(label);
    return key ? <T k={key} /> : label;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 科別切換 */}
      <ExamSubjectSwitcher value={subject} onSelect={onSelectSubject} />

      {/* 卷名 + 紙本連結 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold tracking-tight">
          {titleKey ? <T k={titleKey} /> : paper.title}
        </h2>
        <div className="flex items-center gap-1">
          {paper.questionPdf && (
            <a
              href={encodeURI(paper.questionPdf)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm min-h-[44px] gap-1.5 rounded-full"
            >
              <FileText size={16} strokeWidth={1.75} />
              {paper.questionPdfLabel ? (
                pdfLinkLabel(paper.questionPdfLabel)
              ) : (
                <T k="exams.pdf.questionPaper" />
              )}
            </a>
          )}
          {paper.answerPdf && paper.answerPdfLabel && (
            <a
              href={encodeURI(paper.answerPdf)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm min-h-[44px] gap-1.5 rounded-full"
            >
              <NotebookPen size={16} strokeWidth={1.75} />
              {pdfLinkLabel(paper.answerPdfLabel)}
            </a>
          )}
          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            disabled={!hasProgress}
            className="btn btn-error btn-outline btn-sm min-h-[44px] gap-1.5 rounded-full"
          >
            <RotateCcw size={16} strokeWidth={1.75} />
            <T k="exams.hub.resetProgress" />
          </button>
        </div>
      </div>

      {/* 範圍卡片 */}
      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map(({ scope, progress, retryCount }) => {
          const hasBest = progress !== null && progress.bestTotal > 0;
          const scopeKey = scopeTitleKey(scope.id);
          const subtitle = scope.subtitle
            ? scopeSubtitleMessage(scope.subtitle)
            : null;
          return (
            <article
              key={scope.id}
              className="flex flex-col gap-3 rounded-xl border border-border-hairline bg-card p-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold">
                    {scopeKey ? (
                      <T k={scopeKey} />
                    ) : (
                      scope.title
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {subtitle ? (
                      <T k={subtitle.k} params={subtitle.params} />
                    ) : (
                      (scope.subtitle ?? (
                        <T
                          k="exams.hub.totalQuestions"
                          params={{ n: scope.questionCount }}
                        />
                      ))
                    )}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-accent-tint px-2.5 py-1 text-xs font-semibold text-accent">
                  <T
                    k="exams.hub.questionCount"
                    params={{ n: scope.questionCount }}
                  />
                </span>
              </div>

              <p className="text-sm text-muted-foreground">
                {hasBest ? (
                  <>
                    <T k="exams.hub.bestScore" />{" "}
                    <span className="font-semibold text-foreground">
                      {progress.bestScore} / {progress.bestTotal}
                    </span>
                    {progress.bestScore === progress.bestTotal && " 🏆"}
                  </>
                ) : (
                  <T k="exams.hub.notTried" />
                )}
              </p>

              <div className="mt-auto flex flex-wrap gap-2">
                <button
                  onClick={() => onStart(scope.id)}
                  className="btn btn-primary btn-sm min-h-[44px] flex-1 gap-1.5 rounded-lg"
                >
                  <Play size={16} strokeWidth={2} />
                  <T k="exams.hub.start" />
                </button>
                {retryCount > 0 && (
                  <button
                    onClick={() => onStart(scope.id, "retry")}
                    className="btn btn-outline btn-sm min-h-[44px] flex-1 gap-1.5 rounded-lg"
                  >
                    <RotateCcw size={16} strokeWidth={2} />
                    <T
                      k="exams.hub.retryWrong"
                      params={{ n: retryCount }}
                    />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        <T
          k={
            paper.subject === "math"
              ? "exams.hub.footerNoExplanation"
              : "exams.hub.footer"
          }
        />
      </p>

      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title={t("exams.hub.resetTitle", { title })}
        message={t("exams.hub.resetMessage", { title })}
        confirmText={t("exams.hub.resetConfirm")}
        cancelText={t("common.cancel")}
        confirmVariant="error"
        onConfirm={handleResetProgress}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
}
