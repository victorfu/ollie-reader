import { Check, Copy, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Tooltip } from "../common/Tooltip";
import { useLanguage } from "../../hooks/useLanguage";
import {
  buildPageAssistantPrompt,
  copyTextWithFallback,
} from "../../utils/externalAssistant";

type CopyPagePromptButtonProps = {
  pageNumber: number;
  text: string;
};

type CopyState = "idle" | "copied" | "error";

export function CopyPagePromptButton({
  pageNumber,
  text,
}: CopyPagePromptButtonProps) {
  const { t } = useLanguage();
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const prompt = useMemo(
    () => buildPageAssistantPrompt({ pageNumber, text }),
    [pageNumber, text],
  );
  const hasText = text.trim().length > 0;
  // Icon-only, so the label the button used to carry moves into the tooltip —
  // and the outcome of a copy has to be legible from the icon alone.
  const label =
    copyState === "copied"
      ? t("reader.copyPrompt.copied")
      : copyState === "error"
        ? t("reader.copyPrompt.failed")
        : t("reader.copyPrompt.label");

  const resetCopyState = (nextState: CopyState) => {
    setCopyState(nextState);
    if (typeof window !== "undefined") {
      window.setTimeout(() => setCopyState("idle"), 1600);
    }
  };

  const copyPrompt = async () => {
    if (!hasText) {
      resetCopyState("error");
      return;
    }

    resetCopyState((await copyTextWithFallback(prompt)) ? "copied" : "error");
  };

  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
      <span className="sr-only" role="status" aria-live="polite">
        {copyState === "copied"
          ? t("reader.copyPrompt.copiedStatus", { page: pageNumber })
          : copyState === "error"
            ? t("reader.copyPrompt.failedStatus", { page: pageNumber })
            : ""}
      </span>
      <Tooltip content={label} position="bottom">
        <button
          type="button"
          onClick={copyPrompt}
          disabled={!hasText}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-success/30 bg-success/10 text-success transition-all duration-200 hover:bg-success/15 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 sm:h-8 sm:w-8"
          aria-label={t("reader.copyPrompt.ariaLabel", { page: pageNumber })}
        >
          {copyState === "copied" ? (
            <Check className="size-4" strokeWidth={1.8} />
          ) : copyState === "error" ? (
            <X className="size-4" strokeWidth={1.8} />
          ) : (
            <Copy className="size-4" strokeWidth={1.8} />
          )}
        </button>
      </Tooltip>
    </div>
  );
}
