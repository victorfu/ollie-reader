import {
  collection,
  addDoc,
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
  type DocumentData,
  type QueryDocumentSnapshot,
  writeBatch,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import type {
  SentenceTranslation,
  SentenceTranslationFilters,
  SentenceTranslationResult,
} from "../types/sentenceTranslation";
import { DEFAULT_PAGE_SIZE } from "../types/sentenceTranslation";

const COLLECTION_NAME = "sentenceTranslations";

// Convert Firestore data to SentenceTranslation
const convertToSentenceTranslation = (
  id: string,
  data: DocumentData
): SentenceTranslation => {
  return {
    id,
    userId: data.userId,
    english: data.english,
    chinese: data.chinese,
    sourcePdfName: data.sourcePdfName,
    createdAt: data.createdAt?.toDate() || new Date(),
  };
};

// Check if translation exists and return it (cache lookup)
export const findExistingTranslation = async (
  userId: string,
  english: string
): Promise<SentenceTranslation | null> => {
  const normalizedEnglish = english.trim();

  const q = query(
    collection(db, COLLECTION_NAME),
    where("userId", "==", userId),
    where("english", "==", normalizedEnglish),
    limit(1)
  );

  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return convertToSentenceTranslation(docSnap.id, docSnap.data());
  }

  return null;
};

// Add a new sentence translation
export const addSentenceTranslation = async (
  sentence: Omit<SentenceTranslation, "id" | "createdAt">
): Promise<string> => {
  const now = Timestamp.now();

  const docData = {
    userId: sentence.userId,
    english: sentence.english.trim(),
    chinese: sentence.chinese,
    sourcePdfName: sentence.sourcePdfName,
    createdAt: now,
  };

  // Remove undefined fields
  const cleanedData = Object.fromEntries(
    Object.entries(docData).filter(([, v]) => v !== undefined)
  );

  const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedData);
  return docRef.id;
};

// Get user's sentence translations with pagination
export const getUserSentenceTranslations = async (
  userId: string,
  filters?: SentenceTranslationFilters
): Promise<SentenceTranslationResult> => {
  try {
    const pageSize = filters?.limit || DEFAULT_PAGE_SIZE;
    const sortField = filters?.sortBy || "createdAt";
    const sortDirection = filters?.sortOrder || "desc";

    let q = query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
      orderBy(sortField, sortDirection),
      limit(pageSize + 1)
    );

    // Apply cursor for pagination
    if (filters?.cursor) {
      const cursorDoc = await getDoc(doc(db, COLLECTION_NAME, filters.cursor));
      if (cursorDoc.exists()) {
        q = query(
          collection(db, COLLECTION_NAME),
          where("userId", "==", userId),
          orderBy(sortField, sortDirection),
          startAfter(cursorDoc),
          limit(pageSize + 1)
        );
      }
    }

    const querySnapshot = await getDocs(q);

    const hasMore = querySnapshot.docs.length > pageSize;
    const docs = hasMore
      ? querySnapshot.docs.slice(0, pageSize)
      : querySnapshot.docs;

    let sentences = docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
      return convertToSentenceTranslation(doc.id, doc.data());
    });

    const lastDocId = docs.length > 0 ? docs[docs.length - 1].id : undefined;

    // Apply client-side search filter
    if (filters?.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      sentences = sentences.filter(
        (s) =>
          s.english.toLowerCase().includes(searchLower) ||
          s.chinese.includes(filters.searchQuery!)
      );
    }

    return {
      sentences,
      hasMore,
      lastDocId,
    };
  } catch (error) {
    console.error("Error getting sentence translations:", error);
    throw error;
  }
};

// Delete a sentence translation
export const deleteSentenceTranslation = async (id: string): Promise<void> => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
};

// Delete all sentence translations for a user
export const deleteAllSentenceTranslations = async (
  userId: string
): Promise<void> => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("userId", "==", userId)
  );

  const querySnapshot = await getDocs(q);
  const batch = writeBatch(db);

  querySnapshot.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  await batch.commit();
};
