/**
 * AI Service - Centralized service for all Gemini AI interactions
 */
import { geminiModel } from "../utils/firebaseUtil";
import type { ChatSession, Content } from "firebase/ai";

/**
 * Word details structure returned by generateWordDetails
 */
export interface WordDetails {
  phonetic?: string;
  emoji?: string;
  definitions: Array<{
    partOfSpeech: string;
    definition: string;
    definitionChinese: string;
  }>;
  examples: Array<{
    sentence: string;
  }>;
  synonyms: string[];
  antonyms: string[];
}

/**
 * Parsed sentence structure for sentence practice
 */
export interface ParsedSentence {
  english: string;
  chinese: string;
}

/**
 * Game word structure for vocabulary games
 */
export interface GameWord {
  word: string;
  def: string;
  emoji: string;
}

/**
 * Chat session configuration
 */
export interface ChatSessionConfig {
  history?: Content[];
  systemInstruction?: string;
}

/**
 * Create a new chat session with Gemini AI
 * @param config - Configuration for the chat session
 * @returns ChatSession instance
 */
export function createChatSession(config: ChatSessionConfig = {}): ChatSession {
  return geminiModel.startChat({
    history: config.history || [],
    ...(config.systemInstruction && {
      systemInstruction: {
        role: "user",
        parts: [{ text: config.systemInstruction }],
      },
    }),
  });
}

/**
 * Parse JSON response from Gemini, handling potential markdown code blocks
 */
function parseJsonResponse(text: string): unknown {
  let jsonText = text.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim();
  }
  return JSON.parse(jsonText);
}

/**
 * Generate kid-friendly word details using Gemini AI
 * @param word - The English word to generate details for
 * @param signal - Optional AbortSignal for cancellation
 * @returns Word details or null if aborted/failed
 */
export async function generateWordDetails(
  word: string,
  signal?: AbortSignal,
): Promise<WordDetails | null> {
  try {
    const prompt = `你是一個幫助國小學生學習英文的字典助手。請為以下英文單字提供詳細資訊，使用簡單易懂、適合小朋友理解的詞彙。

單字：${word}

請以 JSON 格式回覆，包含以下欄位：
{
  "phonetic": "音標（如果知道的話）",
  "emoji": "一個最能代表這個單字的 Emoji（例如 apple -> 🍎, run -> 🏃）",
  "definitions": [
    {
      "partOfSpeech": "詞性（如 noun, verb, adjective 等）",
      "definition": "英文定義（簡單易懂）",
      "definitionChinese": "中文解釋（用小朋友能懂的方式說明）"
    }
  ],
  "examples": [
    {
      "sentence": "簡單的例句"
    }
  ],
  "synonyms": ["同義詞1", "同義詞2"],
  "antonyms": ["反義詞1", "反義詞2"]
}

請提供 2-3 個定義，2 個例句，最多 5 個同義詞和反義詞。
只回覆 JSON，不要加任何其他說明。`;

    if (signal?.aborted) return null;

    const result = await geminiModel.generateContent(prompt);

    if (signal?.aborted) return null;

    const response = result.response;
    const text = response.text().trim();
    const wordData = parseJsonResponse(text) as Record<string, unknown>;

    const details: WordDetails = {
      definitions: (wordData.definitions as WordDetails["definitions"]) || [],
      examples: (wordData.examples as WordDetails["examples"]) || [],
      synonyms: (wordData.synonyms as string[]) || [],
      antonyms: (wordData.antonyms as string[]) || [],
    };

    if (wordData.phonetic) {
      details.phonetic = wordData.phonetic as string;
    }
    if (wordData.emoji) {
      details.emoji = wordData.emoji as string;
    }

    return details;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return null;
    console.error("Error generating word details:", err);
    return null;
  }
}

/**
 * Translate text to Traditional Chinese using Gemini AI (kid-friendly)
 * @param text - The English text to translate
 * @param signal - Optional AbortSignal for cancellation
 * @returns Translated text or null if aborted/failed
 */
export async function translateWithAI(
  text: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const prompt = `你是一個幫助國小學生學習英文的翻譯助手。請將以下英文翻譯成繁體中文，使用簡單易懂、適合小朋友理解的詞彙和句子。翻譯要準確但用字要簡單，避免使用艱深的詞彙。

英文原文：${text}

請只回覆翻譯後的中文，不要加任何其他說明。`;

    if (signal?.aborted) return null;

    const result = await geminiModel.generateContent(prompt);

    if (signal?.aborted) return null;

    return result.response.text().trim();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return null;
    console.error("Error translating with AI:", err);
    return null;
  }
}

/**
 * Parse English text into sentences and translate each to Chinese
 * @param text - The English text to parse and translate
 * @returns Array of parsed sentences with English and Chinese
 */
export async function parseAndTranslateSentences(
  text: string,
): Promise<ParsedSentence[]> {
  try {
    const prompt = `你是一個幫助學生學習英文的助手。請將以下英文文字分句，並翻譯成繁體中文。

英文文字：
${text}

請以 JSON 格式回覆，格式如下：
{
  "sentences": [
    {
      "english": "完整的英文句子",
      "chinese": "對應的繁體中文翻譯"
    }
  ]
}

注意事項：
1. 根據英文標點符號（句號、問號、驚嘆號等）正確分句
2. 保持每個句子的完整性，不要拆散句子
3. 翻譯要準確、通順，使用簡單易懂的中文
4. 只回覆 JSON，不要加任何其他說明`;

    const result = await geminiModel.generateContent(prompt);
    const responseText = result.response.text().trim();
    const parsed = parseJsonResponse(responseText) as { sentences: ParsedSentence[] };

    return parsed.sentences || [];
  } catch (err) {
    console.error("Error parsing and translating sentences:", err);
    return [];
  }
}

/**
 * Get a brief Chinese definition for a word
 * @param word - The English word
 * @returns Chinese definition or null if failed
 */
export async function getWordDefinition(word: string): Promise<string | null> {
  try {
    const prompt = `你是一個幫助學生學習英文的字典助手。請提供這個英文單字的簡短中文解釋。

單字：${word}

請用一句簡短的中文說明這個單字的意思，適合學生理解。只回覆中文解釋，不要加其他說明。`;

    const result = await geminiModel.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error("Error getting word definition:", err);
    return null;
  }
}

/**
 * Generate a speech practice script based on a prompt
 * @param prompt - The prompt describing what kind of script to generate
 * @param signal - Optional AbortSignal for cancellation
 * @returns Generated script text or null if aborted/failed
 */
export async function generateSpeechScript(
  prompt: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    if (signal?.aborted) return null;

    const result = await geminiModel.generateContent(prompt);

    if (signal?.aborted) return null;

    return result.response.text();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return null;
    console.error("Error generating speech script:", err);
    return null;
  }
}

/**
 * Generate vocabulary game words suitable for middle school students
 * @param count - Number of words to generate
 * @returns Array of game words
 */
export async function generateGameWords(count: number = 10): Promise<GameWord[]> {
  try {
    const prompt = `
      Generate ${count} English vocabulary words suitable for a 6th grade to middle school student (approx. 12-14 years old).
      Choose words that are challenging but learnable, such as academic vocabulary, descriptive adjectives, or useful verbs.
      Return ONLY a valid JSON array of objects.
      Each object must have:
      - "word": The English word (string)
      - "def": The Traditional Chinese definition (string, simple and direct)
      - "emoji": A relevant emoji (string)
      
      Example format:
      [
        {"word": "Magnificent", "def": "壯麗的", "emoji": "✨"},
        {"word": "Persevere", "def": "堅持不懈", "emoji": "💪"}
      ]
      
      Do not include markdown formatting like \`\`\`json. Just the raw JSON string.
    `;

    const result = await geminiModel.generateContent(prompt);
    const text = result.response
      .text()
      .trim()
      .replace(/```json|```/g, "");

    const words = JSON.parse(text) as GameWord[];
    if (Array.isArray(words) && words.length > 0) {
      return words;
    }

    return [];
  } catch (err) {
    console.error("Error generating game words:", err);
    return [];
  }
}
