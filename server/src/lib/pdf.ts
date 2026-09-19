import { join } from "node:path";
import { ApiError } from "./api";

export const MAX_PDF_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 500;

export async function extractPdf(bytes: Uint8Array, filename: string, signal: AbortSignal) {
  if (!filename.toLowerCase().endsWith(".pdf")) throw new ApiError("只允許上傳 PDF 檔案", 400);
  if (!bytes.length) throw new ApiError("PDF 檔案不能為空", 400);
  if (bytes.length > MAX_PDF_BYTES) throw new ApiError("PDF 超過 4 MiB 限制", 413);
  signal.throwIfAborted();
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Next runs with the server project as cwd; these assets are explicitly traced
  // in next.config.ts. Avoid require.resolve, which Turbopack rewrites to an ID.
  const root = join(process.cwd(), "node_modules/pdfjs-dist");
  const task = getDocument({
    data: bytes, useSystemFonts: false,
    standardFontDataUrl: join(root, "standard_fonts/"),
    cMapUrl: join(root, "cmaps/"), cMapPacked: true,
    wasmUrl: join(root, "wasm/"),
    verbosity: 0,
  });
  let timedOut = false;
  const abort = () => { void task.destroy().catch(() => {}); };
  const timer = setTimeout(() => { timedOut = true; abort(); }, 25_000);
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    const doc = await task.promise;
    if (doc.numPages > MAX_PAGES) throw new ApiError(`PDF 超過 ${MAX_PAGES} 頁限制`, 413);
    const pages: { page_number: number; text: string; text_length: number }[] = [];
    let totalBytes = 0;
    for (let number = 1; number <= doc.numPages; number++) {
      signal.throwIfAborted();
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str;
        if (item.hasEOL) text += "\n";
      }
      // Python len() counts Unicode code points, not UTF-16 code units.
      const entry = { page_number: number, text, text_length: [...text].length };
      totalBytes += Buffer.byteLength(JSON.stringify(entry));
      if (totalBytes > MAX_PDF_BYTES - 16_384) throw new ApiError("提取文字超過回應大小限制", 413);
      pages.push(entry);
      page.cleanup();
    }
    return { status: "success", filename, total_pages: doc.numPages, pages };
  } catch (error) {
    if (timedOut) throw new ApiError("PDF 處理超時", 504);
    if (error instanceof ApiError) throw error;
    throw new ApiError("PDF 處理失敗：檔案損毀、受密碼保護或格式不支援", 400);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    await task.destroy();
  }
}
