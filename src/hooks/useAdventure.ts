import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import {
  getOrCreateProgress,
  saveProgress,
  unlockSpirit,
  calculateLevelUp,
  STAGES,
  isStageCompleted,
  isStagePlayable,
} from "../services/gameProgressService";
import { prepareGamePool, type GameWord } from "../services/gameService";
import type {
  PlayerProgress,
  GameView,
  QuizState,
  QuizQuestion,
  Stage,
  GameReward,
  Spirit,
} from "../types/game";
import type { VocabularyWord } from "../types/vocabulary";
import { getSpiritById } from "../assets/spirits";

const QUIZ_TIME_LIMIT = 30; // 每題 30 秒
const QUIZ_MAX_LIVES = 3; // 3 條命

interface UseAdventureReturn {
  // 玩家進度
  progress: PlayerProgress | null;
  isLoading: boolean;
  error: string | null;

  // 遊戲畫面狀態
  gameView: GameView;
  setGameView: (view: GameView) => void;

  // 關卡資訊
  stages: Stage[];
  currentStage: Stage | null;
  isStageCompleted: (stageIndex: number) => boolean;
  isStagePlayable: (stageIndex: number) => boolean;

  // 快問快答狀態
  quizState: QuizState | null;

  // 獎勵狀態
  pendingReward: GameReward | null;

  // 動作
  initializeGame: () => Promise<void>;
  startQuiz: (
    stageIndex: number,
    vocabularyWords: VocabularyWord[],
  ) => Promise<void>;
  submitAnswer: (answerIndex: number) => void;
  tickTimer: () => void;
  claimReward: () => Promise<void>;
  goHome: () => void;
}

export function useAdventure(): UseAdventureReturn {
  const { user } = useAuth();

  // 玩家進度
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 遊戲畫面
  const [gameView, setGameView] = useState<GameView>("home");

  // 當前關卡
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const currentStage = STAGES[currentStageIndex] || null;

  // 題目池
  const wordPoolRef = useRef<GameWord[]>([]);

  // 用於在 callbacks 內引用最新狀態的 refs
  const progressRef = useRef<PlayerProgress | null>(null);
  const currentStageIndexRef = useRef<number>(0);

  // Track timeouts for cleanup
  const timeoutRefs = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Cleanup timeouts on unmount
  useEffect(() => {
    const timeouts = timeoutRefs.current;
    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      timeouts.clear();
    };
  }, []);

  // 同步 refs
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    currentStageIndexRef.current = currentStageIndex;
  }, [currentStageIndex]);

  // 快問快答狀態
  const [quizState, setQuizState] = useState<QuizState | null>(null);

  // 獎勵狀態
  const [pendingReward, setPendingReward] = useState<GameReward | null>(null);

  // 初始化遊戲（載入玩家進度）
  const initializeGame = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const playerProgress = await getOrCreateProgress(user.uid);
      setProgress(playerProgress);
    } catch (err) {
      console.error("Failed to initialize game:", err);
      setError("無法載入遊戲進度");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // 用戶登入時自動初始化
  useEffect(() => {
    if (user && !progress) {
      initializeGame();
    }
  }, [user, progress, initializeGame]);

  // 生成選項（1 個正確 + 3 個錯誤）
  const generateOptions = useCallback(
    (
      correctDef: string,
      allWords: GameWord[],
    ): { options: string[]; correctIndex: number } => {
      // 從其他單字取錯誤選項
      const wrongDefs = allWords
        .filter((w) => w.def !== correctDef)
        .map((w) => w.def)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      // 如果錯誤選項不夠，補充一些通用錯誤選項
      const fallbackDefs = ["未知的意思", "一種動物", "一種食物", "一個動作"];
      while (wrongDefs.length < 3) {
        const fallback = fallbackDefs[wrongDefs.length];
        if (!wrongDefs.includes(fallback)) {
          wrongDefs.push(fallback);
        }
      }

      // 隨機插入正確答案
      const correctIndex = Math.floor(Math.random() * 4);
      const options = [...wrongDefs];
      options.splice(correctIndex, 0, correctDef);

      return { options, correctIndex };
    },
    [],
  );

  // 開始快問快答
  const startQuiz = useCallback(
    async (stageIndex: number, vocabularyWords: VocabularyWord[]) => {
      if (!progress) return;

      setIsLoading(true);
      setError(null);
      setCurrentStageIndex(stageIndex);

      try {
        const stage = STAGES[stageIndex];
        if (!stage) throw new Error("關卡不存在");

        // 準備題目池
        const wordPool = await prepareGamePool(vocabularyWords);
        wordPoolRef.current = wordPool;

        // 生成題目
        const questionCount = stage.questionCount;
        const selectedWords = wordPool.slice(0, questionCount);

        const questions: QuizQuestion[] = selectedWords.map((word) => {
          const { options, correctIndex } = generateOptions(word.def, wordPool);
          return {
            word: word.word,
            options,
            correctIndex,
            spiritId: stage.rewardSpiritId,
          };
        });

        // 初始化快問快答狀態
        setQuizState({
          questions,
          currentIndex: 0,
          timeLeft: QUIZ_TIME_LIMIT,
          lives: QUIZ_MAX_LIVES,
          maxLives: QUIZ_MAX_LIVES,
          score: 0,
          combo: 0,
          isAnswered: false,
          lastAnswerCorrect: null,
        });

        setGameView("quiz");
      } catch (err) {
        console.error("Failed to start quiz:", err);
        setError("無法開始遊戲");
      } finally {
        setIsLoading(false);
      }
    },
    [progress, generateOptions],
  );

  // 處理遊戲結束 - 使用 refs 避免依賴問題
  const handleQuizEnd = useCallback(
    async (isVictory: boolean, _score: number, maxCombo: number) => {
      const currentProgress = progressRef.current;
      const stageIdx = currentStageIndexRef.current;

      if (!currentProgress || !user) return;

      const stage = STAGES[stageIdx];
      if (!stage) return;

      if (isVictory) {
        // 計算經驗值獎勵
        const expGained = stage.rewardExp;
        const { newLevel, newExp, expToNextLevel, didLevelUp } =
          calculateLevelUp(
            currentProgress.level,
            currentProgress.exp,
            expGained,
          );

        // 檢查是否解鎖新精靈
        let newSpirit: Spirit | undefined;
        if (
          stage.rewardSpiritId &&
          !currentProgress.unlockedSpiritIds.includes(stage.rewardSpiritId)
        ) {
          newSpirit = getSpiritById(stage.rewardSpiritId);
          await unlockSpirit(user.uid, stage.rewardSpiritId);
        }

        // 更新進度
        const newStageIndex = Math.max(
          currentProgress.currentStageIndex,
          stageIdx + 1,
        );
        const newHighestCombo = Math.max(
          currentProgress.highestCombo,
          maxCombo,
        );

        await saveProgress(user.uid, {
          level: newLevel,
          exp: newExp,
          expToNextLevel,
          currentStageIndex: newStageIndex,
          totalQuizCompleted: currentProgress.totalQuizCompleted + 1,
          highestCombo: newHighestCombo,
        });

        // 更新本地狀態
        setProgress((prev) =>
          prev
            ? {
                ...prev,
                level: newLevel,
                exp: newExp,
                expToNextLevel,
                currentStageIndex: newStageIndex,
                totalQuizCompleted: prev.totalQuizCompleted + 1,
                highestCombo: newHighestCombo,
                unlockedSpiritIds: newSpirit
                  ? [...prev.unlockedSpiritIds, stage.rewardSpiritId!]
                  : prev.unlockedSpiritIds,
              }
            : prev,
        );

        // 設定獎勵
        setPendingReward({
          expGained,
          newLevel: didLevelUp ? newLevel : undefined,
          newSpirit,
          isNewHighScore: maxCombo > currentProgress.highestCombo,
        });

        setGameView("reward");
      } else {
        // 失敗，回到地圖
        setGameView("map");
      }

      setQuizState(null);
    },
    [user],
  );

  // 提交答案
  const submitAnswer = useCallback(
    (answerIndex: number) => {
      if (!quizState || quizState.isAnswered) return;

      const currentQuestion = quizState.questions[quizState.currentIndex];
      const isCorrect = answerIndex === currentQuestion.correctIndex;

      setQuizState((prev) => {
        if (!prev) return prev;

        const newCombo = isCorrect ? prev.combo + 1 : 0;
        const scoreGain = isCorrect ? 100 + prev.combo * 10 : 0;
        const newLives = isCorrect ? prev.lives : prev.lives - 1;

        return {
          ...prev,
          score: prev.score + scoreGain,
          combo: newCombo,
          lives: newLives,
          isAnswered: true,
          lastAnswerCorrect: isCorrect,
        };
      });

      // 延遲後進入下一題或結束
      const timeoutId = setTimeout(() => {
        timeoutRefs.current.delete(timeoutId);
        setQuizState((prev) => {
          if (!prev) return prev;

          const isLastQuestion = prev.currentIndex >= prev.questions.length - 1;
          const isGameOver = prev.lives <= 0;

          if (isLastQuestion || isGameOver) {
            // 遊戲結束，計算獎勵
            handleQuizEnd(prev.lives > 0, prev.score, prev.combo);
            return prev;
          }

          // 進入下一題
          return {
            ...prev,
            currentIndex: prev.currentIndex + 1,
            timeLeft: QUIZ_TIME_LIMIT,
            isAnswered: false,
            lastAnswerCorrect: null,
          };
        });
      }, 1500);
      timeoutRefs.current.add(timeoutId);
    },
    [quizState, handleQuizEnd],
  );

  // 計時器每秒減少
  const tickTimer = useCallback(() => {
    setQuizState((prev) => {
      if (!prev || prev.isAnswered) return prev;

      const newTimeLeft = prev.timeLeft - 1;

      if (newTimeLeft <= 0) {
        // 時間到，視為答錯
        const newLives = prev.lives - 1;

        const timeoutId = setTimeout(() => {
          timeoutRefs.current.delete(timeoutId);
          setQuizState((p) => {
            if (!p) return p;

            if (p.lives <= 0) {
              handleQuizEnd(false, p.score, p.combo);
              return p;
            }

            const isLastQuestion = p.currentIndex >= p.questions.length - 1;
            if (isLastQuestion) {
              handleQuizEnd(true, p.score, p.combo);
              return p;
            }

            return {
              ...p,
              currentIndex: p.currentIndex + 1,
              timeLeft: QUIZ_TIME_LIMIT,
              isAnswered: false,
              lastAnswerCorrect: null,
            };
          });
        }, 1000);
        timeoutRefs.current.add(timeoutId);

        return {
          ...prev,
          timeLeft: 0,
          lives: newLives,
          combo: 0,
          isAnswered: true,
          lastAnswerCorrect: false,
        };
      }

      return {
        ...prev,
        timeLeft: newTimeLeft,
      };
    });
  }, [handleQuizEnd]);

  // 領取獎勵
  const claimReward = useCallback(async () => {
    setPendingReward(null);
    setGameView("map");
  }, []);

  // 回到主畫面
  const goHome = useCallback(() => {
    setGameView("home");
    setQuizState(null);
    setPendingReward(null);
  }, []);

  // 檢查關卡是否完成
  const checkStageCompleted = useCallback(
    (stageIndex: number): boolean => {
      if (!progress) return false;
      return isStageCompleted(stageIndex, progress.currentStageIndex);
    },
    [progress],
  );

  // 檢查關卡是否可遊玩
  const checkStagePlayable = useCallback(
    (stageIndex: number): boolean => {
      if (!progress) return false;
      return isStagePlayable(
        stageIndex,
        progress.level,
        progress.currentStageIndex,
      );
    },
    [progress],
  );

  return {
    progress,
    isLoading,
    error,
    gameView,
    setGameView,
    stages: STAGES,
    currentStage,
    isStageCompleted: checkStageCompleted,
    isStagePlayable: checkStagePlayable,
    quizState,
    pendingReward,
    initializeGame,
    startQuiz,
    submitAnswer,
    tickTimer,
    claimReward,
    goHome,
  };
}
