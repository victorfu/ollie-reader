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
  type DocumentData,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import type { VocabularyWord, VocabularyFilters } from "../types/vocabulary";

const COLLECTION_NAME = "vocabulary";

// Helper function to remove undefined values from an object
const removeUndefinedFields = <T extends Record<string, unknown>>(
  obj: T,
): Partial<T> => {
  const result: Partial<T> = {};

  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }

  return result;
};

// Convert Firestore data to VocabularyWord
const convertToVocabularyWord = (
  id: string,
  data: DocumentData,
): VocabularyWord => {
  return {
    id,
    word: data.word,
    userId: data.userId,
    phonetic: data.phonetic,
    definitions: data.definitions || [],
    examples: data.examples || [],
    synonyms: data.synonyms || [],
    antonyms: data.antonyms || [],
    sourceContext: data.sourceContext,
    sourcePdfName: data.sourcePdfName,
    sourcePage: data.sourcePage,
    tags: data.tags || [],
    difficulty: data.difficulty,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    reviewCount: data.reviewCount || 0,
    lastReviewedAt: data.lastReviewedAt?.toDate(),
  };
};

// Add a new word to vocabulary
export const addVocabularyWord = async (
  word: Omit<VocabularyWord, "id" | "createdAt" | "updatedAt" | "reviewCount">,
): Promise<string> => {
  const now = Timestamp.now();

  const docData = removeUndefinedFields({
    ...word,
    createdAt: now,
    updatedAt: now,
    reviewCount: 0,
  });

  const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
  return docRef.id;
};

// Get all vocabulary words for a user
export const getUserVocabulary = async (
  userId: string,
  filters?: VocabularyFilters,
): Promise<VocabularyWord[]> => {
  try {
    let q = query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
    );

    // Apply difficulty filter
    if (filters?.difficulty) {
      q = query(q, where("difficulty", "==", filters.difficulty));
    }

    const querySnapshot = await getDocs(q);

    let words = querySnapshot.docs.map((doc) => {
      return convertToVocabularyWord(doc.id, doc.data());
    });

    // Apply client-side filters
    if (filters?.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      words = words.filter((word) =>
        word.word.toLowerCase().includes(searchLower),
      );
    }

    if (filters?.tags && filters.tags.length > 0) {
      words = words.filter((word) =>
        filters.tags!.some((tag) => word.tags.includes(tag)),
      );
    }

    // Apply sorting on client side
    const sortField = filters?.sortBy || "createdAt";
    const sortDirection = filters?.sortOrder || "desc";

    words.sort((a, b) => {
      let aValue: string | number | Date | undefined = a[
        sortField as keyof VocabularyWord
      ] as string | number | Date | undefined;
      let bValue: string | number | Date | undefined = b[
        sortField as keyof VocabularyWord
      ] as string | number | Date | undefined;

      // Handle Date objects
      if (aValue instanceof Date) aValue = aValue.getTime();
      if (bValue instanceof Date) bValue = bValue.getTime();

      // Handle string comparison
      if (typeof aValue === "string" && typeof bValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      // Handle undefined values
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return words;
  } catch (error) {
    console.error("Error getting user vocabulary:", error);
    throw error;
  }
};

// Get a single vocabulary word
export const getVocabularyWord = async (
  wordId: string,
): Promise<VocabularyWord | null> => {
  const docRef = doc(db, COLLECTION_NAME, wordId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return convertToVocabularyWord(docSnap.id, docSnap.data());
  }
  return null;
};

// Update a vocabulary word
export const updateVocabularyWord = async (
  wordId: string,
  updates: Partial<VocabularyWord>,
): Promise<void> => {
  const docRef = doc(db, COLLECTION_NAME, wordId);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, createdAt, ...updateData } = updates;

  const cleanedData = removeUndefinedFields({
    ...updateData,
    updatedAt: Timestamp.now(),
  });

  await updateDoc(docRef, cleanedData);
};

// Delete a vocabulary word
export const deleteVocabularyWord = async (wordId: string): Promise<void> => {
  const docRef = doc(db, COLLECTION_NAME, wordId);
  await deleteDoc(docRef);
};

// Increment review count
export const incrementReviewCount = async (wordId: string): Promise<void> => {
  const word = await getVocabularyWord(wordId);
  if (word) {
    await updateVocabularyWord(wordId, {
      reviewCount: word.reviewCount + 1,
      lastReviewedAt: new Date(),
    });
  }
};

// Check if word already exists for user
export const checkWordExists = async (
  userId: string,
  word: string,
): Promise<VocabularyWord | null> => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("userId", "==", userId),
    where("word", "==", word.toLowerCase()),
  );

  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return convertToVocabularyWord(doc.id, doc.data());
  }
  return null;
};

// Get all unique tags for a user
export const getUserTags = async (userId: string): Promise<string[]> => {
  const words = await getUserVocabulary(userId);
  const tagsSet = new Set<string>();

  words.forEach((word) => {
    word.tags.forEach((tag) => tagsSet.add(tag));
  });

  return Array.from(tagsSet).sort();
};
