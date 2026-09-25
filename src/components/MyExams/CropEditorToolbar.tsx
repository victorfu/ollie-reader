import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { AutosaveStatus } from "../../hooks/autosaveQueue";

type EditorMode = "question" | "mask";

interface CropEditorToolbarProps {
  title: string;
  onRename: (title: string) => void;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  status: AutosaveStatus;
  onRetry: () => void;
  appendHint: string | null;
}

function SaveStatus({ status, onRetry }: { status: AutosaveStatus; onRetry: () => void }) {
  if (status === "error") {
    return (
      <button type="button" className="btn btn-ghost btn-xs text-error" onClick={onRetry}>
        儲存失敗・重試
      </button>
    );
  }
  const label = status === "saving" ? "儲存中…" : status === "saved" ? "已儲存" : "";
  return (
    <span className="text-xs text-base-content/60" aria-live="polite">
      {label}
    </span>
  );
}

export function CropEditorToolbar({
  title,
  onRename,
  mode,
  onModeChange,
  status,
  onRetry,
  appendHint,
}: CropEditorToolbarProps) {
  const [draft, setDraft] = useState(title);

  const commitTitle = () => {
    const next = draft.trim();
    if (next && next !== title) {
      onRename(next);
    } else {
      setDraft(title);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/my-exams" className="btn btn-ghost btn-sm" aria-label="返回自製考卷">
          <ArrowLeft className="size-4" />
        </Link>
        <input
          className="input input-sm min-w-0 flex-1 font-semibold"
          aria-label="來源標題"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <div className="join">
          <button
            type="button"
            aria-pressed={mode === "question"}
            className={`btn join-item btn-sm ${mode === "question" ? "btn-primary" : ""}`}
            onClick={() => onModeChange("question")}
          >
            框題目
          </button>
          <button
            type="button"
            aria-pressed={mode === "mask"}
            className={`btn join-item btn-sm ${mode === "mask" ? "btn-primary" : ""}`}
            onClick={() => onModeChange("mask")}
          >
            遮蓋
          </button>
        </div>
        <SaveStatus status={status} onRetry={onRetry} />
      </div>
      {appendHint && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{appendHint}</p>}
      <p className="text-xs text-base-content/60">
        {mode === "question"
          ? "在頁面上拖拉框出一題；點框可以移動，拉四個角調整大小。"
          : "遮蓋模式：框出要蓋掉的答案或紅筆，印出來會是白色。"}
      </p>
    </div>
  );
}
