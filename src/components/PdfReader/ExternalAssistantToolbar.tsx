import { Check, Copy, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildExternalAssistantUrl,
  buildPageAssistantPrompt,
  copyTextWithFallback,
} from "../../utils/externalAssistant";

type ExternalAssistantToolbarProps = {
  pageNumber: number;
  text: string;
};

type CopyState = "idle" | "copied" | "error";

export function ExternalAssistantToolbar({
  pageNumber,
  text,
}: ExternalAssistantToolbarProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const prompt = useMemo(
    () => buildPageAssistantPrompt({ pageNumber, text }),
    [pageNumber, text],
  );
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

  const openInChatGpt = async () => {
    if (!hasText) return;

    await copyPrompt();

    if (typeof window !== "undefined") {
      window.open(
        buildExternalAssistantUrl("chatgpt", prompt),
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={copyPrompt}
        disabled={!hasText}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-2.5 text-xs font-semibold text-success transition-all duration-200 hover:bg-success/15 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
        aria-label={`複製 Page ${pageNumber} 的 AI 學習提示`}
      >
        {copyState === "copied" ? (
          <Check className="h-3.5 w-3.5" strokeWidth={1.8} />
        ) : (
          <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />
        )}
        {copyState === "copied"
          ? "已複製"
          : copyState === "error"
            ? "複製失敗"
            : "複製"}
      </button>

      <button
        type="button"
        onClick={openInChatGpt}
        disabled={!hasText}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border-hairline bg-base-100/80 px-2.5 text-xs font-semibold text-base-content shadow-sm transition-all duration-200 hover:bg-success/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
        aria-label={`用 ChatGPT 開啟 Page ${pageNumber} 的 AI 學習提示`}
        title="會先複製提示，再用 ChatGPT 開啟"
      >
        ChatGPT
        <ExternalLink className="h-3.5 w-3.5 text-success" strokeWidth={1.8} />
      </button>
    </div>
  );
}
