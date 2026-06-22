import type {
  WonderAcademyChapter,
  WonderAcademyMapNode,
  WonderAcademyObjective,
  WonderAcademyProgressPointer,
  WonderlingSpecies,
} from "../types/wonderAcademy";

const starterAsset = (name: string) =>
  `src/assets/games/wonder-academy/starters/${name}.png`;

export const WONDER_ACADEMY_STARTERS: WonderlingSpecies[] = [
  {
    speciesId: "lumi",
    speciesName: "Lumi",
    category: "星光小狐",
    rarity: "common",
    elements: ["light", "spark"],
    roles: ["striker", "trickster"],
    regionIds: ["wonder-academy"],
    favoriteSnack: "starberry-cookie",
    personality: "聰明、急性子、很想證明自己",
    fieldSkillId: "light-trail",
    learnableSkillIds: [
      "tiny-flash",
      "zip-spark",
      "wink-feint",
      "starstep-dash",
      "aurora-parade",
    ],
    attuneCondition: "Starter choice",
    growthStages: ["Lumi", "Lumi Tailglow", "Lumi Prismtail", "Lumi Aurorafox"],
    artPrompt: "cozy painterly cute starlight fox companion, warm academy RPG, original character",
    silhouetteAsset: starterAsset("lumi-silhouette"),
    portraitAsset: starterAsset("lumi-portrait"),
    spriteAsset: starterAsset("lumi-sprite"),
  },
  {
    speciesId: "momo",
    speciesName: "Momo",
    category: "雲朵小貓",
    rarity: "common",
    elements: ["dream", "tide"],
    roles: ["healer", "guardian"],
    regionIds: ["wonder-academy"],
    favoriteSnack: "moon-milk-puff",
    personality: "愛睡、溫柔、慢半拍，但關鍵時刻很可靠",
    fieldSkillId: "soft-float",
    learnableSkillIds: [
      "bubble-pat",
      "cozy-shield",
      "nap-song",
      "moon-drizzle",
      "dreamcloud-haven",
    ],
    attuneCondition: "Starter choice",
    growthStages: ["Momo", "Momo Rainpuff", "Momo Mooncloud", "Momo Dreamnimbus"],
    artPrompt: "cozy painterly cute cloud kitten companion, warm academy RPG, original character",
    silhouetteAsset: starterAsset("momo-silhouette"),
    portraitAsset: starterAsset("momo-portrait"),
    spriteAsset: starterAsset("momo-sprite"),
  },
  {
    speciesId: "pico",
    speciesName: "Pico",
    category: "星塵小妖精",
    rarity: "common",
    elements: ["star", "leaf"],
    roles: ["trickster", "healer", "scout"],
    regionIds: ["wonder-academy"],
    favoriteSnack: "clover-macaron",
    personality: "好奇、愛惡作劇、很會發現秘密",
    fieldSkillId: "secret-sense",
    learnableSkillIds: [
      "leaf-wink",
      "stardust-peek",
      "clover-patch",
      "secret-signal",
      "wishbloom-spiral",
    ],
    attuneCondition: "Starter choice",
    growthStages: ["Pico", "Pico Budspark", "Pico Wishpetal", "Pico Celestibloom"],
    artPrompt: "cozy painterly cute stardust fairy companion, warm academy RPG, original character",
    silhouetteAsset: starterAsset("pico-silhouette"),
    portraitAsset: starterAsset("pico-portrait"),
    spriteAsset: starterAsset("pico-sprite"),
  },
  {
    speciesId: "nibi",
    speciesName: "Nibi",
    category: "迷你小龍",
    rarity: "common",
    elements: ["ember", "crystal"],
    roles: ["guardian", "striker"],
    regionIds: ["wonder-academy"],
    favoriteSnack: "warm-cocoa-gem",
    personality: "勇敢、逞強，其實怕寂寞",
    fieldSkillId: "crystal-push",
    learnableSkillIds: [
      "warm-puff",
      "crystal-brace",
      "brave-bump",
      "hearth-guard",
      "hearth-crystal-roar",
    ],
    attuneCondition: "Starter choice",
    growthStages: ["Nibi", "Nibi Pebblehorn", "Nibi Embercrest", "Nibi Hearthdrake"],
    artPrompt: "cozy painterly cute mini dragon companion, warm academy RPG, original character",
    silhouetteAsset: starterAsset("nibi-silhouette"),
    portraitAsset: starterAsset("nibi-portrait"),
    spriteAsset: starterAsset("nibi-sprite"),
  },
];

const objective = (
  id: string,
  label: string,
  description: string,
  targetNodeId: string,
): WonderAcademyObjective => ({
  id,
  label,
  description,
  targetChapterId: "sparkleaf-grove",
  targetNodeId,
});

export const WONDER_ACADEMY_CHAPTERS: WonderAcademyChapter[] = [
  {
    id: "sparkleaf-grove",
    title: "Chapter 1: Sparkleaf Grove",
    tone: "發光森林、第一次 Attune、害怕改變",
    wardenSpeciesId: "sparkleaf-fawn",
    nodes: [
      {
        id: "academy-gate",
        label: "Academy Gate",
        kind: "story",
        x: 0.16,
        y: 0.62,
        adjacentNodeIds: ["firefly-clearing"],
        objective: objective(
          "go-firefly-clearing",
          "前往 Firefly Clearing",
          "從 Academy Gate 出發，沿著發光葉子找到第一個森林節點。",
          "firefly-clearing",
        ),
      },
      {
        id: "firefly-clearing",
        label: "Firefly Clearing",
        kind: "encounter",
        x: 0.32,
        y: 0.42,
        adjacentNodeIds: ["academy-gate", "mossy-bridge", "hidden-burrow"],
        objective: objective(
          "comfort-mossmew",
          "安撫迷路的 Mossmew",
          "完成第一場 Mood Trial，讓 Mossmew 願意靠近。",
          "firefly-clearing",
        ),
      },
      {
        id: "mossy-bridge",
        label: "Mossy Bridge",
        kind: "quest",
        x: 0.48,
        y: 0.58,
        adjacentNodeIds: ["firefly-clearing", "snack-stump"],
        objective: objective(
          "repair-mossy-bridge",
          "找出橋上的發光藤蔓",
          "使用 starter field skill，清出通往森林深處的路。",
          "mossy-bridge",
        ),
      },
      {
        id: "hidden-burrow",
        label: "Hidden Burrow",
        kind: "encounter",
        x: 0.52,
        y: 0.28,
        adjacentNodeIds: ["firefly-clearing"],
        lockedBy: {
          kind: "fieldSkill",
          value: "secret-sense",
          hint: "需要能發現秘密入口的 field skill，或稍後取得 Wonderdex clue。",
        },
        objective: objective(
          "inspect-hidden-burrow",
          "調查 Hidden Burrow",
          "這是可選支線。現在可先完成主線節點。",
          "hidden-burrow",
        ),
      },
      {
        id: "snack-stump",
        label: "Snack Stump",
        kind: "rest",
        x: 0.64,
        y: 0.46,
        adjacentNodeIds: ["mossy-bridge", "sparkleaf-warden"],
        objective: objective(
          "prepare-berry-snack",
          "準備 Berry Snack",
          "在挑戰 Warden 前，恢復 Team Mood 並學會 snack 的用途。",
          "snack-stump",
        ),
      },
      {
        id: "sparkleaf-warden",
        label: "Sparkleaf Warden",
        kind: "warden",
        x: 0.82,
        y: 0.34,
        adjacentNodeIds: ["snack-stump"],
        objective: objective(
          "attune-sparkleaf-fawn",
          "完成 Sparkleaf Fawn 的 Warden Trial",
          "用理解與 Attune 找回第一段 Bell Tone。",
          "sparkleaf-warden",
        ),
      },
    ],
  },
];

const SPARKLEAF_GROVE_COMPLETE_OBJECTIVE: WonderAcademyObjective = {
  id: "return-academy-hub",
  label: "返回 Academy Hub",
  description: "Sparkleaf Grove 的 Bell Tone 已找回，回到 Wonder Academy 準備下一段旅程。",
  targetChapterId: "sparkleaf-grove",
  targetNodeId: "academy-gate",
};

const SPARKLEAF_MAIN_PATH_NODE_IDS = [
  "academy-gate",
  "firefly-clearing",
  "mossy-bridge",
  "snack-stump",
  "sparkleaf-warden",
];

export function getStarterById(speciesId: string): WonderlingSpecies | null {
  return WONDER_ACADEMY_STARTERS.find((starter) => starter.speciesId === speciesId) ?? null;
}

export function getChapterById(chapterId: string): WonderAcademyChapter | null {
  return WONDER_ACADEMY_CHAPTERS.find((chapter) => chapter.id === chapterId) ?? null;
}

export function getNodeById(chapterId: string, nodeId: string): WonderAcademyMapNode | null {
  return getChapterById(chapterId)?.nodes.find((node) => node.id === nodeId) ?? null;
}

export function getCurrentObjective(pointer: WonderAcademyProgressPointer): WonderAcademyObjective {
  const chapter = getChapterById(pointer.currentChapterId) ?? WONDER_ACADEMY_CHAPTERS[0];
  const node = chapter.nodes.find((item) => item.id === pointer.currentNodeId) ?? chapter.nodes[0];

  if (pointer.completedNodeIds.includes(node.id)) {
    if (node.kind === "warden") {
      return SPARKLEAF_GROVE_COMPLETE_OBJECTIVE;
    }

    const currentMainPathIndex = SPARKLEAF_MAIN_PATH_NODE_IDS.indexOf(node.id);
    const resumePathIndex =
      currentMainPathIndex >= 0
        ? currentMainPathIndex
        : SPARKLEAF_MAIN_PATH_NODE_IDS.findIndex((nodeId) =>
            node.adjacentNodeIds.includes(nodeId),
          );
    const searchStartIndex = resumePathIndex >= 0 ? resumePathIndex : 0;
    const nextMainPathNodeId = SPARKLEAF_MAIN_PATH_NODE_IDS.slice(searchStartIndex).find(
      (nodeId) => !pointer.completedNodeIds.includes(nodeId),
    );
    const nextNode = nextMainPathNodeId ? getNodeById(chapter.id, nextMainPathNodeId) : null;

    return nextNode?.objective ?? SPARKLEAF_GROVE_COMPLETE_OBJECTIVE;
  }

  return node.objective;
}
