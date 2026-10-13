import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PodcastTranscript } from "../types/podcastTranscript";
const m = vi.hoisted(() => ({ docs: new Map<string, Record<string, unknown>>(), tail: Promise.resolve(), serverNow: 1_000_000, failClock: false, timestamp: {} }));
vi.mock("../utils/firebaseUtil", () => ({ db: {} }));
vi.mock("firebase/firestore", async (original) => {
  const { Timestamp } = await original<typeof import("firebase/firestore")>();
  const snapshot = (path: string) => ({ exists: () => m.docs.has(path), data: () => m.docs.get(path) });
  const commit = (path: string, data: Record<string, unknown>) => m.docs.set(path, Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, value === m.timestamp ? Timestamp.fromMillis(m.serverNow) : value]),
  ));
  return {
    Timestamp,
    serverTimestamp: () => m.timestamp,
    doc: (_db: unknown, ...parts: string[]) => parts.join("/"),
    setDoc: async (path: string, data: Record<string, unknown>) => { if (m.failClock) throw new Error("clock unavailable"); commit(path, data); },
    getDocFromServer: async (path: string) => snapshot(path),
    runTransaction: (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      const tx = { get: async (path: string) => snapshot(path), set: commit, delete: (path: string) => m.docs.delete(path) };
      const task = m.tail.then(() => fn(tx)); m.tail = task.then(() => undefined, () => undefined); return task;
    },
  };
});
import { transcriptId, readPodcastTranscript, claimPodcastTranscript, savePodcastTranscript, failPodcastTranscript } from "./podcastTranscriptStorage";
import { Timestamp } from "firebase/firestore";
const saved = { fullText: "Complete.", id: "id" } as PodcastTranscript;
beforeEach(() => { m.docs.clear(); m.tail = Promise.resolve(); m.serverNow = 1_000_000; m.failClock = false; vi.stubGlobal("crypto", webcrypto); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("uses stable safe IDs with case-sensitive GUID identity", async () => {
  expect(await transcriptId("1", "../../https://a/b")).toMatch(/^[a-f0-9]{64}$/);
  expect(await transcriptId("1", "A")).not.toBe(await transcriptId("1", "a"));
});
it("atomically prevents duplicate claims across callers", async () => {
  const results = await Promise.all([claimPodcastTranscript("u", "id"), claimPodcastTranscript("u", "id")]);
  expect(results[0]).toHaveProperty("token"); expect(results[1]).toEqual({ status: "generating" });
});
it("persists success and returns cache on subsequent generation", async () => {
  const claim = await claimPodcastTranscript("u", "id"); if (!("token" in claim)) throw new Error("No lease");
  await savePodcastTranscript("u", "id", claim.token, saved);
  expect(await readPodcastTranscript("u", "id")).toEqual({ status: "completed", transcript: saved });
  expect(await claimPodcastTranscript("u", "id")).toEqual({ status: "completed", transcript: saved });
});
it("late failures and stale writers do not overwrite a completed cache", async () => {
  const claim = await claimPodcastTranscript("u", "id"); if (!("token" in claim)) throw new Error("No lease");
  await savePodcastTranscript("u", "id", claim.token, saved);
  await failPodcastTranscript("u", "id", claim.token, "late", false);
  expect(await savePodcastTranscript("u", "id", "stale", { ...saved, fullText: "wrong" })).toEqual(saved);
});
it("isolates each user's cache", async () => {
  m.docs.set("users/u/podcastTranscripts/id", saved as unknown as Record<string, unknown>);
  expect(await readPodcastTranscript("other", "id")).toEqual({ status: "idle" });
});
it("preserves text on errors and expires abandoned jobs", async () => {
  m.docs.set("users/u/podcastTranscriptJobs/id", { status: "generating", startedAt: Timestamp.fromMillis(0), leaseDurationMs: 600_000 });
  expect(await readPodcastTranscript("u", "id")).toMatchObject({ status: "failed" });
  expect(await claimPodcastTranscript("u", "id")).toHaveProperty("token");
});

it.each([-86_400_000, 86_400_000])("uses Firestore time when a second device's clock is skewed by %i ms", async (skew) => {
  vi.spyOn(Date, "now").mockReturnValue(m.serverNow - skew);
  const first = await claimPodcastTranscript("u", "id");
  expect(first).toHaveProperty("token");
  expect(m.docs.get("users/u/podcastTranscriptJobs/id")?.startedAt).toEqual(Timestamp.fromMillis(m.serverNow));
  vi.mocked(Date.now).mockReturnValue(m.serverNow + skew);
  m.serverNow += 599_999;
  expect(await readPodcastTranscript("u", "id")).toEqual({ status: "generating" });
  expect(await claimPodcastTranscript("u", "id")).toEqual({ status: "generating" });
  m.serverNow += 1;
  expect(await readPodcastTranscript("u", "id")).toMatchObject({ status: "failed" });
  const next = await claimPodcastTranscript("u", "id");
  expect(next).toHaveProperty("token");
  expect(next).not.toEqual(first);
});

it.each([false, true])("uses server time for failure/cancellation cooldowns (cancelled: %s)", async (cancelled) => {
  const first = await claimPodcastTranscript("u", "id");
  if (!("token" in first)) throw new Error("No lease");
  vi.spyOn(Date, "now").mockReturnValue(0);
  await failPodcastTranscript("u", "id", first.token, "failed", cancelled);
  vi.mocked(Date.now).mockReturnValue(1e15);
  m.serverNow += (cancelled ? 120_000 : 30_000) - 1;
  expect(await claimPodcastTranscript("u", "id")).toEqual({ status: "failed", error: "failed" });
  m.serverNow += 1;
  expect(await claimPodcastTranscript("u", "id")).toHaveProperty("token");
});

it("fails closed when authoritative time cannot be fetched", async () => {
  m.failClock = true;
  await expect(claimPodcastTranscript("u", "id")).rejects.toThrow("clock unavailable");
  expect(m.docs.has("users/u/podcastTranscriptJobs/id")).toBe(false);
  // Reading a completed transcript does not require a clock write.
  m.docs.set("users/u/podcastTranscripts/id", saved as unknown as Record<string, unknown>);
  expect(await readPodcastTranscript("u", "id")).toEqual({ status: "completed", transcript: saved });
});

it.each([0, 1e15])("migrates browser-clock leases conservatively regardless of expiresAt %i", async (expiresAt) => {
  m.docs.set("users/u/podcastTranscriptJobs/id", { token: "old-owner", status: "generating", expiresAt });
  expect(await claimPodcastTranscript("u", "id")).toEqual({ status: "generating" });
  expect(m.docs.get("users/u/podcastTranscriptJobs/id")).toEqual({ token: "old-owner", status: "generating", startedAt: Timestamp.fromMillis(m.serverNow), leaseDurationMs: 600_000 });
  m.serverNow += 600_000;
  expect(await claimPodcastTranscript("u", "id")).toHaveProperty("token");
});
