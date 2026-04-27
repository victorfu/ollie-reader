import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  Timestamp,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import type {
  PracticeSentence,
  SentencePracticeFilters,
  SentencePracticeResult,
} from "../types/sentencePractice";
import { DEFAULT_SENTENCE_PAGE_SIZE } from "../types/sentencePractice";

const COLLECTION_NAME = "sentencePractice";

const convertToPracticeSentence = (
  id: string,
  data: DocumentData,
): PracticeSentence => ({
  id,
  english: data.english,
  chinese: data.chinese,
  userId: data.userId,
  speechId: data.speechId,
  order: data.order,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

// Max order within a speech
export const getMaxOrder = async (speechId: string): Promise<number> => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("speechId", "==", speechId),
    orderBy("order", "desc"),
    limit(1),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return -1;
  return snapshot.docs[0].data().order ?? -1;
};

export const addSentences = async (
  sentences: Omit<PracticeSentence, "id" | "createdAt" | "updatedAt">[],
): Promise<string[]> => {
  if (sentences.length === 0) return [];

  const speechId = sentences[0].speechId;
  const maxOrder = await getMaxOrder(speechId);

  const now = Timestamp.now();
  const batch = writeBatch(db);
  const docRefs: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const docRef = doc(collection(db, COLLECTION_NAME));
    batch.set(docRef, {
      english: s.english,
      chinese: s.chinese,
      userId: s.userId,
      speechId: s.speechId,
      order: maxOrder + 1 + i,
      createdAt: now,
      updatedAt: now,
    });
    docRefs.push(docRef.id);
  }

  await batch.commit();
  return docRefs;
};

export const addSentence = async (
  sentence: Omit<PracticeSentence, "id" | "createdAt" | "updatedAt">,
): Promise<string> => {
  const maxOrder = await getMaxOrder(sentence.speechId);
  const now = Timestamp.now();

  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    english: sentence.english,
    chinese: sentence.chinese,
    userId: sentence.userId,
    speechId: sentence.speechId,
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  });

  return docRef.id;
};

// Get all sentences for a speech with pagination
export const getSpeechSentences = async (
  speechId: string,
  filters?: SentencePracticeFilters,
): Promise<SentencePracticeResult> => {
  try {
    const pageSize = filters?.limit || DEFAULT_SENTENCE_PAGE_SIZE;
    const sortDirection = filters?.sortOrder || "asc";

    let q = query(
      collection(db, COLLECTION_NAME),
      where("speechId", "==", speechId),
      orderBy("order", sortDirection),
      limit(pageSize + 1),
    );

    if (filters?.cursor) {
      const cursorDoc = await getDoc(doc(db, COLLECTION_NAME, filters.cursor));
      if (cursorDoc.exists()) {
        q = query(
          collection(db, COLLECTION_NAME),
          where("speechId", "==", speechId),
          orderBy("order", sortDirection),
          startAfter(cursorDoc),
          limit(pageSize + 1),
        );
      }
    }

    const querySnapshot = await getDocs(q);

    const hasMore = querySnapshot.docs.length > pageSize;
    const docs = hasMore
      ? querySnapshot.docs.slice(0, pageSize)
      : querySnapshot.docs;

    const sentences = docs.map((d: QueryDocumentSnapshot<DocumentData>) =>
      convertToPracticeSentence(d.id, d.data()),
    );

    const lastDocId = docs.length > 0 ? docs[docs.length - 1].id : undefined;

    return { sentences, hasMore, lastDocId };
  } catch (error) {
    console.error("Error getting speech sentences:", error);
    throw error;
  }
};

export const getSentence = async (
  sentenceId: string,
): Promise<PracticeSentence | null> => {
  const docRef = doc(db, COLLECTION_NAME, sentenceId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return convertToPracticeSentence(docSnap.id, docSnap.data());
  }
  return null;
};

export const updateSentence = async (
  sentenceId: string,
  updates: Partial<Pick<PracticeSentence, "english" | "chinese">>,
): Promise<void> => {
  await updateDoc(doc(db, COLLECTION_NAME, sentenceId), {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const deleteSentence = async (sentenceId: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION_NAME, sentenceId));
};

// Clear all sentences within a speech
export const clearSpeechSentences = async (speechId: string): Promise<void> => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("speechId", "==", speechId),
  );
  const querySnapshot = await getDocs(q);
  const docs = querySnapshot.docs;

  const BATCH_SIZE = 500;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
};

export const updateSentenceOrders = async (
  updates: { id: string; order: number }[],
): Promise<void> => {
  if (updates.length === 0) return;

  const now = Timestamp.now();
  const BATCH_SIZE = 500;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = updates.slice(i, i + BATCH_SIZE);

    for (const { id, order } of chunk) {
      batch.update(doc(db, COLLECTION_NAME, id), { order, updatedAt: now });
    }

    await batch.commit();
  }
};
