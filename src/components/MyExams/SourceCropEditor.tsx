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
