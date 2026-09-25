import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Upload } from "lucide-react";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { QuestionBankGrid } from "./QuestionBankGrid";
import { SourceList } from "./SourceList";
import { SourceUploadDialog } from "./SourceUploadDialog";

type MyExamsTab = "bank" | "sources";

const TABS: readonly { id: MyExamsTab; label: string }[] = [
  { id: "bank", label: "題庫" },
  { id: "sources", label: "上傳紀錄" },
];

function toTab(value: string | null): MyExamsTab {
  return value === "sources" ? "sources" : "bank";
}

export default function MyExamsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = toTab(searchParams.get("tab"));
  const navigate = useNavigate();
  const [uploadOpen, setUploadOpen] = useState(false);
  const bank = useQuestionBank();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">自製考卷</h1>
          <p className="text-sm text-base-content/60">上傳照片或 PDF，框出題目，組成考卷印出來。</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setUploadOpen(true)}>
          <Upload className="size-4" />
          上傳題目
        </button>
      </header>

      <div role="tablist" className="tabs tabs-box w-fit">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`tab ${tab === item.id ? "tab-active" : ""}`}
            onClick={() => setSearchParams(item.id === "bank" ? {} : { tab: item.id })}
          >
            {item.label}
          </button>
        ))}
      </div>

      {bank.error && (
        <div role="alert" className="alert alert-error">
          <span>{bank.error}</span>
          <button type="button" className="btn btn-sm" onClick={bank.reload}>
            重試
          </button>
        </div>
      )}

      {bank.loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg" aria-label="載入題庫" />
        </div>
      ) : tab === "bank" ? (
        <QuestionBankGrid sources={bank.sources} questions={bank.questions} onUpload={() => setUploadOpen(true)} />
      ) : (
        <SourceList sources={bank.sources} questions={bank.questions} onDeleted={bank.reload} />
      )}

      <SourceUploadDialog
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(sourceId) => {
          setUploadOpen(false);
          navigate(`/my-exams/sources/${sourceId}`);
        }}
      />
    </div>
  );
}
