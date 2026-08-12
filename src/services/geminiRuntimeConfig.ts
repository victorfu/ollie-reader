const MIN_CLIENT_RPM_BUDGET = 1;
const MAX_CLIENT_RPM_BUDGET = 120;

// A 5 RPM dashboard quota with 20% headroom gives this client an effective
// budget of 4 RPM when no build-time environment override is provided.
const DEFAULT_CLIENT_RPM_BUDGET = 4;

export function normalizeGeminiClientRpmBudget(value: unknown): number {
  const parsedValue =
    typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : value;

  if (
    typeof parsedValue !== "number" ||
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0
  ) {
    return DEFAULT_CLIENT_RPM_BUDGET;
  }

  return Math.min(
    MAX_CLIENT_RPM_BUDGET,
    Math.max(MIN_CLIENT_RPM_BUDGET, Math.floor(parsedValue)),
  );
}

const clientRpmBudget = normalizeGeminiClientRpmBudget(
  import.meta.env.VITE_GEMINI_CLIENT_RPM_BUDGET,
);

export function getGeminiClientRpmBudget(): number {
  return clientRpmBudget;
}

export function getGeminiMinimumStartIntervalMs(): number {
  return Math.ceil(60_000 / clientRpmBudget);
}
