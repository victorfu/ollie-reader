export interface SpeechPracticeTopic {
  id: string;
  title: string;
  titleChinese: string;
  description: string;
  descriptionChinese: string;
  category: "general" | "academic" | "personal" | "social";
  difficulty: "beginner" | "intermediate" | "advanced";
  suggestedTimeSeconds: number;
}

export interface PracticeRecord {
  id?: string;
  topicId: string;
  topicTitle: string;
  userId: string;
  durationSeconds: number;
  recordingUrl?: string; // GCS file path for audio storage
  notes?: string;
  script?: string; // AI-generated or user-edited speech script
  createdAt: Date;
}

export interface ScriptState {
  prompt: string;
  generatedScript: string;
  isGenerating: boolean;
  error: string | null;
}

// Generate default prompt for script generation (Chinese, elementary school level)
export function getDefaultScriptPrompt(topic: SpeechPracticeTopic): string {
  const minutes = Math.round(topic.suggestedTimeSeconds / 60);
  // Estimate ~150 Chinese characters per minute for speech
  const wordCount = minutes * 150;

  return `請為國小四年級學生撰寫一篇關於「${topic.titleChinese}」的中文演講稿。

主題說明：${topic.descriptionChinese}
演講時間：約 ${minutes} 分鐘

要求：
- 使用適合國小四年級學生理解的詞彙和句型
- 包含開場白、2-3 個重點段落、結尾
- 語氣親切自然，適合朗讀
- 字數約 ${wordCount} 字
- 請直接輸出講稿內容，不需要標題或額外說明`;
}

export interface PracticeFilters {
  topicId?: string;
  sortBy?: "createdAt" | "durationSeconds";
  sortOrder?: "asc" | "desc";
  limit?: number;
}

export const SPEECH_TOPICS: SpeechPracticeTopic[] = [
  {
    id: "school-story-tears-laughter",
    title: "A School Story That Made Me Cry and Laugh",
    titleChinese: "一個讓我又哭又笑的校園故事",
    description:
      "Share a real story that happened at school, which could be a small challenge, a funny play, or a hilarious experience with friends, and share the lessons you learned from it.",
    descriptionChinese:
      "請分享一個在學校發生的真實故事，內容可以是一個小小的挑戰、一件有趣的演戲、與朋友的搞笑經歷，並分享其中學到的道理。",
    category: "personal",
    difficulty: "beginner",
    suggestedTimeSeconds: 300,
  },
  {
    id: "family-superhero",
    title: "My Family Member Is a 'Superhero'",
    titleChinese: "我的家人是「超級英雄」",
    description:
      "Share about a family member (such as dad, mom, brother, sister, grandpa, grandma, or siblings) and the special role they play in your life. For example: teaching you skills, encouraging you to face difficulties, giving you special care, and explain why you think they are your 'superhero'.",
    descriptionChinese:
      "請分享你的某一位家人（如爸爸、媽媽、哥哥、妹妹、爺爺、奶奶或兄弟姊妹）在你生活中扮演的特殊角色。例如：教會你技能、鼓勵你面對困難、給你特別的照顧⋯⋯，並說明為什麼你認為他們是你的「超級英雄」。",
    category: "personal",
    difficulty: "beginner",
    suggestedTimeSeconds: 300,
  },
  {
    id: "silent-friend-in-fear",
    title: "The 'Silent Friend' in My Fear",
    titleChinese: "我書包裡的「無聲朋友」",
    description:
      "Choose an item in your school bag (like a pencil case, water bottle, textbook, or a small accessory) as the main character, and describe how this item accompanies you in learning and growing.",
    descriptionChinese:
      "請挑選你書包裡的一件物品（如鉛筆盒、水壺、課本、或某個小飾品）作為主角，描述這個物品是如何陪伴你學習和成長的。",
    category: "personal",
    difficulty: "beginner",
    suggestedTimeSeconds: 300,
  },
];

export const DEFAULT_PRACTICE_PAGE_SIZE = 20;
