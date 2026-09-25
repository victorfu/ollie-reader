import { useEffect, useId, useRef, useState } from "react";
import { RotateCw, Trash2, Upload } from "lucide-react";
import {
  ACCEPTED_UPLOAD_TYPES,
  MAX_SOURCE_PAGES,
  PAGE_LONG_EDGE_PX,
  THUMBNAIL_LONG_EDGE_PX,
} from "../../constants/questionBank";
import {
  BANK_SUBJECTS,
  BANK_SUBJECT_LABELS,
  isBankSubject,
  type BankSubject,
} from "../../types/questionBank";
import {
  expandFilesToPages,
  nextRotation,
  releasePdfFiles,
  renderPage,
  UNREADABLE_FILE_MESSAGE,
  type FileReadError,
  type PageInput,
} from "../../utils/pageImageProcessor";
import { createSource, newQuestionSourceId } from "../../services/questionSourceService";
import { logger } from "../../utils/logger";

interface PreviewPage {
  input: PageInput;
  thumbUrl: string | null;
  failed: boolean;
}

interface SourceUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: (sourceId: string) => void;
}

export function SourceUploadDialog({ isOpen, onClose, onUploaded }: SourceUploadDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<BankSubject | "">("");
  const [pages, setPages] = useState<PreviewPage[]>([]);
  const [fileErrors, setFileErrors] = useState<FileReadError[]>([]);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [expanding, setExpanding] = useState(false);
  const filesRef = useRef<File[]>([]);
  const thumbUrlsRef = useRef<string[]>([]);
  const sessionRef = useRef(0);

  const uploading = progress !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const reset = () => {
    sessionRef.current += 1;
    thumbUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    thumbUrlsRef.current = [];
    void releasePdfFiles(filesRef.current);
    filesRef.current = [];
    setTitle("");
    setSubject("");
    setPages([]);
    setFileErrors([]);
    setLimitError(null);
    setProgress(null);
    setUploadError(null);
    setSourceId(null);
    setExpanding(false);
  };

  const handleClose = () => {
    if (uploading) return;
    reset();
    onClose();
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = [...fileList];
    const session = sessionRef.current;
    setLimitError(null);
    setExpanding(true);
    try {
      const { pages: inputs, errors } = await expandFilesToPages(files);

      if (session !== sessionRef.current) {
        void releasePdfFiles(files);
        return;
      }

      setFileErrors((previous) => [...previous, ...errors]);

      if (pages.length + inputs.length > MAX_SOURCE_PAGES) {
        setLimitError(`總頁數超過 ${MAX_SOURCE_PAGES} 頁，請拆開上傳`);
        void releasePdfFiles(files);
        return;
      }

      filesRef.current.push(...files);
      setPages((previous) => [
        ...previous,
        ...inputs.map((input) => ({ input, thumbUrl: null, failed: false })),
      ]);

      // 縮圖一張一張產生，避免一次解碼大量照片
      for (const input of inputs) {
        try {
          const { blob } = await renderPage(input, THUMBNAIL_LONG_EDGE_PX);

          if (session !== sessionRef.current) {
            return;
          }

          const url = URL.createObjectURL(blob);
          thumbUrlsRef.current.push(url);
          setPages((previous) =>
            previous.map((page) => (page.input.key === input.key ? { ...page, thumbUrl: url } : page)),
          );
        } catch (error) {
          logger.warn("[SourceUploadDialog] thumbnail failed", error);

          if (session !== sessionRef.current) {
            return;
          }

          setPages((previous) =>
            previous.map((page) => (page.input.key === input.key ? { ...page, failed: true } : page)),
          );
        }
      }
    } finally {
      if (session === sessionRef.current) {
        setExpanding(false);
      }
    }
  };

  const rotate = (key: string) =>
    setPages((previous) =>
      previous.map((page) =>
        page.input.key === key
          ? { ...page, input: { ...page.input, rotation: nextRotation(page.input.rotation) } }
          : page,
      ),
    );

  const removePage = (key: string) =>
    setPages((previous) => previous.filter((page) => page.input.key !== key));

  const uploadable = pages.filter((page) => !page.failed && page.thumbUrl !== null);
  const thumbnailsPending = pages.some((page) => !page.failed && page.thumbUrl === null);
  const canUpload =
    !uploading && title.trim() !== "" && subject !== "" && uploadable.length > 0 && !thumbnailsPending;

  const handleUpload = async () => {
    if (!canUpload) return;
    const id = sourceId ?? newQuestionSourceId();
    const inputs = uploadable.map((page) => page.input);
    setSourceId(id);
    setUploadError(null);
    setProgress({ done: 0, total: inputs.length });
    try {
      await createSource({
        sourceId: id,
        title: title.trim(),
        subject,
        pageCount: inputs.length,
        renderPage: (index) => renderPage(inputs[index], PAGE_LONG_EDGE_PX),
        onProgress: (done, total) => setProgress({ done, total }),
      });
      reset();
      onUploaded(id);
    } catch (error) {
      logger.error("[SourceUploadDialog] upload failed", error);
      setProgress(null);
      setUploadError("上傳失敗，請檢查網路後重試");
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
    >
      <div className="modal-box max-w-2xl">
        <h3 id={headingId} className="text-lg font-semibold">
          上傳題目
        </h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem]">
          <label className="flex flex-col gap-1 text-sm">
            標題
            <input
              className="input input-sm w-full"
              value={title}
              placeholder="例如：四上數學第二次月考"
              disabled={uploading}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            科目
            <select
              className="select select-sm w-full"
              value={subject}
              disabled={uploading}
              onChange={(event) =>
                setSubject(isBankSubject(event.target.value) ? event.target.value : "")
              }
            >
              <option value="">選擇科目</option>
              {BANK_SUBJECTS.map((item) => (
                <option key={item} value={item}>
                  {BANK_SUBJECT_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={`btn btn-outline btn-sm mt-4 ${uploading || expanding ? "btn-disabled" : ""}`}>
          <Upload className="size-4" />
          選擇照片或 PDF
          <input
            type="file"
            className="hidden"
            accept={ACCEPTED_UPLOAD_TYPES}
            multiple
            disabled={uploading || expanding}
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        <p className="mt-2 text-xs text-base-content/60">
          建議用手機內建的「掃描文件」拍，會自動拉正、去陰影。一次最多 {MAX_SOURCE_PAGES} 頁。
        </p>

        {limitError && (
          <p role="alert" className="mt-2 text-sm text-error">
            {limitError}
          </p>
        )}
        {fileErrors.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-error">
            {fileErrors.map((error, index) => (
              <li key={index}>
                {error.fileName}：{error.message}
              </li>
            ))}
          </ul>
        )}

        {pages.length > 0 && (
          <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {pages.map((page, index) => (
              <li key={page.input.key} className="flex flex-col gap-1">
                <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border border-base-300 bg-base-200">
                  {page.failed ? (
                    <span className="p-2 text-center text-xs text-error">{UNREADABLE_FILE_MESSAGE}</span>
                  ) : page.thumbUrl ? (
                    <img
                      src={page.thumbUrl}
                      alt={`第 ${index + 1} 頁`}
                      className="max-h-full max-w-full transition-transform"
                      style={{ transform: `rotate(${page.input.rotation}deg)` }}
                    />
                  ) : (
                    <span className="loading loading-spinner loading-sm" aria-label="產生縮圖中" />
                  )}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>第 {index + 1} 頁</span>
                  <span className="flex">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      aria-label={`旋轉第 ${index + 1} 頁`}
                      disabled={uploading || page.failed}
                      onClick={() => rotate(page.input.key)}
                    >
                      <RotateCw className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      aria-label={`刪除第 ${index + 1} 頁`}
                      disabled={uploading}
                      onClick={() => removePage(page.input.key)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {uploadError && (
          <p role="alert" className="mt-3 text-sm text-error">
            {uploadError}
          </p>
        )}

        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" disabled={uploading} onClick={handleClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!canUpload}
            onClick={() => void handleUpload()}
          >
            {progress ? `上傳中 ${progress.done}/${progress.total}` : uploadError ? "重試" : "上傳"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
