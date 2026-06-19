import { useState } from "react";
import { ChevronDown, Plus, Copy, Pencil, Trash2, Check } from "lucide-react";
import type { Speech } from "../../types/sentencePractice";
import { ConfirmModal } from "../common/ConfirmModal";

interface SpeechSwitcherProps {
  speeches: Speech[];
  currentSpeechId: string | null;
  onSelect: (speechId: string) => void;
  onCreate: (name: string) => Promise<void>;
  onDuplicate: (sourceId: string, name: string) => Promise<void>;
  onRename: (speechId: string, name: string) => Promise<void>;
  onDelete: (speechId: string) => Promise<void>;
}

export const SpeechSwitcher = ({
  speeches,
  currentSpeechId,
  onSelect,
  onCreate,
  onDuplicate,
  onRename,
  onDelete,
}: SpeechSwitcherProps) => {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const current = speeches.find((s) => s.id === currentSpeechId);

  const close = () => {
    setOpen(false);
    setEditingId(null);
  };

  const handleCreate = async () => {
    const name = window.prompt("新增演講版本，請輸入名稱：");
    if (!name?.trim()) return;
    await onCreate(name.trim());
    close();
  };

  const handleDuplicate = async () => {
    if (!current) return;
    const name = window.prompt(
      "複製為新版本，請輸入名稱：",
      `${current.name} 副本`,
    );
    if (!name?.trim()) return;
    await onDuplicate(current.id, name.trim());
    close();
  };

  const startRename = (speech: Speech) => {
    setEditingId(speech.id);
    setEditingName(speech.name);
  };

  const commitRename = async () => {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== speeches.find((s) => s.id === editingId)?.name) {
      await onRename(editingId, trimmed);
    }
    setEditingId(null);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    await onDelete(deletingId);
    setDeletingId(null);
    close();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-sm btn-ghost gap-1 normal-case active:scale-[0.98]"
      >
        <span className="font-medium truncate max-w-[12rem]">
          {current?.name || "選擇版本"}
        </span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="關閉選單"
            className="fixed inset-0 z-40"
            onClick={close}
          />
          <div className="glass absolute z-50 mt-1 right-0 sm:right-auto sm:left-0 w-72 rounded-xl shadow-floating">
            <div className="p-1">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                演講版本
              </div>
              <ul className="max-h-72 overflow-y-auto">
                {speeches.map((s) => {
                  const isActive = s.id === currentSpeechId;
                  const isEditing = editingId === s.id;
                  return (
                    <li key={s.id}>
                      <div
                        className={`group flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors ${
                          isActive
                            ? "bg-accent-tint text-accent"
                            : "hover:bg-accent-tint hover:text-accent"
                        }`}
                      >
                        {isEditing ? (
                          <>
                            <input
                              autoFocus
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename();
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="input input-xs input-bordered flex-1"
                            />
                            <button
                              type="button"
                              onClick={commitRename}
                              className="btn btn-xs btn-ghost"
                              title="確認"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                onSelect(s.id);
                                close();
                              }}
                              className="flex-1 text-left text-sm truncate"
                            >
                              {s.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => startRename(s)}
                              className="btn btn-xs btn-ghost opacity-0 group-hover:opacity-100"
                              title="重新命名"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(s.id)}
                              className="btn btn-xs btn-ghost text-error opacity-0 group-hover:opacity-100"
                              title="刪除版本"
                              disabled={speeches.length <= 1}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-border-hairline my-1" />
              <button
                type="button"
                onClick={handleCreate}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent-tint hover:text-accent"
              >
                <Plus className="h-4 w-4" />
                新增空白版本
              </button>
              {current && (
                <button
                  type="button"
                  onClick={handleDuplicate}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent-tint hover:text-accent"
                >
                  <Copy className="h-4 w-4" />
                  複製目前版本
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={!!deletingId}
        title="刪除演講版本"
        message={`確定要刪除「${
          speeches.find((s) => s.id === deletingId)?.name
        }」？此版本下的所有句子也會被刪除，且無法復原。`}
        confirmText="刪除"
        cancelText="取消"
        confirmVariant="error"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};
