import { useState } from "react";
import { useVocabulary } from "../../hooks/useVocabulary";
import { useSpeechState } from "../../hooks/useSpeechState";
import type { VocabularyWord } from "../../types/vocabulary";

interface WordDetailProps {
  word: VocabularyWord;
  onClose: () => void;
  onUpdate: () => void;
}

export const WordDetail = ({ word, onClose, onUpdate }: WordDetailProps) => {
  const { updateWord } = useVocabulary();
  const { speak } = useSpeechState();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTags, setEditedTags] = useState(word.tags.join(", "));
  const [editedDifficulty, setEditedDifficulty] = useState(
    word.difficulty || "",
  );
  const [newTag, setNewTag] = useState("");

  const handleSave = async () => {
    const tags = editedTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    await updateWord(word.id!, {
      tags,
      difficulty: editedDifficulty as "easy" | "medium" | "hard" | undefined,
    });

    setIsEditing(false);
    onUpdate();
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;

    const currentTags = editedTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (!currentTags.includes(newTag.trim())) {
      currentTags.push(newTag.trim());
      setEditedTags(currentTags.join(", "));
    }

    setNewTag("");
  };

  const handleSpeak = () => {
    speak(word.word);
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-4xl font-bold">{word.word}</h2>
              <button
                type="button"
                onClick={handleSpeak}
                className="btn btn-circle btn-sm btn-ghost"
                title="發音"
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
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                </svg>
              </button>
            </div>
            {word.phonetic && (
              <p className="text-lg text-base-content/60">{word.phonetic}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle"
          >
            ✕
          </button>
        </div>

        {/* Tags and Difficulty */}
        <div className="mb-6">
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="label">
                  <span className="label-text">標籤（用逗號分隔）</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input input-bordered flex-1"
                    value={editedTags}
                    onChange={(e) => setEditedTags(e.target.value)}
                    placeholder="例如：學校, 科技, 日常"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    className="input input-bordered input-sm flex-1"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="快速新增標籤"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="btn btn-sm btn-primary"
                  >
                    新增
                  </button>
                </div>
              </div>
              <div>
                <label className="label">
                  <span className="label-text">難度</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={editedDifficulty}
                  onChange={(e) => setEditedDifficulty(e.target.value)}
                >
                  <option value="">未設定</option>
                  <option value="easy">簡單</option>
                  <option value="medium">中等</option>
                  <option value="hard">困難</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn btn-primary btn-sm"
                >
                  儲存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedTags(word.tags.join(", "));
                    setEditedDifficulty(word.difficulty || "");
                  }}
                  className="btn btn-ghost btn-sm"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 items-center">
              {word.difficulty && (
                <span
                  className={`badge ${
                    word.difficulty === "easy"
                      ? "badge-success"
                      : word.difficulty === "medium"
                      ? "badge-warning"
                      : "badge-error"
                  }`}
                >
                  {word.difficulty === "easy"
                    ? "簡單"
                    : word.difficulty === "medium"
                    ? "中等"
                    : "困難"}
                </span>
              )}
              {word.tags.map((tag) => (
                <span key={tag} className="badge badge-outline">
                  {tag}
                </span>
              ))}
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="btn btn-ghost btn-xs"
              >
                編輯標籤
              </button>
            </div>
          )}
        </div>

        {/* Definitions */}
        {word.definitions.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-3">📖 定義</h3>
            <div className="space-y-3">
              {word.definitions.map((def, index) => (
                <div key={index} className="pl-4 border-l-4 border-primary">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-medium text-primary capitalize mb-1">
                      {def.partOfSpeech}
                    </p>
                    <button
                      type="button"
                      onClick={() => speak(def.definition)}
                      className="btn btn-circle btn-xs btn-ghost shrink-0"
                      title="朗讀定義"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3"
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
                    </button>
                  </div>
                  <p className="text-base-content">{def.definition}</p>
                  {def.definitionChinese && (
                    <p className="text-base-content/60 text-sm mt-1">
                      {def.definitionChinese}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Examples */}
        {word.examples.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-3">💡 例句</h3>
            <div className="space-y-3">
              {word.examples.map((example, index) => (
                <div key={index} className="bg-base-200 p-3 rounded-lg">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <p className="italic flex-1">{example.sentence}</p>
                    <button
                      type="button"
                      onClick={() => speak(example.sentence)}
                      className="btn btn-circle btn-xs btn-ghost shrink-0"
                      title="朗讀例句"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3"
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
                    </button>
                  </div>
                  {example.translation && (
                    <p className="text-sm text-base-content/60">
                      {example.translation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="stats shadow w-full">
          <div className="stat">
            <div className="stat-title">加入時間</div>
            <div className="stat-value text-lg">
              {new Date(word.createdAt).toLocaleString("zh-TW", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};
