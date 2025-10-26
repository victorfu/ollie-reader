import { useEffect } from "react";
import { pdfjs } from "react-pdf";

export const usePdfWorker = () => {
  useEffect(() => {
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
    }
  }, []);
};
