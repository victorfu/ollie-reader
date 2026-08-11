import { useState, useCallback, useRef } from "react";
import { useVocabulary } from "./useVocabulary";
import type { GameState, Monster, Player, GameStats } from "../types/game";
import {
  FALLBACK_GAME_WORDS,
  prepareGamePool,
  type GameWord,
} from "../services/gameService";
import confetti from "canvas-confetti";
import { buildMagicBattleOptions } from "../components/Game/magicBattleOptions";

// Kawaii-only monster emojis (cute animals, fantasy creatures, foods, nature)
const MONSTER_EMOJIS = [
  // 可愛動物系
  "🐱",
  "🐶",
  "🐰",
  "🐻",
  "🐼",
  "🐨",
  "🦊",
  "🦁",
  "🐯",
  "🐮",
  "🐷",
  "🐸",
  "🐵",
  "🐔",
  "🐧",
  "🐦",
  "🐤",
  "🦆",
  "🦉",
  "🐴",
  "🦄",
  "🐝",
  "🦋",
  "🐌",
  "🐞",
  "🐢",
  "🐙",
  "🦑",
  "🐠",
  "🐟",
  "🐬",
  "🐳",
  "🐋",
  "🐘",
  "🦒",
  "🦘",
  "🐇",
  "🐿️",
  "🦔",
  "🦦",
  "🦥",
  "🐹",
  "🦭",
  "🐕",
  "🐩",
  "🦩",
  "🦚",
  "🦜",
  "🦢",
  // 可愛奇幻系
  "🧚",
  "🧜",
  "🧝",
  "👼",
  "🦄",
  "🐉",
  "🌸",
  "🌺",
  "🌻",
  "🌷",
  // 可愛食物系
  "🍓",
  "🍒",
  "🍎",
  "🍑",
  "🍊",
  "🍋",
  "🍌",
  "🍉",
  "🍇",
  "🫐",
  "🧁",
  "🍩",
  "🍪",
  "🍰",
  "🎂",
  "🍭",
  "🍬",
  "🍡",
  "🍙",
  "🍦",
  // 可愛貓咪表情系
  "😺",
  "😸",
  "😹",
  "😻",
  "😽",
  "🐾",
  // 可愛自然系
  "🌈",
  "⭐",
  "🌟",
  "💫",
  "✨",
  "🎀",
  "💝",
  "💖",
  "🎈",
  "🎁",
];

const MONSTER_NAMES = [
  // 可愛動物系
  "喵喵",
  "汪汪",
  "兔兔",
  "熊熊",
  "圓圓",
  "無尾熊",
  "狐狸精靈",
  "獅子王",
  "虎虎",
  "牛牛",
  "豬豬",
  "青蛙",
  "猴子",
  "小雞",
  "企鵝",
  "小鳥",
  "黃小鴨",
  "唐老鴨",
  "貓頭鷹",
  "小馬",
  "獨角獸",
  "小蜜蜂",
  "蝴蝶仙子",
  "蝸牛",
  "瓢蟲",
  "烏龜",
  "章魚哥",
  "烏賊",
  "熱帶魚",
  "小金魚",
  "海豚",
  "鯨魚",
  "藍鯨",
  "大象",
  "長頸鹿",
  "袋鼠",
  "小兔子",
  "松鼠",
  "刺蝟",
  "水獺",
  "樹懶",
  "倉鼠",
  "海豹",
  "柴犬",
  "貴賓狗",
  "紅鶴",
  "孔雀",
  "鸚鵡",
  "天鵝",
  // 可愛奇幻系
  "小仙女",
  "美人魚",
  "精靈",
  "小天使",
  "彩虹獸",
  "小龍",
  "櫻花精靈",
  "花仙子",
  "向日葵",
  "鬱金香",
  // 可愛食物系
  "草莓寶",
  "櫻桃",
  "蘋果",
  "蜜桃",
  "橘子",
  "檸檬",
  "香蕉",
  "西瓜",
  "葡萄",
  "藍莓",
  "杯子蛋糕",
  "甜甜圈",
  "餅乾",
  "蛋糕",
  "生日蛋糕",
  "棒棒糖",
  "糖果",
  "糰子",
  "飯糰",
  "冰淇淋",
  // 可愛貓咪表情系
  "開心貓",
  "笑笑貓",
  "傻笑貓",
  "愛心貓",
  "親親貓",
  "小腳印",
  // 可愛自然系
  "彩虹",
  "小星星",
  "閃亮星",
  "流星",
  "閃閃",
  "蝴蝶結",
  "愛心",
  "粉紅心",
  "氣球",
  "禮物",
];

const PLAYER_MAX_HP = 3;
const MONSTER_MAX_HP = 1;
const MONSTERS_TO_WIN = 10; // Victory condition: defeat 10 monsters

export function useMagicBattle() {
  const { words } = useVocabulary();
  const [gameState, setGameState] = useState<GameState>("menu");
  const [player, setPlayer] = useState<Player>({
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    name: "Ollie",
  });
  const [currentMonster, setCurrentMonster] = useState<Monster | null>(null);
  const [gamePool, setGamePool] = useState<GameWord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Track used words to avoid repetition within a session
  const usedWordsRef = useRef<Set<string>>(new Set());

  // Track progress toward victory
  const [progress, setProgress] = useState({
    current: 0,
    total: MONSTERS_TO_WIN,
  });

  const [stats, setStats] = useState<GameStats>({
    score: 0,
    combo: 0,
    maxCombo: 0,
    monstersDefeated: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
  });

  const [feedback, setFeedback] = useState<"hit" | "damage" | "miss" | null>(
    null,
  );

  // Initialize game pool when starting
  const initializeGame = useCallback(async () => {
    setIsLoading(true);
    usedWordsRef.current = new Set(); // Reset used words tracking
    const pool = await prepareGamePool(words);
    setGamePool(pool);
    setIsLoading(false);
    setGameState("playing");
    setPlayer({ hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, name: "Ollie" });
    setProgress({ current: 0, total: MONSTERS_TO_WIN });
    setStats({
      score: 0,
      combo: 0,
      maxCombo: 0,
      monstersDefeated: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
    });
    // Spawn first monster immediately after pool is ready
    // We need to pass the pool directly because state update is async
    spawnMonster(pool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words]);

  // Generate a new monster
  const spawnMonster = useCallback(
    (currentPool: GameWord[] = gamePool) => {
      if (currentPool.length === 0) return;

      // Filter out already used words, but if all are used, reset and reuse
      let availableWords = currentPool.filter(
        (w) => !usedWordsRef.current.has(w.word),
      );
      if (availableWords.length < 4) {
        // Not enough words, reset used tracking and use full pool
        usedWordsRef.current = new Set();
        availableWords = currentPool;
      }

      // Pick a target word
      const targetIndex = Math.floor(Math.random() * availableWords.length);
      const targetWord = availableWords[targetIndex];

      // Mark this word as used
      usedWordsRef.current.add(targetWord.word);

      // Supplement user vocabulary with fallback definitions only when needed;
      // the builder de-duplicates what the player actually sees.
      const options = buildMagicBattleOptions(
        targetWord,
        [...currentPool, ...FALLBACK_GAME_WORDS],
      );

      const monsterIndex = Math.floor(Math.random() * MONSTER_EMOJIS.length);

      const newMonster: Monster = {
        id: Math.random().toString(36).substr(2, 9),
        name: MONSTER_NAMES[monsterIndex],
        emoji: MONSTER_EMOJIS[monsterIndex],
        hp: MONSTER_MAX_HP,
        maxHp: MONSTER_MAX_HP,
        word: targetWord.word,
        definitions: options.definitions,
        correctDefinitionIndex: options.correctDefinitionIndex,
      };

      setCurrentMonster(newMonster);
      setFeedback(null);
    },
    [gamePool],
  );

  const startGame = useCallback(() => {
    void initializeGame();
  }, [initializeGame]);

  const handleAttack = useCallback(
    (optionIndex: number) => {
      if (gameState !== "playing" || !currentMonster || feedback !== null)
        return;

      if (optionIndex === currentMonster.correctDefinitionIndex) {
        // Correct Answer
        setFeedback("hit");

        // Update stats and progress
        const newMonstersDefeated = stats.monstersDefeated + 1;

        setStats((prev) => {
          const newCombo = prev.combo + 1;
          return {
            ...prev,
            score: prev.score + 100 + newCombo * 10,
            combo: newCombo,
            maxCombo: Math.max(prev.maxCombo, newCombo),
            monstersDefeated: newMonstersDefeated,
            correctAnswers: prev.correctAnswers + 1,
          };
        });

        setProgress((prev) => ({ ...prev, current: newMonstersDefeated }));

        // Visual effects - kawaii pink/purple confetti
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ["#F472B6", "#A855F7", "#EC4899", "#C084FC", "#FBCFE8"],
        });

        // Check victory condition
        if (newMonstersDefeated >= MONSTERS_TO_WIN) {
          setTimeout(() => setGameState("victory"), 800);
        } else {
          // Delay for animation then spawn next
          setTimeout(() => {
            spawnMonster();
          }, 800);
        }
      } else {
        // Wrong Answer
        setFeedback("damage");

        // Update stats
        setStats((prev) => ({
          ...prev,
          combo: 0,
          wrongAnswers: prev.wrongAnswers + 1,
        }));

        // Player takes damage
        setPlayer((prev) => {
          const newHp = prev.hp - 1;
          if (newHp <= 0) {
            setTimeout(() => setGameState("defeat"), 1000);
          } else {
            // Reset feedback after delay so player can try again
            setTimeout(() => {
              setFeedback(null);
            }, 1000);
          }
          return { ...prev, hp: newHp };
        });
      }
    },
    [gameState, currentMonster, spawnMonster, feedback, stats.monstersDefeated],
  );

  const restartGame = () => {
    void initializeGame();
  };

  const quitGame = () => {
    setGameState("menu");
  };

  return {
    gameState,
    player,
    currentMonster,
    stats,
    feedback,
    isLoading,
    progress,
    startGame,
    handleAttack,
    restartGame,
    quitGame,
  };
}
