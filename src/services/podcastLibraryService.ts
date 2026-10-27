/**
 * The user's saved podcast links, one document each under
 * `users/{uid}/podcasts/{id}`. Only what the list needs is stored; audio links
 * expire, so opening an item resolves its URL again.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  type DocumentSnapshot,
} from "../utils/firestore";
import { db } from "../utils/firebaseUtil";
import type { PodcastResolution, SavedPodcast } from "../types/podcast";

const podcastsCollection = (uid: string) => collection(db, "users", uid, "podcasts");

function toSavedPodcast(snapshot: DocumentSnapshot): SavedPodcast | null {
  const data = snapshot.data();
  if (!data || typeof data.url !== "string") return null;
  return {
    id: snapshot.id,
    kind: data.kind === "show" ? "show" : "episode",
    url: data.url,
    title: typeof data.title === "string" ? data.title : data.url,
    podcastTitle: typeof data.podcastTitle === "string" ? data.podcastTitle : "",
    artworkUrl: typeof data.artworkUrl === "string" ? data.artworkUrl : null,
    addedAt: typeof data.addedAt === "number" ? data.addedAt : 0,
  };
}

/** What a resolved link is saved as. */
export function savedPodcastFrom(
  resolution: PodcastResolution,
  fallbackUrl: string,
): Omit<SavedPodcast, "id" | "addedAt"> {
  if ("episodes" in resolution) {
    return {
      kind: "show",
      url: resolution.sourceUrl || fallbackUrl,
      title: resolution.podcastTitle,
      podcastTitle: resolution.podcastTitle,
      artworkUrl: resolution.episodes.find((episode) => episode.artworkUrl)?.artworkUrl ?? null,
    };
  }
  return {
    kind: "episode",
    url: resolution.sourceUrl || fallbackUrl,
    title: resolution.title,
    podcastTitle: resolution.podcastTitle,
    artworkUrl: resolution.artworkUrl,
  };
}

/** Saved podcasts, newest first. */
export async function listSavedPodcasts(uid: string): Promise<SavedPodcast[]> {
  const snapshot = await getDocs(query(podcastsCollection(uid), orderBy("addedAt", "desc")));
  return snapshot.docs.flatMap((item) => toSavedPodcast(item) ?? []);
}

export async function getSavedPodcast(uid: string, id: string): Promise<SavedPodcast | null> {
  return toSavedPodcast(await getDoc(doc(podcastsCollection(uid), id)));
}

export async function savePodcast(
  uid: string,
  podcast: Omit<SavedPodcast, "id" | "addedAt">,
  now: number = Date.now(),
): Promise<SavedPodcast> {
  const ref = doc(podcastsCollection(uid));
  const saved = { ...podcast, addedAt: now };
  await setDoc(ref, saved);
  return { id: ref.id, ...saved };
}

export async function deleteSavedPodcast(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(podcastsCollection(uid), id));
}
