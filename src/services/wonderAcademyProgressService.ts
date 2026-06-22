import {
  WONDER_ACADEMY_STARTERS,
  getCurrentObjective,
  getStarterById,
} from "../data/wonderAcademyData";
import type {
  OwnedWonderling,
  WonderAcademyAudioSettings,
  WonderAcademyProgress,
} from "../types/wonderAcademy";

export const WONDER_ACADEMY_CACHE_KEY = "ollie-wonder-academy-cache";
export const WONDER_ACADEMY_PENDING_KEY = "ollie-wonder-academy-pending";

type CreateInitialWonderAcademyProgressOptions = {
  userId: string;
  starterSpeciesId?: string;
  starterNickname?: string;
  playerName?: string | null;
  now?: string;
};

type WonderAcademyCloudGetter = (
  userId: string,
) => Promise<WonderAcademyProgress | null>;

type WonderAcademyCloudSetter = (
  progress: WonderAcademyProgress,
) => Promise<void>;

type WonderAcademyProgressServiceOptions = {
  storage?: Storage | null;
  getCloudProgress?: WonderAcademyCloudGetter;
  setCloudProgress?: WonderAcademyCloudSetter;
};

type WonderAcademyProgressService = {
  load: (userId: string) => Promise<WonderAcademyProgress | null>;
  save: (
    progress: WonderAcademyProgress,
  ) => Promise<{ cloudSaved: boolean; progress: WonderAcademyProgress }>;
};

const DEFAULT_AUDIO_SETTINGS: WonderAcademyAudioSettings = {
  musicVolume: 0.45,
  sfxVolume: 0.65,
  muted: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isStringNumberRecord = (value: unknown): value is Record<string, number> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === "number");

const isSkillLoadouts = (value: unknown): value is Record<string, string[]> =>
  isRecord(value) && Object.values(value).every(isStringArray);

const isWonderdex = (
  value: unknown,
): value is WonderAcademyProgress["wonderdex"] => {
  const validValues = new Set([
    "seen",
    "attuned",
    "warden-recorded",
    "mythling-recorded",
  ]);

  return (
    isRecord(value) &&
    Object.values(value).every(
      (item) => typeof item === "string" && validValues.has(item),
    )
  );
};

const isOwnedWonderling = (value: unknown): value is OwnedWonderling =>
  isRecord(value) &&
  typeof value.ownedId === "string" &&
  typeof value.speciesId === "string" &&
  typeof value.nickname === "string" &&
  typeof value.level === "number" &&
  typeof value.xp === "number" &&
  typeof value.bond === "number" &&
  typeof value.moodMax === "number" &&
  isStringArray(value.equippedSkillIds) &&
  isStringArray(value.unlockedSkillIds) &&
  typeof value.attunedAt === "string" &&
  typeof value.currentGrowthStage === "number";

const isOwnedWonderlingArray = (value: unknown): value is OwnedWonderling[] =>
  Array.isArray(value) && value.every(isOwnedWonderling);

const isAudioSettings = (value: unknown): value is WonderAcademyAudioSettings =>
  isRecord(value) &&
  typeof value.musicVolume === "number" &&
  typeof value.sfxVolume === "number" &&
  typeof value.muted === "boolean";

const isWonderAcademyProgress = (
  value: unknown,
): value is WonderAcademyProgress => {
  if (!isRecord(value)) return false;

  if (
    value.schemaVersion !== 1 ||
    typeof value.userId !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    (value.lastCloudSavedAt !== null && typeof value.lastCloudSavedAt !== "string") ||
    typeof value.lastSafeResumePoint !== "string" ||
    (value.playerName !== null && typeof value.playerName !== "string") ||
    typeof value.starterSpeciesId !== "string" ||
    typeof value.starterNickname !== "string"
  ) {
    return false;
  }

  if (
    !isRecord(value.storyProgress) ||
    typeof value.storyProgress.currentChapterId !== "string" ||
    typeof value.storyProgress.currentNodeId !== "string" ||
    typeof value.storyProgress.currentObjectiveId !== "string"
  ) {
    return false;
  }

  if (
    !isStringArray(value.unlockedRegionIds) ||
    !isStringArray(value.unlockedNodeIds) ||
    !isStringArray(value.completedNodeIds) ||
    !isStringArray(value.completedQuestIds) ||
    !isOwnedWonderlingArray(value.ownedWonderlings) ||
    !isWonderdex(value.wonderdex) ||
    !isRecord(value.keeperTeam) ||
    typeof value.keeperTeam.activeOwnedId !== "string" ||
    !isStringArray(value.keeperTeam.supportOwnedIds) ||
    !isStringArray(value.keeperTeam.reserveOwnedIds) ||
    !isSkillLoadouts(value.skillLoadouts) ||
    !isStringNumberRecord(value.snacks) ||
    !isStringNumberRecord(value.charms) ||
    !isStringNumberRecord(value.careerLevels) ||
    !isAudioSettings(value.audioSettings) ||
    !isRecord(value.accessibilitySettings) ||
    typeof value.accessibilitySettings.reducedMotion !== "boolean" ||
    typeof value.accessibilitySettings.largerText !== "boolean"
  ) {
    return false;
  }

  return getStarterById(value.starterSpeciesId) !== null;
};

function readStoredProgress(
  storage: Storage | null,
  key: string,
  userId: string,
): WonderAcademyProgress | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const legacyProgress = parseWonderAcademyProgress(parsed);

    if (legacyProgress) {
      return legacyProgress.userId === userId ? legacyProgress : null;
    }

    if (!isRecord(parsed)) return null;
    const userProgress = parseWonderAcademyProgress(parsed[userId]);
    return userProgress?.userId === userId ? userProgress : null;
  } catch {
    return null;
  }
}

function readStoredProgressMap(
  storage: Storage | null,
  key: string,
): Record<string, WonderAcademyProgress> {
  if (!storage) return {};

  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const legacyProgress = parseWonderAcademyProgress(parsed);

    if (legacyProgress) {
      return { [legacyProgress.userId]: legacyProgress };
    }

    if (!isRecord(parsed)) return {};

    return Object.entries(parsed).reduce<Record<string, WonderAcademyProgress>>(
      (progressMap, [userId, value]) => {
        const progress = parseWonderAcademyProgress(value);
        if (progress?.userId === userId) {
          progressMap[userId] = progress;
        }
        return progressMap;
      },
      {},
    );
  } catch {
    return {};
  }
}

function writeStoredProgress(
  storage: Storage | null,
  key: string,
  progress: WonderAcademyProgress,
) {
  if (!storage) return;

  try {
    storage.setItem(
      key,
      JSON.stringify({
        ...readStoredProgressMap(storage, key),
        [progress.userId]: progress,
      }),
    );
  } catch {
    // Storage can be unavailable or full; cloud remains the source of durable save.
  }
}

function removeStoredProgress(
  storage: Storage | null,
  key: string,
  userId: string,
) {
  if (!storage) return;

  try {
    const progressMap = readStoredProgressMap(storage, key);
    delete progressMap[userId];

    if (Object.keys(progressMap).length === 0) {
      storage.removeItem(key);
      return;
    }

    storage.setItem(key, JSON.stringify(progressMap));
  } catch {
    // Ignore local cleanup failures.
  }
}

function compareUpdatedAt(
  left: WonderAcademyProgress,
  right: WonderAcademyProgress,
): number {
  return Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
}

export function createInitialWonderAcademyProgress({
  userId,
  starterSpeciesId = WONDER_ACADEMY_STARTERS[0]?.speciesId ?? "lumi",
  starterNickname,
  playerName = null,
  now = new Date().toISOString(),
}: CreateInitialWonderAcademyProgressOptions): WonderAcademyProgress {
  const starter = getStarterById(starterSpeciesId) ?? WONDER_ACADEMY_STARTERS[0];
  const nickname = starterNickname ?? starter.speciesName;
  const currentChapterId = "sparkleaf-grove";
  const currentNodeId = "academy-gate";
  const completedNodeIds: string[] = [];
  const currentObjective = getCurrentObjective({
    currentChapterId,
    currentNodeId,
    completedNodeIds,
  });
  const ownedWonderling: OwnedWonderling = {
    ownedId: `${starter.speciesId}-starter`,
    speciesId: starter.speciesId,
    nickname,
    level: 1,
    xp: 0,
    bond: 0,
    moodMax: 100,
    equippedSkillIds: starter.learnableSkillIds.slice(0, 2),
    unlockedSkillIds: starter.learnableSkillIds.slice(0, 2),
    attunedAt: now,
    currentGrowthStage: 0,
  };

  return {
    schemaVersion: 1,
    userId,
    createdAt: now,
    updatedAt: now,
    lastCloudSavedAt: null,
    lastSafeResumePoint: "hub",
    playerName,
    starterSpeciesId: starter.speciesId,
    starterNickname: nickname,
    storyProgress: {
      currentChapterId,
      currentNodeId,
      currentObjectiveId: currentObjective.id,
    },
    unlockedRegionIds: ["wonder-academy"],
    unlockedNodeIds: [currentNodeId],
    completedNodeIds,
    completedQuestIds: [],
    ownedWonderlings: [ownedWonderling],
    wonderdex: {
      [starter.speciesId]: "attuned",
    },
    keeperTeam: {
      activeOwnedId: ownedWonderling.ownedId,
      supportOwnedIds: [],
      reserveOwnedIds: [],
    },
    skillLoadouts: {
      [ownedWonderling.ownedId]: ownedWonderling.equippedSkillIds,
    },
    snacks: {},
    charms: {},
    careerLevels: {},
    audioSettings: { ...DEFAULT_AUDIO_SETTINGS },
    accessibilitySettings: {
      reducedMotion: false,
      largerText: false,
    },
  };
}

export function parseWonderAcademyProgress(
  value: unknown,
): WonderAcademyProgress | null {
  return isWonderAcademyProgress(value) ? value : null;
}

export function getWonderAcademyStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

async function loadFirestore() {
  const [{ doc, getDoc, setDoc }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../utils/firebaseUtil"),
  ]);

  return { doc, getDoc, setDoc, db };
}

export async function getFirestoreWonderAcademyProgress(
  userId: string,
): Promise<WonderAcademyProgress | null> {
  const { doc, getDoc, db } = await loadFirestore();
  const docRef = doc(db, "gameProgress", userId, "littleGames", "wonderAcademy");
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;
  const progress = parseWonderAcademyProgress(snapshot.data());
  return progress?.userId === userId ? progress : null;
}

export async function setFirestoreWonderAcademyProgress(
  progress: WonderAcademyProgress,
): Promise<void> {
  const { doc, setDoc, db } = await loadFirestore();
  const docRef = doc(
    db,
    "gameProgress",
    progress.userId,
    "littleGames",
    "wonderAcademy",
  );

  await setDoc(docRef, progress);
}

export function createWonderAcademyProgressService({
  storage = getWonderAcademyStorage(),
  getCloudProgress = getFirestoreWonderAcademyProgress,
  setCloudProgress = setFirestoreWonderAcademyProgress,
}: WonderAcademyProgressServiceOptions = {}): WonderAcademyProgressService {
  return {
    async load(userId) {
      const pending = readStoredProgress(storage, WONDER_ACADEMY_PENDING_KEY, userId);
      const cache = readStoredProgress(storage, WONDER_ACADEMY_CACHE_KEY, userId);
      const cloud = await getCloudProgress(userId).catch(() => null);
      const parsedCloud = cloud?.userId === userId ? parseWonderAcademyProgress(cloud) : null;

      if (pending && (!parsedCloud || compareUpdatedAt(pending, parsedCloud) > 0)) {
        return pending;
      }

      return parsedCloud ?? cache ?? null;
    },
    async save(progress) {
      writeStoredProgress(storage, WONDER_ACADEMY_CACHE_KEY, progress);

      try {
        const cloudSavedProgress = {
          ...progress,
          lastCloudSavedAt: progress.updatedAt,
        };
        await setCloudProgress(cloudSavedProgress);
        writeStoredProgress(storage, WONDER_ACADEMY_CACHE_KEY, cloudSavedProgress);
        removeStoredProgress(
          storage,
          WONDER_ACADEMY_PENDING_KEY,
          progress.userId,
        );
        return { cloudSaved: true, progress: cloudSavedProgress };
      } catch {
        writeStoredProgress(storage, WONDER_ACADEMY_PENDING_KEY, progress);
        return { cloudSaved: false, progress };
      }
    },
  };
}

export const wonderAcademyProgressService = createWonderAcademyProgressService();
