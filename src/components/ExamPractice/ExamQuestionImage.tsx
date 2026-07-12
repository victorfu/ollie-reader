import { useState } from "react";

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

/** 考卷裁圖。永遠白底(原卷即白紙),深色模式下以邊框收束;載入失敗時顯示對照提示。 */
export function ExamQuestionImage({
  image,
  number,
  questionPdf,
  alt = `第 ${number} 題附圖`,
  className = "",
}: ExamQuestionImageProps) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const failed = failedImage === image;

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

  return (
    <div className={`rounded-lg border border-border-hairline bg-white p-2 ${className}`}>
      <img
        src={`/exams/images/${image}`}
        alt={alt}
        loading="lazy"
        onError={() => setFailedImage(image)}
        className="mx-auto h-auto max-h-96 w-auto max-w-full"
      />
    </div>
  );
}
