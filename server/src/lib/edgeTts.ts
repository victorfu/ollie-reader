import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { Agent } from "node:https";
import type { Readable } from "node:stream";
import type { SpeechRequest } from "../types/speech";
import { escapeSpeechText, rateFromSpeed, SpeechError } from "./speech";

export const SYNTHESIS_TIMEOUT_MS = 25_000;
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

function upstreamError(error: unknown): SpeechError {
  if (error instanceof SpeechError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new SpeechError(
    message.includes("403")
      ? "Edge TTS 被服務端拒絕（403），請更新伺服器的 msedge-tts 套件後重試"
      : "Edge TTS 語音合成失敗，請稍後重試",
    502,
  );
}

/** Each request owns its connection. Never share mutable TTS clients. */
export function synthesizeSpeech(
  request: SpeechRequest,
  signal?: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  if (signal?.aborted) return Promise.reject(new DOMException("語音請求已取消", "AbortError"));

  return new Promise((resolve, reject) => {
    const agent = new Agent();
    const client = new MsEdgeTTS({ agent });
    let audioStream: Readable | undefined;
    let metadataStream: Readable | null | undefined;
    let settled = false;
    let size = 0;
    const chunks: Buffer[] = [];

    const closeClient = () => {
      // close() may throw while the WebSocket is still connecting.
      try { client.close(); } catch { /* The handshake will also reject. */ }
      // Close transport sockets immediately, before destroying library streams.
      // Otherwise late WebSocket frames can reference already-removed streams.
      agent.destroy();
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      closeClient();
      audioStream?.destroy();
      metadataStream?.destroy();
      if (error) reject(error);
      else resolve(new Uint8Array(Buffer.concat(chunks)));
      chunks.length = 0;
    };
    const onAbort = () => finish(new DOMException("語音請求已取消", "AbortError"));
    const timer = setTimeout(
      () => finish(new SpeechError("Edge TTS 語音合成逾時，請稍後重試", 504)),
      SYNTHESIS_TIMEOUT_MS,
    );
    signal?.addEventListener("abort", onAbort, { once: true });

    void client.setMetadata(
      request.voice,
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
    ).then(() => {
      // A handshake can finish after cancellation; do not start synthesis then.
      if (settled) return closeClient();
      const streams = client.toStream(escapeSpeechText(request.text), {
        rate: rateFromSpeed(request.speed),
      });
      audioStream = streams.audioStream;
      metadataStream = streams.metadataStream;
      audioStream.on("data", (chunk: Buffer) => {
        if (settled) return;
        size += chunk.length;
        if (size > MAX_AUDIO_BYTES) {
          finish(new SpeechError("語音音檔過大，請縮短文字後重試", 502));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      audioStream.once("error", (error) => finish(upstreamError(error)));
      audioStream.once("end", () => finish(
        size ? undefined : new SpeechError("Edge TTS 未產生任何音訊", 502),
      ));
      audioStream.once("close", () => {
        if (!settled) finish(new SpeechError("Edge TTS 音訊傳輸中斷，請重試", 502));
      });
    }).catch((error: unknown) => {
      if (settled) closeClient();
      else finish(upstreamError(error));
    });
  });
}
