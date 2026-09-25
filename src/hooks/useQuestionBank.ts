import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import {
  BANK_QUESTIONS_COLLECTION,
  EXAM_SHEETS_COLLECTION,
  QUESTION_SOURCES_COLLECTION,
} from "../constants/questionBank";
import { listBankQuestions } from "../services/bankQuestionService";
import { listSheets } from "../services/examSheetService";
import { listSources } from "../services/questionSourceService";
import type { BankQuestion, ExamSheet, QuestionSource } from "../types/questionBank";
import { logger } from "../utils/logger";

interface QuestionBankState {
  sources: QuestionSource[];
  questions: BankQuestion[];
  sheets: ExamSheet[];
  loading: boolean;
  error: string | null;
}

function logIfRejected(collection: string, result: PromiseSettledResult<unknown>): void {
  if (result.status === "rejected") {
    logger.error(`[useQuestionBank] ${collection} load failed`, result.reason);
  }
}

export function useQuestionBank() {
  const { user } = useAuth();
  const [state, setState] = useState<QuestionBankState>({
    sources: [],
    questions: [],
    sheets: [],
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // 用 allSettled 讓每個失敗都各自記錄：缺 index 時錯誤訊息附有建立連結，
    // Promise.all 只回報第一個失敗，其餘的連結會被吞掉。
    Promise.allSettled([listSources(), listBankQuestions(), listSheets()]).then(
      ([sources, questions, sheets]) => {
        logIfRejected(QUESTION_SOURCES_COLLECTION, sources);
        logIfRejected(BANK_QUESTIONS_COLLECTION, questions);
        logIfRejected(EXAM_SHEETS_COLLECTION, sheets);
        if (cancelled) return;
        if (
          sources.status === "rejected" ||
          questions.status === "rejected" ||
          sheets.status === "rejected"
        ) {
          setState((previous) => ({ ...previous, loading: false, error: "讀取題庫失敗" }));
          return;
        }
        setState({
          sources: sources.value,
          questions: questions.value,
          sheets: sheets.value,
          loading: false,
          error: null,
        });
      },
    );
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
