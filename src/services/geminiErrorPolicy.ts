export type GeminiRateLimitKind =
  | "short_rate_limit"
  | "short_spend_limit"
  | "capacity"
  | "daily_exhausted"
  | "quota_unavailable"
  | "unknown_429";

export interface GeminiRateLimitDecision {
  kind: GeminiRateLimitKind;
  retryable: boolean;
  retryAfterMs?: number;
  quotaIds: string[];
}

export function getGeminiRateLimitMessage(
  decision: GeminiRateLimitDecision,
): string {
  switch (decision.kind) {
    case "daily_exhausted":
      return "今天的 Gemini 免費額度已用完；額度會在美國太平洋時間午夜重設，今天不會自動重試。";
    case "quota_unavailable":
      return "目前的 Gemini 模型沒有可用額度，請檢查專案配額或稍後再試。";
    case "unknown_429":
      return "無法確認 Gemini 配額狀態；為避免持續重送，未自動送出或重試。";
    case "short_rate_limit":
    case "short_spend_limit":
      return "Gemini 請求過於頻繁，已達自動重試上限，請稍後再試。";
    case "capacity":
      return "Gemini 目前忙碌，已達自動重試上限，請稍後再試。";
  }
}

type UnknownRecord = Record<string, unknown>;

interface QuotaViolation {
  quotaId?: string;
  quotaMetric?: string;
  quotaValue?: unknown;
}

interface QuotaEvidence {
  violations: QuotaViolation[];
  quotaIds: string[];
  incomplete: boolean;
}

const QUOTA_FAILURE_TYPE = "google.rpc.quotafailure";
const RETRY_INFO_TYPE = "google.rpc.retryinfo";

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const readString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const hasDetailType = (detail: UnknownRecord, type: string): boolean => {
  const detailType = readString(detail["@type"]);
  return detailType?.toLowerCase().endsWith(type) ?? false;
};

const read429Details = (error: unknown): UnknownRecord[] | null => {
  if (!isRecord(error) || !isRecord(error.customErrorData)) {
    return null;
  }

  if (error.customErrorData.status !== 429) {
    return null;
  }

  const details = error.customErrorData.errorDetails;
  if (!Array.isArray(details)) {
    return [];
  }

  return details.filter(isRecord);
};

const collectQuotaEvidence = (details: UnknownRecord[]): QuotaEvidence => {
  const violations: QuotaViolation[] = [];
  const quotaIds: string[] = [];
  const seenQuotaIds = new Set<string>();
  let incomplete = false;

  for (const detail of details) {
    if (!hasDetailType(detail, QUOTA_FAILURE_TYPE)) {
      continue;
    }

    const rawViolations = detail.violations;
    if (!Array.isArray(rawViolations) || rawViolations.length === 0) {
      incomplete = true;
      continue;
    }

    for (const rawViolation of rawViolations) {
      if (!isRecord(rawViolation)) {
        incomplete = true;
        continue;
      }

      const quotaId = readString(rawViolation.quotaId);
      const quotaMetric = readString(rawViolation.quotaMetric);
      violations.push({
        quotaId,
        quotaMetric,
        quotaValue: rawViolation.quotaValue,
      });

      if (quotaId && !seenQuotaIds.has(quotaId)) {
        seenQuotaIds.add(quotaId);
        quotaIds.push(quotaId);
      }
    }
  }

  return { violations, quotaIds, incomplete };
};

const buildQuotaSignature = (violation: QuotaViolation): string =>
  [violation.quotaId, violation.quotaMetric]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

const tokenize = (value: string): string[] =>
  value.split(/[^a-z0-9]+/u).filter(Boolean);

const isDailyViolation = (violation: QuotaViolation): boolean => {
  const signature = buildQuotaSignature(violation);
  const compact = signature.replace(/[^a-z0-9]+/gu, "");
  const tokens = tokenize(signature);

  return (
    compact.includes("perday") ||
    compact.includes("daily") ||
    tokens.includes("rpd") ||
    tokens.includes("tpd")
  );
};

const isMinuteViolation = (violation: QuotaViolation): boolean => {
  const signature = buildQuotaSignature(violation);
  const compact = signature.replace(/[^a-z0-9]+/gu, "");
  const tokens = tokenize(signature);

  return (
    compact.includes("perminute") ||
    tokens.includes("rpm") ||
    tokens.includes("tpm")
  );
};

const isSpendViolation = (violation: QuotaViolation): boolean => {
  const normalized = buildQuotaSignature(violation).replace(
    /[^a-z0-9]+/gu,
    "",
  );
  return (
    normalized.includes("shorttermspend") ||
    normalized.includes("rollingspend") ||
    normalized.includes("spendper10minute") ||
    normalized.includes("spendper10minutes") ||
    normalized.includes("rolling10minutespend")
  );
};

const isZeroQuotaValue = (value: unknown): boolean => {
  if (typeof value === "number") {
    return value === 0;
  }

  if (typeof value !== "string") {
    return false;
  }

  return /^[+-]?0+(?:\.0+)?$/u.test(value.trim());
};

const collectStructuredReasons = (details: UnknownRecord[]): string[] => {
  const reasons: string[] = [];

  for (const detail of details) {
    const reason = readString(detail.reason);
    if (reason) {
      reasons.push(reason);
    }

    if (isRecord(detail.metadata)) {
      const metadataReason = readString(detail.metadata.reason);
      if (metadataReason) {
        reasons.push(metadataReason);
      }
    }
  }

  return reasons;
};

const hasExplicitSpendReason = (details: UnknownRecord[]): boolean =>
  collectStructuredReasons(details).some((reason) => {
    const normalized = reason.toLowerCase().replace(/[^a-z0-9]+/gu, "");
    return (
      normalized.includes("shorttermspend") ||
      normalized.includes("rollingspend") ||
      normalized.includes("spendper10minute") ||
      normalized.includes("rolling10minutespend")
    );
  });

const hasExplicitCapacityReason = (details: UnknownRecord[]): boolean =>
  collectStructuredReasons(details).some((reason) => {
    const normalized = reason.toLowerCase().replace(/[^a-z0-9]+/gu, "");
    return normalized.includes("capacity") || normalized.includes("overload");
  });

const parseProtobufDurationMs = (value: unknown): number | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const match = /^(\d+)(?:\.(\d{1,9}))?s$/u.exec(value.trim());
  if (!match) {
    return undefined;
  }

  const seconds = Number(match[1]);
  if (!Number.isSafeInteger(seconds)) {
    return undefined;
  }

  const fractionalDigits = match[2] ?? "";
  const nanoseconds = fractionalDigits
    ? Number(fractionalDigits.padEnd(9, "0"))
    : 0;
  const milliseconds = seconds * 1_000 + nanoseconds / 1_000_000;

  if (!Number.isFinite(milliseconds) || milliseconds > Number.MAX_SAFE_INTEGER) {
    return undefined;
  }

  return Math.ceil(milliseconds);
};

const readRetryAfterMs = (details: UnknownRecord[]): number | undefined => {
  let retryAfterMs: number | undefined;

  for (const detail of details) {
    if (!hasDetailType(detail, RETRY_INFO_TYPE)) {
      continue;
    }

    const parsed = parseProtobufDurationMs(detail.retryDelay);
    if (parsed !== undefined) {
      retryAfterMs = Math.max(retryAfterMs ?? 0, parsed);
    }
  }

  return retryAfterMs;
};

const retryableDecision = (
  kind: Extract<
    GeminiRateLimitKind,
    "short_rate_limit" | "short_spend_limit" | "capacity"
  >,
  quotaIds: string[],
  details: UnknownRecord[],
): GeminiRateLimitDecision => {
  const retryAfterMs = readRetryAfterMs(details);
  return {
    kind,
    retryable: true,
    ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    quotaIds,
  };
};

const nonRetryableDecision = (
  kind: Extract<
    GeminiRateLimitKind,
    "daily_exhausted" | "quota_unavailable" | "unknown_429"
  >,
  quotaIds: string[],
): GeminiRateLimitDecision => ({
  kind,
  retryable: false,
  quotaIds,
});

export const classifyGeminiRateLimit = (
  error: unknown,
): GeminiRateLimitDecision | null => {
  const details = read429Details(error);
  if (details === null) {
    return null;
  }

  const evidence = collectQuotaEvidence(details);

  if (evidence.violations.some(isDailyViolation)) {
    return nonRetryableDecision("daily_exhausted", evidence.quotaIds);
  }

  if (evidence.violations.some((violation) => isZeroQuotaValue(violation.quotaValue))) {
    return nonRetryableDecision("quota_unavailable", evidence.quotaIds);
  }

  if (evidence.incomplete) {
    return nonRetryableDecision("unknown_429", evidence.quotaIds);
  }

  if (
    evidence.violations.length > 0 &&
    evidence.violations.every(isMinuteViolation)
  ) {
    return retryableDecision(
      "short_rate_limit",
      evidence.quotaIds,
      details,
    );
  }

  if (
    evidence.violations.length > 0 &&
    evidence.violations.every(isSpendViolation)
  ) {
    return retryableDecision(
      "short_spend_limit",
      evidence.quotaIds,
      details,
    );
  }

  if (evidence.violations.length > 0) {
    return nonRetryableDecision("unknown_429", evidence.quotaIds);
  }

  if (hasExplicitSpendReason(details)) {
    return retryableDecision("short_spend_limit", evidence.quotaIds, details);
  }

  if (hasExplicitCapacityReason(details)) {
    return retryableDecision("capacity", evidence.quotaIds, details);
  }

  return nonRetryableDecision("unknown_429", evidence.quotaIds);
};

export class GeminiRateLimitError extends Error {
  readonly decision: GeminiRateLimitDecision;
  override readonly cause: unknown;

  constructor(decision: GeminiRateLimitDecision, cause?: unknown) {
    super(getGeminiRateLimitMessage(decision), { cause });
    this.name = "GeminiRateLimitError";
    this.decision = decision;
    this.cause = cause;
  }
}

export const isGeminiRateLimitError = (
  error: unknown,
): error is GeminiRateLimitError => error instanceof GeminiRateLimitError;
