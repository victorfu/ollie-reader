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

// Convert Firestore data to PracticeSentence
const convertToPracticeSentence = (
  id: string,
  data: DocumentData,
): PracticeSentence => {
  return {
    id,
    english: data.english,
    chinese: data.chinese,
    userId: data.userId,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
};

// Add multiple sentences at once (batch write)
export const addSentences = async (
  sentences: Omit<PracticeSentence, "id" | "createdAt" | "updatedAt">[],
): Promise<string[]> => {
  const now = Timestamp.now();
  const batch = writeBatch(db);
  const docRefs: string[] = [];

  for (const sentence of sentences) {
    const docRef = doc(collection(db, COLLECTION_NAME));
    batch.set(docRef, {
      english: sentence.english,
      chinese: sentence.chinese,
      userId: sentence.userId,
      createdAt: now,
      updatedAt: now,
    });
    docRefs.push(docRef.id);
  }

  await batch.commit();
  return docRefs;
};

// Add a single sentence
export const addSentence = async (
  sentence: Omit<PracticeSentence, "id" | "createdAt" | "updatedAt">,
): Promise<string> => {
  const now = Timestamp.now();

  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    english: sentence.english,
    chinese: sentence.chinese,
    userId: sentence.userId,
    createdAt: now,
    updatedAt: now,
  });

  return docRef.id;
};

// Get all sentences for a user with pagination
export const getUserSentences = async (
  userId: string,
  filters?: SentencePracticeFilters,
): Promise<SentencePracticeResult> => {
  try {
    const pageSize = filters?.limit || DEFAULT_SENTENCE_PAGE_SIZE;
    const sortDirection = filters?.sortOrder || "asc";

    // Build base query
    let q = query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
      orderBy("createdAt", sortDirection),
      limit(pageSize + 1), // Fetch one extra to check if more exist
    );

    // Apply cursor for pagination
    if (filters?.cursor) {
      const cursorDoc = await getDoc(doc(db, COLLECTION_NAME, filters.cursor));
      if (cursorDoc.exists()) {
        q = query(
          collection(db, COLLECTION_NAME),
          where("userId", "==", userId),
          orderBy("createdAt", sortDirection),
          startAfter(cursorDoc),
          limit(pageSize + 1),
        );
      }
    }

    const querySnapshot = await getDocs(q);

    // Check if there are more results
    const hasMore = querySnapshot.docs.length > pageSize;
    const docs = hasMore
      ? querySnapshot.docs.slice(0, pageSize)
      : querySnapshot.docs;

    const sentences = docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
      return convertToPracticeSentence(doc.id, doc.data());
    });

    // Get last document ID for cursor-based pagination
    const lastDocId = docs.length > 0 ? docs[docs.length - 1].id : undefined;

    return {
      sentences,
      hasMore,
      lastDocId,
    };
  } catch (error) {
    console.error("Error getting user sentences:", error);
    throw error;
  }
};

// Get a single sentence
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

// Update a sentence
export const updateSentence = async (
  sentenceId: string,
  updates: Partial<Pick<PracticeSentence, "english" | "chinese">>,
): Promise<void> => {
  const docRef = doc(db, COLLECTION_NAME, sentenceId);

  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

// Delete a sentence
export const deleteSentence = async (sentenceId: string): Promise<void> => {
  const docRef = doc(db, COLLECTION_NAME, sentenceId);
  await deleteDoc(docRef);
};

// Clear all sentences for a user
export const clearAllSentences = async (userId: string): Promise<void> => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("userId", "==", userId),
  );

  const querySnapshot = await getDocs(q);

  const batch = writeBatch(db);
  querySnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
};
