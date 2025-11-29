import { useState, useEffect, useCallback } from "react";
import type { PracticeRecord } from "../../types/speechPractice";
import { SPEECH_TOPICS } from "../../types/speechPractice";
import { getAudioSignedUrl } from "../../services/audioStorageService";

interface PracticeHistoryProps {
  records: PracticeRecord[];
  loading: boolean;
  onDelete: (recordId: string) => void;
}

export function PracticeHistory({
  records,
  loading,
  onDelete,
}: PracticeHistoryProps) {
  const [expandedScriptId, setExpandedScriptId] = useState<string | null>(null);
  // Cache signed URLs for audio playback
  const [audioUrls, setAudioUrls] = useState<Map<string, string>>(new Map());
  const [audioLoading, setAudioLoading] = useState<Set<string>>(new Set());
  const [audioErrors, setAudioErrors] = useState<Set<string>>(new Set());

  // Fetch signed URL for a record's audio
  const fetchAudioUrl = useCallback(async (recordId: string, path: string) => {
    if (!path) return;

    setAudioLoading((prev) => new Set(prev).add(recordId));
    setAudioErrors((prev) => {
      const next = new Set(prev);
      next.delete(recordId);
      return next;
    });

    try {
      const signedUrl = await getAudioSignedUrl(path);
      setAudioUrls((prev) => new Map(prev).set(recordId, signedUrl));
    } catch (error) {
      console.error(`Failed to get audio URL for ${recordId}:`, error);
      setAudioErrors((prev) => new Set(prev).add(recordId));
    } finally {
      setAudioLoading((prev) => {
        const next = new Set(prev);
        next.delete(recordId);
        return next;
      });
    }
  }, []);

  // Fetch signed URLs for all records with audio on mount/records change
  useEffect(() => {
    records.forEach((record) => {
      if (record.id && record.recordingUrl && !audioUrls.has(record.id)) {
        void fetchAudioUrl(record.id, record.recordingUrl);
      }
    });
  }, [records, audioUrls, fetchAudioUrl]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTopicInfo = (topicId: string) => {
    return SPEECH_TOPICS.find((t) => t.id === topicId);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-xl font-bold mb-2">還沒有練習記錄</h3>
        <p className="text-base-content/60">
          選擇一個主題開始練習，你的進步將會記錄在這裡
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        📊 練習記錄
        <span className="badge badge-primary">{records.length}</span>
      </h2>

      <div className="space-y-3">
        {records.map((record) => {
          const topicInfo = getTopicInfo(record.topicId);
          const isOverTime = topicInfo
            ? record.durationSeconds > topicInfo.suggestedTimeSeconds
            : false;

          return (
            <div
              key={record.id}
              className="card bg-base-100 shadow-sm hover:shadow transition-shadow"
            >
              <div className="card-body p-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">
                      {record.topicTitle}
                    </h3>
                    <p className="text-sm text-base-content/60">
                      {formatDate(record.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`badge ${
                        isOverTime ? "badge-error" : "badge-success"
                      }`}
                    >
                      {formatTime(record.durationSeconds)}
                    </span>

                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-circle"
                      onClick={() => record.id && onDelete(record.id)}
                      title="刪除記錄"
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

                {record.notes && (
                  <p className="text-sm text-base-content/80 mt-2">
                    📝 {record.notes}
                  </p>
                )}

                {/* Audio Playback */}
                {record.recordingUrl && record.id && (
                  <div className="mt-2">
                    <h4 className="text-sm font-medium mb-1 flex items-center gap-1">
                      🎧 錄音回放
                      {audioLoading.has(record.id) && (
                        <span className="loading loading-spinner loading-xs" />
                      )}
                    </h4>
                    {audioErrors.has(record.id) ? (
                      <div className="flex items-center gap-2 text-sm text-error">
                        <span>載入音訊失敗</span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() =>
                            fetchAudioUrl(record.id!, record.recordingUrl!)
                          }
                        >
                          重試
                        </button>
                      </div>
                    ) : audioUrls.has(record.id) ? (
                      <audio
                        controls
                        className="w-full h-10"
                        src={audioUrls.get(record.id)}
                        preload="metadata"
                        onError={() => {
                          // Re-fetch signed URL if playback fails (URL may have expired)
                          setAudioUrls((prev) => {
                            const next = new Map(prev);
                            next.delete(record.id!);
                            return next;
                          });
                          void fetchAudioUrl(record.id!, record.recordingUrl!);
                        }}
                      >
                        您的瀏覽器不支援音訊播放
                      </audio>
                    ) : (
                      <div className="text-sm text-base-content/60">
                        載入中...
                      </div>
                    )}
                  </div>
                )}

                {/* Script Display */}
                {record.script && (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs gap-1"
                      onClick={() =>
                        setExpandedScriptId(
                          expandedScriptId === record.id
                            ? null
                            : record.id ?? null,
                        )
                      }
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-3 w-3 transition-transform ${
                          expandedScriptId === record.id ? "rotate-90" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      📄 查看講稿
                      <span className="badge badge-ghost badge-xs">
                        {record.script.length} 字
                      </span>
                    </button>

                    {expandedScriptId === record.id && (
                      <div className="mt-2 p-3 bg-base-200 rounded-lg">
                        <pre className="whitespace-pre-wrap font-sans text-sm text-base-content/80 leading-relaxed">
                          {record.script}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {topicInfo && (
                  <div className="text-xs text-base-content/50 mt-1">
                    建議時間：{formatTime(topicInfo.suggestedTimeSeconds)}
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
