import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import {
  getOrCreateProgress,
  saveProgress,
  unlockSpirit,
  evolveSpirit,
  calculateLevelUp,
  STAGES,
  isStageCompleted,
  isStagePlayable,
} from "../services/gameProgressService";
import { checkPendingEvolution } from "../services/spiritEvolution";
import { prepareGamePool, type GameWord } from "../services/gameService";
import {
  buildQuizQuestions,
  isQuestionCorrect,
} from "../components/Game/quizQuestions";
import type {
  PlayerProgress,
  GameView,
  QuizState,
  Stage,
  GameReward,
  Spirit,
} from "../types/game";
import type { VocabularyWord } from "../types/vocabulary";
import { getSpiritById } from "../assets/spirits";
import {
  coinsForAnswer,
  coinsForStageClear,
  computeDailyBonus,
  canAffordGacha,
  drawGacha,
  todayLocal,
  type DailyBonusResult,
  type GachaResult,
} from "../services/economyService";

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

  // 經濟系統
  coins: number;
  pendingDailyBonus: DailyBonusResult | null;

  // 動作
  initializeGame: () => Promise<void>;
  startQuiz: (
    stageIndex: number,
    vocabularyWords: VocabularyWord[],
    speechSupported?: boolean,
  ) => Promise<void>;
  submitAnswer: (answer: number | string) => void;
  tickTimer: () => void;
  claimReward: () => Promise<void>;
  claimDailyBonus: () => Promise<void>;
  drawGacha: () => Promise<GachaResult | null>;
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

  // 本輪快問快答累積的金幣（每題答對即累加，關卡結束一次寫入）
  const coinsEarnedRef = useRef<number>(0);
  // 本輪答對題數（用於元素訓練 → 進化）
  const correctCountRef = useRef<number>(0);

  // 每日獎勵（登入時計算，可領時由 UI 顯示）
  const [pendingDailyBonus, setPendingDailyBonus] =
    useState<DailyBonusResult | null>(null);

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

      // 計算每日獎勵（今天還沒領才提示）
      const bonus = computeDailyBonus(
        playerProgress.lastDailyClaimDate,
        todayLocal(),
        playerProgress.streakDays,
      );
      setPendingDailyBonus(bonus.eligible ? bonus : null);
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

  // 開始快問快答
  const startQuiz = useCallback(
    async (
      stageIndex: number,
      vocabularyWords: VocabularyWord[],
      speechSupported: boolean = true,
    ) => {
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
        coinsEarnedRef.current = 0; // 重置本輪金幣
        correctCountRef.current = 0; // 重置本輪答對數

        // 依關卡題型組合建題
        const questions = buildQuizQuestions(wordPool, stage, {
          speechSupported,
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
    [progress],
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

        // 金幣：答題累積 + 過關獎勵
        coinsEarnedRef.current += coinsForStageClear(
          stage.rewardCoins,
          stage.isBoss,
        );
        const coinsGained = coinsEarnedRef.current;
        const newCoins = currentProgress.coins + coinsGained;

        // 元素訓練：本關獎勵精靈的元素 += 本輪答對數
        const stageElement = stage.rewardSpiritId
          ? getSpiritById(stage.rewardSpiritId)?.element
          : undefined;
        const newElementProgress = { ...currentProgress.elementProgress };
        if (stageElement && correctCountRef.current > 0) {
          newElementProgress[stageElement] =
            (newElementProgress[stageElement] ?? 0) + correctCountRef.current;
        }

        // 進化檢查（含本關剛解鎖的精靈）
        const ownedAfterUnlock = newSpirit
          ? [...currentProgress.unlockedSpiritIds, stage.rewardSpiritId!]
          : currentProgress.unlockedSpiritIds;
        const evolution = checkPendingEvolution({
          unlockedSpiritIds: ownedAfterUnlock,
          evolvedSpiritIds: currentProgress.evolvedSpiritIds,
          elementProgress: newElementProgress,
          level: newLevel,
        });
        if (evolution) {
          await evolveSpirit(user.uid, evolution.from.id, evolution.to.id);
        }

        await saveProgress(user.uid, {
          level: newLevel,
          exp: newExp,
          expToNextLevel,
          currentStageIndex: newStageIndex,
          totalQuizCompleted: currentProgress.totalQuizCompleted + 1,
          highestCombo: newHighestCombo,
          coins: newCoins,
          elementProgress: newElementProgress,
        });

        // 更新本地狀態
        setProgress((prev) => {
          if (!prev) return prev;
          let unlockedSpiritIds = newSpirit
            ? [...prev.unlockedSpiritIds, stage.rewardSpiritId!]
            : prev.unlockedSpiritIds;
          let evolvedSpiritIds = prev.evolvedSpiritIds;
          if (evolution) {
            if (!evolvedSpiritIds.includes(evolution.from.id)) {
              evolvedSpiritIds = [...evolvedSpiritIds, evolution.from.id];
            }
            if (!unlockedSpiritIds.includes(evolution.to.id)) {
              unlockedSpiritIds = [...unlockedSpiritIds, evolution.to.id];
            }
          }
          return {
            ...prev,
            level: newLevel,
            exp: newExp,
            expToNextLevel,
            currentStageIndex: newStageIndex,
            totalQuizCompleted: prev.totalQuizCompleted + 1,
            highestCombo: newHighestCombo,
            coins: newCoins,
            elementProgress: newElementProgress,
            unlockedSpiritIds,
            evolvedSpiritIds,
          };
        });

        // 設定獎勵
        setPendingReward({
          expGained,
          newLevel: didLevelUp ? newLevel : undefined,
          newSpirit,
          isNewHighScore: maxCombo > currentProgress.highestCombo,
          coinsGained,
          evolvedSpirit: evolution
            ? { from: evolution.from, to: evolution.to }
            : undefined,
        });

        setGameView("reward");
      } else {
        // 失敗：仍保留本輪金幣與元素訓練進度（不懲罰），再回地圖
        const coinsGained = coinsEarnedRef.current;
        const stageElement = stage.rewardSpiritId
          ? getSpiritById(stage.rewardSpiritId)?.element
          : undefined;
        const newElementProgress = { ...currentProgress.elementProgress };
        if (stageElement && correctCountRef.current > 0) {
          newElementProgress[stageElement] =
            (newElementProgress[stageElement] ?? 0) + correctCountRef.current;
        }
        const newCoins = currentProgress.coins + coinsGained;
        await saveProgress(user.uid, {
          coins: newCoins,
          elementProgress: newElementProgress,
        });
        setProgress((prev) =>
          prev
            ? { ...prev, coins: newCoins, elementProgress: newElementProgress }
            : prev,
        );
        setGameView("map");
      }

      coinsEarnedRef.current = 0;
      correctCountRef.current = 0;
      setQuizState(null);
    },
    [user],
  );

  // 提交答案（選項題傳 index，拼字題傳字串）
  const submitAnswer = useCallback(
    (answer: number | string) => {
      if (!quizState || quizState.isAnswered) return;

      const currentQuestion = quizState.questions[quizState.currentIndex];
      const isCorrect = isQuestionCorrect(currentQuestion, answer);

      // 答對即累積金幣與答對數 — 在 updater 外累加，避免 StrictMode 重複
      if (isCorrect) {
        coinsEarnedRef.current += coinsForAnswer(quizState.combo + 1);
        correctCountRef.current += 1;
      }

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

  // 領取每日獎勵（冪等：領完 lastDailyClaimDate=today，下次載入即不再提示）
  const claimDailyBonus = useCallback(async () => {
    const cur = progressRef.current;
    const bonus = pendingDailyBonus;
    if (!user || !cur || !bonus || !bonus.eligible) {
      setPendingDailyBonus(null);
      return;
    }
    const today = todayLocal();
    const patch = {
      coins: cur.coins + bonus.coins,
      streakDays: bonus.streakDays,
      lastDailyClaimDate: today,
      lastLoginDate: today,
    };
    await saveProgress(user.uid, patch);
    setProgress((prev) => (prev ? { ...prev, ...patch } : prev));
    setPendingDailyBonus(null);
  }, [user, pendingDailyBonus]);

  // 抽扭蛋：扣幣、解鎖新精靈（重複則退幣），回傳結果供 UI 演出
  const drawGachaAction = useCallback(async (): Promise<GachaResult | null> => {
    const cur = progressRef.current;
    if (!user || !cur || !canAffordGacha(cur.coins)) return null;

    const result = drawGacha(cur.unlockedSpiritIds);
    const willUnlock = !result.isDuplicate;
    const newCoins = cur.coins - result.coinsSpent + result.refundCoins;

    await saveProgress(user.uid, { coins: newCoins });
    if (willUnlock) await unlockSpirit(user.uid, result.spiritId);

    setProgress((prev) =>
      prev
        ? {
            ...prev,
            coins: newCoins,
            unlockedSpiritIds: willUnlock
              ? [...prev.unlockedSpiritIds, result.spiritId]
              : prev.unlockedSpiritIds,
          }
        : prev,
    );
    return result;
  }, [user]);

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
    coins: progress?.coins ?? 0,
    pendingDailyBonus,
    initializeGame,
    startQuiz,
    submitAnswer,
    tickTimer,
    claimReward,
    claimDailyBonus,
    drawGacha: drawGachaAction,
    goHome,
  };
}
