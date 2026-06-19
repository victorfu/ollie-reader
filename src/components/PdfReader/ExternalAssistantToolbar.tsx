import { Check, Copy, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildExternalAssistantUrl,
  buildPageAssistantPrompt,
  copyTextWithFallback,
  externalAssistantTargets,
  getExternalAssistantTarget,
} from "../../utils/externalAssistant";
import type { ExternalAssistantTargetId } from "../../utils/externalAssistant";

type ExternalAssistantToolbarProps = {
  pageNumber: number;
  text: string;
};

type CopyState = "idle" | "copied" | "error";

export function ExternalAssistantToolbar({
  pageNumber,
  text,
}: ExternalAssistantToolbarProps) {
  const [selectedTarget, setSelectedTarget] =
    useState<ExternalAssistantTargetId>("chatgpt");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const prompt = useMemo(
    () => buildPageAssistantPrompt({ pageNumber, text }),
    [pageNumber, text],
  );
  const selectedTargetMeta = getExternalAssistantTarget(selectedTarget);
  const hasText = text.trim().length > 0;

  const resetCopyState = (nextState: CopyState) => {
    setCopyState(nextState);
    if (typeof window !== "undefined") {
      window.setTimeout(() => setCopyState("idle"), 1600);
    }
  };

  const copyPrompt = async () => {
    if (!hasText) {
      resetCopyState("error");
      return false;
    }

    const copied = await copyTextWithFallback(prompt);
    if (copied) {
      resetCopyState("copied");
      return true;
    }

    resetCopyState("error");
    return false;
  };

  const openInAssistant = async () => {
    if (!hasText) return;

    const copied = await copyPrompt();
    if (selectedTargetMeta.behavior === "copy-then-open" && !copied) {
      return;
    }

    if (typeof window !== "undefined") {
      window.open(
        buildExternalAssistantUrl(selectedTarget, prompt),
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={copyPrompt}
        disabled={!hasText}
        className="inline-flex h-11 sm:h-10 items-center justify-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 text-sm font-semibold text-success transition-all duration-200 hover:bg-success/15 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
        aria-label={`複製 Page ${pageNumber} 的 AI 學習提示`}
      >
        {copyState === "copied" ? (
          <Check className="h-4 w-4" strokeWidth={1.8} />
        ) : (
          <Copy className="h-4 w-4" strokeWidth={1.8} />
        )}
        {copyState === "copied"
          ? "已複製"
          : copyState === "error"
            ? "複製失敗"
            : "複製"}
      </button>

      <div className="flex h-11 sm:h-10 min-w-0 max-w-full overflow-hidden rounded-lg border border-border-hairline bg-base-100/80 shadow-sm">
        <select
          aria-label="選擇要開啟的 AI 工具"
          value={selectedTarget}
          onChange={(event) =>
            setSelectedTarget(event.target.value as ExternalAssistantTargetId)
          }
          className="min-w-0 flex-1 appearance-auto bg-transparent pl-3 pr-8 text-sm font-semibold text-base-content outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          disabled={!hasText}
        >
          {externalAssistantTargets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={openInAssistant}
          disabled={!hasText}
          className="inline-flex items-center justify-center gap-2 border-l border-border-hairline px-3 text-sm font-semibold text-success transition-all duration-200 hover:bg-success/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
          aria-label={`用 ${selectedTargetMeta.label} 開啟 Page ${pageNumber} 的 AI 學習提示`}
          title={
            selectedTargetMeta.behavior === "copy-then-open"
              ? "會先複製提示，再開啟工具"
              : "會先複製提示，並帶入工具"
          }
        >
          <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
          開啟
        </button>
      </div>
    </div>
  );
}
