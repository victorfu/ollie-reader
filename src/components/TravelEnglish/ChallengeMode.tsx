import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, Star, Heart, X } from "lucide-react";
import type { TravelScene } from "../../types/travelEnglish";
import type { useTravelProgress } from "../../hooks/useTravelProgress";

interface ChallengeModeProps {
  scene: TravelScene;
  onBack: () => void;
  speak: (text: string) => void;
  travelProgress: ReturnType<typeof useTravelProgress>;
}

type QuestionType = "listen" | "translate" | "fillblank";

interface Question {
  type: QuestionType;
  prompt: string;
  promptChinese: string;
  audioText?: string;
  correctAnswer: string;
  options: string[];
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function generateQuestions(scene: TravelScene): Question[] {
  const questions: Question[] = [];
  const vocab = scene.vocabulary;
  const phrases = scene.phrases;

  // Type 1: Listen & Choose — pick vocab, play audio, choose Chinese
  for (const v of vocab.slice(0, 4)) {
    const wrong = shuffleArray(vocab.filter((w) => w.word !== v.word))
      .slice(0, 3)
      .map((w) => w.chinese);
    questions.push({
      type: "listen",
      prompt: "Listen and choose the correct meaning",
      promptChinese: "聽一聽，選出正確的意思",
      audioText: v.word,
      correctAnswer: v.chinese,
      options: shuffleArray([v.chinese, ...wrong]),
    });
  }

  // Type 2: Translate — show Chinese, choose English
  for (const p of phrases.slice(0, 3)) {
    const wrong = shuffleArray(phrases.filter((x) => x.id !== p.id))
      .slice(0, 2)
      .map((x) => x.english);
    questions.push({
      type: "translate",
      prompt: p.chinese,
      promptChinese: "選出正確的英文翻譯",
      correctAnswer: p.english,
      options: shuffleArray([p.english, ...wrong]),
    });
  }

  // Type 3: Fill blank — pick a phrase, remove a word
  for (const p of phrases.slice(3, 6)) {
    const words = p.english.split(" ").filter((w) => w.length > 2);
    if (words.length === 0) continue;
    const targetWord = words[Math.floor(Math.random() * words.length)].replace(/[?.!,]/g, "");
    const blanked = p.english.replace(new RegExp(`\\b${targetWord}\\b`, "i"), "___");
    const wrongWords = shuffleArray(
      vocab.map((v) => v.word).filter((w) => w.toLowerCase() !== targetWord.toLowerCase()),
    ).slice(0, 2);
    questions.push({
      type: "fillblank",
      prompt: blanked,
      promptChinese: p.chinese,
      correctAnswer: targetWord.toLowerCase(),
      options: shuffleArray([targetWord.toLowerCase(), ...wrongWords.map((w) => w.toLowerCase())]),
    });
  }

  return shuffleArray(questions).slice(0, 10);
}

export function ChallengeMode({ scene, onBack, speak, travelProgress }: ChallengeModeProps) {
  const { setChallengeStars } = travelProgress;

  const questions = useMemo(() => generateQuestions(scene), [scene]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [completed, setCompleted] = useState(false);

  const question = questions[currentIdx];
  const total = questions.length;

  // Auto-play audio for listen questions
  useEffect(() => {
    if (question?.type === "listen" && question.audioText) {
      speak(question.audioText);
    }
  }, [currentIdx, question, speak]);

  const handleSelect = (option: string) => {
    if (answered) return;
    setSelected(option);
    setAnswered(true);

    const isCorrect = option === question.correctAnswer;
    setCorrect(isCorrect);

    if (isCorrect) {
      setCorrectCount((c) => c + 1);
    } else {
      setLives((l) => {
        if (l - 1 <= 0) {
          setTimeout(() => setGameOver(true), 1500);
        }
        return l - 1;
      });
    }

    // Auto-advance
    setTimeout(() => {
      if (currentIdx + 1 >= total) {
        if (!gameOver && lives > (isCorrect ? 0 : 1)) {
          setCompleted(true);
        }
      } else if (lives > (isCorrect ? 0 : 1)) {
        setCurrentIdx((i) => i + 1);
        setSelected(null);
        setAnswered(false);
        setCorrect(false);
      }
    }, isCorrect ? 1000 : 2000);
  };

  // Save stars when challenge is completed
  useEffect(() => {
    if (!completed) return;
    const starCount = lives >= 3 ? 3 : lives >= 2 ? 2 : 1;
    setChallengeStars(scene.id, starCount);
  }, [completed, lives, scene.id, setChallengeStars]);

  const handleRestart = () => {
    setCurrentIdx(0);
    setLives(3);
    setSelected(null);
    setAnswered(false);
    setCorrect(false);
    setCorrectCount(0);
    setGameOver(false);
    setCompleted(false);
  };

  // Game Over
  if (gameOver) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <span className="text-5xl">😢</span>
        <p className="text-2xl font-bold">Game Over</p>
        <p className="text-base-content/60">
          沒關係！再試一次！
        </p>
        <p className="text-sm text-base-content/40">
          You got {correctCount}/{total} correct
        </p>
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            className="btn btn-primary min-h-[44px]"
            onClick={handleRestart}
          >
            🔄 再試一次
          </button>
          <button
            type="button"
            className="btn btn-outline min-h-[44px]"
            onClick={onBack}
          >
            ← 返回
          </button>
        </div>
      </div>
    );
  }

  // Completed
  if (completed) {
    const starCount = lives >= 3 ? 3 : lives >= 2 ? 2 : 1;

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
        <p className="text-2xl font-bold">太棒了！Challenge Complete!</p>
        <div className="flex gap-1">
          {[1, 2, 3].map((n) => (
            <motion.div
              key={n}
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 15, delay: n * 0.15 }}
            >
              <Star
                className={`w-8 h-8 ${
                  n <= starCount ? "text-amber-400 fill-amber-400" : "text-base-content/20"
                }`}
              />
            </motion.div>
          ))}
        </div>
        <p className="text-base-content/60">
          你答對了 {correctCount} / {total} 題！
        </p>
        <div className="flex gap-1">
          {Array.from({ length: lives }).map((_, i) => (
            <Heart key={i} className="w-5 h-5 text-red-500 fill-red-500" />
          ))}
          <span className="text-sm text-base-content/50 ml-1">剩餘生命</span>
        </div>
        {starCount > 0 && (
          <p className="text-sm text-amber-500 font-medium">🛂 獲得護照印章！</p>
        )}
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            className="btn btn-outline min-h-[44px]"
            onClick={handleRestart}
          >
            🔄 再玩一次
          </button>
          <button
            type="button"
            className="btn btn-primary min-h-[44px]"
            onClick={onBack}
          >
            ← 返回任務
          </button>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="btn btn-ghost btn-sm gap-1.5 min-h-[44px]"
          onClick={onBack}
        >
          <X className="w-4 h-4" />
          結束
        </button>
        <div className="flex gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <motion.div
              key={i}
              animate={i >= lives ? { scale: [1, 1.3, 0], opacity: [1, 1, 0] } : {}}
              transition={{ duration: 0.4 }}
            >
              <Heart
                className={`w-5 h-5 ${
                  i < lives ? "text-red-500 fill-red-500" : "text-base-content/20"
                }`}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-base-content/50 mb-1">
          <span>⭐ 挑戰</span>
          <span>{currentIdx + 1}/{total}</span>
        </div>
        <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
            animate={{ width: `${((currentIdx + 1) / total) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="bg-base-100 rounded-[12px] border border-black/5 dark:border-white/10 shadow-sm p-5 text-center">
        {question.type === "listen" && (
          <>
            <p className="text-sm font-medium text-base-content/60 mb-1">🔊 Listen and choose</p>
            <p className="text-xs text-base-content/40 mb-4">{question.promptChinese}</p>
            <button
              type="button"
              className="btn btn-primary btn-lg min-h-[56px] gap-2"
              onClick={() => question.audioText && speak(question.audioText)}
            >
              <Volume2 className="w-5 h-5" /> 播放
            </button>
          </>
        )}
        {question.type === "translate" && (
          <>
            <p className="text-xs text-base-content/40 mb-2">{question.promptChinese}</p>
            <p className="text-xl font-semibold">{question.prompt}</p>
          </>
        )}
        {question.type === "fillblank" && (
          <>
            <p className="text-xs text-base-content/40 mb-2">Fill in the blank</p>
            <p className="text-lg font-medium">{question.prompt}</p>
            <p className="text-xs text-base-content/50 mt-1">{question.promptChinese}</p>
          </>
        )}
      </div>

      {/* Options */}
      <div className={`grid gap-2 ${question.options.length === 4 ? "grid-cols-2" : "grid-cols-1"}`}>
        {question.options.map((option, i) => {
          const isSelected = selected === option;
          const isCorrectOption = option === question.correctAnswer;
          let optionClass = "border-black/5 dark:border-white/10 bg-base-100 hover:shadow-md";

          if (answered) {
            if (isCorrectOption) {
              optionClass = "border-green-400 bg-green-50 dark:bg-green-900/20";
            } else if (isSelected && !correct) {
              optionClass = "border-red-400 bg-red-50 dark:bg-red-900/20";
            } else {
              optionClass = "opacity-50 border-black/5 dark:border-white/10 bg-base-100";
            }
          }

          return (
            <motion.button
              key={`${option}-${i}`}
              type="button"
              animate={isSelected && !correct ? { x: [0, -6, 6, -3, 3, 0] } : {}}
              transition={{ duration: 0.5 }}
              className={`p-3 rounded-[10px] border min-h-[44px] text-sm font-medium transition-all cursor-pointer active:scale-[0.98] ${optionClass}`}
              onClick={() => handleSelect(option)}
              disabled={answered}
            >
              {option}
            </motion.button>
          );
        })}
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {answered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            {correct ? (
              <p className="text-green-500 font-medium">✅ 正確！</p>
            ) : (
              <p className="text-red-500 font-medium">
                ❌ 正確答案: {question.correctAnswer}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
