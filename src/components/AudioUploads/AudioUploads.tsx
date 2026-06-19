import { useState, useRef, useCallback } from "react";
import type {
  AudioUpload,
  AudioUploadUpdateInput,
} from "../../types/audioUpload";
import {
  SUPPORTED_AUDIO_EXTENSIONS,
  MAX_UPLOAD_SIZE_MB,
} from "../../types/audioUpload";
import { useAudioUploads } from "../../hooks/useAudioUploads";
import { AudioUploadList } from "./AudioUploadList";
import { AudioUploadEditModal } from "./AudioUploadEditModal";
import { Toast } from "../common/Toast";
import { ConfirmModal } from "../common/ConfirmModal";

export function AudioUploads() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Edit modal state
  const [editingUpload, setEditingUpload] = useState<AudioUpload | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    audioUrl: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    uploads,
    loading,
    uploading,
    audioUrls,
    uploadAudio,
    updateUpload,
    deleteUpload,
    refreshSignedUrl,
    getSignedUrl,
  } = useAudioUploads();

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    // Auto-fill title with filename (without extension)
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    setTitle(nameWithoutExt);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (
        file &&
        (file.type.startsWith("audio/") || file.type === "video/mp4")
      ) {
        handleFileSelect(file);
      } else {
        setToastMessage({ message: "請上傳音訊檔案", type: "error" });
      }
    },
    [handleFileSelect],
  );

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) return;

    const result = await uploadAudio(selectedFile, title.trim());

    if (result.success) {
      setToastMessage({ message: result.message, type: "success" });
      // Reset form
      setSelectedFile(null);
      setTitle("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } else {
      setToastMessage({ message: result.message, type: "error" });
    }
  };

  const handleClearSelection = () => {
    setSelectedFile(null);
    setTitle("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleEdit = (upload: AudioUpload) => {
    setEditingUpload(upload);
  };

  const handleSaveEdit = async (
    uploadId: string,
    updates: AudioUploadUpdateInput,
  ) => {
    setIsUpdating(true);
    const result = await updateUpload(uploadId, updates);
    setIsUpdating(false);

    if (result.success) {
      setToastMessage({ message: result.message, type: "success" });
      setEditingUpload(null);
    } else {
      setToastMessage({ message: result.message, type: "error" });
    }
  };

  const handleCloseEditModal = () => {
    setEditingUpload(null);
  };

  const handleDelete = (uploadId: string, audioUrl: string) => {
    setDeleteTarget({ id: uploadId, audioUrl });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    const result = await deleteUpload(deleteTarget.id, deleteTarget.audioUrl);
    setIsDeleting(false);
    setDeleteTarget(null);

    if (result.success) {
      setToastMessage({ message: result.message, type: "success" });
    } else {
      setToastMessage({ message: result.message, type: "error" });
    }
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
  };

  const handleRefreshUrl = (uploadId: string, audioUrl: string) => {
    void refreshSignedUrl(uploadId, audioUrl);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-5 md:p-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Header */}
      <div className="surface-card p-4 sm:p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
              🎵 音訊庫
            </h1>
            <p className="text-muted-foreground mt-1">
              上傳、管理和播放你的音訊檔案
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="badge badge-lg badge-outline gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
                {uploads.length} 個音訊
              </div>
          </div>
        </div>
      </div>

      {/* Modern Upload Area */}
      <div className="surface-card overflow-hidden">
        {/* Drag & Drop Zone */}
        <div
          className={`relative p-4 sm:p-6 md:p-8 transition-all duration-300 ${
            isDragging
              ? "bg-primary/10 border-primary"
              : selectedFile
              ? "bg-success/5"
              : "bg-base-200/40"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              id="audio-file"
              type="file"
              accept={SUPPORTED_AUDIO_EXTENSIONS}
              onChange={handleInputChange}
              className="hidden"
              disabled={uploading}
            />

            {!selectedFile ? (
              // Upload prompt
              <div className="text-center">
                <div
                  className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-300 ${
                    isDragging
                      ? "bg-primary text-primary-content scale-110"
                      : "bg-base-300 text-muted-foreground"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-10 w-10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {isDragging ? "放開以上傳檔案" : "拖放音訊檔案到這裡"}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  支援 MP3, WAV, M4A, WebM, OGG, AAC, MP4（最大 {MAX_UPLOAD_SIZE_MB}
                  MB）
                </p>
                <label
                  htmlFor="audio-file"
                  className="btn btn-primary btn-outline gap-2 cursor-pointer active:scale-[0.98]"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  選擇檔案
                </label>
              </div>
            ) : (
              // File selected - show preview and title input
              <div className="w-full sm:max-w-lg mx-auto">
                {/* File Preview Card */}
                <div className="glass rounded-2xl p-4 shadow-elevated mb-4">
                  <div className="flex items-center gap-4">
                    {/* Audio Icon */}
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-7 w-7 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                    </div>
                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    {/* Remove Button */}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-circle"
                      onClick={handleClearSelection}
                      disabled={uploading}
                      title="移除檔案"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Title Input */}
                <div className="form-control mb-4">
                  <label className="label" htmlFor="audio-title">
                    <span className="label-text font-medium">音訊標題</span>
                  </label>
                  <input
                    id="audio-title"
                    type="text"
                    className="input input-bordered w-full focus:input-primary h-11"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="輸入音訊標題"
                    disabled={uploading}
                  />
                </div>

                {/* Upload Button */}
                <button
                  type="button"
                  className="btn btn-primary w-full gap-2 active:scale-[0.98]"
                  onClick={handleUpload}
                  disabled={uploading || !title.trim()}
                >
                  {uploading ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      上傳中...
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                        />
                      </svg>
                      上傳音訊
                    </>
                  )}
                </button>
              </div>
            )}
        </div>
      </div>

      {/* Upload List */}
      <div className="surface-card p-4 sm:p-5 md:p-6">
        <AudioUploadList
          uploads={uploads}
          loading={loading}
          audioUrls={audioUrls}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRefreshUrl={handleRefreshUrl}
          onLoadUrl={getSignedUrl}
        />
      </div>

      {/* Edit Modal */}
      <AudioUploadEditModal
        isOpen={editingUpload !== null}
        upload={editingUpload}
        isSaving={isUpdating}
        onSave={handleSaveEdit}
        onClose={handleCloseEditModal}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="刪除音訊"
        message="確定要刪除這個音訊嗎？此操作無法復原。"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        confirmText="刪除"
        cancelText="取消"
        confirmVariant="error"
        isLoading={isDeleting}
      />
    </div>
  );
}

export default AudioUploads;
