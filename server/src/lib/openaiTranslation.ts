import { ApiError } from "./api";
import { translationPrompts, type TranslationAction } from "../shared/translationPrompts";

export function openAIModels(): string[] {
  const configured = process.env.OPENAI_MODELS ?? "gpt-4.1-mini,gpt-5-mini";
  return [...new Set(configured.split(",").map((id) => id.trim()).filter(Boolean))];
}

interface ResponseMessage {
  type: string;
  content?: { type: string; text?: string }[];
}

export async function translateWithOpenAI(body: unknown, signal: AbortSignal): Promise<string> {
  if (!body || typeof body !== "object") throw new ApiError("請提供翻譯內容", 400);
  const { action, text, model } = body as Record<string, unknown>;
  if (typeof action !== "string" || !Object.hasOwn(translationPrompts, action)) {
    throw new ApiError("不支援的翻譯操作", 400);
  }
  if (typeof text !== "string" || !text.trim()) throw new ApiError("翻譯文字不可空白", 400);
  if (typeof model !== "string" || !openAIModels().includes(model)) {
    throw new ApiError("此模型已停用，請到設定重新選擇翻譯模型", 400);
  }
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new ApiError("伺服器尚未設定 OpenAI API 金鑰", 503);

  const deadline = AbortSignal.timeout(110_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.any([signal, deadline]),
      body: JSON.stringify({
        model,
        input: translationPrompts[action as TranslationAction](text),
        max_output_tokens: 8192,
        store: false,
      }),
    });
    if (response.status === 429) throw new ApiError("OpenAI 已達使用額度或請求頻率上限，請稍後再試", 429);
    if (!response.ok) throw new ApiError("OpenAI 請求失敗，請確認伺服器金鑰與模型權限", 502);
    const result = await response.json() as { status: string; output?: ResponseMessage[] };
    if (result.status === "completed" && Array.isArray(result.output)) {
      const answer = result.output.filter((item) => item.type === "message")
        .flatMap((item) => item.content ?? [])
        .filter((part) => part.type === "output_text")
        .map((part) => part.text).join("").trim();
      if (answer) return answer;
    }
    throw new ApiError("OpenAI 未傳回完整譯文，請縮短文字或稍後再試", 502);
  } catch (err) {
    if (deadline.aborted) throw new ApiError("OpenAI 回應逾時，請稍後再試", 504);
    if (signal.aborted || err instanceof ApiError) throw err;
    throw new ApiError("無法取得 OpenAI 回應，請稍後再試", 502);
  }
}
