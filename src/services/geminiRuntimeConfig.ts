import {
  activate,
  fetchAndActivate,
  getNumber,
  getRemoteConfig,
  isSupported,
  onConfigUpdate,
  type RemoteConfig,
} from "firebase/remote-config";
import { firebaseApp } from "../utils/firebaseUtil";
import { logger } from "../utils/logger";

export const GEMINI_CLIENT_RPM_BUDGET_PARAMETER =
  "gemini_client_rpm_budget";

const MIN_CLIENT_RPM_BUDGET = 1;
const MAX_CLIENT_RPM_BUDGET = 120;

// Temporary safe fallback: a 5 RPM dashboard quota with 20% headroom gives
// this client an effective budget of 4 RPM. Remote Config should override it
// based on the active model's dashboard quota and expected active clients.
const DEFAULT_CLIENT_RPM_BUDGET = 4;

let clientRpmBudget = DEFAULT_CLIENT_RPM_BUDGET;
let initializationStarted = false;

export function normalizeGeminiClientRpmBudget(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_CLIENT_RPM_BUDGET;
  }

  return Math.min(
    MAX_CLIENT_RPM_BUDGET,
    Math.max(MIN_CLIENT_RPM_BUDGET, Math.floor(value)),
  );
}

export function getGeminiClientRpmBudget(): number {
  return clientRpmBudget;
}

export function getGeminiMinimumStartIntervalMs(): number {
  return Math.ceil(60_000 / clientRpmBudget);
}

function applyRemoteRpmBudget(remoteConfig: RemoteConfig): void {
  const remoteValue = getNumber(
    remoteConfig,
    GEMINI_CLIENT_RPM_BUDGET_PARAMETER,
  );
  const normalizedValue = normalizeGeminiClientRpmBudget(remoteValue);

  if (normalizedValue !== remoteValue) {
    logger.warn(
      "Invalid Gemini client RPM budget; using a bounded safe value",
      {
        remoteValue,
        normalizedValue,
      },
    );
  }

  clientRpmBudget = normalizedValue;
}

async function initializeRemoteConfig(): Promise<void> {
  try {
    if (!(await isSupported())) {
      logger.warn(
        "Firebase Remote Config is unavailable; using the default Gemini RPM budget",
      );
      return;
    }

    const remoteConfig = getRemoteConfig(firebaseApp);
    remoteConfig.defaultConfig[GEMINI_CLIENT_RPM_BUDGET_PARAMETER] =
      DEFAULT_CLIENT_RPM_BUDGET;

    // Apply an already-activated cached value immediately when available.
    applyRemoteRpmBudget(remoteConfig);

    onConfigUpdate(remoteConfig, {
      next: (configUpdate) => {
        if (
          !configUpdate
            .getUpdatedKeys()
            .has(GEMINI_CLIENT_RPM_BUDGET_PARAMETER)
        ) {
          return;
        }

        void activate(remoteConfig)
          .then(() => {
            applyRemoteRpmBudget(remoteConfig);
          })
          .catch((error: unknown) => {
            logger.warn(
              "Failed to activate the updated Gemini RPM budget",
              error,
            );
          });
      },
      error: (error) => {
        logger.warn("Gemini RPM Remote Config listener failed", error);
      },
      complete: () => {},
    });

    try {
      await fetchAndActivate(remoteConfig);
      applyRemoteRpmBudget(remoteConfig);
    } catch (error) {
      logger.warn(
        "Failed to fetch the Gemini RPM budget; using the current safe value",
        error,
      );
    }
  } catch (error) {
    logger.warn(
      "Failed to initialize Gemini RPM Remote Config; using the default budget",
      error,
    );
  }
}

/**
 * Starts loading Gemini pacing configuration without delaying application
 * startup. Repeated calls are safe and reuse the first initialization.
 */
export function initializeGeminiRuntimeConfig(): void {
  if (initializationStarted) {
    return;
  }

  initializationStarted = true;
  void initializeRemoteConfig();
}
