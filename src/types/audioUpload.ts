export interface AudioUpload {
  id?: string;
  userId: string;
  title: string;
  description?: string;
  audioUrl: string; // GCS file path for audio storage
  durationSeconds: number;
  fileSize: number; // in bytes
  mimeType: string;
  createdAt: Date;
}

export interface AudioUploadInput {
  title: string;
  description?: string;
}

export interface AudioUploadUpdateInput {
  title?: string;
  description?: string;
}

// 50MB max audio file size for uploads
export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_UPLOAD_SIZE_MB = 50;

// Supported audio formats
export const SUPPORTED_AUDIO_TYPES = [
  "audio/mpeg", // mp3
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp4", // m4a
  "audio/x-m4a",
  "audio/webm",
  "audio/ogg",
  "audio/aac",
];

export const SUPPORTED_AUDIO_EXTENSIONS = ".mp3,.wav,.m4a,.webm,.ogg,.aac";
