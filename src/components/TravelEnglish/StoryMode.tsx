import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Volume2, ChevronLeft, ChevronRight } from "lucide-react";
import type { TravelScene, TravelDialogue } from "../../types/travelEnglish";
import type { useTravelProgress } from "../../hooks/useTravelProgress";

interface StoryModeProps {
  scene: TravelScene;
  onBack: () => void;
  speak: (text: string) => void;
  speakAsync: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  travelProgress: ReturnType<typeof useTravelProgress>;
}

const ROLE_AVATARS: Record<string, string> = {
  Child: "👦", You: "👦", Mom: "👩", Dad: "👨",
  Staff: "🧑‍💼", Receptionist: "🧑‍💼", Cashier: "🧑‍💼",
  "Flight Attendant": "👨‍✈️", Officer: "👮",
  Hawker: "🧑‍🍳", Driver: "🚕", Local: "🧑",
  Shopkeeper: "🧑‍💼", Vendor: "🧑‍💼", Tourist: "📸",
  Pharmacist: "💊",
};

function getAvatar(role: string): string {
  return ROLE_AVATARS[role] ?? "🧑";
}

function DialogueStory({
  dialogue,
  speak,
  speakAsync,
  stopSpeaking,
  onComplete,
}: {
  dialogue: TravelDialogue;
  speak: (text: string) => void;
  speakAsync: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  onComplete: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(1);
  const [showChinese, setShowChinese] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const autoPlayRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalLines = dialogue.lines.length;
  const allVisible = visibleCount >= totalLines;

  // Auto-speak when new line appears
  useEffect(() => {
    const line = dialogue.lines[visibleCount - 1];
    if (line) speak(line.english);
  }, [visibleCount, dialogue.lines, speak]);

  // Auto-play
  useEffect(() => {
    autoPlayRef.current = autoPlay;
    if (!autoPlay) return;

    let cancelled = false;
    const run = async () => {
      for (let i = visibleCount; i < totalLines; i++) {
        if (!autoPlayRef.current || cancelled) break;
        await new Promise((r) => setTimeout(r, 800));
        if (!autoPlayRef.current || cancelled) break;
        setVisibleCount(i + 1);
        await speakAsync(dialogue.lines[i].english);
      }
      if (!cancelled) {
        setAutoPlay(false);
        onComplete();
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [autoPlay]); // eslint-disable-line react-hooks/exhaustive-deps -- autoPlay is the only trigger

  // Scroll to bottom
  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleCount]);

  const handleTap = () => {
    if (autoPlay) return;
    if (visibleCount < totalLines) {
      setVisibleCount((c) => c + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div>
      {/* Dialogue title */}
      <div className="mb-3">
        <p className="font-semibold">{dialogue.title}</p>
        <p className="text-sm text-muted-foreground">{dialogue.titleChinese}</p>
        <p className="text-xs text-muted-foreground mt-1">{dialogue.description}</p>
      </div>

      {/* Chat area */}
      <div
        ref={containerRef}
        className="surface-card rounded-2xl p-4 sm:p-5 min-h-[300px] max-h-[400px] overflow-y-auto cursor-pointer"
        onClick={handleTap}
      >
        <AnimatePresence>
          {dialogue.lines.slice(0, visibleCount).map((line, index) => {
            const isYou = line.speaker === "A";
            return (
              <motion.div
                key={index}
                initial={{ x: isYou ? 20 : -20, opacity: 0, scale: 0.95 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`flex flex-col mb-3 ${isYou ? "items-end" : "items-start"}`}
              >
                <span className="text-xs text-muted-foreground mb-1">
                  {getAvatar(line.role)} {line.role}
                </span>
                <div
                  className={`px-4 py-2.5 max-w-[85%] cursor-pointer shadow-soft ${
                    isYou
                      ? "bg-primary/10 rounded-2xl rounded-br-md"
                      : "bg-base-200 rounded-2xl rounded-bl-md"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    speak(line.english);
                  }}
                >
                  <p className="text-sm">{line.english}</p>
                  {showChinese && (
                    <p className="text-xs text-muted-foreground mt-1">{line.chinese}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {!allVisible && !autoPlay && (
          <p className="text-center text-xs text-muted-foreground mt-4 animate-pulse">
            👆 Tap to continue
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-2 mt-3">
        <button
          type="button"
          className="btn btn-ghost btn-sm min-h-[44px] active:scale-[0.98]"
          onClick={() => speak(dialogue.lines[visibleCount - 1]?.english ?? "")}
        >
          <Volume2 className="w-4 h-4" /> 聽
        </button>
        <button
          type="button"
          className={`btn btn-sm min-h-[44px] active:scale-[0.98] ${showChinese ? "btn-primary" : "btn-outline"}`}
          onClick={() => setShowChinese(!showChinese)}
        >
          中/英
        </button>
        <button
          type="button"
          className={`btn btn-sm min-h-[44px] active:scale-[0.98] ${autoPlay ? "btn-error" : "btn-outline"}`}
          onClick={() => {
            if (autoPlay) {
              setAutoPlay(false);
              stopSpeaking();
            } else {
              setAutoPlay(true);
            }
          }}
        >
          {autoPlay ? "⏸ 停止" : "▶️ 自動"}
        </button>
      </div>
    </div>
  );
}

export function StoryMode({ scene, onBack, speak, speakAsync, stopSpeaking, travelProgress }: StoryModeProps) {
  const { markStoryWatched } = travelProgress;
  const [dialogueIndex, setDialogueIndex] = useState(0);

  const dialogue = scene.dialogues[dialogueIndex];
  const total = scene.dialogues.length;

  const handleComplete = useCallback(() => {
    markStoryWatched(scene.id, dialogue.id);
  }, [scene.id, dialogue.id, markStoryWatched]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="btn btn-ghost btn-sm gap-1.5 min-h-[44px] active:scale-[0.98]"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <span className="pill text-sm text-muted-foreground">
          📖 看故事 {dialogueIndex + 1} / {total}
        </span>
      </div>

      {/* Dialogue */}
      <AnimatePresence mode="wait">
        <motion.div
          key={dialogue.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <DialogueStory
            dialogue={dialogue}
            speak={speak}
            speakAsync={speakAsync}
            stopSpeaking={stopSpeaking}
            onComplete={handleComplete}
          />
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      {total > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button
            type="button"
            className="btn btn-ghost btn-sm min-h-[44px] active:scale-[0.98]"
            disabled={dialogueIndex === 0}
            onClick={() => setDialogueIndex((i) => i - 1)}
          >
            <ChevronLeft className="w-4 h-4" /> 上一段
          </button>
          <div className="flex gap-1.5">
            {scene.dialogues.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i === dialogueIndex ? "bg-primary" : "bg-base-300"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm min-h-[44px] active:scale-[0.98]"
            disabled={dialogueIndex === total - 1}
            onClick={() => setDialogueIndex((i) => i + 1)}
          >
            下一段 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
