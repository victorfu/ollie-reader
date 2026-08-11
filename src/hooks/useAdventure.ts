import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { useAuth } from "./useAuth";
import {
  getOrCreateProgress,
  fetchProgress,
  saveProgressWithTokenReward,
  claimDailyTokenBonus,
  getDailyTokenBonusPreview,
  isGameProgressResetConflictError,
  STAGES,
  isStageCompleted,
  isStagePlayable,
} from "../services/gameProgressService";
import { prepareGamePool, type GameWord } from "../services/gameService";
import {
  buildQuizQuestions,
  isQuestionCorrect,
  resolveDefLanguage,
} from "../components/Game/quizQuestions";
import type {
  PlayerProgress,
  GameView,
  QuizState,
  Stage,
  GameReward,
  DefLanguage,
} from "../types/game";
import type { VocabularyWord } from "../types/vocabulary";
import {
  coinMultiplierForDefLanguage,
  coinsForAnswer,
  coinsForStageClear,
  type DailyBonusResult,
} from "../services/economyService";

export const QUIZ_TIME_LIMIT = 60; // 每題 60 秒
const QUIZ_MAX_LIVES = 3; // 3 條命
const BOSS_QUESTION_BUFFER = 3; // 魔王題數 = bossHp + buffer（一次失誤不會變不可過）

export interface BossState {
  bossHp: number;
  bossMaxHp: number;
  lastHit: "player" | "boss" | null; // 最近一次是誰被打（給 UI 做 shake）
}

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
  quizTimeLimit: number;

  // 想玩英文但單字池英文釋義不夠，本輪已退回中文
  defLanguageFellBack: boolean;

  // 魔王戰狀態
  bossState: BossState | null;

  // 獎勵狀態
  pendingReward: GameReward | null;

  // 經濟系統
  pendingDailyBonus: DailyBonusResult | null;
  isClaimingDailyBonus: boolean;
  dailyBonusError: string | null;
  tokenSyncError: string | null;
  isSettling: boolean;
  canRetrySettlement: boolean;

  // 動作
  initializeGame: () => Promise<void>;
  startQuiz: (
    stageIndex: number,
    vocabularyWords: VocabularyWord[],
    speechSupported?: boolean,
    preferredDefLanguage?: DefLanguage,
  ) => Promise<void>;
  submitAnswer: (answer: number | string) => void;
  /** 答錯／逾時後由玩家手動推進；答對時 submitAnswer 會自動呼叫 */
  advanceQuestion: () => void;
  tickTimer: () => void;
  claimReward: () => Promise<void>;
  claimDailyBonus: () => Promise<void>;
  retrySettlement: () => Promise<void>;
  clearTokenSyncError: () => void;
  quitQuiz: () => void;
  goHome: () => void;
}

interface PendingSettlement {
  settlementId: string;
  uid: string;
  accountGeneration: number;
  runId: number;
  outcome: "victory" | "defeat";
  stageIndex: number;
  maxCombo: number;
  coinsGained: number;
  defLanguage: DefLanguage;
  expectedResetVersion: number;
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

  // 本輪快問快答累積的扭蛋代幣（每題答對即累加，關卡結束一次寫入）
  const coinsEarnedRef = useRef<number>(0);
  // 同一題只允許結算一次，避免快速連點在 React 狀態更新前重複發代幣
  const answeredQuestionIndexRef = useRef<number | null>(null);
  const dailyClaimInFlightRef = useRef(false);
  // 結算冪等旗標：避免 StrictMode 重複呼叫 / 競態造成雙重寫入與代幣灌水
  const quizEndedRef = useRef<boolean>(false);
  const activeUidRef = useRef<string | null>(null);
  const accountGenerationRef = useRef(0);
  const runIdRef = useRef(0);
  const settlementAttemptIdRef = useRef(0);
  const settlementInFlightRef = useRef<number | null>(null);
  const pendingSettlementRef = useRef<PendingSettlement | null>(null);

  // 本輪實際釋義語言（決定代幣倍率）。用 ref 讓結算 callback 讀得到最新值
  const activeDefLanguageRef = useRef<DefLanguage>("zh");
  const [defLanguageFellBack, setDefLanguageFellBack] = useState(false);

  // 每日獎勵（登入時計算，可領時由 UI 顯示）
  const [pendingDailyBonus, setPendingDailyBonus] =
    useState<DailyBonusResult | null>(null);
  const [isClaimingDailyBonus, setIsClaimingDailyBonus] = useState(false);
  const [dailyBonusError, setDailyBonusError] = useState<string | null>(null);
  const [tokenSyncError, setTokenSyncError] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [canRetrySettlement, setCanRetrySettlement] = useState(false);

  // 用於在 callbacks 內引用最新狀態的 refs
  const progressRef = useRef<PlayerProgress | null>(null);
  const currentStageIndexRef = useRef<number>(0);

  // Track timeouts for cleanup
  const timeoutRefs = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const clearRunTimeouts = useCallback(() => {
    timeoutRefs.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutRefs.current.clear();
  }, []);

  const ownsAccount = useCallback((uid: string, generation: number) => {
    return (
      activeUidRef.current === uid &&
      accountGenerationRef.current === generation
    );
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      activeUidRef.current = null;
      accountGenerationRef.current += 1;
      runIdRef.current += 1;
      settlementAttemptIdRef.current += 1;
      settlementInFlightRef.current = null;
      clearRunTimeouts();
    };
  }, [clearRunTimeouts]);

  // 同步 refs
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    currentStageIndexRef.current = currentStageIndex;
  }, [currentStageIndex]);

  // 從扭蛋分頁切回冒險時，只刷新共用代幣餘額，不干擾進行中的關卡狀態
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const accountGeneration = accountGenerationRef.current;
    if (!ownsAccount(uid, accountGeneration)) return;

    let cancelled = false;
    const refreshTokenBalance = () => {
      void fetchProgress(uid)
        .then((latest) => {
          if (
            cancelled ||
            !latest ||
            !ownsAccount(uid, accountGeneration)
          ) {
            return;
          }
          setProgress((current) => {
            if (!current) return current;
            const next = current.resetVersion === latest.resetVersion
              ? { ...current, coins: latest.coins }
              : latest;
            progressRef.current = next;
            return next;
          });
        })
        .catch((refreshError: unknown) => {
          console.error("Failed to refresh gacha token balance:", refreshError);
        });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshTokenBalance();
    };

    window.addEventListener("focus", refreshTokenBalance);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshTokenBalance);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [ownsAccount, user]);

  // 快問快答狀態
  const [quizState, setQuizState] = useState<QuizState | null>(null);

  // 獎勵狀態
  const [pendingReward, setPendingReward] = useState<GameReward | null>(null);

  // 魔王戰狀態（gameView === "boss" 時與 quizState 並存）
  const [bossState, setBossState] = useState<BossState | null>(null);
  const bossStateRef = useRef<BossState | null>(null);
  const bossHpRef = useRef<number>(0);
  // 讓 tickTimer 能在 updater 外判斷逾時，updater 才能保持純函式
  const quizStateRef = useRef<QuizState | null>(null);

  const setQuizSnapshot = useCallback((next: QuizState | null) => {
    quizStateRef.current = next;
    setQuizState(next);
  }, []);

  const setBossSnapshot = useCallback((next: BossState | null) => {
    bossStateRef.current = next;
    setBossState(next);
  }, []);

  const invalidateRun = useCallback(() => {
    runIdRef.current += 1;
    settlementAttemptIdRef.current += 1;
    settlementInFlightRef.current = null;
    pendingSettlementRef.current = null;
    quizEndedRef.current = false;
    clearRunTimeouts();
    setIsSettling(false);
    setCanRetrySettlement(false);
    return runIdRef.current;
  }, [clearRunTimeouts]);
  useEffect(() => {
    bossStateRef.current = bossState;
  }, [bossState]);
  useEffect(() => {
    quizStateRef.current = quizState;
  }, [quizState]);

  // 初始化遊戲（載入玩家進度）
  const initializeGame = useCallback(async () => {
    const uid = user?.uid;
    const accountGeneration = accountGenerationRef.current;
    if (!uid || !ownsAccount(uid, accountGeneration)) return;

    setIsLoading(true);
    setError(null);

    try {
      const playerProgress = await getOrCreateProgress(uid);
      if (!ownsAccount(uid, accountGeneration)) return;
      progressRef.current = playerProgress;
      setProgress(playerProgress);

      // 日期與金額都用 Firestore server time 推導，不能信任裝置日期。
      try {
        const { bonus } = await getDailyTokenBonusPreview(uid);
        if (!ownsAccount(uid, accountGeneration)) return;
        setPendingDailyBonus(bonus.eligible ? bonus : null);
      } catch (previewError) {
        if (!ownsAccount(uid, accountGeneration)) return;
        // 離線時仍可進入遊戲；每日獎勵等下次能向伺服器驗證時再提示。
        console.error("Failed to preview daily token bonus:", previewError);
        setPendingDailyBonus(null);
      }
    } catch (err) {
      if (!ownsAccount(uid, accountGeneration)) return;
      console.error("Failed to initialize game:", err);
      setError("無法載入遊戲進度");
    } finally {
      if (ownsAccount(uid, accountGeneration)) setIsLoading(false);
    }
  }, [ownsAccount, user?.uid]);

  // 帳號切換必須先換 ownership generation 再清畫面。generation 讓
  // A→B→A 時第一個 A 的 late response 也無法通過（只比 uid 會 ABA）。
  useLayoutEffect(() => {
    const nextUid = user?.uid ?? null;
    if (activeUidRef.current === nextUid) return;

    activeUidRef.current = nextUid;
    accountGenerationRef.current += 1;
    invalidateRun();
    dailyClaimInFlightRef.current = false;
    progressRef.current = null;
    currentStageIndexRef.current = 0;
    coinsEarnedRef.current = 0;
    answeredQuestionIndexRef.current = null;
    bossHpRef.current = 0;
    wordPoolRef.current = [];
    setProgress(null);
    setCurrentStageIndex(0);
    setQuizSnapshot(null);
    setBossSnapshot(null);
    setPendingReward(null);
    setPendingDailyBonus(null);
    setIsClaimingDailyBonus(false);
    setDailyBonusError(null);
    setTokenSyncError(null);
    setDefLanguageFellBack(false);
    setError(null);
    setIsLoading(false);
    setGameView("home");

    if (nextUid) void initializeGame();
  }, [
    initializeGame,
    invalidateRun,
    setBossSnapshot,
    setQuizSnapshot,
    user?.uid,
  ]);

  // 開始快問快答
  const startQuiz = useCallback(
    async (
      stageIndex: number,
      vocabularyWords: VocabularyWord[],
      speechSupported: boolean = true,
      preferredDefLanguage: DefLanguage = "zh",
    ) => {
      const uid = user?.uid;
      const accountGeneration = accountGenerationRef.current;
      const currentProgress = progressRef.current;
      if (
        !uid ||
        !currentProgress ||
        !ownsAccount(uid, accountGeneration)
      ) {
        return;
      }

      const stage = STAGES[stageIndex];
      if (!stage) {
        setError("關卡不存在");
        return;
      }

      const runId = invalidateRun();

      setIsLoading(true);
      setError(null);
      setTokenSyncError(null);
      setCurrentStageIndex(stageIndex);
      currentStageIndexRef.current = stageIndex;
      setQuizSnapshot(null);
      setBossSnapshot(null);
      setPendingReward(null);
      coinsEarnedRef.current = 0;
      answeredQuestionIndexRef.current = null;
      bossHpRef.current = 0;

      try {
        // 準備題目池
        const wordPool = await prepareGamePool(vocabularyWords);
        if (
          runId !== runIdRef.current ||
          !ownsAccount(uid, accountGeneration)
        ) {
          return;
        }

        wordPoolRef.current = wordPool;

        // 魔王關題數 = bossHp + buffer，確保一次失誤不會變不可過
        const bossHp = stage.bossHp ?? 5;
        const questionCount = stage.isBoss
          ? bossHp + BOSS_QUESTION_BUFFER
          : stage.questionCount;

        // 本輪釋義語言：英文釋義不足就整輪退回中文（並且不發英文模式加成）
        const effectiveDefLanguage = resolveDefLanguage(
          wordPool,
          preferredDefLanguage,
        );
        activeDefLanguageRef.current = effectiveDefLanguage;
        setDefLanguageFellBack(
          preferredDefLanguage === "en" && effectiveDefLanguage === "zh",
        );

        // 依關卡題型組合建題
        const questions = buildQuizQuestions(wordPool, stage, {
          speechSupported,
          count: questionCount,
          defLanguage: effectiveDefLanguage,
        });

        // 初始化快問快答狀態
        const initialQuizState: QuizState = {
          questions,
          currentIndex: 0,
          timeLeft: QUIZ_TIME_LIMIT,
          lives: QUIZ_MAX_LIVES,
          maxLives: QUIZ_MAX_LIVES,
          score: 0,
          combo: 0,
          maxCombo: 0,
          isAnswered: false,
          lastAnswerCorrect: null,
        };
        setQuizSnapshot(initialQuizState);

        // 魔王關：初始化魔王血量並切到魔王畫面
        if (stage.isBoss) {
          bossHpRef.current = bossHp;
          setBossSnapshot({ bossHp, bossMaxHp: bossHp, lastHit: null });
          setGameView("boss");
        } else {
          bossHpRef.current = 0;
          setBossSnapshot(null);
          setGameView("quiz");
        }
      } catch (err) {
        if (
          runId !== runIdRef.current ||
          !ownsAccount(uid, accountGeneration)
        ) {
          return;
        }
        console.error("Failed to start quiz:", err);
        setError("無法開始遊戲");
      } finally {
        if (
          runId === runIdRef.current &&
          ownsAccount(uid, accountGeneration)
        ) {
          setIsLoading(false);
        }
      }
    },
    [
      invalidateRun,
      ownsAccount,
      setBossSnapshot,
      setQuizSnapshot,
      user?.uid,
    ],
  );

  const attemptSettlement = useCallback(
    async (request: PendingSettlement) => {
      if (
        !ownsAccount(request.uid, request.accountGeneration) ||
        request.runId !== runIdRef.current ||
        settlementInFlightRef.current !== null
      ) {
        return;
      }

      const stage = STAGES[request.stageIndex];
      if (!stage) return;

      const attemptId = ++settlementAttemptIdRef.current;
      settlementInFlightRef.current = attemptId;
      setIsSettling(true);
      setCanRetrySettlement(false);
      setTokenSyncError(null);

      try {
        const result = await saveProgressWithTokenReward(
          request.uid,
          request.outcome === "victory"
            ? {
                settlementId: request.settlementId,
                outcome: "victory",
                stageIndex: request.stageIndex,
                expGained: stage.rewardExp,
                maxCombo: request.maxCombo,
                bossDefeated: stage.isBoss,
              }
            : {
                settlementId: request.settlementId,
                outcome: "defeat",
              },
          request.coinsGained,
          request.expectedResetVersion,
        );

        if (
          !ownsAccount(request.uid, request.accountGeneration) ||
          request.runId !== runIdRef.current ||
          attemptId !== settlementAttemptIdRef.current
        ) {
          return;
        }

        const latestLocalProgress = progressRef.current;
        if (
          !latestLocalProgress ||
          latestLocalProgress.resetVersion !== result.progress.resetVersion
        ) {
          invalidateRun();
          setTokenSyncError("遊戲進度已在其他分頁重設，本輪結果不再套用。");
          setPendingReward(null);
          setGameView("home");
          coinsEarnedRef.current = 0;
          bossHpRef.current = 0;
          answeredQuestionIndexRef.current = null;
          setBossSnapshot(null);
          setQuizSnapshot(null);
          return;
        }

        const nextProgress = { ...latestLocalProgress, ...result.progress };
        progressRef.current = nextProgress;
        setProgress(nextProgress);
        pendingSettlementRef.current = null;
        setCanRetrySettlement(false);
        setTokenSyncError(null);

        if (request.outcome === "victory") {
          setPendingReward({
            expGained: stage.rewardExp,
            newLevel: result.didLevelUp ? result.progress.level : undefined,
            isNewHighScore: result.isNewHighScore,
            coinsGained: request.coinsGained,
            defLanguage: request.defLanguage,
            isBossVictory: stage.isBoss,
          });
          setGameView("reward");
        } else {
          setGameView("map");
        }

        clearRunTimeouts();
        coinsEarnedRef.current = 0;
        bossHpRef.current = 0;
        answeredQuestionIndexRef.current = null;
        setBossSnapshot(null);
        setQuizSnapshot(null);
      } catch (settlementError) {
        if (
          !ownsAccount(request.uid, request.accountGeneration) ||
          request.runId !== runIdRef.current ||
          attemptId !== settlementAttemptIdRef.current
        ) {
          return;
        }

        if (isGameProgressResetConflictError(settlementError)) {
          let latest: PlayerProgress | null = null;
          try {
            latest = await fetchProgress(request.uid);
          } catch (refreshError) {
            console.error("重設後重新載入進度失敗:", refreshError);
          }
          if (
            !ownsAccount(request.uid, request.accountGeneration) ||
            request.runId !== runIdRef.current ||
            attemptId !== settlementAttemptIdRef.current
          ) {
            return;
          }

          invalidateRun();
          if (latest) {
            progressRef.current = latest;
            setProgress(latest);
          }
          setTokenSyncError("遊戲進度已在其他分頁重設，本輪結果未寫入。");
          setPendingReward(null);
          setGameView("home");
          coinsEarnedRef.current = 0;
          bossHpRef.current = 0;
          answeredQuestionIndexRef.current = null;
          setBossSnapshot(null);
          setQuizSnapshot(null);
          return;
        }

        // Firestore transaction rejection means the whole settlement failed.
        // Keep the final question and exact request so retry cannot double-add
        // stage rewards or silently advance only the local progress.
        console.error("進度寫入失敗:", settlementError);
        setTokenSyncError("本輪進度與代幣尚未完成結算，請確認連線後重試。");
        setCanRetrySettlement(true);
      } finally {
        if (
          ownsAccount(request.uid, request.accountGeneration) &&
          settlementInFlightRef.current === attemptId
        ) {
          settlementInFlightRef.current = null;
          setIsSettling(false);
        }
      }
    },
    [
      clearRunTimeouts,
      invalidateRun,
      ownsAccount,
      setBossSnapshot,
      setQuizSnapshot,
    ],
  );

  // 建立一次不可變的結算請求；重試只重送這一份，避免重複加過關獎勵。
  const handleQuizEnd = useCallback(
    (
      isVictory: boolean,
      maxCombo: number,
      runId: number,
      uid: string,
      accountGeneration: number,
    ) => {
      const currentProgress = progressRef.current;
      const stageIndex = currentStageIndexRef.current;
      if (
        !currentProgress ||
        !ownsAccount(uid, accountGeneration) ||
        runId !== runIdRef.current ||
        quizEndedRef.current
      ) {
        return;
      }

      const stage = STAGES[stageIndex];
      if (!stage) return;

      quizEndedRef.current = true;
      const defLanguage = activeDefLanguageRef.current;
      const request: PendingSettlement = {
        settlementId: globalThis.crypto.randomUUID(),
        uid,
        accountGeneration,
        runId,
        outcome: isVictory ? "victory" : "defeat",
        stageIndex,
        maxCombo,
        coinsGained:
          coinsEarnedRef.current +
          (isVictory
            ? coinsForStageClear(
                stage.rewardCoins,
                stage.isBoss,
                coinMultiplierForDefLanguage(defLanguage),
              )
            : 0),
        defLanguage,
        expectedResetVersion: currentProgress.resetVersion,
      };
      pendingSettlementRef.current = request;
      void attemptSettlement(request);
    },
    [attemptSettlement, ownsAccount],
  );

  /**
   * 推進到下一題（或結算本輪）。
   * 答對 → submitAnswer 排 1.5 秒後自動呼叫；答錯／逾時 → 由玩家按「下一題」呼叫。
   * 只有 isAnswered 的題目能推進，順便擋掉連點跳題。
   */
  const advanceQuestionForRun = useCallback(
    (runId: number, uid: string, accountGeneration: number) => {
      if (
        !ownsAccount(uid, accountGeneration) ||
        runId !== runIdRef.current ||
        quizEndedRef.current
      ) {
        return;
      }
      const inBoss = bossStateRef.current !== null;
      const current = quizStateRef.current;
      if (!current || !current.isAnswered) return;

      const isLastQuestion =
        current.currentIndex >= current.questions.length - 1;

      if (inBoss) {
        if (bossHpRef.current <= 0) {
          handleQuizEnd(
            true,
            current.maxCombo,
            runId,
            uid,
            accountGeneration,
          );
          return;
        }
        if (current.lives <= 0 || isLastQuestion) {
          handleQuizEnd(
            false,
            current.maxCombo,
            runId,
            uid,
            accountGeneration,
          );
          return;
        }
      } else if (isLastQuestion || current.lives <= 0) {
        handleQuizEnd(
          current.lives > 0,
          current.maxCombo,
          runId,
          uid,
          accountGeneration,
        );
        return;
      }

      answeredQuestionIndexRef.current = null;
      setQuizSnapshot({
        ...current,
        currentIndex: current.currentIndex + 1,
        timeLeft: QUIZ_TIME_LIMIT,
        isAnswered: false,
        lastAnswerCorrect: null,
      });
    },
    [handleQuizEnd, ownsAccount, setQuizSnapshot],
  );

  const advanceQuestion = useCallback(() => {
    const uid = activeUidRef.current;
    const accountGeneration = accountGenerationRef.current;
    if (!uid || !ownsAccount(uid, accountGeneration)) return;
    advanceQuestionForRun(runIdRef.current, uid, accountGeneration);
  }, [advanceQuestionForRun, ownsAccount]);

  // 提交答案（選項題傳 index，拼字題傳字串）
  const submitAnswer = useCallback(
    (answer: number | string) => {
      const uid = activeUidRef.current;
      const accountGeneration = accountGenerationRef.current;
      const current = quizStateRef.current;
      if (
        !uid ||
        !ownsAccount(uid, accountGeneration) ||
        !current ||
        current.isAnswered ||
        quizEndedRef.current
      ) {
        return;
      }

      if (answeredQuestionIndexRef.current === current.currentIndex) return;
      answeredQuestionIndexRef.current = current.currentIndex;

      const currentQuestion = current.questions[current.currentIndex];
      const isCorrect = isQuestionCorrect(currentQuestion, answer);

      const inBoss = bossStateRef.current !== null;

      // 答對即累積扭蛋代幣 — 以題號 ref 防止快速連點重複發放
      if (isCorrect) {
        coinsEarnedRef.current += coinsForAnswer(
          current.combo + 1,
          coinMultiplierForDefLanguage(activeDefLanguageRef.current),
        );
        // 魔王扣血（連擊 ≥3 爆擊 -2）
        if (inBoss) {
          const crit = current.combo + 1 >= 3;
          const newHp = Math.max(0, bossHpRef.current - (crit ? 2 : 1));
          bossHpRef.current = newHp;
          const boss = bossStateRef.current;
          if (boss) {
            setBossSnapshot({ ...boss, bossHp: newHp, lastHit: "boss" });
          }
        }
      } else if (inBoss) {
        const boss = bossStateRef.current;
        if (boss) setBossSnapshot({ ...boss, lastHit: "player" });
      }

      const newCombo = isCorrect ? current.combo + 1 : 0;
      setQuizSnapshot({
        ...current,
        score: current.score + (isCorrect ? 100 + current.combo * 10 : 0),
        combo: newCombo,
        maxCombo: Math.max(current.maxCombo, newCombo),
        lives: isCorrect ? current.lives : current.lives - 1,
        isAnswered: true,
        lastAnswerCorrect: isCorrect,
      });

      // 答對才自動進下一題；答錯停在原地，讓玩家看清正確答案後自己按「下一題」
      if (isCorrect) {
        const runId = runIdRef.current;
        const timeoutId = setTimeout(() => {
          timeoutRefs.current.delete(timeoutId);
          advanceQuestionForRun(runId, uid, accountGeneration);
        }, 1500);
        timeoutRefs.current.add(timeoutId);
      }
    },
    [advanceQuestionForRun, ownsAccount, setBossSnapshot, setQuizSnapshot],
  );

  /**
   * 計時器每秒減少。逾時＝答錯：扣命、斷連擊，但**不**自動推進 —
   * 和答錯一樣停下來等玩家自己按「下一題」。
   */
  const tickTimer = useCallback(() => {
    const uid = activeUidRef.current;
    const accountGeneration = accountGenerationRef.current;
    const current = quizStateRef.current;
    if (
      !uid ||
      !ownsAccount(uid, accountGeneration) ||
      !current ||
      current.isAnswered ||
      quizEndedRef.current
    ) {
      return;
    }

    if (current.timeLeft > 1) {
      setQuizSnapshot({ ...current, timeLeft: current.timeLeft - 1 });
      return;
    }

    // 時間到
    const boss = bossStateRef.current;
    if (boss) setBossSnapshot({ ...boss, lastHit: "player" });
    answeredQuestionIndexRef.current = current.currentIndex;
    setQuizSnapshot({
      ...current,
      timeLeft: 0,
      lives: current.lives - 1,
      combo: 0,
      isAnswered: true,
      lastAnswerCorrect: false,
    });
  }, [ownsAccount, setBossSnapshot, setQuizSnapshot]);

  const retrySettlement = useCallback(async () => {
    const request = pendingSettlementRef.current;
    if (
      !request ||
      !ownsAccount(request.uid, request.accountGeneration) ||
      request.runId !== runIdRef.current
    ) {
      return;
    }
    await attemptSettlement(request);
  }, [attemptSettlement, ownsAccount]);

  const quitQuiz = useCallback(() => {
    invalidateRun();
    setIsLoading(false);
    setTokenSyncError(null);
    setPendingReward(null);
    setQuizSnapshot(null);
    setBossSnapshot(null);
    coinsEarnedRef.current = 0;
    bossHpRef.current = 0;
    answeredQuestionIndexRef.current = null;
    setGameView("map");
  }, [invalidateRun, setBossSnapshot, setQuizSnapshot]);

  // 領取獎勵
  const claimReward = useCallback(async () => {
    setPendingReward(null);
    setGameView("map");
  }, []);

  // 回到主畫面
  const goHome = useCallback(() => {
    invalidateRun();
    setIsLoading(false);
    setGameView("home");
    setQuizSnapshot(null);
    setBossSnapshot(null);
    setPendingReward(null);
    setTokenSyncError(null);
    coinsEarnedRef.current = 0;
    bossHpRef.current = 0;
    answeredQuestionIndexRef.current = null;
  }, [invalidateRun, setBossSnapshot, setQuizSnapshot]);

  // 領取每日獎勵（冪等：領完 lastDailyClaimDate=today，下次載入即不再提示）
  const claimDailyBonus = useCallback(async () => {
    const uid = user?.uid;
    const accountGeneration = accountGenerationRef.current;
    const cur = progressRef.current;
    const bonus = pendingDailyBonus;
    if (!uid || !ownsAccount(uid, accountGeneration)) return;
    if (!cur || !bonus || !bonus.eligible) {
      setPendingDailyBonus(null);
      return;
    }
    if (dailyClaimInFlightRef.current) return;

    dailyClaimInFlightRef.current = true;
    setIsClaimingDailyBonus(true);
    setDailyBonusError(null);
    try {
      const result = await claimDailyTokenBonus(uid);
      if (!ownsAccount(uid, accountGeneration)) return;
      setProgress((previous) => {
        if (!previous || !ownsAccount(uid, accountGeneration)) return previous;
        const next = {
          ...previous,
          coins: result.tokenBalance,
          streakDays: result.streakDays,
          lastDailyClaimDate: result.claimDate,
          lastLoginDate: result.claimDate,
        };
        progressRef.current = next;
        return next;
      });
      setPendingDailyBonus(null);
    } catch (claimError) {
      if (!ownsAccount(uid, accountGeneration)) return;
      console.error("每日代幣領取失敗:", claimError);
      setDailyBonusError("每日代幣尚未入帳，請確認連線後重試。");
    } finally {
      if (ownsAccount(uid, accountGeneration)) {
        dailyClaimInFlightRef.current = false;
        setIsClaimingDailyBonus(false);
      }
    }
  }, [ownsAccount, pendingDailyBonus, user?.uid]);

  const clearTokenSyncError = useCallback(() => {
    setTokenSyncError(null);
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
    quizTimeLimit: QUIZ_TIME_LIMIT,
    defLanguageFellBack,
    bossState,
    pendingReward,
    pendingDailyBonus,
    isClaimingDailyBonus,
    dailyBonusError,
    tokenSyncError,
    isSettling,
    canRetrySettlement,
    initializeGame,
    startQuiz,
    submitAnswer,
    advanceQuestion,
    tickTimer,
    claimReward,
    claimDailyBonus,
    retrySettlement,
    clearTokenSyncError,
    quitQuiz,
    goHome,
  };
}
