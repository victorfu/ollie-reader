import { useState, useRef } from "react";
import type { AudioUpload } from "../../types/audioUpload";

interface AudioUploadListProps {
  uploads: AudioUpload[];
  loading: boolean;
  audioUrls: Map<string, string>;
  onEdit: (upload: AudioUpload) => void;
  onDelete: (uploadId: string, audioUrl: string) => void;
  onRefreshUrl: (uploadId: string, audioUrl: string) => void;
}

export function AudioUploadList({
  uploads,
  loading,
  audioUrls,
  onEdit,
  onDelete,
  onRefreshUrl,
}: AudioUploadListProps) {
  const [audioErrors, setAudioErrors] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString("zh-TW", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleAudioError = (uploadId: string, audioUrl: string) => {
    setAudioErrors((prev) => new Set(prev).add(uploadId));
    onRefreshUrl(uploadId, audioUrl);
  };

  const handleRetry = (uploadId: string, audioUrl: string) => {
    setAudioErrors((prev) => {
      const next = new Set(prev);
      next.delete(uploadId);
      return next;
    });
    onRefreshUrl(uploadId, audioUrl);
  };

  const handlePlayPause = (uploadId: string) => {
    const audio = audioRefs.current.get(uploadId);
    if (!audio) return;

    if (activeId === uploadId) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch((err) => console.error("Playback failed:", err));
      }
    } else {
      // Pause any currently playing audio
      if (activeId) {
        const currentAudio = audioRefs.current.get(activeId);
        currentAudio?.pause();
      }
      setActiveId(uploadId);
      // Allow a brief moment for state to update if needed, though refs are immediate
      setTimeout(() => {
        const newAudio = audioRefs.current.get(uploadId);
        newAudio?.play().catch((err) => console.error("Playback failed:", err));
      }, 0);
    }
  };

  const handleAudioEnded = (uploadId: string) => {
    if (activeId === uploadId) {
      setIsPlaying(false);
      // Optional: keep player open or close it.
      // Keeping it open allows easy replay.
      // setActiveId(null);
    }
  };

  const setAudioRef = (uploadId: string, element: HTMLAudioElement | null) => {
    if (element) {
      audioRefs.current.set(uploadId, element);
    } else {
      audioRefs.current.delete(uploadId);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <span className="loading loading-spinner loading-lg text-primary mb-4" />
        <p className="text-base-content/60">載入音訊列表...</p>
      </div>
    );
  }

  if (uploads.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-base-200 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 text-base-content/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold mb-2">還沒有上傳的音訊</h3>
        <p className="text-base-content/60 max-w-sm mx-auto">
          拖放音訊檔案或點擊上方的「選擇檔案」按鈕開始上傳
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          🎧 我的音訊
        </h2>
        <span className="text-sm text-base-content/60">
          共 {uploads.length} 個檔案
        </span>
      </div>

      {/* Audio Grid */}
      <div className="grid gap-3">
        {uploads.map((upload) => {
          const hasSignedUrl = upload.id && audioUrls.has(upload.id);
          const hasError = upload.id && audioErrors.has(upload.id);
          const isActive = activeId === upload.id;
          const isCurrentPlaying = isActive && isPlaying;
          const isLoading = !hasSignedUrl && !hasError;

          return (
            <div
              key={upload.id}
              className={`group relative bg-base-100 rounded-2xl border overflow-hidden transition-all duration-200 ${
                isActive
                  ? "border-primary shadow-lg shadow-primary/10"
                  : "border-base-200 hover:border-base-300 hover:shadow-md"
              }`}
            >
              <div className="p-3 sm:p-4 overflow-hidden">
                <div className="flex items-start sm:items-center gap-3 sm:gap-4 w-full">
                  {/* Play Button / Album Art */}
                  <div className="shrink-0">
                    {hasError ? (
                      <button
                        type="button"
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-error/10 flex items-center justify-center text-error hover:bg-error/20 transition-colors"
                        onClick={() =>
                          upload.id && handleRetry(upload.id, upload.audioUrl)
                        }
                        title="重試載入"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 sm:h-6 sm:w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </button>
                    ) : isLoading ? (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-base-200 flex items-center justify-center">
                        <span className="loading loading-spinner loading-sm" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-200 ${
                          isCurrentPlaying
                            ? "bg-primary text-primary-content"
                            : "bg-gradient-to-br from-primary/80 to-secondary/80 text-white hover:scale-105"
                        }`}
                        onClick={() => upload.id && handlePlayPause(upload.id)}
                        title={isCurrentPlaying ? "暫停" : "播放"}
                      >
                        {isCurrentPlaying ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6 sm:h-7 sm:w-7"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6 sm:h-7 sm:w-7 ml-1"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Audio Info */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <h3 className="font-semibold text-sm sm:text-base truncate">
                      {upload.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs sm:text-sm text-base-content/60">
                      <span>{formatDuration(upload.durationSeconds)}</span>
                      <span className="w-1 h-1 rounded-full bg-base-content/30" />
                      <span>{formatFileSize(upload.fileSize)}</span>
                      <span className="hidden sm:inline w-1 h-1 rounded-full bg-base-content/30" />
                      <span className="hidden sm:inline">
                        {formatDate(upload.createdAt)}
                      </span>
                    </div>
                    {upload.description && (
                      <p className="text-sm text-base-content/50 mt-1 truncate">
                        {upload.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-circle"
                      onClick={() => onEdit(upload)}
                      title="編輯"
                    >
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
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-circle text-error hover:bg-error/10"
                      onClick={() =>
                        upload.id && onDelete(upload.id, upload.audioUrl)
                      }
                      title="刪除"
                    >
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Audio Player - only one element, shown when active */}
                {hasSignedUrl && upload.id && (
                  <div
                    className={`mt-3 pt-3 border-t border-base-200 ${
                      isActive ? "" : "hidden"
                    }`}
                    onClick={(e) => e.stopPropagation()} // Prevent clicks from bubbling
                  >
                    <audio
                      ref={(el) => setAudioRef(upload.id!, el)}
                      controls
                      className="w-full h-8"
                      src={audioUrls.get(upload.id)}
                      preload="metadata"
                      onEnded={() => handleAudioEnded(upload.id!)}
                      onPlay={() => {
                        if (activeId === upload.id) setIsPlaying(true);
                      }}
                      onPause={() => {
                        if (activeId === upload.id) setIsPlaying(false);
                      }}
                      onError={() =>
                        handleAudioError(upload.id!, upload.audioUrl)
                      }
                    >
                      您的瀏覽器不支援音訊播放
                    </audio>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
