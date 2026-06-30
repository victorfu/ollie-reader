export const WONDER_ACADEMY_GUEST_SAVE_KEY = "wonder-academy-game-v3-guest";

export function buildWonderAcademyGuestSave({
  playerName = "QA",
  level = 9,
  equippedMoveIds = ["tiny-flash"],
  stardust = 100,
  snacks = { "starberry-cookie": 2 },
} = {}) {
  return {
    schemaVersion: 2,
    updatedAt: Date.now(),
    data: {
      playerName,
      team: [{
        ownedId: "owned-lumi",
        speciesId: "lumi",
        nickname: "Lumi",
        level,
        xp: 0,
        bond: 0,
        stage: 0,
        equippedMoveIds,
      }],
      dex: { lumi: "caught" },
      stardust,
      snacks,
      customCreatures: [],
      wardensDefeated: [],
      clearedNodes: ["sparkleaf:entry"],
      shinyDex: [],
      dexRewardsClaimed: [],
      lastDailyReward: null,
      daily: null,
      audioSettings: { musicVolume: 0.45, sfxVolume: 0.65, muted: true },
    },
  };
}

export function buildMalformedLoadoutGuestSave() {
  return buildWonderAcademyGuestSave({
    equippedMoveIds: ["bubble-pat"],
  });
}

export function isKnownBenignWonderAcademyConsoleEntry(entry) {
  const text = entry?.text ?? "";
  return text.includes("content-firebaseappcheck.googleapis.com")
    || text.includes("App Check")
    || (
      text.includes("Failed to load resource")
      && text.includes("403")
    );
}

export function relevantWonderAcademyConsoleEntries(entries) {
  return entries.filter((entry) => !isKnownBenignWonderAcademyConsoleEntry(entry));
}
