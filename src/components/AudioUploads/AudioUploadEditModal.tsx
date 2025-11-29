import { useState, useEffect } from "react";
import type {
  AudioUpload,
  AudioUploadUpdateInput,
} from "../../types/audioUpload";

interface AudioUploadEditModalProps {
  isOpen: boolean;
  upload: AudioUpload | null;
  isSaving: boolean;
  onSave: (uploadId: string, updates: AudioUploadUpdateInput) => void;
  onClose: () => void;
}

export function AudioUploadEditModal({
  isOpen,
  upload,
  isSaving,
  onSave,
  onClose,
}: AudioUploadEditModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Reset form when upload changes
  useEffect(() => {
    if (upload) {
      setTitle(upload.title);
      setDescription(upload.description || "");
    }
  }, [upload]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!upload?.id || !title.trim()) return;

    onSave(upload.id, {
      title: title.trim(),
      description: description.trim() || undefined,
    });
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  if (!isOpen || !upload) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">編輯音訊資訊</h3>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Title Input */}
            <div className="form-control">
              <label className="label" htmlFor="edit-title">
                <span className="label-text">標題 *</span>
              </label>
              <input
                id="edit-title"
                type="text"
                className="input input-bordered w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="輸入音訊標題"
                required
                disabled={isSaving}
              />
            </div>

            {/* Description Input */}
            <div className="form-control">
              <label className="label" htmlFor="edit-description">
                <span className="label-text">描述（選填）</span>
              </label>
              <textarea
                id="edit-description"
                className="textarea textarea-bordered w-full"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="輸入音訊描述..."
                rows={3}
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleClose}
              disabled={isSaving}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving || !title.trim()}
            >
              {isSaving ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  儲存中...
                </>
              ) : (
                "儲存"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Click outside to close */}
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={handleClose} disabled={isSaving}>
          close
        </button>
      </form>
    </dialog>
  );
}
