declare module "*.mjs" {
  export const WONDER_ACADEMY_GUEST_SAVE_KEY: string;
  export const WONDER_ACADEMY_SMOKE_CHECKS: readonly string[];

  export type WonderAcademySmokeConsoleEntry = {
    type: string;
    text: string;
  };

  export type WonderAcademySmokeSave = {
    schemaVersion: 2;
    updatedAt: number;
    data: {
      playerName: string;
      team: Array<{
        ownedId: string;
        speciesId: string;
        nickname: string;
        level: number;
        xp: number;
        bond: number;
        stage: number;
        equippedMoveIds: string[];
      }>;
      dex: Record<string, string>;
      stardust: number;
      snacks: Record<string, number>;
      customCreatures: unknown[];
      wardensDefeated: string[];
      clearedNodes: string[];
      shinyDex: string[];
      dexRewardsClaimed: number[];
      lastDailyReward: string | null;
      daily: unknown | null;
      audioSettings: {
        musicVolume: number;
        sfxVolume: number;
        muted: boolean;
      };
    };
  };

  export function buildWonderAcademyGuestSave(options?: {
    playerName?: string;
    level?: number;
    equippedMoveIds?: string[];
    stardust?: number;
    snacks?: Record<string, number>;
    clearedNodes?: string[];
    wardensDefeated?: string[];
  }): WonderAcademySmokeSave;

  export function buildMalformedLoadoutGuestSave(): WonderAcademySmokeSave;

  export function buildWardenReadyGuestSave(): WonderAcademySmokeSave;

  export function isKnownBenignWonderAcademyConsoleEntry(
    entry: WonderAcademySmokeConsoleEntry,
  ): boolean;

  export function relevantWonderAcademyConsoleEntries(
    entries: WonderAcademySmokeConsoleEntry[],
  ): WonderAcademySmokeConsoleEntry[];
}
