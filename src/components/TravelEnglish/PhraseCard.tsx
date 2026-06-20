import { Clock3 } from "lucide-react";
import type { TravelPhrase } from "../../types/travelEnglish";
import { situationLabel } from "../../data/travelTopics";
import { SpeakerButton } from "./SpeakerButton";

interface PhraseCardProps {
  phrase: TravelPhrase;
  speak: (text: string) => void;
}

/** 句子卡：使用時機標籤 + 英文 + 中文 + 朗讀 */
export function PhraseCard({ phrase, speak }: PhraseCardProps) {
  return (
    <div className="surface-card flex items-center gap-2 rounded-2xl p-4">
      {/* 點句子區發音 */}
      <button
        type="button"
        onClick={() => speak(phrase.english)}
        className="flex-1 min-w-0 text-left min-h-[44px] active:scale-[0.99] transition-transform"
        aria-label={`播放句子 ${phrase.english}`}
      >
        {phrase.situation && (
          <span className="pill mb-1.5 px-2 py-0.5 text-[11px] text-muted-foreground">
            <Clock3 className="size-3" />
            {situationLabel(phrase.situation)}
          </span>
        )}
        <p className="text-base sm:text-lg font-semibold leading-snug">{phrase.english}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{phrase.chinese}</p>
      </button>
      <SpeakerButton text={phrase.english} speak={speak} className="shrink-0" />
    </div>
  );
}
