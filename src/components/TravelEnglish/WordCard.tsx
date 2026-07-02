import { motion } from "framer-motion";
import { BookOpen, Volume2 } from "lucide-react";
import type { TravelVocab } from "../../types/travelEnglish";
import { SpeakerButton } from "./SpeakerButton";

interface WordCardProps {
  vocab: TravelVocab;
  /** 主題底色 */
  colorClass: string;
  speak: (text: string) => void;
}

/** 大字、圖示、點一下發音的單字卡（適合和小朋友一起學） */
export function WordCard({ vocab, colorClass, speak }: WordCardProps) {
  const initial = vocab.word.trim().charAt(0).toUpperCase();

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className={`flex min-h-[188px] flex-col gap-3 rounded-2xl border border-border-hairline p-4 shadow-soft transition-shadow hover:shadow-elevated ${colorClass}`}
    >
      {/* 點單字區發音 */}
      <button
        type="button"
        onClick={() => speak(vocab.word)}
        className="flex w-full flex-1 flex-col items-start gap-2 text-left active:scale-[0.98] transition-transform"
        aria-label={`播放單字 ${vocab.word}`}
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-white/70 text-lg font-semibold text-primary shadow-soft ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10">
          {initial || <BookOpen className="size-5" />}
        </span>
        <span className="flex w-full items-start justify-between gap-2">
          <span className="text-xl sm:text-2xl font-bold leading-tight break-words">
            {vocab.word}
          </span>
          <Volume2 className="mt-1 size-4 shrink-0 text-primary" />
        </span>
      </button>

      <p className="text-base font-medium text-base-content/80">{vocab.chinese}</p>

      {vocab.example && (
        <div className="mt-auto flex items-start gap-1.5 border-t border-border-hairline pt-2">
          <p className="text-xs leading-relaxed text-muted-foreground">
            &ldquo;{vocab.example}&rdquo;
          </p>
          <SpeakerButton
            text={vocab.example}
            speak={speak}
            label={`播放例句：${vocab.example}`}
            className="btn-xs min-h-[32px] min-w-[32px] shrink-0"
          />
        </div>
      )}
    </motion.div>
  );
}
