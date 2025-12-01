import { useState } from "react";
import { useSpeechState } from "../../hooks/useSpeechState";
import { ClickableWords } from "./ClickableWords";
import type { PracticeSentence } from "../../types/sentencePractice";

interface SentenceCardProps {
  sentence: PracticeSentence;
  onEdit: (
    id: string,
    newEnglish: string,
  ) => Promise<{ success: boolean; message?: string }>;
  onDelete: (id: string) => Promise<{ success: boolean; message?: string }>;
  getWordDefinition: (word: string) => Promise<string | null>;
  isProcessing: boolean;
  isCurrentlyPlaying?: boolean;
}

export const SentenceCard = ({
  sentence,
  onEdit,
  onDelete,
  getWordDefinition,
  isProcessing,
  isCurrentlyPlaying = false,
}: SentenceCardProps) => {
  const { speak, isSpeaking, isLoadingAudio } = useSpeechState();
  const [isEditing, setIsEditing] = useState(false);
  const [editedEnglish, setEditedEnglish] = useState(sentence.english);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSpeak = () => {
    speak(sentence.english);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedEnglish(sentence.english);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedEnglish(sentence.english);
  };

  const handleSaveEdit = async () => {
    if (!editedEnglish.trim() || editedEnglish === sentence.english) {
      handleCancelEdit();
      return;
    }

    setIsUpdating(true);
    const result = await onEdit(sentence.id!, editedEnglish.trim());
    setIsUpdating(false);

    if (result.success) {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!sentence.id) return;
    await onDelete(sentence.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      handleCancelEdit();
    } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit();
    }
  };

  return (
    <div
      className={`card bg-base-100 shadow-md hover:shadow-lg transition-shadow ${
        isCurrentlyPlaying ? "ring-2 ring-primary ring-offset-2" : ""
      }`}
    >
      <div className="card-body p-4">
        {/* English sentence */}
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          <div
            className="shrink-0 mt-0.5 cursor-grab active:cursor-grabbing text-base-content/40 hover:text-base-content/60 touch-none"
            title="拖曳排序"
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
                d="M4 8h16M4 16h16"
              />
            </svg>
          </div>

          {/* Speak button */}
          <button
            type="button"
            onClick={handleSpeak}
            disabled={isSpeaking || isLoadingAudio}
            className="btn btn-circle btn-sm btn-ghost text-primary shrink-0 mt-0.5"
            title="播放整句"
          >
            {isLoadingAudio ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
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
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editedEnglish}
                  onChange={(e) => setEditedEnglish(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="textarea textarea-bordered w-full text-base"
                  rows={2}
                  autoFocus
                  disabled={isUpdating}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="btn btn-ghost btn-sm"
                    disabled={isUpdating}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="btn btn-primary btn-sm"
                    disabled={isUpdating || !editedEnglish.trim()}
                  >
                    {isUpdating ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        更新中...
                      </>
                    ) : (
                      "儲存"
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-lg font-medium text-base-content leading-relaxed">
                <ClickableWords
                  text={sentence.english}
                  getWordDefinition={getWordDefinition}
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          {!isEditing && (
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={handleEdit}
                disabled={isProcessing}
                className="btn btn-circle btn-sm btn-ghost text-base-content/60 hover:text-primary"
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
                onClick={handleDelete}
                disabled={isProcessing}
                className="btn btn-circle btn-sm btn-ghost text-base-content/60 hover:text-error"
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
          )}
        </div>

        {/* Chinese translation */}
        {!isEditing && (
          <p className="text-base text-base-content/70 mt-2 ml-16 border-l-2 border-primary/30 pl-3">
            {sentence.chinese}
          </p>
        )}
      </div>
    </div>
  );
};
