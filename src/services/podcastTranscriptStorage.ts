import { doc, getDocFromServer, runTransaction } from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import type { PodcastTranscript, TranscriptResult } from "../types/podcastTranscript";
import { TRANSCRIPT_MODEL, TRANSCRIPT_SCHEMA_VERSION } from "../utils/podcastTranscript";

export async function transcriptId(podcastId: string, guid: string) {
  const input = new TextEncoder().encode(JSON.stringify([podcastId, guid, TRANSCRIPT_MODEL, TRANSCRIPT_SCHEMA_VERSION]));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", input)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
const cache = (uid: string, id: string) => doc(db, "users", uid, "podcastTranscripts", id);
const job = (uid: string, id: string) => doc(db, "users", uid, "podcastTranscriptJobs", id);

export async function readPodcastTranscript(uid: string, id: string): Promise<TranscriptResult> {
  const saved = await getDocFromServer(cache(uid, id));
  if (saved.exists()) return { status: "completed", transcript: saved.data() as PodcastTranscript };
  const active = (await getDocFromServer(job(uid, id))).data();
  if (!active) return { status: "idle" };
  if (active.status === "generating" && active.expiresAt > Date.now()) return { status: "generating" };
  return { status: "failed", error: active.error || "上次轉錄未完成，請重試。" };
}

export async function claimPodcastTranscript(uid: string, id: string): Promise<{ token: string } | TranscriptResult> {
  const token = crypto.randomUUID();
  return runTransaction(db, async (tx) => {
    const [saved, active] = await Promise.all([tx.get(cache(uid, id)), tx.get(job(uid, id))]);
    if (saved.exists()) return { status: "completed" as const, transcript: saved.data() as PodcastTranscript };
    const data = active.data();
    if (data && data.expiresAt > Date.now()) return data.status === "generating" ? { status: "generating" as const } : { status: "failed" as const, error: data.error || "請稍後再試。" };
    tx.set(job(uid, id), { token, status: "generating", expiresAt: Date.now() + 600_000 });
    return { token };
  });
}

export async function savePodcastTranscript(uid: string, id: string, token: string, transcript: PodcastTranscript) {
  if (new TextEncoder().encode(JSON.stringify(transcript)).length > 750_000) throw new Error("字幕超過儲存限制，未截斷內容。");
  return runTransaction(db, async (tx) => {
    const [saved, active] = await Promise.all([tx.get(cache(uid, id)), tx.get(job(uid, id))]);
    if (saved.exists()) return saved.data() as PodcastTranscript;
    if (active.data()?.token !== token) throw new Error("字幕作業已變更，請重新檢查已儲存字幕。");
    tx.set(cache(uid, id), transcript);
    tx.delete(job(uid, id));
    return transcript;
  });
}

export async function failPodcastTranscript(uid: string, id: string, token: string, error: string, cancelled: boolean) {
  await runTransaction(db, async (tx) => {
    const active = await tx.get(job(uid, id));
    if (active.data()?.token !== token) return;
    // Cancellation cannot guarantee that Google's provider has stopped processing.
    tx.set(job(uid, id), { token, status: "failed", error, expiresAt: Date.now() + (cancelled ? 120_000 : 30_000) });
  });
}
