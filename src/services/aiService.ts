/**
 * AI Service - Centralized service for all Gemini AI interactions
 */
import { geminiModel } from "../utils/firebaseUtil";

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
