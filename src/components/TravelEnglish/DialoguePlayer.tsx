import { useState, useRef } from "react";
import type { TravelDialogue } from "../../types/travelEnglish";

interface DialoguePlayerProps {
  dialogues: TravelDialogue[];
  speakAsync: (text: string) => Promise<void>;
  speak: (text: string) => void;
  stopSpeaking: () => void;
}

function DialogueSection({
  dialogue,
  speakAsync,
  speak,
  stopSpeaking,
}: {
  dialogue: TravelDialogue;
  speakAsync: (text: string) => Promise<void>;
  speak: (text: string) => void;
  stopSpeaking: () => void;
}) {
  const [showChinese, setShowChinese] = useState(true);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const playingRef = useRef(false);

  const handlePlayAll = async () => {
    if (isPlayingAll) {
      playingRef.current = false;
      stopSpeaking();
      setIsPlayingAll(false);
      setCurrentLineIndex(-1);
      return;
    }

    playingRef.current = true;
    setIsPlayingAll(true);

    for (let i = 0; i < dialogue.lines.length; i++) {
      if (!playingRef.current) break;
      setCurrentLineIndex(i);
      await speakAsync(dialogue.lines[i].english);
      if (!playingRef.current) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    playingRef.current = false;
    setIsPlayingAll(false);
    setCurrentLineIndex(-1);
  };

  return (
    <div>
      {/* Header */}
      <p className="font-semibold">{dialogue.title}</p>
      <p className="text-sm text-base-content/60">{dialogue.titleChinese}</p>

      {/* Controls bar */}
      <div className="flex justify-between items-center mt-3">
        <button
          className={`btn btn-sm ${isPlayingAll ? "btn-error" : "btn-primary"}`}
          onClick={handlePlayAll}
        >
          {isPlayingAll ? "停止" : "播放全部"}
        </button>
        <label className="label cursor-pointer gap-2">
          <span className="text-sm">顯示中文</span>
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-primary"
            checked={showChinese}
            onChange={() => setShowChinese((v) => !v)}
          />
        </label>
      </div>

      {/* Chat bubbles */}
      <div className="space-y-3 mt-4">
        {dialogue.lines.map((line, index) => {
          const isHighlighted = isPlayingAll && index === currentLineIndex;
          const isYou = line.speaker === "A";

          return (
            <div
              key={index}
              className={`flex flex-col ${isYou ? "items-end" : "items-start"}`}
            >
              <span className="text-xs text-base-content/40 mb-1">{line.role}</span>
              <div
                className={`${
                  isYou
                    ? "bg-primary/10 rounded-2xl rounded-tr-sm"
                    : "bg-base-200 rounded-2xl rounded-tl-sm"
                } px-4 py-2 max-w-[80%] cursor-pointer ${
                  isHighlighted ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => speak(line.english)}
              >
                <p className="text-sm">{line.english}</p>
                {showChinese && (
                  <p className="text-xs text-base-content/50 mt-1">{line.chinese}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DialoguePlayer({
  dialogues,
  speakAsync,
  speak,
  stopSpeaking,
}: DialoguePlayerProps) {
  return (
    <div>
      {dialogues.map((dialogue, index) => (
        <div key={dialogue.id}>
          {index > 0 && <div className="divider" />}
          <DialogueSection
            dialogue={dialogue}
            speakAsync={speakAsync}
            speak={speak}
            stopSpeaking={stopSpeaking}
          />
        </div>
      ))}
    </div>
  );
}
