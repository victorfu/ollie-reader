import { useState, useEffect, useCallback, useRef } from "react";
import type { PracticeRecord } from "../../types/speechPractice";
import { SPEECH_TOPICS } from "../../types/speechPractice";
import { getAudioSignedUrl } from "../../services/audioStorageService";
import { T } from "../common/T";
import { useLanguage } from "../../hooks/useLanguage";

interface PracticeHistoryProps {
  records: PracticeRecord[];
  loading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onDelete: (recordId: string) => void;
}

export function PracticeHistory({
  records,
  loading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onDelete,
}: PracticeHistoryProps) {
  const { t, language } = useLanguage();
  const [expandedScriptId, setExpandedScriptId] = useState<string | null>(null);
  // Cache signed URLs for audio playback
  const [audioUrls, setAudioUrls] = useState<Map<string, string>>(new Map());
  const [audioLoading, setAudioLoading] = useState<Set<string>>(new Set());
  const [audioErrors, setAudioErrors] = useState<Set<string>>(new Set());
  // Track fetched IDs to avoid re-triggering the effect via audioUrls dependency
  const fetchedIdsRef = useRef<Set<string>>(new Set());

  const refreshedIdsRef = useRef(new Set<string>());
  const inFlightIdsRef = useRef(new Set<string>());

  // Fetch signed URL for a record's audio
  const fetchAudioUrl = useCallback(async (recordId: string, path: string) => {
    if (!path || inFlightIdsRef.current.has(recordId)) return;
    inFlightIdsRef.current.add(recordId);
    // Do not remount the failed URL while a manual retry is still signing.
    setAudioUrls((prev) => {
      const next = new Map(prev);
      next.delete(recordId);
      return next;
    });

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
      inFlightIdsRef.current.delete(recordId);
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
      if (record.id && record.recordingUrl && !fetchedIdsRef.current.has(record.id)) {
        fetchedIdsRef.current.add(record.id);
        void fetchAudioUrl(record.id, record.recordingUrl);
      }
    });
  }, [records, fetchAudioUrl]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString(language === "en" ? "en-US" : "zh-TW", {
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
        <h3 className="text-lg font-semibold mb-2">
          <T k="listening.speech.historyEmpty" />
        </h3>
        <p className="text-muted-foreground">
          <T k="listening.speech.historyEmptyHint" />
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        📊 <T k="listening.speech.historyTitle" variant="stacked" />
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
              className="surface-card rounded-xl transition-shadow duration-200 hover:shadow-elevated"
            >
              <div className="p-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">
                      {record.topicTitle}
                    </h3>
                    <p className="text-sm text-muted-foreground">
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
                      title={t("listening.speech.deleteRecord")}
                      aria-label={t("listening.speech.deleteRecord")}
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
                  <p className="text-sm text-muted-foreground mt-2">
                    📝 {record.notes}
                  </p>
                )}

                {/* Audio Playback */}
                {record.recordingUrl && record.id && (
                  <div className="mt-2">
                    <h4 className="text-sm font-medium mb-1 flex items-center gap-1">
                      🎧 <T k="listening.speech.recordingPlayback" />
                      {audioLoading.has(record.id) && (
                        <span className="loading loading-spinner loading-xs" />
                      )}
                    </h4>
                    {audioErrors.has(record.id) ? (
                      <div className="flex items-center gap-2 text-sm text-error">
                        <span>
                          <T k="listening.speech.audioLoadFailed" />
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => {
                            refreshedIdsRef.current.delete(record.id!);
                            void fetchAudioUrl(record.id!, record.recordingUrl!);
                          }}
                        >
                          <T k="common.retry" variant="stacked" />
                        </button>
                      </div>
                    ) : audioUrls.has(record.id) ? (
                      <audio
                        controls
                        className="w-full h-10"
                        src={audioUrls.get(record.id)}
                        preload="metadata"
                        onError={(event) => {
                          const id = record.id!;
                          if (inFlightIdsRef.current.has(id)) return;
                          // Network/source failures may be an expired URL. A
                          // decode failure cannot be repaired by signing again.
                          if (
                            event.currentTarget.error?.code === 3
                            || refreshedIdsRef.current.has(id)
                          ) {
                            setAudioErrors((prev) => new Set(prev).add(id));
                            return;
                          }
                          refreshedIdsRef.current.add(id);
                          void fetchAudioUrl(record.id!, record.recordingUrl!);
                        }}
                      >
                        {t("listening.audioUnsupported")}
                      </audio>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        <T k="listening.loading" />
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
                      📄 <T k="listening.speech.viewScript" variant="stacked" />
                      <span className="badge badge-ghost badge-xs">
                        <T k="listening.charCount" params={{ count: record.script.length }} />
                      </span>
                    </button>

                    {expandedScriptId === record.id && (
                      <div className="mt-2 p-3 bg-base-200 rounded-lg border border-border-hairline">
                        <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground leading-relaxed">
                          {record.script}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {topicInfo && (
                  <div className="text-xs text-muted-foreground mt-1">
                    <T
                      k="listening.speech.suggestedTime"
                      params={{ time: formatTime(topicInfo.suggestedTimeSeconds) }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            className="btn btn-outline btn-primary"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                <T k="listening.loading" variant="stacked" />
              </>
            ) : (
              <T k="listening.speech.loadMore" variant="stacked" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
