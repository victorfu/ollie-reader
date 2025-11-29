import { pdfjs } from "react-pdf";

// Configure PDF.js worker globally (called once at app startup)
export function initializePdfjs() {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

// PDF Document options for proper font rendering
// These must be provided to each Document component
export const pdfDocumentOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
};

// Initialize immediately when this module is imported
initializePdfjs();
