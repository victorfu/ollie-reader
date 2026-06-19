import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import type { UserSettings } from "../types/settings";
import type { TTSMode, TTSEngine, ReadingMode } from "../types/pdf";

const SETTINGS_COLLECTION = "userSettings";

/**
 * Get user settings from Firestore
 */
export const getUserSettings = async (
  userId: string,
): Promise<UserSettings | null> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        userId,
        ttsMode: (data.ttsMode as TTSMode) || "browser",
        ttsEngine: (data.ttsEngine as TTSEngine) || "piper",
        speechRate: (data.speechRate as number) ?? 1,
        readingMode: (data.readingMode as ReadingMode) || "word",
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      };
    }

    return null;
  } catch (error) {
    console.error("Error getting user settings:", error);
    throw new Error("Failed to get user settings");
  }
};

/**
 * Save user settings to Firestore
 */
export const saveUserSettings = async (
  userId: string,
  settings: Partial<
    Pick<UserSettings, "ttsMode" | "ttsEngine" | "speechRate" | "readingMode">
  >,
): Promise<void> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, userId);
    const existingDoc = await getDoc(docRef);

    if (existingDoc.exists()) {
      // Update existing settings
      await setDoc(
        docRef,
        {
          ...settings,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } else {
      // Create new settings with defaults
      await setDoc(docRef, {
        userId,
        ttsMode: settings.ttsMode || "browser",
        ttsEngine: settings.ttsEngine || "piper",
        speechRate: settings.speechRate ?? 1,
        readingMode: settings.readingMode || "word",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error saving user settings:", error);
    throw new Error("Failed to save user settings");
  }
};
