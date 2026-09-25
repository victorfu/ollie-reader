import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { resolveSheetQuestions } from "./sheetComposition";
import { SheetComposerForm } from "./SheetComposerForm";

export default function SheetComposerPage() {
  const { id } = useParams();
  const bank = useQuestionBank();

  // 來源已刪除的題目不應存在，保險起見仍排除
  const validBank = useMemo(() => {
    const sourceIds = new Set(bank.sources.map((source) => source.id));
    return bank.questions.filter((question) => sourceIds.has(question.sourceId));
  }, [bank.sources, bank.questions]);

  if (bank.loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg" aria-label="載入題庫" />
      </div>
    );
  }

  if (bank.error) {
    return (
      <div className="py-16 text-center">
        <p className="text-error">{bank.error}</p>
        <button type="button" className="btn btn-sm mt-4" onClick={bank.reload}>
          重試
        </button>
      </div>
    );
  }

  if (!id) {
    return (
      <SheetComposerForm
        key="new"
        sheetId={null}
        initialTitle=""
        initialQuestions={[]}
        missingCount={0}
        bank={validBank}
        sources={bank.sources}
      />
    );
  }

  const sheet = bank.sheets.find((item) => item.id === id);
  if (!sheet) {
    return (
      <div className="py-16 text-center">
        <p className="text-base-content/70">找不到這份資料。</p>
        <Link to="/my-exams?tab=sheets" className="btn btn-sm mt-4">
          返回自製考卷
        </Link>
      </div>
    );
  }

  const { questions, missingCount } = resolveSheetQuestions(sheet.questionIds, validBank);
  return (
    <SheetComposerForm
      key={sheet.id}
      sheetId={sheet.id}
      initialTitle={sheet.title}
      initialQuestions={questions}
      missingCount={missingCount}
      bank={validBank}
      sources={bank.sources}
    />
  );
}
