import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PodcastTranscript } from "../types/podcastTranscript";
const m = vi.hoisted(() => ({ docs: new Map<string, Record<string, unknown>>(), tail: Promise.resolve() }));
vi.mock("../utils/firebaseUtil", () => ({ db: {} }));
vi.mock("firebase/firestore", () => {
  const snapshot = (path: string) => ({ exists: () => m.docs.has(path), data: () => m.docs.get(path) });
  return {
    doc: (_db: unknown, ...parts: string[]) => parts.join("/"),
    getDocFromServer: async (path: string) => snapshot(path),
    runTransaction: (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      const tx = { get: async (path: string) => snapshot(path), set: (path: string, data: Record<string, unknown>) => m.docs.set(path, data), delete: (path: string) => m.docs.delete(path) };
      const task = m.tail.then(() => fn(tx)); m.tail = task.then(() => undefined, () => undefined); return task;
    },
  };
});
import { transcriptId, readPodcastTranscript, claimPodcastTranscript, savePodcastTranscript, failPodcastTranscript } from "./podcastTranscriptStorage";
const saved = { fullText: "Complete.", id: "id" } as PodcastTranscript;
beforeEach(() => { m.docs.clear(); m.tail = Promise.resolve(); vi.stubGlobal("crypto", webcrypto); });
afterEach(() => vi.unstubAllGlobals());
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
  m.docs.set("users/u/podcastTranscriptJobs/id", { status: "generating", expiresAt: 0 });
  expect(await readPodcastTranscript("u", "id")).toMatchObject({ status: "failed" });
  expect(await claimPodcastTranscript("u", "id")).toHaveProperty("token");
});
