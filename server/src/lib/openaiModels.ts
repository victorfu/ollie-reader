import { ApiError } from "./api";

const CACHE_MS = 5 * 60_000;
let catalog: { key: string; expires: number; models: Promise<string[]> } | undefined;

// /v1/models has no modality or endpoint metadata. Match general GPT families
// and omit known specialist variants that the translation request cannot use.
function isTranslationModel(id: string): boolean {
  return /^gpt-(?:4o|4\.[1-9]\d*|[5-9]|[1-9]\d+)(?:[.-]|$)/.test(id) &&
    !/-(?:audio|realtime|transcribe|tts|image|search|codex|deep-research|computer-use|instruct|embedding)(?:-|$)/.test(id);
}

async function discoverModels(key: string): Promise<string[]> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (!Array.isArray(result?.data)) throw new Error();
    const ids = new Set<string>();
    const today = new Date().toISOString().slice(0, 10);
    for (const model of result.data) {
      if (typeof model?.id === "string" && isTranslationModel(model.id) &&
          (!model.shutdown_date || model.shutdown_date > today)) ids.add(model.id);
    }
    return [...ids].sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
  } catch {
    throw new ApiError("無法載入 OpenAI 模型清單，請確認金鑰具有讀取模型的權限或稍後重試", 502);
  }
}

export async function openAIModels(): Promise<string[]> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return [];

  // An explicit deployment allow-list also works with restricted keys that
  // can generate responses but cannot list models.
  if (process.env.OPENAI_MODELS !== undefined) {
    return [...new Set(process.env.OPENAI_MODELS.split(",").map((id) => id.trim()).filter(Boolean))];
  }
  if (catalog?.key === key && catalog.expires > Date.now()) return catalog.models;
  const entry = { key, expires: Date.now() + CACHE_MS, models: discoverModels(key) };
  catalog = entry;
  try {
    return await entry.models;
  } catch (error) {
    if (catalog === entry) catalog = undefined;
    throw error;
  }
}
