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
  runTransaction,
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
const SPEECH_COLLECTION_NAME = "speeches";
const SENTENCE_ORDER_FLOOR_FIELD = "sentenceOrderFloor";

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

// Min order within a speech; null when the speech has no sentences yet.
export const getMinOrder = async (speechId: string): Promise<number | null> => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("speechId", "==", speechId),
    orderBy("order", "asc"),
    limit(1),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data().order ?? null;
};

export const addSentences = async (
  sentences: Omit<PracticeSentence, "id" | "createdAt" | "updatedAt">[],
): Promise<{ id: string; order: number }[]> => {
  if (sentences.length === 0) return [];

  const speechId = sentences[0].speechId;
  const userId = sentences[0].userId;
  if (
    sentences.some(
      (sentence) =>
        sentence.speechId !== speechId || sentence.userId !== userId,
    )
  ) {
    throw new Error("同一次新增只能包含同一個演講版本的句子");
  }

  // New sentences go to the TOP of the list (easier to drag/reorder right
  // after adding). The floor is reserved on the speech document in a
  // transaction so two tabs cannot read the same minimum and allocate the
  // same order range. The observed minimum bootstraps existing speech records
  // that predate the allocator field.
  const observedMinOrder = await getMinOrder(speechId);
  const speechRef = doc(db, SPEECH_COLLECTION_NAME, speechId);
  const baseOrder = await runTransaction(db, async (transaction) => {
    const speechSnapshot = await transaction.get(speechRef);
    if (!speechSnapshot.exists()) {
      throw new Error("演講版本不存在");
    }
    if (speechSnapshot.data().userId !== userId) {
      throw new Error("無法新增到其他使用者的演講版本");
    }

    const storedFloor = speechSnapshot.data()[SENTENCE_ORDER_FLOOR_FIELD];
    const safeStoredFloor =
      typeof storedFloor === "number" && Number.isSafeInteger(storedFloor)
        ? storedFloor
        : null;
    const initialFloor = observedMinOrder ?? 0;
    const currentFloor =
      safeStoredFloor === null
        ? initialFloor
        : Math.min(safeStoredFloor, initialFloor);
    const reservedFloor = currentFloor - sentences.length;

    if (!Number.isSafeInteger(reservedFloor)) {
      throw new RangeError("句子排序值超出安全範圍");
    }

    transaction.update(speechRef, {
      [SENTENCE_ORDER_FLOOR_FIELD]: reservedFloor,
      updatedAt: Timestamp.now(),
    });
    return reservedFloor;
  });

  const now = Timestamp.now();
  const batch = writeBatch(db);
  const saved: { id: string; order: number }[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const docRef = doc(collection(db, COLLECTION_NAME));
    const order = baseOrder + i;
    batch.set(docRef, {
      english: s.english,
      chinese: s.chinese,
      userId: s.userId,
      speechId: s.speechId,
      order,
      createdAt: now,
      updatedAt: now,
    });
    saved.push({ id: docRef.id, order });
  }

  await batch.commit();
  return saved;
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
  speechId: string,
  orderedSentenceIds: string[],
): Promise<{ id: string; order: number }[]> => {
  if (orderedSentenceIds.length === 0) return [];

  const orderedIdSet = new Set(orderedSentenceIds);
  if (orderedIdSet.size !== orderedSentenceIds.length) {
    throw new Error("排序清單包含重複句子");
  }

  // Read the whole speech before assigning positions. The UI can reorder only
  // the loaded prefix, while other pages (and rows inserted by another tab)
  // must retain their relative positions. Reusing the loaded documents'
  // existing order slots avoids colliding with the first unseen page without
  // rewriting that unseen data.
  const speechQuery = query(
    collection(db, COLLECTION_NAME),
    where("speechId", "==", speechId),
    orderBy("order", "asc"),
  );
  const snapshot = await getDocs(speechQuery);
  const documentsById = new Map(
    snapshot.docs.map((document) => [document.id, document]),
  );

  for (const sentenceId of orderedSentenceIds) {
    if (!documentsById.has(sentenceId)) {
      throw new Error("句子清單已變更，請重新載入後再排序");
    }
  }

  const existingOrders = snapshot.docs.map((document) => document.data().order);
  const ordersAreUnique =
    existingOrders.every(
      (order) => typeof order === "number" && Number.isFinite(order),
    ) && new Set(existingOrders).size === existingOrders.length;

  let updates: {
    id: string;
    ref: QueryDocumentSnapshot<DocumentData>["ref"];
    order: number;
    previousOrder: unknown;
  }[];

  if (ordersAreUnique) {
    const occupiedOrders = snapshot.docs
      .filter((document) => orderedIdSet.has(document.id))
      .map((document) => document.data().order as number);

    updates = orderedSentenceIds.map((sentenceId, index) => {
      const document = documentsById.get(sentenceId)!;
      return {
        id: document.id,
        ref: document.ref,
        order: occupiedOrders[index],
        previousOrder: document.data().order,
      };
    });
  } else {
    // Repair legacy collisions left by the old index-based reorder algorithm.
    // Replacing only the occupied documents preserves every unseen row's
    // relative position; assigning dense orders makes the whole speech unique.
    let orderedIndex = 0;
    const normalizedDocuments = snapshot.docs.map((document) => {
      if (!orderedIdSet.has(document.id)) return document;
      const replacement = documentsById.get(orderedSentenceIds[orderedIndex]);
      orderedIndex += 1;
      return replacement!;
    });

    if (orderedIndex !== orderedSentenceIds.length) {
      throw new Error("句子清單已變更，請重新載入後再排序");
    }

    updates = normalizedDocuments.map((document, order) => ({
      id: document.id,
      ref: document.ref,
      order,
      previousOrder: document.data().order,
    }));
  }

  const changedUpdates = updates.filter(
    ({ order, previousOrder }) => previousOrder !== order,
  );

  const now = Timestamp.now();
  const BATCH_SIZE = 500;

  for (let i = 0; i < changedUpdates.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = changedUpdates.slice(i, i + BATCH_SIZE);

    for (const { ref, order } of chunk) {
      batch.update(ref, { order, updatedAt: now });
    }

    await batch.commit();
  }

  return updates.map(({ id, order }) => ({ id, order }));
};
