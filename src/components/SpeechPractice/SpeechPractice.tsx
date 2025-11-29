import { useState } from "react";
import type { SpeechPracticeTopic } from "../../types/speechPractice";
import { useSpeechPractice } from "../../hooks/useSpeechPractice";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { usePracticeTimer } from "../../hooks/usePracticeTimer";
import { useScriptGenerator } from "../../hooks/useScriptGenerator";
import { TopicSelector } from "./TopicSelector";
import { TimerDisplay } from "./TimerDisplay";
import { PracticeHistory } from "./PracticeHistory";
import { ScriptGeneratorModal } from "./ScriptGeneratorModal";
import { Toast } from "../common/Toast";
import { ConfirmModal } from "../common/ConfirmModal";

type ViewMode = "select" | "practice" | "history";

export function SpeechPractice() {
  const [viewMode, setViewMode] = useState<ViewMode>("select");
  const [selectedTopic, setSelectedTopic] =
    useState<SpeechPracticeTopic | null>(null);
  const [notes, setNotes] = useState("");
  const [script, setScript] = useState("");
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [isScriptExpanded, setIsScriptExpanded] = useState(true);
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingScript, setIsSavingScript] = useState(false);

  const {
    records,
    loading,
    topicCounts,
    topicScripts,
    saveRecord,
    deleteRecord,
    saveScript,
  } = useSpeechPractice();

  const timer = usePracticeTimer();
  const recorder = useAudioRecorder();
  const scriptGenerator = useScriptGenerator(selectedTopic);

  const handleTopicSelect = (topic: SpeechPracticeTopic) => {
    setSelectedTopic(topic);
  };

  const handleStartPractice = () => {
    if (!selectedTopic) return;
    setViewMode("practice");
    setNotes("");
    // Load saved script if available
    const savedScript = topicScripts.get(selectedTopic.id);
    if (savedScript) {
      setScript(savedScript);
    }
    timer.reset();
    recorder.resetRecording();
  };

  const handleOpenScriptModal = async () => {
    if (selectedTopic) {
      // Load existing script if available
      const existingScript = topicScripts.get(selectedTopic.id);
      if (existingScript) {
        scriptGenerator.setScript(existingScript);
      }
    }
    setIsScriptModalOpen(true);
  };

  const handleCloseScriptModal = () => {
    setIsScriptModalOpen(false);
  };

  const handleUseScript = async (generatedScript: string) => {
    setScript(generatedScript);

    // Save script to Firebase
    if (selectedTopic) {
      setIsSavingScript(true);
      const result = await saveScript(selectedTopic.id, generatedScript);
      setIsSavingScript(false);

      if (result.success) {
        setToastMessage({
          message: "講稿已儲存",
          type: "success",
        });
        setIsScriptModalOpen(false);
      } else {
        setToastMessage({
          message: result.message,
          type: "error",
        });
      }
    }
  };

  // Unified start - starts both timer and recording
  const handleStart = () => {
    timer.start();
    if (recorder.isSupported) {
      void recorder.startRecording();
    }
  };

  // Unified pause - pauses both timer and recording
  const handlePause = () => {
    timer.pause();
    if (recorder.isRecording && !recorder.isPaused) {
      recorder.pauseRecording();
    }
  };

  // Unified resume - resumes both timer and recording
  const handleResume = () => {
    timer.resume();
    if (recorder.isRecording && recorder.isPaused) {
      recorder.resumeRecording();
    }
  };

  // Unified stop - stops both timer and recording
  const handleStop = () => {
    timer.stop();
    if (recorder.isRecording) {
      recorder.stopRecording();
    }
  };

  const handleSavePractice = async () => {
    if (!selectedTopic) return;

    setIsSaving(true);

    const result = await saveRecord(
      {
        topicId: selectedTopic.id,
        topicTitle: selectedTopic.titleChinese,
        durationSeconds: timer.time,
        notes: notes.trim() || undefined,
        script: script.trim() || undefined,
      },
      recorder.audioBlob,
    );

    setIsSaving(false);

    if (result.success) {
      setToastMessage({ message: result.message, type: "success" });
      setViewMode("select");
      setSelectedTopic(null);
      timer.reset();
      recorder.resetRecording();
      setNotes("");
      setScript("");
      scriptGenerator.resetState();
    } else {
      setToastMessage({ message: result.message, type: "error" });
    }
  };

  const handleCancelPractice = () => {
    timer.reset();
    recorder.resetRecording();
    setViewMode("select");
    setNotes("");
    // Keep script for next practice attempt
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleDeleteRecord = (recordId: string) => {
    setDeleteRecordId(recordId);
  };

  const confirmDelete = async () => {
    if (!deleteRecordId) return;

    setIsDeleting(true);
    const result = await deleteRecord(deleteRecordId);
    setIsDeleting(false);
    setDeleteRecordId(null);

    if (result.success) {
      setToastMessage({ message: result.message, type: "success" });
    } else {
      setToastMessage({ message: result.message, type: "error" });
    }
  };

  const cancelDelete = () => {
    setDeleteRecordId(null);
  };

  return (
    <div className="max-w-4xl mx-auto pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Header */}
      <div className="card bg-base-100 shadow-xl mb-4">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                🎤 演講練習
              </h1>
              <p className="text-base-content/60 mt-1">
                選擇主題、計時練習、錄音回放，追蹤你的進步
              </p>
            </div>

            {/* View Mode Tabs */}
            <div className="tabs tabs-boxed">
              <button
                type="button"
                className={`tab ${viewMode === "select" ? "tab-active" : ""}`}
                onClick={() => {
                  if (!timer.isRunning) {
                    setViewMode("select");
                  }
                }}
                disabled={timer.isRunning}
              >
                主題選擇
              </button>
              <button
                type="button"
                className={`tab ${viewMode === "history" ? "tab-active" : ""}`}
                onClick={() => {
                  if (!timer.isRunning) {
                    setViewMode("history");
                  }
                }}
                disabled={timer.isRunning}
              >
                練習記錄
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          {/* Topic Selection View */}
          {viewMode === "select" && (
            <TopicSelector
              selectedTopic={selectedTopic}
              onSelect={handleTopicSelect}
              onStartPractice={handleStartPractice}
              onGenerateScript={handleOpenScriptModal}
              topicCounts={topicCounts}
              topicScripts={topicScripts}
            />
          )}

          {/* Practice View */}
          {viewMode === "practice" && selectedTopic && (
            <div className="space-y-6">
              {/* Topic Info - Compact */}
              <div className="text-center pb-2 border-b border-base-200">
                <h2 className="text-xl font-bold">
                  {selectedTopic.titleChinese}
                </h2>
                <p className="text-sm text-base-content/60">
                  建議 {formatTime(selectedTopic.suggestedTimeSeconds)}
                </p>
              </div>

              {/* Timer Display - Centered and compact */}
              <div className="flex justify-center py-2">
                <TimerDisplay
                  time={timer.time}
                  suggestedTime={selectedTopic.suggestedTimeSeconds}
                  isRunning={timer.isRunning}
                  isPaused={timer.isPaused}
                />
              </div>

              {/* Recording indicator */}
              {recorder.isRecording && (
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 px-4 py-2 bg-error/10 rounded-full">
                    <span
                      className={`w-2 h-2 rounded-full bg-error ${
                        !recorder.isPaused ? "animate-pulse" : ""
                      }`}
                    />
                    <span className="text-sm font-medium text-error">
                      {recorder.isPaused ? "錄音暫停" : "錄音中"}
                    </span>
                  </div>
                </div>
              )}

              {/* Script Display - Collapsible */}
              {script && (
                <div className="collapse collapse-arrow bg-base-200 rounded-lg">
                  <input
                    type="checkbox"
                    checked={isScriptExpanded}
                    onChange={(e) => setIsScriptExpanded(e.target.checked)}
                  />
                  <div className="collapse-title font-medium flex items-center gap-2">
                    📄 參考講稿
                    <span className="badge badge-sm badge-ghost">
                      {script.length} 字
                    </span>
                  </div>
                  <div className="collapse-content">
                    <div className="prose max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-base-content/80 bg-base-100 p-4 rounded-lg text-xl leading-relaxed">
                        {script}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Practice Complete - Show save options */}
              {!timer.isRunning && timer.time > 0 && (
                <div className="space-y-4 mt-4">
                  <div className="flex items-center gap-2 text-success">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                    <span className="font-medium">練習完成！</span>
                  </div>

                  {/* Audio Playback */}
                  {recorder.audioUrl && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        🎧 回放錄音
                      </h3>
                      <audio
                        controls
                        className="w-full h-10"
                        src={recorder.audioUrl}
                      >
                        您的瀏覽器不支援音訊播放
                      </audio>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label
                      htmlFor="practice-notes"
                      className="block text-sm font-medium mb-2"
                    >
                      練習筆記（選填）
                    </label>
                    <textarea
                      id="practice-notes"
                      className="textarea textarea-bordered w-full"
                      placeholder="記錄這次練習的心得、需要改進的地方..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      className="btn btn-primary flex-1"
                      onClick={handleSavePractice}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <span className="loading loading-spinner loading-sm" />
                          儲存中...
                        </>
                      ) : (
                        "儲存練習記錄"
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost flex-1"
                      onClick={handleCancelPractice}
                      disabled={isSaving}
                    >
                      放棄並返回
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History View */}
          {viewMode === "history" && (
            <PracticeHistory
              records={records}
              loading={loading}
              onDelete={handleDeleteRecord}
            />
          )}
        </div>
      </div>

      {/* Floating Control Bar - Only show during practice */}
      {viewMode === "practice" &&
        selectedTopic &&
        !(!timer.isRunning && timer.time > 0) && (
          <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-base-100 via-base-100 to-transparent">
            <div className="max-w-md mx-auto">
              <div className="bg-base-200 rounded-2xl shadow-2xl p-3 flex items-center justify-center gap-3">
                {/* Not started yet */}
                {!timer.isRunning && timer.time === 0 && (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={handleCancelPractice}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                      </svg>
                      返回
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-lg gap-2 flex-1 max-w-xs"
                      onClick={handleStart}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      開始練習
                    </button>
                    <div className="w-16" /> {/* Spacer for balance */}
                  </>
                )}

                {/* Running */}
                {timer.isRunning && (
                  <>
                    {/* Pause/Resume Button */}
                    {timer.isPaused ? (
                      <button
                        type="button"
                        className="btn btn-circle btn-primary btn-lg"
                        onClick={handleResume}
                        title="繼續"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-8 w-8"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-circle btn-warning btn-lg"
                        onClick={handlePause}
                        title="暫停"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-8 w-8"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                      </button>
                    )}

                    {/* Timer Display */}
                    <div className="flex flex-col items-center min-w-[80px]">
                      <span
                        className={`font-mono text-2xl font-bold ${
                          timer.time > selectedTopic.suggestedTimeSeconds
                            ? "text-error"
                            : ""
                        }`}
                      >
                        {formatTime(timer.time)}
                      </span>
                      {recorder.isRecording && (
                        <span className="text-xs text-error flex items-center gap-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full bg-error ${
                              !recorder.isPaused ? "animate-pulse" : ""
                            }`}
                          />
                          REC
                        </span>
                      )}
                    </div>

                    {/* Stop Button */}
                    <button
                      type="button"
                      className="btn btn-circle btn-error btn-lg"
                      onClick={handleStop}
                      title="結束練習"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-8 w-8"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M6 6h12v12H6z" />
                      </svg>
                    </button>
                  </>
                )}
              </div>

              {/* Recording status indicator */}
              {!timer.isRunning && timer.time === 0 && recorder.isSupported && (
                <p className="text-center text-xs text-base-content/50 mt-2">
                  🎙️ 開始練習將自動錄音
                </p>
              )}
            </div>
          </div>
        )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteRecordId !== null}
        title="刪除練習記錄"
        message="確定要刪除這筆練習記錄嗎？此操作無法復原。"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        confirmText="刪除"
        cancelText="取消"
        confirmVariant="error"
        isLoading={isDeleting}
      />

      {/* Script Generator Modal */}
      <ScriptGeneratorModal
        isOpen={isScriptModalOpen}
        topic={selectedTopic}
        prompt={scriptGenerator.prompt}
        generatedScript={scriptGenerator.generatedScript}
        isGenerating={scriptGenerator.isGenerating}
        error={scriptGenerator.error}
        isSaving={isSavingScript}
        onPromptChange={scriptGenerator.setPrompt}
        onScriptChange={scriptGenerator.setScript}
        onGenerate={() => scriptGenerator.generateScript()}
        onUseScript={handleUseScript}
        onClose={handleCloseScriptModal}
      />
    </div>
  );
}

export default SpeechPractice;
