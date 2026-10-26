import { useState } from "react";
import type {
  AudioUpload,
  AudioUploadUpdateInput,
} from "../../types/audioUpload";
import { T } from "../common/T";
import { useLanguage } from "../../hooks/useLanguage";

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
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prevUpload, setPrevUpload] = useState(upload);

  // Reset form when upload changes
  if (prevUpload !== upload) {
    setPrevUpload(upload);
    if (upload) {
      setTitle(upload.title);
      setDescription(upload.description || "");
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!upload?.id || !title.trim()) return;

    onSave(upload.id, {
      title: title.trim(),
      description: description.trim(),
    });
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  if (!isOpen || !upload) return null;

  return (
    <dialog className="modal modal-bottom sm:modal-middle modal-open">
      <div className="modal-box rounded-2xl border border-border-hairline shadow-floating">
        <h3 className="text-lg font-semibold mb-4">
          <T k="listening.audio.editTitle" variant="stacked" />
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Title Input */}
            <div className="form-control">
              <label className="label" htmlFor="edit-title">
                <span className="label-text">
                  <T k="listening.audio.editTitleLabel" />
                </span>
              </label>
              <input
                id="edit-title"
                type="text"
                className="input input-bordered w-full h-11"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("listening.audio.titlePlaceholder")}
                required
                disabled={isSaving}
              />
            </div>

            {/* Description Input */}
            <div className="form-control">
              <label className="label" htmlFor="edit-description">
                <span className="label-text">
                  <T k="listening.audio.descriptionLabel" />
                </span>
              </label>
              <textarea
                id="edit-description"
                className="textarea textarea-bordered w-full"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("listening.audio.descriptionPlaceholder")}
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
              <T k="common.cancel" variant="stacked" />
            </button>
            <button
              type="submit"
              className="btn btn-primary active:scale-[0.98]"
              disabled={isSaving || !title.trim()}
            >
              {isSaving ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  <T k="listening.saving" variant="stacked" />
                </>
              ) : (
                <T k="listening.audio.save" variant="stacked" />
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
