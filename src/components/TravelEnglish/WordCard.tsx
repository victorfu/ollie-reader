import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
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
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className={`flex flex-col items-center text-center gap-1 p-4 rounded-2xl border border-border-hairline shadow-soft transition-shadow hover:shadow-elevated ${colorClass}`}
    >
      {/* 點單字區發音 */}
      <button
        type="button"
        onClick={() => speak(vocab.word)}
        className="flex flex-col items-center gap-1 w-full min-h-[44px] active:scale-[0.98] transition-transform"
        aria-label={`播放單字 ${vocab.word}`}
      >
        <span className="text-4xl sm:text-5xl">{vocab.emoji}</span>
        <span className="flex items-center justify-center gap-1.5 mt-1">
          <span className="text-xl sm:text-2xl font-bold break-words">{vocab.word}</span>
          <Volume2 className="w-4 h-4 text-primary shrink-0" />
        </span>
        {vocab.phonetic && (
          <span className="text-xs text-muted-foreground">[{vocab.phonetic}]</span>
        )}
      </button>

      <p className="text-base font-medium text-base-content/80">{vocab.chinese}</p>

      {vocab.example && (
        <div className="flex items-center justify-center gap-1 mt-1">
          <p className="text-xs italic text-muted-foreground">&ldquo;{vocab.example}&rdquo;</p>
          <SpeakerButton
            text={vocab.example}
            speak={speak}
            label={`播放例句：${vocab.example}`}
            className="btn-xs min-h-[32px] min-w-[32px]"
          />
        </div>
      )}
    </motion.div>
  );
}
