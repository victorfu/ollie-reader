import { useEffect, useRef, useState } from "react";
import { X, ZoomIn } from "lucide-react";

interface ExamQuestionImageProps {
  /** /exams/images/ 下的檔名,如 "math-q25.png"。 */
  image: string;
  /** 原卷題號,供替代文字與載入失敗提示。 */
  number: number;
  /** 題目卷 PDF 路徑;載入失敗時提供對照連結。 */
  questionPdf?: string;
  /** 圖形內容的等價文字描述。 */
  alt?: string;
  className?: string;
}

/**
 * 考卷裁圖。永遠白底(原卷即白紙),深色模式下以邊框收束;載入失敗時顯示對照提示。
 * 內嵌顯示最高 384px,點圖開原生 dialog lightbox 放大
 * (比照 ConfirmModal 模式;dialog[open] 同時讓測驗快捷鍵自動停用)。
 */
export function ExamQuestionImage({
  image,
  number,
  questionPdf,
  alt = `第 ${number} 題附圖`,
  className = "",
}: ExamQuestionImageProps) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const failed = failedImage === image;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isZoomOpen) {
      // 對已開啟的 dialog 重呼叫 showModal 會丟 InvalidStateError(StrictMode/重掛載)
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isZoomOpen]);

  if (failed) {
    return (
      <div className="rounded-lg border border-border-hairline bg-accent-tint p-3 text-sm text-muted-foreground">
        圖片載入失敗，請對照
        {questionPdf ? (
          <a
            className="link mx-1 text-accent"
            href={encodeURI(questionPdf)}
            target="_blank"
            rel="noopener noreferrer"
          >
            題目卷
          </a>
        ) : (
          "題目卷"
        )}
        第 {number} 題。
      </div>
    );
  }

  const src = `/exams/images/${image}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsZoomOpen(true)}
        aria-label={`放大附圖：${alt}`}
        className={`relative block w-full cursor-zoom-in rounded-lg border border-border-hairline bg-white p-2 transition-all active:scale-[0.99] ${className}`}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailedImage(image)}
          className="mx-auto h-auto max-h-96 w-auto max-w-full"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/45 text-white"
        >
          <ZoomIn size={14} strokeWidth={2} />
        </span>
      </button>

      <dialog
        ref={dialogRef}
        className="modal"
        onClose={() => setIsZoomOpen(false)}
      >
        <div className="modal-box relative w-fit max-w-[95vw] rounded-2xl bg-white p-3">
          <img src={src} alt={alt} className="max-h-[80vh] w-auto max-w-full" />
          <button
            type="button"
            onClick={() => setIsZoomOpen(false)}
            aria-label="關閉放大檢視"
            className="btn btn-circle btn-sm absolute right-2 top-2 border-none bg-black/45 text-white hover:bg-black/60"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={() => setIsZoomOpen(false)}>
            close
          </button>
        </form>
      </dialog>
    </>
  );
}
