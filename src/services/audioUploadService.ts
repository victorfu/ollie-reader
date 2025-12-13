import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  limit,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import { apiFetch } from "../utils/apiUtil";
import {
  GCS_UPLOAD_URL,
  GCS_DELETE_URL,
  GCS_SIGNED_URL,
} from "../constants/api";
import type { AudioUpload, AudioUploadUpdateInput } from "../types/audioUpload";
import {
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
  SUPPORTED_AUDIO_TYPES,
} from "../types/audioUpload";

const COLLECTION_NAME = "audioUploads";

/**
 * Get GCS path for audio upload
 */
function getAudioUploadPath(
  userId: string,
  uploadId: string,
  extension: string,
): string {
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
 * Upload audio file to GCS
 */
export async function uploadAudioFile(
  userId: string,
  uploadId: string,
  audioFile: File | Blob,
  mimeType: string,
): Promise<string> {
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

  const extension = getExtensionFromMimeType(mimeType);
  const path = getAudioUploadPath(userId, uploadId, extension);

  // Create FormData for multipart upload
  const formData = new FormData();
  const fileName =
    audioFile instanceof File ? audioFile.name : `${uploadId}.${extension}`;
  formData.append("file", audioFile, fileName);
  formData.append("path", path);

  const response = await apiFetch(GCS_UPLOAD_URL, {
    method: "POST",
    includeAuthToken: true,
    body: formData,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "上傳音訊失敗");
  }

  return path;
}

/**
 * Delete audio file from GCS
 */
export async function deleteAudioFile(audioUrl: string): Promise<void> {
  try {
    const response = await apiFetch(
      `${GCS_DELETE_URL}?path=${encodeURIComponent(audioUrl)}`,
      {
        method: "DELETE",
        includeAuthToken: true,
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Audio file not found: ${audioUrl}`);
        return;
      }
      const error = await response
        .json()
        .catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || "刪除音訊失敗");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      console.warn(`Audio file not found: ${audioUrl}`);
      return;
    }
    throw error;
  }
}

/**
 * Get signed URL for audio playback
 */
export async function getAudioUploadSignedUrl(
  path: string,
  expirationMinutes: number = 60,
): Promise<string> {
  const params = new URLSearchParams({
    path,
    expiration_minutes: expirationMinutes.toString(),
  });

  const response = await apiFetch(`${GCS_SIGNED_URL}?${params}`, {
    method: "GET",
    includeAuthToken: true,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "取得音訊 URL 失敗");
  }

  const data = await response.json();
  return data.url;
}

/**
 * Add a new audio upload record to Firestore
 */
export async function addAudioUpload(
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

  const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
  return docRef.id;
}

/**
 * Get all audio uploads for a user, sorted by createdAt descending
 */
export async function getUserAudioUploads(
  userId: string,
  pageLimit: number = 50,
): Promise<AudioUpload[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(pageLimit),
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(
      (doc: QueryDocumentSnapshot<DocumentData>) => {
        return convertToAudioUpload(doc.id, doc.data());
      },
    );
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
    updateData.description = updates.description;
  }

  if (Object.keys(updateData).length > 0) {
    await updateDoc(docRef, updateData);
  }
}

/**
 * Delete an audio upload and its associated file
 */
export async function deleteAudioUpload(
  uploadId: string,
  audioUrl: string,
): Promise<void> {
  // Delete audio file from GCS
  try {
    await deleteAudioFile(audioUrl);
  } catch (error) {
    console.warn("Failed to delete audio file (may not exist):", error);
  }

  // Delete Firestore document
  const docRef = doc(db, COLLECTION_NAME, uploadId);
  await deleteDoc(docRef);
}
