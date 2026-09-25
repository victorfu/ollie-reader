import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listBankQuestions } from "../services/bankQuestionService";
import { listSources } from "../services/questionSourceService";
import type { BankQuestion, QuestionSource } from "../types/questionBank";
import { logger } from "../utils/logger";

interface QuestionBankState {
  sources: QuestionSource[];
  questions: BankQuestion[];
  loading: boolean;
  error: string | null;
}

export function useQuestionBank() {
  const { user } = useAuth();
  const [state, setState] = useState<QuestionBankState>({
    sources: [],
    questions: [],
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([listSources(), listBankQuestions()])
      .then(([sources, questions]) => {
        if (!cancelled) setState({ sources, questions, loading: false, error: null });
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
