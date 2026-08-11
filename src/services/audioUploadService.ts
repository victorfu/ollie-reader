import {
  collection,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDocsFromServer,
  getDocFromServer,
  Timestamp,
  orderBy,
  limit,
  startAfter,
  updateDoc,
  deleteField,
  runTransaction,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import { auth, db } from "../utils/firebaseUtil";
import { supabase, STORAGE_BUCKET } from "../utils/supabaseClient";
import type { AudioUpload, AudioUploadUpdateInput } from "../types/audioUpload";
import {
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
  SUPPORTED_AUDIO_TYPES,
} from "../types/audioUpload";
import { isOwnedAudioUploadPath } from "./audioUploadCleanupQueue";

const COLLECTION_NAME = "audioUploads";

/**
 * Get storage path for audio upload
 */
export function createAudioUploadPath(
  userId: string,
  uploadId: string,
  mimeType: string,
): string {
  const extension = getExtensionFromMimeType(mimeType);
  return `audio-uploads/${userId}/${uploadId}.${extension}`;
}

/**
 * Extract file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
    "video/mp4": "mp4",
  };
  return mimeToExt[mimeType] || "audio";
}

// Convert Firestore data to AudioUpload
const convertToAudioUpload = (id: string, data: DocumentData): AudioUpload => {
  return {
    id,
    userId: data.userId,
    title: data.title,
    description: data.description,
    audioUrl: data.audioUrl,
    durationSeconds: data.durationSeconds,
    fileSize: data.fileSize,
    mimeType: data.mimeType,
    createdAt: data.createdAt?.toDate() || new Date(),
  };
};

/**
 * Upload audio file to storage
 */
export async function uploadAudioFile(
  userId: string,
  path: string,
  audioFile: File | Blob,
  mimeType: string,
): Promise<void> {
  // Validate file size
  if (audioFile.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(
      `檔案過大，最大允許 ${MAX_UPLOAD_SIZE_MB}MB，目前大小 ${(
        audioFile.size /
        1024 /
        1024
      ).toFixed(2)}MB`,
    );
  }

  // Validate file type
  if (!SUPPORTED_AUDIO_TYPES.includes(mimeType)) {
    throw new Error(
      `不支援的音訊格式。支援格式：MP3, WAV, M4A, WebM, OGG, AAC, MP4`,
    );
  }

  if (!isOwnedAudioUploadPath(userId, path)) {
    throw new Error("拒絕上傳到不屬於目前帳號的音訊路徑");
  }

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, audioFile, { contentType: mimeType, upsert: true });

  if (error) {
    throw new Error(error.message || "上傳音訊失敗");
  }
}

/**
 * Delete audio file from storage
 */
export async function deleteAudioFile(audioUrl: string): Promise<void> {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([audioUrl]);

  if (error) {
    if (error.message?.includes("not found")) {
      console.warn(`Audio file not found: ${audioUrl}`);
      return;
    }
    throw new Error(error.message || "刪除音訊失敗");
  }
}

export async function deleteAudioFileForOwner(
  userId: string,
  audioUrl: string,
): Promise<void> {
  if (!isOwnedAudioUploadPath(userId, audioUrl)) {
    throw new Error("拒絕清理不屬於目前帳號的音訊路徑");
  }
  if (auth.currentUser?.uid !== userId) {
    throw new Error("音訊清理帳號已切換");
  }
  await deleteAudioFile(audioUrl);
}

/**
 * Get signed URL for audio playback
 */
export async function getAudioUploadSignedUrl(
  path: string,
  expirationMinutes: number = 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expirationMinutes * 60);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "取得音訊 URL 失敗");
  }

  return data.signedUrl;
}

export async function audioUploadMetadataExists(
  userId: string,
  audioUrl: string,
): Promise<boolean> {
  // Cleanup decisions must never use Firestore's offline cache: a cached
  // negative after a lost acknowledgement could make us delete a still-used
  // Storage object.
  const snapshot = await getDocsFromServer(
    query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
      where("audioUrl", "==", audioUrl),
      limit(1),
    ),
  );
  return !snapshot.empty;
}

export async function audioUploadMetadataExistsById(
  userId: string,
  uploadId: string,
  audioUrl: string,
): Promise<boolean> {
  const snapshot = await getDocFromServer(doc(db, COLLECTION_NAME, uploadId));
  if (!snapshot.exists()) return false;

  const data = snapshot.data();
  if (data.userId !== userId || data.audioUrl !== audioUrl) {
    throw new Error("音訊 metadata 與目前帳號或檔案不一致");
  }
  return true;
}

/**
 * Add a new audio upload record to Firestore
 */
export async function addAudioUpload(
  uploadId: string,
  upload: Omit<AudioUpload, "id" | "createdAt">,
): Promise<string> {
  const now = Timestamp.now();

  const docData: Record<string, unknown> = {
    userId: upload.userId,
    title: upload.title,
    audioUrl: upload.audioUrl,
    durationSeconds: upload.durationSeconds,
    fileSize: upload.fileSize,
    mimeType: upload.mimeType,
    createdAt: now,
  };

  if (upload.description !== undefined && upload.description !== "") {
    docData.description = upload.description;
  }

  const docRef = doc(db, COLLECTION_NAME, uploadId);
  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(docRef);
    if (existing.exists()) {
      const data = existing.data();
      if (data.userId !== upload.userId || data.audioUrl !== upload.audioUrl) {
        throw new Error("音訊 metadata ID 已被其他資料使用");
      }
      return existing.id;
    }

    transaction.set(docRef, docData);
    return docRef.id;
  });
}

/**
 * Get all audio uploads for a user, sorted by createdAt descending
 */
export async function getUserAudioUploads(
  userId: string,
  pageSize: number = 100,
): Promise<AudioUpload[]> {
  try {
    const uploads: AudioUpload[] = [];
    const effectivePageSize = Math.max(1, pageSize);
    let cursor: QueryDocumentSnapshot<DocumentData> | null = null;

    while (true) {
      const q: Query<DocumentData> = cursor
        ? query(
            collection(db, COLLECTION_NAME),
            where("userId", "==", userId),
            orderBy("createdAt", "desc"),
            startAfter(cursor),
            limit(effectivePageSize),
          )
        : query(
            collection(db, COLLECTION_NAME),
            where("userId", "==", userId),
            orderBy("createdAt", "desc"),
            limit(effectivePageSize),
          );

      const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(q);
      uploads.push(
        ...querySnapshot.docs.map(
          (snapshot: QueryDocumentSnapshot<DocumentData>) =>
            convertToAudioUpload(snapshot.id, snapshot.data()),
        ),
      );

      if (querySnapshot.docs.length < effectivePageSize) break;
      cursor = querySnapshot.docs.at(-1) ?? null;
      if (!cursor) break;
    }

    return uploads;
  } catch (error) {
    console.error("Error getting user audio uploads:", error);
    throw error;
  }
}

/**
 * Update an audio upload's metadata (title, description)
 */
export async function updateAudioUpload(
  uploadId: string,
  updates: AudioUploadUpdateInput,
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, uploadId);

  const updateData: Record<string, unknown> = {};

  if (updates.title !== undefined) {
    updateData.title = updates.title;
  }
  if (updates.description !== undefined) {
    updateData.description = updates.description || deleteField();
  }

  if (Object.keys(updateData).length > 0) {
    await updateDoc(docRef, updateData);
  }
}

/**
 * Delete an audio upload's metadata. Storage cleanup is coordinated by the
 * hook through a durable per-owner queue after this logical deletion commits.
 */
export async function deleteAudioUpload(
  uploadId: string,
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, uploadId);
  await deleteDoc(docRef);
}
