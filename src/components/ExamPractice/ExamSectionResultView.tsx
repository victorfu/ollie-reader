import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BarChart3, X } from "lucide-react";
import type { ExamSectionResult } from "../../types/exam";

interface ExamSectionResultViewProps {
  result: ExamSectionResult;
  onContinue: () => void;
  onExit: () => void;
}

export function ExamSectionResultView({
  result,
  onContinue,
  onExit,
}: ExamSectionResultViewProps) {
  const shouldReduceMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const percent =
    result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button
          type="button"
          onClick={onExit}
          className="btn btn-ghost btn-sm min-h-[44px] gap-1 rounded-full text-muted-foreground"
        >
          <X size={16} strokeWidth={2} />
          離開
        </button>
      </div>

      <motion.section
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.3,
          ease: "easeOut",
        }}
        className="rounded-2xl border border-border-hairline bg-card p-6 text-center shadow-elevated sm:p-8"
        aria-live="polite"
      >
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-tint text-accent">
          <BarChart3 size={24} strokeWidth={1.75} aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm font-medium text-accent">區段完成</p>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-1 text-xl font-semibold tracking-tight"
        >
          {result.sectionLabel}
        </h2>

        <div className="mt-6">
          <p className="text-sm text-muted-foreground">正確率</p>
          <p className="mt-1 text-6xl font-semibold tracking-tight">
            {percent}
            <span className="ml-1 text-2xl text-muted-foreground">%</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            答對 {result.score} / {result.total} 題
          </p>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="btn btn-primary mt-7 min-h-[48px] w-full gap-1.5 rounded-xl"
        >
          {result.isFinalSection ? "查看總成績" : "繼續下一區段"}
          <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </motion.section>
    </div>
  );
}
