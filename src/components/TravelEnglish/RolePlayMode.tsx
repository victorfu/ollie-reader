import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Volume2, Star } from "lucide-react";
import type { TravelScene, DialogueLine } from "../../types/travelEnglish";
import type { useTravelProgress } from "../../hooks/useTravelProgress";

interface RolePlayModeProps {
  scene: TravelScene;
  onBack: () => void;
  speak: (text: string) => void;
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

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function generateDistractors(correct: string, allPhrases: string[]): string[] {
  const pool = allPhrases.filter((p) => p !== correct);
  const shuffled = shuffleArray(pool);
  return shuffled.slice(0, 2);
}

export function RolePlayMode({ scene, onBack, speak, travelProgress }: RolePlayModeProps) {
  const { setRolePlayScore } = travelProgress;

  // Use the first dialogue for role play
  const dialogue = scene.dialogues[0];
  const allPhraseTexts = useMemo(
    () => [
      ...scene.phrases.map((p) => p.english),
      ...dialogue.lines.filter((l) => l.speaker === "A").map((l) => l.english),
    ],
    [scene, dialogue],
  );

  // Build the dialogue flow
  const lineQueue = useMemo(() => {
    const queue: { line: DialogueLine; isChoice: boolean }[] = [];
    for (const line of dialogue.lines) {
      queue.push({ line, isChoice: line.speaker === "A" });
    }
    return queue;
  }, [dialogue]);

  // Compute initial state: show B lines until the first A choice
  const initialState = useMemo(() => {
    const visible: DialogueLine[] = [];
    let idx = 0;
    while (idx < lineQueue.length) {
      const item = lineQueue[idx];
      if (item.isChoice) {
        const correct = item.line.english;
        const distractors = generateDistractors(correct, allPhraseTexts);
        return {
          lineIdx: idx,
          visible,
          choices: shuffleArray([correct, ...distractors]),
          showChoices: true,
          finished: false,
        };
      }
      visible.push(item.line);
      idx++;
    }
    return { lineIdx: 0, visible, choices: [] as string[], showChoices: false, finished: true };
  }, [lineQueue, allPhraseTexts]);

  const [currentLineIdx, setCurrentLineIdx] = useState(initialState.lineIdx);
  const [visibleLines, setVisibleLines] = useState<DialogueLine[]>(initialState.visible);
  const [choices, setChoices] = useState<string[]>(initialState.choices);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showChoices, setShowChoices] = useState(initialState.showChoices);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [finished, setFinished] = useState(initialState.finished);

  function advanceToNextChoice(fromIdx: number, currentVisible: DialogueLine[]) {
    const newVisible = [...currentVisible];
    let idx = fromIdx;

    while (idx < lineQueue.length) {
      const item = lineQueue[idx];
      if (item.isChoice) {
        const correct = item.line.english;
        const distractors = generateDistractors(correct, allPhraseTexts);
        setChoices(shuffleArray([correct, ...distractors]));
        setCurrentLineIdx(idx);
        setShowChoices(true);
        setSelectedChoice(null);
        setWrongAttempts(0);
        setIsCorrect(false);
        setVisibleLines(newVisible);
        return;
      }
      newVisible.push(item.line);
      idx++;
    }

    setVisibleLines(newVisible);
    setShowChoices(false);
    setFinished(true);
  }

  const currentQuestion = lineQueue[currentLineIdx]?.line;

  const handleChoice = (choice: string) => {
    if (selectedChoice || isCorrect) return;
    setSelectedChoice(choice);

    if (choice === currentQuestion.english) {
      setIsCorrect(true);
      setCorrectCount((c) => c + 1);
      setTotalQuestions((c) => c + 1);
      speak(choice);
    } else {
      setWrongAttempts((w) => {
        const newW = w + 1;
        if (newW >= 2) {
          // Reveal correct answer
          setIsCorrect(true);
          setTotalQuestions((c) => c + 1);
        }
        return newW;
      });
      // Reset selection after shake
      setTimeout(() => setSelectedChoice(null), 600);
    }
  };

  const handleContinue = () => {
    const newVisible = [...visibleLines, currentQuestion];
    advanceToNextChoice(currentLineIdx + 1, newVisible);
  };

  const handleRestart = () => {
    setCurrentLineIdx(0);
    setVisibleLines([]);
    setChoices([]);
    setSelectedChoice(null);
    setWrongAttempts(0);
    setIsCorrect(false);
    setShowChoices(false);
    setCorrectCount(0);
    setTotalQuestions(0);
    setFinished(false);
    advanceToNextChoice(0, []);
  };

  // Save score when role play finishes
  useEffect(() => {
    if (!finished) return;
    const pct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    setRolePlayScore(scene.id, pct);
  }, [finished, correctCount, totalQuestions, scene.id, setRolePlayScore]);

  if (finished) {
    const pct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const starCount = pct >= 100 ? 3 : pct >= 75 ? 2 : 1;

    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <motion.span
          className="text-5xl"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
        >
          🎉
        </motion.span>
        <p className="text-2xl sm:text-3xl font-semibold tracking-tight">角色扮演完成！</p>
        <p className="text-muted-foreground">
          你答對了 {correctCount}/{totalQuestions} 題！
        </p>
        <div className="flex gap-1">
          {[1, 2, 3].map((n) => (
            <Star
              key={n}
              className={`w-6 h-6 ${
                n <= starCount ? "text-warning fill-warning" : "text-base-content/20"
              }`}
            />
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            className="btn btn-outline min-h-[44px] active:scale-[0.98]"
            onClick={handleRestart}
          >
            🔄 再玩一次
          </button>
          <button
            type="button"
            className="btn btn-primary min-h-[44px] active:scale-[0.98]"
            onClick={onBack}
          >
            ← 返回任務
          </button>
        </div>
      </div>
    );
  }

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
        <span className="pill text-sm text-muted-foreground">🎭 角色扮演</span>
      </div>

      {/* Dialogue info */}
      <div className="text-center">
        <p className="font-semibold text-sm">{dialogue.title}</p>
        <p className="text-xs text-muted-foreground">{dialogue.titleChinese}</p>
      </div>

      {/* Chat area */}
      <div className="surface-card rounded-2xl p-4 sm:p-5 min-h-[200px]">
        <AnimatePresence>
          {visibleLines.map((line, index) => {
            const isYou = line.speaker === "A";
            return (
              <motion.div
                key={`visible-${index}`}
                initial={{ x: isYou ? 20 : -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className={`flex flex-col mb-3 ${isYou ? "items-end" : "items-start"}`}
              >
                <span className="text-xs text-muted-foreground mb-1">
                  {getAvatar(line.role)} {line.role}
                </span>
                <div
                  className={`px-4 py-2.5 max-w-[85%] shadow-soft ${
                    isYou
                      ? "bg-success/10 rounded-2xl rounded-br-md"
                      : "bg-base-200 rounded-2xl rounded-bl-md"
                  }`}
                >
                  <p className="text-sm">{line.english}</p>
                  <p className="text-xs text-muted-foreground mt-1">{line.chinese}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Correct answer display */}
        {showChoices && isCorrect && currentQuestion && (
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex flex-col items-end mb-3"
          >
            <span className="text-xs text-muted-foreground mb-1">
              {getAvatar(currentQuestion.role)} {currentQuestion.role}
            </span>
            <div className="px-4 py-2.5 max-w-[85%] bg-success/15 border border-success/20 rounded-2xl rounded-br-md shadow-soft">
              <div className="flex items-center gap-2">
                <p className="text-sm">✅ {currentQuestion.english}</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs p-1"
                  onClick={() => speak(currentQuestion.english)}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{currentQuestion.chinese}</p>
            </div>
          </motion.div>
        )}

        {/* Choice prompt */}
        {showChoices && !isCorrect && (
          <div className="text-center py-3">
            <p className="text-sm font-medium">🤔 你會怎麼說？</p>
            <p className="text-xs text-muted-foreground">What would you say?</p>
          </div>
        )}
      </div>

      {/* Choices */}
      {showChoices && !isCorrect && (
        <div className="space-y-2">
          {choices.map((choice, i) => {
            const isWrong = selectedChoice === choice && !isCorrect;
            const isDisabled = wrongAttempts > 0 && selectedChoice === choice;
            return (
              <motion.button
                key={`${choice}-${i}`}
                type="button"
                animate={isWrong ? { x: [0, -8, 8, -4, 4, 0] } : {}}
                transition={{ duration: 0.5 }}
                className={`surface-card w-full text-left px-4 py-3.5 rounded-xl min-h-[44px] transition-all ${
                  isDisabled
                    ? "opacity-40 cursor-not-allowed border-error/40 bg-error/10"
                    : "cursor-pointer hover:shadow-elevated active:scale-[0.98]"
                }`}
                onClick={() => !isDisabled && handleChoice(choice)}
                disabled={isDisabled}
              >
                <span className="text-sm">
                  {String.fromCharCode(65 + i)}) {choice}
                </span>
              </motion.button>
            );
          })}
          {wrongAttempts > 0 && wrongAttempts < 2 && (
            <p className="text-center text-sm text-warning">再試一次！Try again!</p>
          )}
        </div>
      )}

      {/* Correct celebration + continue */}
      {showChoices && isCorrect && (
        <div className="text-center space-y-3">
          <motion.p
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-lg font-bold text-success"
          >
            🎉 {wrongAttempts < 2 ? "正確！Great job!" : "答案揭曉！"}
          </motion.p>
          <button
            type="button"
            className="btn btn-primary min-h-[44px] active:scale-[0.98]"
            onClick={handleContinue}
          >
            繼續 →
          </button>
        </div>
      )}
    </div>
  );
}
