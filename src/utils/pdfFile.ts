export function isSupportedPdfFile(
  file: Pick<File, "name" | "type">,
): boolean {
  const mimeType = file.type.trim().toLowerCase();
  if (mimeType === "application/pdf") return true;

  const hasPdfExtension = file.name.trim().toLowerCase().endsWith(".pdf");
  return (
    hasPdfExtension &&
    (mimeType === "" || mimeType === "application/octet-stream")
  );
}
