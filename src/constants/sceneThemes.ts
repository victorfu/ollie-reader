// Scene themes for each stage in Spirit Adventure
// Each scene has unique visual elements and atmosphere

export interface SceneTheme {
  id: string;
  name: string;
  bgGradient: string;
  particles: string[];
  accentColor: string;
  glowColor: string;
  description: string;
}

export const SCENE_THEMES: Record<string, SceneTheme> = {
  // Forest themes
  "stage-1": {
    id: "grassland",
    name: "草原入口",
    bgGradient: "from-green-100 via-emerald-100 to-lime-100",
    particles: ["🌿", "🍃", "🌸", "🦋", "☘️", "🌼"],
    accentColor: "emerald",
    glowColor: "rgba(16, 185, 129, 0.3)",
    description: "溫暖的陽光照耀著翠綠的草原",
  },
  "stage-2": {
    id: "forest",
    name: "森林小徑",
    bgGradient: "from-green-200 via-teal-100 to-emerald-100",
    particles: ["🌲", "🍀", "🐦", "🌻", "🍂", "✨"],
    accentColor: "teal",
    glowColor: "rgba(20, 184, 166, 0.3)",
    description: "神秘的森林中閃爍著奇妙的光芒",
  },
  "stage-3": {
    id: "pond",
    name: "神秘池塘",
    bgGradient: "from-blue-100 via-cyan-100 to-sky-100",
    particles: ["💧", "🌊", "🐟", "🌺", "✨", "🪷"],
    accentColor: "cyan",
    glowColor: "rgba(6, 182, 212, 0.3)",
    description: "清澈的池塘映照著藍天白雲",
  },
  "boss-1": {
    id: "guardian",
    name: "守護者之戰",
    bgGradient: "from-yellow-100 via-amber-100 to-orange-100",
    particles: ["⚡", "🌟", "💫", "✨", "🔥", "⭐"],
    accentColor: "amber",
    glowColor: "rgba(245, 158, 11, 0.4)",
    description: "雷電交加的神聖戰場",
  },
  "stage-4": {
    id: "thunder-valley",
    name: "雷電山谷",
    bgGradient: "from-yellow-200 via-amber-100 to-yellow-100",
    particles: ["⚡", "🌩️", "💛", "✨", "⭐", "🌟"],
    accentColor: "yellow",
    glowColor: "rgba(234, 179, 8, 0.3)",
    description: "電光閃爍的神秘山谷",
  },
  "stage-5": {
    id: "garden",
    name: "花園迷宮",
    bgGradient: "from-pink-100 via-rose-100 to-fuchsia-100",
    particles: ["🌸", "🌹", "🌺", "🌷", "💐", "🦋"],
    accentColor: "pink",
    glowColor: "rgba(236, 72, 153, 0.3)",
    description: "五彩繽紛的花朵綻放其中",
  },
  "boss-2": {
    id: "ice-realm",
    name: "冰霜挑戰",
    bgGradient: "from-blue-200 via-sky-100 to-indigo-100",
    particles: ["❄️", "🌨️", "💎", "✨", "⛄", "🌟"],
    accentColor: "blue",
    glowColor: "rgba(59, 130, 246, 0.4)",
    description: "寒冷的冰雪世界等待著挑戰者",
  },
  "stage-6": {
    id: "fire-trial",
    name: "火焰試煉",
    bgGradient: "from-orange-100 via-red-100 to-amber-100",
    particles: ["🔥", "🌋", "💥", "✨", "⭐", "🌟"],
    accentColor: "orange",
    glowColor: "rgba(249, 115, 22, 0.3)",
    description: "熱情的火焰照亮前進的道路",
  },
  "boss-3": {
    id: "phoenix-peak",
    name: "鳳凰之巔",
    bgGradient: "from-red-200 via-orange-100 to-yellow-100",
    particles: ["🔥", "🦅", "✨", "💫", "🌟", "⭐"],
    accentColor: "red",
    glowColor: "rgba(239, 68, 68, 0.4)",
    description: "傳說中鳳凰棲息的聖地",
  },
  "boss-4": {
    id: "dragon-lair",
    name: "雷龍覺醒",
    bgGradient: "from-purple-200 via-indigo-100 to-violet-100",
    particles: ["🐉", "⚡", "💜", "✨", "🌟", "💫"],
    accentColor: "purple",
    glowColor: "rgba(139, 92, 246, 0.4)",
    description: "強大的雷龍在此沉睡",
  },
  "stage-7": {
    id: "starlight",
    name: "星空之路",
    bgGradient: "from-indigo-200 via-purple-100 to-slate-100",
    particles: ["⭐", "🌙", "✨", "💫", "🌟", "🌌"],
    accentColor: "indigo",
    glowColor: "rgba(99, 102, 241, 0.3)",
    description: "繁星點點的夢幻道路",
  },
  "stage-8": {
    id: "earth",
    name: "大地迴廊",
    bgGradient: "from-amber-100 via-stone-100 to-emerald-100",
    particles: ["🌍", "🏔️", "🌳", "✨", "🪨", "🌿"],
    accentColor: "stone",
    glowColor: "rgba(120, 113, 108, 0.3)",
    description: "堅實的大地孕育著生命",
  },
  "boss-5": {
    id: "storm-peak",
    name: "風暴之巔",
    bgGradient: "from-sky-200 via-blue-100 to-cyan-100",
    particles: ["🌪️", "💨", "🦅", "✨", "⚡", "🌟"],
    accentColor: "sky",
    glowColor: "rgba(14, 165, 233, 0.4)",
    description: "疾風呼嘯的最終試煉",
  },
};

// Default theme for unknown stages
export const DEFAULT_SCENE_THEME: SceneTheme = {
  id: "default",
  name: "冒險世界",
  bgGradient: "from-pink-100 via-purple-100 to-indigo-100",
  particles: ["🌸", "✨", "💫", "🌟", "💖", "🎀"],
  accentColor: "purple",
  glowColor: "rgba(168, 85, 247, 0.3)",
  description: "充滿奇蹟的冒險世界",
};

export function getSceneTheme(stageId: string): SceneTheme {
  return SCENE_THEMES[stageId] || DEFAULT_SCENE_THEME;
}
