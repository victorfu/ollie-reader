import type { SpeechRequest } from "../types/speech";

export const DEFAULT_EDGE_VOICE = "en-US-AriaNeural";
export const MAX_TEXT_LENGTH = 5_000;

export class SpeechError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "SpeechError";
  }
}

function validVoice(voice: string): boolean {
  return voice.length <= 128 && /^[a-z]{2,3}-(?:[A-Za-z0-9]+-)+[A-Za-z0-9]+$/.test(voice);
}

export function parseSpeechRequest(value: unknown): SpeechRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SpeechError("請提供語音合成 JSON 物件", 400);
  }
  const { text, speed = 1, voice } = value as Record<string, unknown>;
  if (typeof text !== "string" || !text.trim()) {
    throw new SpeechError("text 必須是非空白字串", 400);
  }
  if ([...text].length > MAX_TEXT_LENGTH) {
    throw new SpeechError(`text 不可超過 ${MAX_TEXT_LENGTH} 字元`, 413);
  }
  // XML 1.0 cannot represent these control characters, even as entities.
  if ([...text].some((character) => {
    const code = character.codePointAt(0)!;
    return (code < 32 && ![9, 10, 13].includes(code)) ||
      (code >= 0xd800 && code <= 0xdfff) || code === 0xfffe || code === 0xffff;
  })) {
    throw new SpeechError("text 包含不支援的控制字元", 400);
  }
  if (typeof speed !== "number" || !Number.isFinite(speed)) {
    throw new SpeechError("speed 必須是有限數值", 400);
  }
  if (voice !== undefined && voice !== null && typeof voice !== "string") {
    throw new SpeechError("voice 必須是字串或 null", 400);
  }
  const explicitVoice = typeof voice === "string" ? voice.trim() : "";
  const chosenVoice = explicitVoice || process.env.EDGE_TTS_VOICE?.trim() || DEFAULT_EDGE_VOICE;
  if (!validVoice(chosenVoice)) {
    throw new SpeechError(
      explicitVoice ? "voice 必須是有效的 Edge 聲音名稱" : "EDGE_TTS_VOICE 設定無效",
      explicitVoice ? 400 : 500,
    );
  }
  return { text, speed, voice: chosenVoice };
}

export function rateFromSpeed(speed: number): string {
  const percent = ((speed <= 0 ? 1 : speed) - 1) * 100;
  // Python round() uses ties-to-even; Math.round() alone differs at .5.
  const floor = Math.floor(percent);
  const rounded = percent - floor === 0.5
    ? (floor % 2 === 0 ? floor : floor + 1)
    : Math.round(percent);
  const rate = Math.max(-50, Math.min(100, rounded));
  return `${rate >= 0 ? "+" : ""}${rate}%`;
}

export function escapeSpeechText(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]!);
}
