import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, stat, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";
import { parseBuffer } from "music-metadata";
import { ApiError } from "./api";

export const MAX_PREPARED_BYTES = 4 * 1024 * 1024;

/** Full-length Opus, not transcription. Small enough for both Vercel and Firebase inline input. */
export async function preparePodcastAudio(audio: { bytes: Uint8Array; duration: number }, signal: AbortSignal) {
  if (!ffmpeg) throw new ApiError("此伺服器不支援音訊準備，請檢查 FFmpeg 安裝", 503);
  const executable = ffmpeg;
  signal.throwIfAborted();
  const directory = await mkdtemp(join(tmpdir(), "ollie-podcast-"));
  const input = join(directory, "input.audio");
  const output = join(directory, "speech.webm");
  // Up to 32 kbps for short episodes; ~15 kbps for 30 minutes, leaving container headroom.
  const bitrate = Math.min(32000, Math.floor(3_500_000 * 8 / audio.duration / 1000) * 1000);
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(60_000)]);
  try {
    await writeFile(input, audio.bytes);
    await new Promise<void>((resolve, reject) => {
      let failure: Error | undefined;
      const process = spawn(executable, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-protocol_whitelist", "file,pipe", "-format_whitelist", "mp3,mov,aac,ogg,wav,flac",
        "-i", input, "-map", "0:a:0", "-vn", "-sn", "-dn", "-map_metadata", "-1",
        "-c:a", "libopus", "-application", "voip", "-ac", "1", "-ar", "16000",
        "-b:a", String(bitrate), "-vbr", "off", "-threads", "1",
        "-fs", String(MAX_PREPARED_BYTES + 65536), "-f", "webm", output,
      ], { windowsHide: true, stdio: "ignore", signal: deadline });
      process.on("error", (error) => { failure = error; });
      // Wait for process exit before deleting files (also works on Windows).
      process.on("close", (code) => {
        if (deadline.aborted) reject(new ApiError("音訊準備逾時或已取消", 504));
        else if (failure || code !== 0) reject(new ApiError("音訊轉換失敗，請確認來源格式及 FFmpeg 安裝", 502));
        else resolve();
      });
    });
    if ((await stat(output)).size > MAX_PREPARED_BYTES) throw new ApiError("完整音訊壓縮後仍超過限制，未截斷內容", 413);
    const bytes = await readFile(output);
    const metadata = await parseBuffer(bytes, { mimeType: "audio/webm", size: bytes.length }, { duration: true, skipCovers: true });
    const duration = metadata.format.duration;
    if (!duration || Math.abs(duration - audio.duration) > 2) throw new ApiError("無法確認轉換後音訊完整，未傳送部分內容", 422);
    return { bytes: new Uint8Array(bytes), duration: audio.duration };
  } finally {
    // Only these fixed filenames in our unique temporary directory are removed.
    await Promise.all([unlink(input).catch(() => {}), unlink(output).catch(() => {})]);
    await rmdir(directory).catch(() => {});
  }
}
