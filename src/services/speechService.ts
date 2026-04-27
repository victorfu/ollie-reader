import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import type { Speech } from "../types/sentencePractice";
import { DEFAULT_SPEECH_NAME } from "../types/sentencePractice";

const SPEECH_COLLECTION = "speeches";
const SENTENCE_COLLECTION = "sentencePractice";

const toSpeech = (id: string, data: DocumentData): Speech => ({
  id,
  userId: data.userId,
  name: data.name,
  description: data.description,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const listSpeeches = async (userId: string): Promise<Speech[]> => {
  const q = query(
    collection(db, SPEECH_COLLECTION),
    where("userId", "==", userId),
    orderBy("createdAt", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toSpeech(d.id, d.data()));
};

export const createSpeech = async (
  userId: string,
  name: string,
  description?: string,
): Promise<Speech> => {
  const now = Timestamp.now();
  const ref = await addDoc(collection(db, SPEECH_COLLECTION), {
    userId,
    name,
    description: description ?? "",
    createdAt: now,
    updatedAt: now,
  });
  return {
    id: ref.id,
    userId,
    name,
    description: description ?? "",
    createdAt: now.toDate(),
    updatedAt: now.toDate(),
  };
};

export const renameSpeech = async (
  speechId: string,
  name: string,
): Promise<void> => {
  await updateDoc(doc(db, SPEECH_COLLECTION, speechId), {
    name,
    updatedAt: Timestamp.now(),
  });
};

// Delete a speech AND all its sentences
export const deleteSpeech = async (speechId: string): Promise<void> => {
  const sentenceQ = query(
    collection(db, SENTENCE_COLLECTION),
    where("speechId", "==", speechId),
  );
  const sentenceSnap = await getDocs(sentenceQ);

  const BATCH_SIZE = 500;
  for (let i = 0; i < sentenceSnap.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    sentenceSnap.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  await deleteDoc(doc(db, SPEECH_COLLECTION, speechId));
};

// Duplicate a speech: create a new speech and copy all sentences (preserving order)
export const duplicateSpeech = async (
  userId: string,
  sourceSpeechId: string,
  newName: string,
): Promise<Speech> => {
  const newSpeech = await createSpeech(userId, newName);

  const sentenceQ = query(
    collection(db, SENTENCE_COLLECTION),
    where("speechId", "==", sourceSpeechId),
    orderBy("order", "asc"),
  );
  const snap = await getDocs(sentenceQ);
  if (snap.empty) return newSpeech;

  const now = Timestamp.now();
  const BATCH_SIZE = 500;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    docs.slice(i, i + BATCH_SIZE).forEach((d, idx) => {
      const data = d.data();
      const newRef = doc(collection(db, SENTENCE_COLLECTION));
      batch.set(newRef, {
        english: data.english,
        chinese: data.chinese,
        userId,
        speechId: newSpeech.id,
        order: i + idx,
        createdAt: now,
        updatedAt: now,
      });
    });
    await batch.commit();
  }

  return newSpeech;
};

// One-time migration: if user has sentences without speechId, create a default
// speech and assign all of them to it. Returns the user's speech list after.
export const ensureSpeechesAndMigrate = async (
  userId: string,
): Promise<Speech[]> => {
  const existing = await listSpeeches(userId);

  // Find any sentences without a speechId for this user
  const legacyQ = query(
    collection(db, SENTENCE_COLLECTION),
    where("userId", "==", userId),
  );
  const legacySnap = await getDocs(legacyQ);
  const legacyDocs = legacySnap.docs.filter((d) => !d.data().speechId);

  if (legacyDocs.length === 0) {
    if (existing.length > 0) return existing;
    // No legacy sentences and no speeches yet: create empty default speech.
    const fresh = await createSpeech(userId, DEFAULT_SPEECH_NAME);
    return [fresh];
  }

  // Reuse an existing speech (named default) or create one.
  const target =
    existing.find((s) => s.name === DEFAULT_SPEECH_NAME) ||
    existing[0] ||
    (await createSpeech(userId, DEFAULT_SPEECH_NAME));

  const now = Timestamp.now();
  const BATCH_SIZE = 500;
  for (let i = 0; i < legacyDocs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    legacyDocs.slice(i, i + BATCH_SIZE).forEach((d) => {
      batch.update(d.ref, { speechId: target.id, updatedAt: now });
    });
    await batch.commit();
  }

  // Re-list to include any newly created default speech.
  return existing.length > 0 ? existing : [target];
};
