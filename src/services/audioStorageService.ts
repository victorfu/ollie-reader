import { supabase, STORAGE_BUCKET } from "../utils/supabaseClient";

// 10MB max audio file size
export const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_SIZE_MB = 10;

const AUDIO_EXTENSION_BY_TYPE: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

function normalizeAudioContentType(audioBlob: Blob): string {
  return audioBlob.type.split(";", 1)[0].trim().toLowerCase() || "audio/webm";
}

/** 取得錄音檔在 storage 的路徑。 */
function getAudioPath(
  userId: string,
  recordId: string,
  contentType: string,
): string {
  const extension = AUDIO_EXTENSION_BY_TYPE[contentType] ?? "webm";
  return `speech-practice/${userId}/${recordId}.${extension}`;
}

export function getPracticeAudioPath(
  userId: string,
  recordId: string,
  audioBlob: Blob,
): string {
  return getAudioPath(userId, recordId, normalizeAudioContentType(audioBlob));
}

/** 上傳練習錄音。保留瀏覽器產生的 MIME type 並回傳儲存路徑。 */
export async function uploadPracticeAudio(
  userId: string,
  recordId: string,
  audioBlob: Blob,
): Promise<string> {
  if (audioBlob.size > MAX_AUDIO_SIZE_BYTES) {
    throw new Error(
      `錄音檔案過大，最大允許 ${MAX_AUDIO_SIZE_MB}MB，目前大小 ${(
        audioBlob.size /
        1024 /
        1024
      ).toFixed(2)}MB`,
    );
  }

  const contentType = normalizeAudioContentType(audioBlob);
  const path = getPracticeAudioPath(userId, recordId, audioBlob);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, audioBlob, { contentType, upsert: true });

  if (error) {
    throw new Error(error.message || "上傳錄音失敗");
  }

  return path;
}

/** 刪除練習錄音（找不到不視為錯誤）。 */
export async function deletePracticeAudio(
  userId: string,
  recordId: string,
  storedPath?: string,
): Promise<void> {
  const expectedPrefix = `speech-practice/${userId}/${recordId}.`;
  const path = storedPath ?? getAudioPath(userId, recordId, "audio/webm");
  if (!path.startsWith(expectedPrefix)) {
    throw new Error("錄音儲存路徑與使用者不符");
  }

  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);

  if (error) {
    if (error.message?.toLowerCase().includes("not found")) {
      console.warn(`Audio file not found: ${path}`);
      return;
    }
    throw new Error(error.message || "刪除錄音失敗");
  }
}

/** 取得錄音播放用的短效簽名 URL（expirationMinutes 預設 60）。 */
export async function getAudioSignedUrl(
  path: string,
  expirationMinutes: number = 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expirationMinutes * 60);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "取得音訊 URL 失敗");
  }

  return data.signedUrl;
}
