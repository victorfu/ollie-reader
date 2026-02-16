import { useState } from "react";
import type { TravelVocab, TravelPhrase } from "../../types/travelEnglish";
import { SpeakerIcon } from "../icons";

interface PhraseListProps {
  vocabulary: TravelVocab[];
  phrases: TravelPhrase[];
  speak: (text: string) => void;
}

function SpeakButton({ text, speak }: { text: string; speak: (t: string) => void }) {
  return (
    <button
      className="btn btn-ghost btn-xs text-base-content/40 hover:text-primary"
      onClick={(e) => { e.stopPropagation(); speak(text); }}
      aria-label={`播放 ${text}`}
    >
      <SpeakerIcon />
    </button>
  );
}

function VocabCard({
  vocab,
  isExpanded,
  onToggle,
  speak,
}: {
  vocab: TravelVocab;
  isExpanded: boolean;
  onToggle: () => void;
  speak: (text: string) => void;
}) {
  return (
    <div
      className="bg-base-100 rounded-lg border border-black/5 dark:border-white/10 p-3 cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl">{vocab.emoji}</span>
          <div className="min-w-0">
            <p className="font-semibold truncate">{vocab.word}</p>
            <p className="text-sm text-base-content/60">{vocab.chinese}</p>
          </div>
        </div>
        <SpeakButton text={vocab.word} speak={speak} />
      </div>
      {isExpanded && vocab.example && (
        <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-base-content/70 italic">{vocab.example}</p>
            <SpeakButton text={vocab.example} speak={speak} />
          </div>
        </div>
      )}
    </div>
  );
}

function PhraseRow({
  phrase,
  speak,
}: {
  phrase: TravelPhrase;
  speak: (text: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 border-b border-black/5 dark:border-white/5 last:border-b-0 min-h-[44px]">
      <div className="flex-1 min-w-0">
        <p className="font-medium">{phrase.english}</p>
        <p className="text-sm text-base-content/60">{phrase.chinese}</p>
        {phrase.situation && (
          <span className="badge badge-sm badge-ghost mt-1">{phrase.situation}</span>
        )}
      </div>
      <SpeakButton text={phrase.english} speak={speak} />
    </div>
  );
}

export function PhraseList({ vocabulary, phrases, speak }: PhraseListProps) {
  const [expandedWord, setExpandedWord] = useState<string | null>(null);

  return (
    <div>
      {/* 重要單字 */}
      <h3 className="text-lg font-semibold">重要單字</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
        {vocabulary.map((vocab) => (
          <VocabCard
            key={vocab.word}
            vocab={vocab}
            isExpanded={expandedWord === vocab.word}
            onToggle={() =>
              setExpandedWord((prev) => (prev === vocab.word ? null : vocab.word))
            }
            speak={speak}
          />
        ))}
      </div>

      {/* 常用句型 */}
      <h3 className="text-lg font-semibold mt-8">常用句型</h3>
      <div className="mt-3">
        {phrases.map((phrase) => (
          <PhraseRow key={phrase.id} phrase={phrase} speak={speak} />
        ))}
      </div>
    </div>
  );
}
