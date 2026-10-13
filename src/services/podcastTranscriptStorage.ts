import { doc, getDocFromServer, runTransaction, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import type { PodcastTranscript, TranscriptResult } from "../types/podcastTranscript";
import { TRANSCRIPT_MODEL, TRANSCRIPT_SCHEMA_VERSION } from "../utils/podcastTranscript";

export async function transcriptId(podcastId: string, guid: string) {
  const input = new TextEncoder().encode(JSON.stringify([podcastId, guid, TRANSCRIPT_MODEL, TRANSCRIPT_SCHEMA_VERSION]));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", input)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
const cache = (uid: string, id: string) => doc(db, "users", uid, "podcastTranscripts", id);
const job = (uid: string, id: string) => doc(db, "users", uid, "podcastTranscriptJobs", id);

/** The resolved timestamp is from Firestore, never an SDK local estimate.
 * Rules require sampledAt == request.time so clients cannot forge this clock.
 * A concurrent sample can only be newer; both are authoritative server times. */
async function serverTime(uid: string): Promise<number> {
  const clock = doc(db, "users", uid, "podcastTranscriptClock", "current");
  await setDoc(clock, { sampledAt: serverTimestamp() });
  const sampledAt: unknown = (await getDocFromServer(clock)).data()?.sampledAt;
  if (!(sampledAt instanceof Timestamp)) throw new Error("無法確認伺服器時間，請稍後重試。");
  return sampledAt.toMillis();
}

function hasServerLease(data: Record<string, unknown>): data is Record<string, unknown> & { startedAt: Timestamp; leaseDurationMs: number } {
  return data.startedAt instanceof Timestamp && typeof data.leaseDurationMs === "number" && [30_000, 120_000, 600_000].includes(data.leaseDurationMs);
}

function leaseActive(data: { startedAt: Timestamp; leaseDurationMs: number }, now: number) {
  return data.startedAt.toMillis() + data.leaseDurationMs > now;
}

export async function readPodcastTranscript(uid: string, id: string): Promise<TranscriptResult> {
  const saved = await getDocFromServer(cache(uid, id));
  if (saved.exists()) return { status: "completed", transcript: saved.data() as PodcastTranscript };
  const active = (await getDocFromServer(job(uid, id))).data();
  if (!active) return { status: "idle" };
  if (!hasServerLease(active)) return { status: "failed", error: "舊版字幕作業需要更新，請按重試；更新後會先等候原作業結束。" };
  if (active.status === "generating" && leaseActive(active, await serverTime(uid))) return { status: "generating" };
  return { status: "failed", error: typeof active.error === "string" && active.error ? active.error : "上次轉錄未完成，請重試。" };
}

export async function claimPodcastTranscript(uid: string, id: string): Promise<{ token: string } | TranscriptResult> {
  const token = crypto.randomUUID();
  // Sampling before the transaction is conservative: transaction retries may
  // postpone an expiry decision, but can never expire a running lease early.
  const now = await serverTime(uid);
  return runTransaction(db, async (tx) => {
    const [saved, active] = await Promise.all([tx.get(cache(uid, id)), tx.get(job(uid, id))]);
    if (saved.exists()) return { status: "completed" as const, transcript: saved.data() as PodcastTranscript };
    const data = active.data();
    if (data) {
      if (!hasServerLease(data)) {
        // Pre-fix browser-clock leases cannot safely be judged expired. Preserve
        // their owner token and wait a full server-timed lease before retrying.
        tx.set(job(uid, id), { token: typeof data.token === "string" && data.token ? data.token : token, status: "generating", startedAt: serverTimestamp(), leaseDurationMs: 600_000 });
        return { status: "generating" as const };
      }
      if (leaseActive(data, now)) return data.status === "generating" ? { status: "generating" as const } : { status: "failed" as const, error: typeof data.error === "string" && data.error ? data.error : "請稍後再試。" };
    }
    tx.set(job(uid, id), { token, status: "generating", startedAt: serverTimestamp(), leaseDurationMs: 600_000 });
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
    tx.set(job(uid, id), { token, status: "failed", error, startedAt: serverTimestamp(), leaseDurationMs: cancelled ? 120_000 : 30_000 });
  });
}
