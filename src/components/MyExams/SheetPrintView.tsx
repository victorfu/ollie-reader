import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { useSignedPageUrls } from "../../hooks/useSignedPageUrls";
import { PrintPaper, type PrintItem } from "./PrintPaper";
import { PrintToolbar } from "./PrintToolbar";
import {
  PRINT_SCALE_FACTORS,
  readPrintPreferences,
  writePrintPreferences,
  type PrintPreferences,
} from "./printSettings";
import { resolveSheetQuestions } from "./sheetComposition";

export default function SheetPrintView() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const bank = useQuestionBank();
  const [preferences, setPreferences] = useState<PrintPreferences>(readPrintPreferences);
  const [loadedKeys, setLoadedKeys] = useState<ReadonlySet<string>>(() => new Set());

  const sheet = bank.sheets.find((item) => item.id === id);
  const sourceById = useMemo(() => new Map(bank.sources.map((source) => [source.id, source])), [bank.sources]);
  const { items, missingCount } = useMemo(() => {
    if (!sheet) return { items: [] as PrintItem[], missingCount: 0 };
    const validBank = bank.questions.filter((question) => sourceById.has(question.sourceId));
    const resolved = resolveSheetQuestions(sheet.questionIds, validBank);
    return {
      items: resolved.questions.map((question) => ({
        question,
        pages: sourceById.get(question.sourceId)?.pages ?? [],
      })),
      missingCount: resolved.missingCount,
    };
  }, [sheet, bank.questions, sourceById]);

  const regionKeys = items.flatMap(({ question, pages }) =>
    question.regions.flatMap((region, regionIndex) =>
      pages[region.pageIndex] ? [`${question.id}:${regionIndex}`] : [],
    ),
  );
  const paths = items.flatMap(({ question, pages }) =>
    question.regions.flatMap((region) => {
      const page = pages[region.pageIndex];
      return page ? [page.storagePath] : [];
    }),
  );
  const { urls, refresh } = useSignedPageUrls(paths);
  const loadedCount = regionKeys.filter((key) => loadedKeys.has(key)).length;
  const hasAnswers = items.some(({ question }) => Boolean(question.answer));

  const updatePreferences = (next: PrintPreferences) => {
    setPreferences(next);
    writePrintPreferences(next);
  };

  const markLoaded = (key: string) =>
    setLoadedKeys((previous) => (previous.has(key) ? previous : new Set(previous).add(key)));

  const back = () => navigate("/my-exams?tab=sheets");

  if (bank.loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg" aria-label="載入考卷" />
      </div>
    );
  }

  if (bank.error || !sheet) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-base-200">
        <p className="text-base-content/70">{bank.error ?? "找不到這份資料。"}</p>
        <button type="button" className="btn btn-sm" onClick={back}>
          返回自製考卷
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-base-200 pb-8 print:bg-white print:pb-0">
      <PrintToolbar
        onBack={back}
        onPrint={() => window.print()}
        loadedCount={loadedCount}
        totalCount={regionKeys.length}
        preferences={preferences}
        onChange={updatePreferences}
        hasAnswers={hasAnswers}
        missingCount={missingCount}
      />
      <div className="mx-auto w-fit max-w-full bg-white px-4 py-6 shadow-lg print:p-0 print:shadow-none">
        <PrintPaper
          title={sheet.title}
          items={items}
          urls={urls}
          scale={PRINT_SCALE_FACTORS[preferences.scale]}
          enhance={preferences.enhance}
          includeAnswers={hasAnswers && preferences.includeAnswers}
          onImageLoad={markLoaded}
          onRetryImage={(path) => void refresh(path)}
        />
      </div>
    </div>
  );
}
