export const WONDER_ACADEMY_GUEST_SAVE_KEY = "wonder-academy-game-v3-guest";

export const WONDER_ACADEMY_SMOKE_CHECKS = Object.freeze([
  "legacy route redirects",
  "guest title loads",
  "new game reaches hub",
  "region map opens",
  "node map opens",
  "explore canvas renders",
  "battle opens from grass",
  "catch flow reaches result",
  "chest loot message appears",
  "Warden battle opens",
  "reload preserves guest hub",
  "mobile touch flow opens hub surfaces",
  "keyboard flow reaches starter selection",
  "guest hub loads",
  "malformed skills loadout repairs",
  "skill equip updates",
  "Wonderdex opens",
  "shop opens",
  "expanded regions are listed",
  "workshop opens and charm toggles",
  "postgame trial opens",
  "audio controls adjust volume",
  "reduced motion starter flow renders",
  "no relevant console or page errors",
]);

export function buildWonderAcademyGuestSave({
  playerName = "QA",
  level = 9,
  equippedMoveIds = ["tiny-flash"],
  stardust = 100,
  snacks = { "starberry-cookie": 2 },
  clearedNodes = ["sparkleaf:entry"],
  wardensDefeated = [],
  materials = {},
  charms = {},
  activeCharms = [],
  trialWins = {},
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
      wardensDefeated,
      clearedNodes,
      shinyDex: [],
      dexRewardsClaimed: [],
      materials,
      charms,
      activeCharms,
      trialWins,
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

export function buildPostgameReadyGuestSave() {
  return buildWonderAcademyGuestSave({
    playerName: "Postgame QA",
    level: 80,
    equippedMoveIds: ["tiny-flash", "zip-spark", "wink-feint", "starstep-dash"],
    stardust: 300,
    snacks: {
      "starberry-cookie": 8,
      "clover-macaron": 8,
      "moon-milk-puff": 8,
      "warm-cocoa-gem": 8,
    },
    clearedNodes: [
      "sparkleaf:entry",
      "sparkleaf:meadow",
      "sparkleaf:grove",
      "tideglass:entry",
      "tideglass:lagoon",
      "tideglass:reef",
      "clocktower:entry",
      "clocktower:stair",
      "clocktower:attic",
      "sugarcloud:entry",
      "sugarcloud:bakery",
      "sugarcloud:stage",
      "snowbell:entry",
      "snowbell:drift",
      "snowbell:ridge",
      "dreamcloud:entry",
      "dreamcloud:lullaby",
      "dreamcloud:mirror-cloud",
      "starrail:entry",
      "starrail:dome",
      "starrail:comet-ring",
      "crystalbell:entry",
      "crystalbell:resonance-hall",
      "crystalbell:mirror-lake",
    ],
    wardensDefeated: [
      "sparkleaf",
      "tideglass",
      "clocktower",
      "sugarcloud",
      "snowbell",
      "dreamcloud",
      "starrail",
      "crystalbell",
    ],
    materials: {
      "glow-petal": 3,
      "bell-shard": 1,
    },
    charms: {},
    activeCharms: [],
    trialWins: {},
  });
}

export function buildWardenReadyGuestSave() {
  return buildWonderAcademyGuestSave({
    level: 50,
    equippedMoveIds: ["tiny-flash", "zip-spark", "wink-feint", "starstep-dash"],
    stardust: 250,
    snacks: {
      "starberry-cookie": 5,
      "clover-macaron": 5,
    },
    clearedNodes: ["sparkleaf:entry", "sparkleaf:meadow", "sparkleaf:grove"],
  });
}

export function isKnownBenignWonderAcademyConsoleEntry(entry) {
  const text = entry?.text ?? "";
  return text.includes("content-firebaseappcheck.googleapis.com")
    || text.includes("App Check")
    || (
      entry?.type === "warning"
      && text.includes("GL Driver Message")
      && text.includes("ReadPixels")
    )
    || (
      entry?.type === "warning"
      && text.includes("KAPLAY already initialized")
      && text.includes("kaplay() multiple times")
    )
    || (
      text.includes("Framing 'https://www.google.com/' violates")
      && text.includes("report-only Content Security Policy")
    )
    || (
      text.includes("Failed to load resource")
      && text.includes("403")
    );
}

export function relevantWonderAcademyConsoleEntries(entries) {
  return entries.filter((entry) => !isKnownBenignWonderAcademyConsoleEntry(entry));
}
