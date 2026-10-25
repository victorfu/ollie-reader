import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./useAuth";
import type { CefrInfo, CefrLevel } from "../types/wordPractice";
import { loadPracticeState } from "../services/wordPracticeStorage";
import { loadCefrTable, resolveCefr, type CefrTable } from "../utils/cefr";
import { logger } from "../utils/logger";

export interface UseCefrLevels {
  /** True once the word list and (when signed in) the stored estimates have both loaded. */
  ready: boolean;
  /**
   * The CEFR level of a word, or null when it is not graded (or nothing has
   * loaded yet). Changes identity whenever the loaded data changes, so
   * memoized rows re-render exactly when a level can have changed.
   */
  levelOf: (word: string) => CefrInfo | null;
}

interface LoadedEstimates {
  uid: string;
  estimates: Record<string, CefrLevel>;
}

const NO_TABLE: CefrTable = new Map();
const NO_ESTIMATES: Record<string, CefrLevel> = {};

/**
 * CEFR levels for the vocabulary book: the bundled word list and the AI
 * estimates stored earlier. It never writes and never asks Gemini for a
 * level, because that would compete with lookups and translations for the
 * shared request quota. Reading the practice state converts an old
 * (pre-homework-book) state document once, on its first read
 * (`loadPracticeState`). A word that is in neither source has no level.
 *
 * A failed load is logged and never thrown into render: without the word list
 * `ready` stays false and only stored estimates are used; without the stored
 * estimates only list levels are used.
 */
export function useCefrLevels(): UseCefrLevels {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [table, setTable] = useState<CefrTable | null>(null);
  const [loaded, setLoaded] = useState<LoadedEstimates | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCefrTable()
      .then((loadedTable) => {
        if (!cancelled) setTable(loadedTable);
      })
      .catch((error: unknown) => {
        logger.error("Failed to load the CEFR word list:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    loadPracticeState(uid)
      .then((state) => {
        if (!cancelled) setLoaded({ uid, estimates: state.cefrEstimates });
      })
      .catch((error: unknown) => {
        logger.error("Failed to load stored CEFR estimates:", error);
        if (!cancelled) setLoaded({ uid, estimates: NO_ESTIMATES });
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Estimates belong to the user they were loaded for.
  const estimatesSettled = uid === null || loaded?.uid === uid;
  const estimates = loaded !== null && loaded.uid === uid ? loaded.estimates : NO_ESTIMATES;

  const levelOf = useMemo(() => {
    const wordList = table ?? NO_TABLE;
    return (word: string): CefrInfo | null => resolveCefr(wordList, estimates, word);
  }, [table, estimates]);

  return { ready: table !== null && estimatesSettled, levelOf };
}
