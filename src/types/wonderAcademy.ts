export type WonderAcademyElement =
  | "spark"
  | "tide"
  | "leaf"
  | "light"
  | "dream"
  | "ember"
  | "crystal"
  | "star";

export type WonderAcademyRole =
  | "striker"
  | "guardian"
  | "healer"
  | "trickster"
  | "scout"
  | "performer";

export type WonderAcademyRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "warden"
  | "mythling";

export type WonderlingSpecies = {
  speciesId: string;
  speciesName: string;
  category: string;
  rarity: WonderAcademyRarity;
  elements: WonderAcademyElement[];
  roles: WonderAcademyRole[];
  regionIds: string[];
  favoriteSnack: string;
  personality: string;
  fieldSkillId: string;
  learnableSkillIds: string[];
  attuneCondition: string;
  growthStages: string[];
  artPrompt: string;
  silhouetteAsset: string;
  portraitAsset: string;
  spriteAsset: string;
};

export type OwnedWonderling = {
  ownedId: string;
  speciesId: string;
  nickname: string;
  level: number;
  xp: number;
  bond: number;
  moodMax: number;
  equippedSkillIds: string[];
  unlockedSkillIds: string[];
  attunedAt: string;
  currentGrowthStage: number;
};

export type WonderAcademyNodeKind =
  | "story"
  | "encounter"
  | "quest"
  | "rest"
  | "warden"
  | "returnHub";

export type WonderAcademyObjective = {
  id: string;
  label: string;
  description: string;
  targetChapterId: string;
  targetNodeId: string;
};

export type WonderAcademyMapNode = {
  id: string;
  label: string;
  kind: WonderAcademyNodeKind;
  x: number;
  y: number;
  adjacentNodeIds: string[];
  objective: WonderAcademyObjective;
  lockedBy?: {
    kind: "node" | "fieldSkill" | "questFlag" | "snack";
    value: string;
    hint: string;
  };
};

export type WonderAcademyChapter = {
  id: string;
  title: string;
  tone: string;
  wardenSpeciesId: string;
  nodes: WonderAcademyMapNode[];
};

export type WonderAcademyProgressPointer = {
  currentChapterId: string;
  currentNodeId: string;
  completedNodeIds: string[];
};

export type WonderAcademyAudioSettings = {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
};

export type WonderAcademyProgress = {
  schemaVersion: 1;
  userId: string;
  createdAt: string;
  updatedAt: string;
  lastCloudSavedAt: string | null;
  lastSafeResumePoint: string;
  playerName: string | null;
  starterSpeciesId: string;
  starterNickname: string;
  storyProgress: {
    currentChapterId: string;
    currentNodeId: string;
    currentObjectiveId: string;
  };
  unlockedRegionIds: string[];
  unlockedNodeIds: string[];
  completedNodeIds: string[];
  completedQuestIds: string[];
  ownedWonderlings: OwnedWonderling[];
  wonderdex: Record<
    string,
    "seen" | "attuned" | "warden-recorded" | "mythling-recorded"
  >;
  keeperTeam: {
    activeOwnedId: string;
    supportOwnedIds: string[];
    reserveOwnedIds: string[];
  };
  skillLoadouts: Record<string, string[]>;
  snacks: Record<string, number>;
  charms: Record<string, number>;
  careerLevels: Record<string, number>;
  audioSettings: WonderAcademyAudioSettings;
  accessibilitySettings: {
    reducedMotion: boolean;
    largerText: boolean;
  };
};
