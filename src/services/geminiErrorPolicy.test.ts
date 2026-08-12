import { describe, expect, it } from "vitest";
import {
  GeminiRateLimitError,
  classifyGeminiRateLimit,
  getGeminiRateLimitMessage,
  isGeminiRateLimitError,
} from "./geminiErrorPolicy";

const quotaFailure = (violations: unknown[]) => ({
  "@type": "type.googleapis.com/google.rpc.QuotaFailure",
  violations,
});

const retryInfo = (retryDelay: unknown) => ({
  "@type": "type.googleapis.com/google.rpc.RetryInfo",
  retryDelay,
});

const aiError = (errorDetails?: unknown, status: unknown = 429) => ({
  code: "ai/fetch-error",
  customErrorData: {
    status,
    ...(errorDetails === undefined ? {} : { errorDetails }),
  },
});

describe("classifyGeminiRateLimit", () => {
  it("only classifies Firebase AI errors with numeric HTTP status 429", () => {
    expect(classifyGeminiRateLimit(null)).toBeNull();
    expect(classifyGeminiRateLimit(new Error("429"))).toBeNull();
    expect(classifyGeminiRateLimit(aiError([], 503))).toBeNull();
    expect(classifyGeminiRateLimit(aiError([], "429"))).toBeNull();
  });

  it("classifies all-minute quota violations as a retryable short limit", () => {
    const error = aiError([
      quotaFailure([
        {
          quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
          quotaMetric: "generativelanguage.googleapis.com/generate_requests",
          quotaValue: "10",
        },
        {
          quotaId: "input-token-rpm",
          quotaMetric:
            "generativelanguage.googleapis.com/input_tokens_per_model_per_minute",
          quotaValue: 250_000,
        },
      ]),
      retryInfo("1.250000001s"),
    ]);

    expect(classifyGeminiRateLimit(error)).toEqual({
      kind: "short_rate_limit",
      retryable: true,
      retryAfterMs: 1_251,
      quotaIds: [
        "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
        "input-token-rpm",
      ],
    });
  });

  it("uses the longest valid RetryInfo duration", () => {
    const error = aiError([
      quotaFailure([{ quotaId: "RPM", quotaValue: 1 }]),
      retryInfo("0.25s"),
      retryInfo("2s"),
      retryInfo("invalid"),
    ]);

    expect(classifyGeminiRateLimit(error)).toMatchObject({
      kind: "short_rate_limit",
      retryable: true,
      retryAfterMs: 2_000,
    });
  });

  it("gives daily exhaustion priority and never exposes RetryInfo for retry", () => {
    const error = aiError([
      quotaFailure([
        {
          quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
          quotaValue: 0,
        },
        {
          quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
          quotaValue: "20",
        },
      ]),
      retryInfo("1s"),
    ]);

    expect(classifyGeminiRateLimit(error)).toEqual({
      kind: "daily_exhausted",
      retryable: false,
      quotaIds: [
        "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
        "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
      ],
    });
  });

  it.each(["RPD", "TPD", "requests-daily-budget"])(
    "recognizes the explicit daily quota marker %s",
    (quotaId) => {
      const error = aiError([quotaFailure([{ quotaId, quotaValue: 1 }])]);

      expect(classifyGeminiRateLimit(error)).toMatchObject({
        kind: "daily_exhausted",
        retryable: false,
      });
    },
  );

  it.each([0, -0, "0", "+0.000", "-0.0"])(
    "treats an unavailable quota value (%s) as non-retryable",
    (quotaValue) => {
      const error = aiError([
        quotaFailure([{ quotaId: "model-availability", quotaValue }]),
        retryInfo("1s"),
      ]);

      expect(classifyGeminiRateLimit(error)).toEqual({
        kind: "quota_unavailable",
        retryable: false,
        quotaIds: ["model-availability"],
      });
    },
  );

  it("does not retry when any quota violation lacks a short-term dimension", () => {
    const error = aiError([
      quotaFailure([
        { quotaId: "RPM", quotaValue: 10 },
        { quotaId: "UndocumentedProjectQuota", quotaValue: 10 },
      ]),
      retryInfo("1s"),
    ]);

    expect(classifyGeminiRateLimit(error)).toEqual({
      kind: "unknown_429",
      retryable: false,
      quotaIds: ["RPM", "UndocumentedProjectQuota"],
    });
  });

  it("does not treat RetryInfo alone as proof of a transient failure", () => {
    expect(classifyGeminiRateLimit(aiError([retryInfo("1.5s")]))).toEqual({
      kind: "unknown_429",
      retryable: false,
      quotaIds: [],
    });
  });

  it("classifies an explicit spend violation as retryable", () => {
    const error = aiError([
      quotaFailure([
        {
          quotaId: "ProjectSpendLimit",
          quotaMetric: "billing.googleapis.com/short_term_spend",
          quotaValue: "5",
        },
      ]),
      retryInfo("3.75s"),
    ]);

    expect(classifyGeminiRateLimit(error)).toEqual({
      kind: "short_spend_limit",
      retryable: true,
      retryAfterMs: 3_750,
      quotaIds: ["ProjectSpendLimit"],
    });
  });

  it("does not assume a generic project spend cap is short-term", () => {
    const error = aiError([
      quotaFailure([
        {
          quotaId: "ProjectSpendLimit",
          quotaMetric: "billing.googleapis.com/project_spend",
          quotaValue: "5",
        },
      ]),
      retryInfo("3s"),
    ]);

    expect(classifyGeminiRateLimit(error)).toEqual({
      kind: "unknown_429",
      retryable: false,
      quotaIds: ["ProjectSpendLimit"],
    });
  });

  it("classifies an explicit structured capacity reason as retryable", () => {
    const error = aiError([
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        reason: "MODEL_CAPACITY_EXHAUSTED",
      },
      retryInfo("0.000000001s"),
    ]);

    expect(classifyGeminiRateLimit(error)).toEqual({
      kind: "capacity",
      retryable: true,
      retryAfterMs: 1,
      quotaIds: [],
    });
  });

  it("reads an explicit reason from structured metadata", () => {
    const error = aiError([
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        metadata: { reason: "SERVICE_OVERLOADED" },
      },
    ]);

    expect(classifyGeminiRateLimit(error)).toEqual({
      kind: "capacity",
      retryable: true,
      quotaIds: [],
    });
  });

  it("does not assume generic resource exhaustion is capacity", () => {
    const error = aiError([
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        reason: "RESOURCE_EXHAUSTED",
      },
      retryInfo("1s"),
    ]);

    expect(classifyGeminiRateLimit(error)).toEqual({
      kind: "unknown_429",
      retryable: false,
      quotaIds: [],
    });
  });

  it("never infers a quota dimension from the human-readable message", () => {
    const error = {
      ...aiError([retryInfo("1s")]),
      message: "RequestsPerMinute exceeded; retry now",
    };

    expect(classifyGeminiRateLimit(error)).toEqual({
      kind: "unknown_429",
      retryable: false,
      quotaIds: [],
    });
  });

  it("fails closed for incomplete QuotaFailure details", () => {
    const error = aiError([
      quotaFailure([{ quotaId: "RPM", quotaValue: 10 }, "malformed"]),
      retryInfo("1s"),
    ]);

    expect(classifyGeminiRateLimit(error)).toEqual({
      kind: "unknown_429",
      retryable: false,
      quotaIds: ["RPM"],
    });
  });

  it("deduplicates quota IDs while retaining their response order", () => {
    const error = aiError([
      quotaFailure([
        { quotaId: "RPM", quotaValue: 10 },
        { quotaId: "RPM", quotaValue: 10 },
        { quotaId: "TPM", quotaValue: 10 },
      ]),
    ]);

    expect(classifyGeminiRateLimit(error)?.quotaIds).toEqual(["RPM", "TPM"]);
  });

  it("returns an unknown non-retryable decision when details are absent", () => {
    expect(classifyGeminiRateLimit(aiError())).toEqual({
      kind: "unknown_429",
      retryable: false,
      quotaIds: [],
    });
  });
});

describe("GeminiRateLimitError", () => {
  it("preserves the decision and original cause", () => {
    const cause = aiError([]);
    const decision = {
      kind: "daily_exhausted" as const,
      retryable: false,
      quotaIds: ["RPD"],
    };
    const error = new GeminiRateLimitError(decision, cause);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("GeminiRateLimitError");
    expect(error.message).toContain("今天的 Gemini 免費額度已用完");
    expect(error.decision).toBe(decision);
    expect(error.cause).toBe(cause);
    expect(isGeminiRateLimitError(error)).toBe(true);
    expect(isGeminiRateLimitError(cause)).toBe(false);
  });

  it("provides safe user-facing messages for every decision kind", () => {
    const messages = [
      "short_rate_limit",
      "short_spend_limit",
      "capacity",
      "daily_exhausted",
      "quota_unavailable",
      "unknown_429",
    ].map((kind) =>
      getGeminiRateLimitMessage({
        kind: kind as Parameters<typeof getGeminiRateLimitMessage>[0]["kind"],
        retryable: false,
        quotaIds: [],
      }),
    );

    expect(messages.every((message) => message.length > 0)).toBe(true);
  });
});
