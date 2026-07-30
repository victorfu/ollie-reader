import type { PhraseDefinition } from "../types";

export const PHRASES: readonly PhraseDefinition[] = [
  { id: "good-morning", en: "Good morning!", zh: "早安！", context: "greeting", unlockLevel: 1 },
  { id: "good-afternoon", en: "Good afternoon!", zh: "午安！", context: "greeting", unlockLevel: 1 },
  { id: "good-evening", en: "Good evening!", zh: "晚安呀！", context: "greeting", unlockLevel: 1 },
  { id: "sleepy", en: "Shh… I'm sleepy…", zh: "噓……我想睡覺了……", context: "sleep", unlockLevel: 1 },
  { id: "missed-you", en: "I missed you!", zh: "我好想你！", context: "return", unlockLevel: 1 },
  { id: "full", en: "I'm full!", zh: "我吃飽飽了！", context: "status", unlockLevel: 1 },
  { id: "all-gone", en: "All gone!", zh: "這個吃完了，明天還會補充喔！", context: "status", unlockLevel: 1 },
  { id: "find-a-toy", en: "Let's find a toy!", zh: "先去商店挑一個玩具吧！", context: "status", unlockLevel: 1 },
  { id: "playtime", en: "Playtime!", zh: "晚上七點後再一起睡覺吧！", context: "status", unlockLevel: 1 },
  { id: "slept-well", en: "I slept well!", zh: "今晚已經做過甜甜的夢了！", context: "sleep", unlockLevel: 1 },
  { id: "happy", en: "I'm happy!", zh: "我現在很開心！", context: "status", unlockLevel: 1 },
  { id: "yummy", en: "Yummy!", zh: "好好吃！", context: "care", unlockLevel: 1 },
  { id: "bubbles", en: "Bubbles! Achoo! So fluffy!", zh: "好多泡泡！哈啾！毛毛變得蓬蓬的！", context: "care", unlockLevel: 1 },
  { id: "pet-ears", en: "Hee hee!", zh: "耳朵搖呀搖！", context: "care", unlockLevel: 1 },
  { id: "pet-tummy", en: "Hee hee!", zh: "肚肚好舒服！", context: "care", unlockLevel: 1 },
  { id: "wake-happy", en: "Good morning!", zh: "醒來看到你真開心！", context: "sleep", unlockLevel: 1 },
  { id: "play-ball", en: "Catch the ball!", zh: "接到球囉！", context: "care", unlockLevel: 1 },
  { id: "play-frisbee", en: "I got it!", zh: "飛盤接到囉！", context: "care", unlockLevel: 1 },
  { id: "play-bubbles", en: "Pop, pop, pop!", zh: "泡泡啵啵啵！", context: "care", unlockLevel: 1 },
  { id: "play-music-box", en: "Let's dance!", zh: "跟著音樂搖一搖！", context: "care", unlockLevel: 1 },
  { id: "play-cloud-swing", en: "Higher, please!", zh: "再盪高一點！", context: "care", unlockLevel: 1 },
  { id: "so-comfy", en: "So comfy!", zh: "坐起來好舒服！", context: "care", unlockLevel: 1 },
  { id: "cozy-clouds", en: "Cozy clouds!", zh: "鑽進雲朵被窩囉！", context: "care", unlockLevel: 1 },
  { id: "sniff-furniture", en: "Let me sniff!", zh: "讓我聞聞新家具！", context: "care", unlockLevel: 1 },
  { id: "new-look", en: "How do I look?", zh: "你喜歡我的新造型嗎？", context: "care", unlockLevel: 1 },
  { id: "good-night", en: "Good night! Sweet dreams…", zh: "晚安，做個甜甜的夢……", context: "sleep", unlockLevel: 1 },
  { id: "love-it", en: "I love it!", zh: "我好喜歡！", context: "bond", unlockLevel: 2 },
  { id: "you-are-the-best", en: "You're the best!", zh: "你最棒了！", context: "bond", unlockLevel: 4 },
  { id: "lets-play", en: "Let's play!", zh: "一起玩吧！", context: "bond", unlockLevel: 7 },
  { id: "so-happy", en: "I'm so happy!", zh: "我好開心！", context: "bond", unlockLevel: 10 },
  { id: "sweet-dreams", en: "Good night! Sweet dreams!", zh: "晚安！祝你做個甜甜的夢！", context: "bond", unlockLevel: 13 },
  { id: "best-friends-forever", en: "Best friends forever!", zh: "永遠都是最好的朋友！", context: "bond", unlockLevel: 17 },
  { id: "love-you", en: "I love you!", zh: "我愛你！", context: "bond", unlockLevel: 19 },
] as const;

const PHRASE_BY_ID = new Map(PHRASES.map((phrase) => [phrase.id, phrase]));

export function getPhrase(id: string): PhraseDefinition | undefined {
  return PHRASE_BY_ID.get(id);
}

export function getUnlockedPhrases(level: number): PhraseDefinition[] {
  return PHRASES.filter((phrase) => phrase.unlockLevel <= level);
}
