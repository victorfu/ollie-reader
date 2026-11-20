/**
 * AI Service - AI generation and learning-content parsing
 */
import { isAbortError } from "../utils/errorUtils";
import { logger } from "../utils/logger";
import { normalizeExamples } from "../utils/normalizeExamples";
import type { SentenceKeyWord } from "../types/sentenceTranslation";
import type { PartOfSpeech } from "../types/game";
import { normalizePartOfSpeech } from "../utils/partOfSpeech";
import { generateTranslationText } from "./translationClient";
import { generateGeminiContent } from "./geminiClient";
import { isTranslationServiceError } from "./translationErrors";
import { isGeminiRateLimitError } from "./geminiErrorPolicy";

/**
 * Word details structure returned by generateWordDetails
 */
export interface WordDetails {
  emoji?: string;
  definitions: Array<{
    partOfSpeech: string;
    definition: string;
    definitionChinese: string;
  }>;
  examples: Array<{
    sentence: string;
  }>;
  synonyms?: string[];
  antonyms?: string[];
}

/**
 * Result of smartLookup: the AI classifies a multi-word input as either a
 * phrase (dictionary-style word details) or a full sentence (translation
 * plus difficult key words).
 */
export type SmartLookupResult =
  | { kind: "word"; details: WordDetails }
  | { kind: "sentence"; chinese: string; keyWords: SentenceKeyWord[] };

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
  def: string; // 中文優先的主要釋義（中文模式用）
  defEn?: string; // 英文釋義（英文模式用，可能缺）
  emoji: string;
  example?: string; // 含該字的英文例句（句子填空用，可能缺）
  exampleZh?: string; // 例句的中文翻譯（可能缺）
  pos?: PartOfSpeech; // 詞性（詞性題用；多詞性或認不出時缺）
  synonyms?: string[]; // 同義字（同反義題用，可能缺）
  antonyms?: string[]; // 反義字（同反義題用，可能缺）
}

/**
 * Parse JSON response from Gemini, handling potential markdown code blocks
 */
export function parseJsonResponse(text: string): unknown {
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
 * Generate kid-friendly word details using the selected model
 * @param word - The English word to generate details for
 * @param signal - Optional AbortSignal for cancellation
 * @returns Word details or null if aborted/failed
 */
export async function generateWordDetails(
  word: string,
  signal?: AbortSignal,
): Promise<WordDetails | null> {
  try {
    if (signal?.aborted) return null;

    const responseText = await generateTranslationText("word_details", word, signal);

    if (signal?.aborted) return null;

    const wordData = parseJsonResponse(responseText) as Record<string, unknown>;

    const details: WordDetails = {
      definitions: (wordData.definitions as WordDetails["definitions"]) || [],
      examples: normalizeExamples(wordData.examples),
    };

    if (wordData.emoji) {
      details.emoji = wordData.emoji as string;
    }

    return details;
  } catch (err) {
    if (isAbortError(err)) return null;
    if (isTranslationServiceError(err)) throw err;
    logger.error("Error generating word details:", err);
    return null;
  }
}

/**
 * Translate text to kid-friendly Traditional Chinese using the selected model
 * @param text - The English text to translate
 * @param signal - Optional AbortSignal for cancellation
 * @returns Translated text or null if aborted/failed
 */
export async function translateWithAI(
  text: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    if (signal?.aborted) return null;

    const responseText = await generateTranslationText("translation", text, signal);

    if (signal?.aborted) return null;

    return responseText.trim();
  } catch (err) {
    if (isAbortError(err)) return null;
    if (isTranslationServiceError(err)) throw err;
    logger.error("Error translating with AI:", err);
    return null;
  }
}

const sanitizeKeyWords = (raw: unknown): SentenceKeyWord[] => {
  if (!Array.isArray(raw)) return [];
  const keyWords: SentenceKeyWord[] = [];
  for (const entry of raw) {
    if (keyWords.length >= 3) break;
    if (!entry || typeof entry !== "object") continue;
    const { word, meaning } = entry as { word?: unknown; meaning?: unknown };
    if (typeof word !== "string" || typeof meaning !== "string") continue;
    if (!word.trim() || !meaning.trim()) continue;
    keyWords.push({ word: word.trim(), meaning: meaning.trim() });
  }
  return keyWords;
};

/**
 * Classify a multi-word English input as a phrase or a full sentence and
 * answer accordingly in a single model call: phrases get dictionary-style
 * word details, sentences get a kid-friendly translation plus key words.
 * @param text - The multi-word English input
 * @param signal - Optional AbortSignal for cancellation
 * @returns Discriminated result, or null if aborted/failed/unusable
 */
export async function smartLookup(
  text: string,
  signal?: AbortSignal,
): Promise<SmartLookupResult | null> {
  try {
    if (signal?.aborted) return null;

    const responseText = await generateTranslationText("smart_lookup", text, signal);

    if (signal?.aborted) return null;

    const parsed = parseJsonResponse(responseText) as Record<string, unknown>;

    if (
      parsed.kind === "sentence" &&
      typeof parsed.chinese === "string" &&
      parsed.chinese.trim()
    ) {
      return {
        kind: "sentence",
        chinese: parsed.chinese.trim(),
        keyWords: sanitizeKeyWords(parsed.keyWords),
      };
    }

    if (Array.isArray(parsed.definitions)) {
      const details: WordDetails = {
        definitions: parsed.definitions as WordDetails["definitions"],
        examples: normalizeExamples(parsed.examples),
      };
      if (parsed.emoji) {
        details.emoji = parsed.emoji as string;
      }
      const usable = details.definitions.some((definition) =>
        Boolean(
          definition?.definition?.trim() ||
            definition?.definitionChinese?.trim(),
        ),
      );
      if (usable) {
        return { kind: "word", details };
      }
    }

    return null;
  } catch (err) {
    if (isAbortError(err)) return null;
    if (isTranslationServiceError(err)) throw err;
    logger.error("Error in smart lookup:", err);
    return null;
  }
}

/**
 * Basic sentence splitter as fallback when AI fails
 * Splits text by common sentence-ending punctuation
 */
function splitIntoSentences(text: string): string[] {
  // Split by sentence-ending punctuation, keeping the punctuation
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return sentences;
}

/**
 * Parse English text into sentences and translate each to Chinese
 * @param text - The English text to parse and translate
 * @returns Array of parsed sentences with English and Chinese
 */
export async function parseAndTranslateSentences(
  text: string,
  signal?: AbortSignal,
): Promise<ParsedSentence[]> {
  try {
    const responseText = await generateTranslationText("sentence_parse", text, signal);
    const parsed = parseJsonResponse(responseText) as {
      sentences: ParsedSentence[];
    };

    if (parsed.sentences && parsed.sentences.length > 0) {
      return parsed.sentences;
    }

    // AI returned empty result, use fallback
    throw new Error("AI returned empty sentences");
  } catch (err) {
    if (isAbortError(err)) throw err;
    if (isTranslationServiceError(err)) throw err;
    logger.error("Error parsing and translating sentences:", err);
    // Fallback: use basic sentence splitting without translation
    const sentences = splitIntoSentences(text);
    return sentences.map((english) => ({
      english,
      chinese: "(翻譯失敗，請稍後重試)",
    }));
  }
}

/**
 * Get a brief Chinese definition for a word
 * @param word - The English word
 * @returns Chinese definition or null if failed
 */
export async function getWordDefinition(
  word: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const responseText = await generateTranslationText("word_definition", word, signal);
    return responseText.trim();
  } catch (err) {
    if (isAbortError(err)) return null;
    if (isTranslationServiceError(err)) throw err;
    logger.error("Error getting word definition:", err);
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

    const result = await generateGeminiContent(prompt, {
      action: "speech_script",
      signal,
    });

    if (signal?.aborted) return null;

    return result.response.text();
  } catch (err) {
    if (isAbortError(err)) return null;
    if (isGeminiRateLimitError(err)) throw err;
    logger.error("Error generating speech script:", err);
    return null;
  }
}

/**
 * Generate vocabulary game words suitable for middle school students
 * @param count - Number of words to generate
 * @returns Array of game words
 */
const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const textList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const list = value
    .map(optionalText)
    .filter((item): item is string => item !== undefined);
  return list.length > 0 ? list : undefined;
};

export async function generateGameWords(
  count: number = 10,
  signal?: AbortSignal,
): Promise<GameWord[]> {
  try {
    const prompt = `
      Generate ${count} English vocabulary words suitable for a 6th grade to middle school student (approx. 12-14 years old).
      Choose words that are challenging but learnable, such as academic vocabulary, descriptive adjectives, or useful verbs.
      Return ONLY a valid JSON array of objects.
      Each object must have:
      - "word": The English word (string)
      - "def": The Traditional Chinese definition (string, simple and direct)
      - "defEn": A simple English definition (10-20 words) that only uses words easier than the target word.
        NEVER include the target word or any inflected form of it inside "defEn" — it is used as a quiz clue.
      - "emoji": A relevant emoji (string)
      - "example": One short, simple English sentence (8-15 words) a 12-year-old can read.
        It MUST contain the target word (an inflected form like "ran" or "dogs" is fine).
      - "exampleZh": The Traditional Chinese translation of "example".
      - "pos": The part of speech: one of "noun", "verb", "adjective", "adverb".
        Leave "pos" out if the word is commonly used as more than one part of speech (e.g. "test" is a noun and a verb).
      - "synonyms": 1-2 simple single-word synonyms (array of strings, may be empty).
      - "antonyms": 0-2 simple single-word antonyms (array of strings, may be empty).

      Example format:
      [
        {"word": "Magnificent", "def": "壯麗的", "defEn": "extremely beautiful or impressive to look at", "emoji": "✨", "example": "The view from the mountain top was magnificent.", "exampleZh": "從山頂看出去的景色非常壯麗。", "pos": "adjective", "synonyms": ["splendid"], "antonyms": ["ordinary"]},
        {"word": "Persevere", "def": "堅持不懈", "defEn": "to keep trying to do something even when it is hard", "emoji": "💪", "example": "She persevered and finally solved the puzzle.", "exampleZh": "她堅持不懈，終於解開了謎題。", "pos": "verb", "synonyms": ["persist"], "antonyms": ["quit"]}
      ]

      Do not include markdown formatting like \`\`\`json. Just the raw JSON string.
    `;

    const result = await generateGeminiContent(prompt, {
      action: "game_words",
      signal,
    });
    const text = result.response
      .text()
      .trim()
      .replace(/```json|```/g, "");

    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      // Gemini 偶爾會漏欄位；正規化並丟掉不可用的項目，避免整輪題目破圖
      const words = parsed
        .filter(
          (w): w is Record<string, unknown> =>
            typeof w === "object" && w !== null,
        )
        .map((w) => ({
          word: typeof w.word === "string" ? w.word.trim() : "",
          def: typeof w.def === "string" ? w.def.trim() : "",
          defEn:
            typeof w.defEn === "string" && w.defEn.trim()
              ? w.defEn.trim()
              : undefined,
          emoji: typeof w.emoji === "string" && w.emoji ? w.emoji : "✨",
          // 缺例句不丟掉整個字，句子填空會自動改出其他題型
          example: optionalText(w.example),
          exampleZh: optionalText(w.exampleZh),
          // 缺詞性／同反義字一樣保留，對應題型會自動改出其他題型
          pos: normalizePartOfSpeech(w.pos),
          synonyms: textList(w.synonyms),
          antonyms: textList(w.antonyms),
        }))
        .filter((w) => w.word && w.def);

      if (words.length > 0) {
        return words;
      }
    }

    return [];
  } catch (err) {
    if (isAbortError(err)) throw err;
    if (isGeminiRateLimitError(err)) throw err;
    logger.error("Error generating game words:", err);
    return [];
  }
}
