import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSettings } from "../../hooks/useSettings";
import { Toast } from "../common/Toast";
import { RefreshIcon } from "../icons";
import { SpeakButton } from "../common/SpeakButton";
import { CefrBadge } from "../common/CefrBadge";
import type { VocabularyWord } from "../../types/vocabulary";
import type { CefrInfo } from "../../types/wordPractice";

export interface WordDetailPanelProps {
  word: VocabularyWord;
  onUpdateWord: (
    wordId: string,
    updates: Partial<VocabularyWord>,
  ) => Promise<{ success: boolean; message?: string }>;
  onRegenerateWordDetails: (
    wordId: string,
    word: string,
    signal?: AbortSignal,
  ) => Promise<{
    success: boolean;
    message?: string;
    updatedWord?: Partial<VocabularyWord>;
  }>;
  availableTags?: string[];
  /** Called when the tag editor opens, so suggestions can load lazily. */
  onTagEditorOpen?: () => void;
  /** CEFR level of the word; no badge when null or omitted. */
  cefr?: CefrInfo | null;
  /** Optional trailing header control, kept in flow to avoid title overlap. */
  headerAction?: ReactNode;
}

export const WordDetailPanel = ({
  word: initialWord,
  onUpdateWord,
  onRegenerateWordDetails,
  availableTags = [],
  onTagEditorOpen,
  cefr,
  headerAction,
}: WordDetailPanelProps) => {
  const { showChineseTranslation, updateShowChineseTranslation } = useSettings();
  const [word, setWord] = useState<VocabularyWord>(initialWord);
  const [isEditing, setIsEditing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [editedTags, setEditedTags] = useState<string[]>([...word.tags]);
  const [editedDifficulty, setEditedDifficulty] = useState(
    word.difficulty || "",
  );
  const [newTag, setNewTag] = useState("");
  const regenerateControllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      regenerateControllerRef.current?.abort();
    },
    [],
  );

  const handleSave = async () => {
    const updates = {
      tags: editedTags,
      difficulty: editedDifficulty as "easy" | "medium" | "hard" | undefined,
    };
    const result = await onUpdateWord(word.id!, updates);
    if (!result.success) {
      setToast({ message: result.message || "儲存失敗，請稍後再試", type: "error" });
      return;
    }
    setWord((prev) => ({ ...prev, ...updates }));
    setIsEditing(false);
    setToast({ message: "已儲存標籤與難度", type: "success" });
  };

  const handleAddTag = (tag?: string) => {
    const trimmedTag = (tag ?? newTag).trim();
    if (!trimmedTag) return;
    if (!editedTags.includes(trimmedTag)) {
      setEditedTags((prev) => [...prev, trimmedTag]);
    }
    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditedTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const tagSuggestions = useMemo(() => {
    return availableTags.filter(
      (tag) =>
        !editedTags.includes(tag) &&
        (newTag.trim() === "" || tag.toLowerCase().includes(newTag.toLowerCase())),
    );
  }, [availableTags, editedTags, newTag]);

  const handleRegenerate = async () => {
    if (!word.id || isRegenerating) return;
    regenerateControllerRef.current?.abort();
    const controller = new AbortController();
    regenerateControllerRef.current = controller;
    setIsRegenerating(true);
    setToast(null);
    try {
      const result = await onRegenerateWordDetails(
        word.id,
        word.word,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (result.success && result.updatedWord) {
        setWord((prev) => ({ ...prev, ...result.updatedWord }));
        setToast({ message: "已重新生成解釋！", type: "success" });
      } else {
        setToast({ message: result.message || "重新生成失敗", type: "error" });
      }
    } catch {
      setToast({ message: "重新生成時發生錯誤", type: "error" });
    } finally {
      if (regenerateControllerRef.current === controller) {
        regenerateControllerRef.current = null;
      }
      if (!controller.signal.aborted) {
        setIsRegenerating(false);
      }
    }
  };

  return (
    <div className="h-full">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight truncate">
              {word.word}
            </h2>
            {cefr && <CefrBadge info={cefr} />}
            <SpeakButton text={word.word} label="發音" size="md" />
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="btn btn-circle btn-sm btn-ghost shrink-0"
              title="重新生成解釋"
            >
              {isRegenerating ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <RefreshIcon />
              )}
            </button>
          </div>
        </div>
        {headerAction}
      </div>

      {/* Tags and Difficulty */}
      <div className="mb-6">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="label">
                <span className="label-text">標籤</span>
              </label>
              {editedTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {editedTags.map((tag) => (
                    <span key={tag} className="badge badge-primary gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-error"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input input-bordered input-sm flex-1"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="輸入標籤後按 Enter 或點擊新增"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddTag()}
                  className="btn btn-sm btn-primary"
                  disabled={!newTag.trim()}
                >
                  新增
                </button>
              </div>
              {tagSuggestions.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground mb-1 block">
                    快速選擇：
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {tagSuggestions.slice(0, 10).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddTag(tag)}
                        className="badge badge-outline badge-sm cursor-pointer hover:badge-primary transition-colors"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
              <button type="button" onClick={handleSave} className="btn btn-primary btn-sm">
                儲存
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditedTags([...word.tags]);
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
              onClick={() => {
                setIsEditing(true);
                onTagEditorOpen?.();
              }}
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg">📖 定義</h3>
            <label className="flex items-center gap-2 cursor-pointer text-sm select-none">
              <span className="text-muted-foreground">顯示中文</span>
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-accent"
                checked={showChineseTranslation}
                onChange={(e) => updateShowChineseTranslation(e.target.checked)}
              />
            </label>
          </div>
          <div className="space-y-3">
            {word.definitions.map((def, index) => (
              <div key={index} className="pl-4 border-l-4 border-accent">
                <div className="flex justify-between items-start gap-2">
                  <p className="font-medium text-accent capitalize mb-1">
                    {def.partOfSpeech}
                  </p>
                  <SpeakButton text={def.definition} label="朗讀定義" />
                </div>
                <p className="text-base-content">
                  {def.definition || def.definitionChinese}
                </p>
                {showChineseTranslation && def.definitionChinese && def.definition && (
                  <p className="text-muted-foreground text-sm mt-1">
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
              <div
                key={index}
                className="bg-base-200/60 border border-border-hairline p-3 rounded-lg"
              >
                <div className="flex justify-between items-start gap-2 mb-1">
                  <p className="italic flex-1">{example.sentence}</p>
                  <SpeakButton text={example.sentence} label="朗讀例句" />
                </div>
                {example.translation && (
                  <p className="text-sm text-muted-foreground">{example.translation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats surface-card rounded-xl w-full">
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

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};
