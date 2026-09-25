export type SelectionTarget =
  | { kind: "question"; questionId: string; regionIndex: number }
  | { kind: "mask"; maskIndex: number };

function toIndex(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

/** Firestore 自動產生的 id 不含冒號，可以安全地用冒號分隔。 */
export function questionSelectionKey(questionId: string, regionIndex: number): string {
  return `q:${questionId}:${regionIndex}`;
}

export function maskSelectionKey(maskIndex: number): string {
  return `m:${maskIndex}`;
}

export function parseSelectionKey(key: string): SelectionTarget | null {
  const parts = key.split(":");
  if (parts[0] === "q" && parts.length === 3 && parts[1]) {
    const regionIndex = toIndex(parts[2]);
    return regionIndex === null ? null : { kind: "question", questionId: parts[1], regionIndex };
  }
  if (parts[0] === "m" && parts.length === 2) {
    const maskIndex = toIndex(parts[1]);
    return maskIndex === null ? null : { kind: "mask", maskIndex };
  }
  return null;
}
