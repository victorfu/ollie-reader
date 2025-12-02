import { generateGameWords as generateGameWordsAI, type GameWord } from "./aiService";
import type { VocabularyWord } from "../types/vocabulary";

// ============ 音效系統 ============

type SoundEffect = "correct" | "wrong" | "levelup" | "unlock" | "click";

// Lazy initialization of AudioContext to avoid browser warnings
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext ||
      (window as typeof window & { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
  }
  return audioContext;
}

const soundConfigs: Record<
  SoundEffect,
  { frequency: number; duration: number; type: OscillatorType; gain: number }[]
> = {
  correct: [
    { frequency: 523.25, duration: 0.1, type: "sine", gain: 0.3 },
    { frequency: 659.25, duration: 0.1, type: "sine", gain: 0.3 },
    { frequency: 783.99, duration: 0.15, type: "sine", gain: 0.3 },
  ],
  wrong: [
    { frequency: 200, duration: 0.15, type: "sawtooth", gain: 0.2 },
    { frequency: 150, duration: 0.2, type: "sawtooth", gain: 0.15 },
  ],
  levelup: [
    { frequency: 523.25, duration: 0.1, type: "sine", gain: 0.3 },
    { frequency: 659.25, duration: 0.1, type: "sine", gain: 0.3 },
    { frequency: 783.99, duration: 0.1, type: "sine", gain: 0.3 },
    { frequency: 1046.5, duration: 0.2, type: "sine", gain: 0.4 },
  ],
  unlock: [
    { frequency: 440, duration: 0.1, type: "triangle", gain: 0.25 },
    { frequency: 554.37, duration: 0.1, type: "triangle", gain: 0.25 },
    { frequency: 659.25, duration: 0.1, type: "triangle", gain: 0.25 },
    { frequency: 880, duration: 0.3, type: "triangle", gain: 0.3 },
  ],
  click: [{ frequency: 800, duration: 0.05, type: "sine", gain: 0.15 }],
};

export function playSound(effect: SoundEffect): void {
  try {
    const ctx = getAudioContext();
    
    // Resume audio context if suspended (browser autoplay policy)
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const config = soundConfigs[effect];
    let startTime = ctx.currentTime;

    config.forEach(({ frequency, duration, type, gain: gainValue }) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startTime);

      gainNode.gain.setValueAtTime(gainValue, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);

      startTime += duration * 0.8; // Slight overlap for smoother sound
    });
  } catch (error) {
    console.warn("Failed to play sound:", error);
  }
}

// ============ 單字池系統 ============

// Fallback words with higher difficulty (middle school level) if AI fails or is slow
const FALLBACK_WORDS: GameWord[] = [
  { word: "Magnificent", def: "壯麗的、華麗的", emoji: "✨" },
  { word: "Perseverance", def: "毅力、堅持不懈", emoji: "💪" },
  { word: "Hypothesis", def: "假設、假說", emoji: "🔬" },
  { word: "Consequence", def: "結果、後果", emoji: "➡️" },
  { word: "Enthusiasm", def: "熱情、熱忱", emoji: "🔥" },
  { word: "Mysterious", def: "神秘的、不可思議的", emoji: "🔮" },
  { word: "Distinguish", def: "區分、辨別", emoji: "🔍" },
  { word: "Accomplish", def: "完成、達成", emoji: "🎯" },
  { word: "Significant", def: "重要的、有意義的", emoji: "⭐" },
  { word: "Opportunity", def: "機會、時機", emoji: "🚪" },
  { word: "Experiment", def: "實驗、試驗", emoji: "🧪" },
  { word: "Environment", def: "環境、周圍狀況", emoji: "🌍" },
  { word: "Celebration", def: "慶祝、慶典", emoji: "🎉" },
  { word: "Imagination", def: "想像力、創意", emoji: "💭" },
  { word: "Temperature", def: "溫度、體溫", emoji: "🌡️" },
  { word: "Vocabulary", def: "詞彙、字彙", emoji: "📚" },
  { word: "Adventure", def: "冒險、奇遇", emoji: "🗺️" },
  { word: "Communicate", def: "溝通、交流", emoji: "💬" },
  { word: "Concentrate", def: "專注、集中注意力", emoji: "🎯" },
  { word: "Appreciate", def: "感激、欣賞", emoji: "💝" },
];

// Re-export GameWord type from aiService
export type { GameWord };

export const generateGameWords = async (
  count: number = 10,
): Promise<GameWord[]> => {
  const words = await generateGameWordsAI(count);
  
  if (words.length > 0) {
    return words;
  }
  
  return FALLBACK_WORDS.slice(0, count);
};

export const prepareGamePool = async (
  userWords: VocabularyWord[],
): Promise<GameWord[]> => {
  // 1. Convert ALL user words to GameWord format (prioritize vocabulary book)
  const userGameWords: GameWord[] = userWords.map((w) => ({
    word: w.word,
    def:
      w.definitions[0]?.definitionChinese ||
      w.definitions[0]?.definition ||
      "未知定義",
    emoji: w.emoji || "✨",
  }));

  // 2. If we have at least 4 words (minimum needed for the game), use them
  if (userGameWords.length >= 4) {
    // Shuffle and return all user words (no limit)
    return userGameWords.sort(() => 0.5 - Math.random());
  }

  // 3. If not enough user words, fetch more from AI to supplement
  const needed = Math.max(20 - userGameWords.length, 16); // Ensure at least 16 AI words if user has few
  const aiWords = await generateGameWords(needed);

  // 4. Combine and shuffle
  return [...userGameWords, ...aiWords].sort(() => 0.5 - Math.random());
};
