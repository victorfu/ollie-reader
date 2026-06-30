import academyHubUrl from "../../../assets/games/wonder-academy/backgrounds/academy-hub.png";
import { ArrowLeft, Compass, Gift, Lock, MapPin, Plus, RotateCcw, ShoppingBag, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import type { WonderAcademyAudioSettings } from "../../../types/wonderAcademy";
import {
  createWonderAcademyAudio,
  defaultWonderAcademyAudioSettings,
  selectWonderAcademyLoop,
  wonderAcademyLoopIds,
  type WonderAcademyAudioManager,
} from "./wonderAcademyAudio";
import { getMoveById } from "../../../data/wonderAcademyMoves";
import { isSleepy } from "./logic/battleLogic";
import {
  playerAttack,
  playerCatch,
  playerFlee,
  playerSwitch,
  startBattle,
  type BattleSession,
} from "./logic/battleSession";
import { gainBond } from "./logic/bond";
import { effectivenessBadge } from "./logic/battleText";
import { chooseCatchSnack } from "./logic/catchSnacks";
import {
  bumpDaily,
  claimTask,
  DAILY_TASKS,
  rolloverDaily,
  type DailyTaskId,
} from "./logic/dailyTasks";
import { teamFieldPerks } from "./logic/fieldSkills";
import { rollEncounter, type EncounterTable } from "./logic/encounter";
import { canEvolve, evolve } from "./logic/evolution";
import { rollLoot, type LootTable } from "./logic/loot";
import {
  equipMoveForCreature,
  unequipMoveForCreature,
} from "./logic/moveLoadout";
import { gainXp } from "./logic/progression";
import { getEffectivenessAgainst } from "./logic/typeChart";
import { dexCompletion, recordDex } from "./logic/wonderdex";
import {
  allSpecies,
  catchableSpecies,
  defaultEquipped,
  ELEMENT_META,
  FIELD_SKILLS,
  fieldSkillForElements,
  learnablePool,
  makeCustomCreature,
  moveUnlockLevel,
  registerCustomCreatures,
  rollShiny,
  SHINY_FILTER,
  speciesById,
  starterSnackBundle,
  STARTER_SPECIES,
  toCombatant,
  toWarden,
  toWild,
  type CreatureSpecies,
  type OwnedCreature,
} from "./wonderAcademyCreatures";
import ExploreSceneKaplay from "./ExploreSceneKaplay";
import BattleStageKaplay from "./BattleStageKaplay";
import { findStart, tileAt, type SceneState } from "./sceneMap";
import {
  FIRST_REGION,
  isNodeUnlocked,
  isRegionUnlocked,
  nodeUnlockHint,
  nodeKey,
  REGIONS,
  regionById,
} from "./wonderAcademyRegions";
import {
  checkpointWonderAcademyProgress,
  loadWonderAcademySave,
  localOnlyWonderAcademyCloudAdapter,
  saveWonderAcademyProgress,
  syncWonderAcademyPendingSave,
  type WonderAcademyProgressData,
  type WonderAcademySaveStatus,
} from "./wonderAcademyPersistence";
import {
  getWonderAcademyEntryCopy,
  shouldConfirmWonderAcademyOverwrite,
} from "./wonderAcademySessionGuards";

type Screen =
  | "title"
  | "arrival"
  | "select"
  | "confirm"
  | "hub"
  | "regions"
  | "nodeMap"
  | "scene"
  | "battle"
  | "result"
  | "evolve"
  | "dex"
  | "builder"
  | "skills"
  | "shop";

const SNACK_NAMES: Record<string, string> = {
  "starberry-cookie": "星莓餅乾",
  "moon-milk-puff": "月乳泡芙",
  "clover-macaron": "三葉草馬卡龍",
  "warm-cocoa-gem": "暖可可寶石",
};
const SNACK_POOL = Object.keys(SNACK_NAMES);
const SNACK_PRICE = 12;

type ResultInfo = {
  kind: BattleSession["outcome"] | "treasure";
  speciesId?: string;
  lines: string[];
};

type EvolutionInfo = { display: string; after: string; portrait: string };

type Persisted = WonderAcademyProgressData;

/** Wonderdex collection milestones (by number of species caught). */
const DEX_REWARDS = [
  { caught: 3, stardust: 25, snack: "starberry-cookie", qty: 2 },
  { caught: 5, stardust: 45, snack: "moon-milk-puff", qty: 2 },
  { caught: 8, stardust: 75, snack: "warm-cocoa-gem", qty: 3 },
  { caught: 12, stardust: 120, snack: "clover-macaron", qty: 4 },
];

/** Catch-celebration confetti — a deterministic burst (no per-render randomness). */
const CATCH_CONFETTI = Array.from({ length: 16 }, (_, i) => {
  const ang = (i / 16) * Math.PI * 2 + (i % 3) * 0.35;
  const dist = 72 + (i % 4) * 18;
  const colors = ["#ffd66b", "#ff9ec4", "#9be7ff", "#b6f0a8", "#c9b1f0", "#fff3b0"];
  return {
    tx: Math.round(Math.cos(ang) * dist),
    ty: Math.round(Math.sin(ang) * dist),
    rot: (i % 2 ? 1 : -1) * (160 + (i % 5) * 55),
    color: colors[i % colors.length],
    size: 7 + (i % 3) * 3,
    delay: (i % 6) * 0.035,
    round: i % 2 === 0,
  };
});

type GameState = Persisted & {
  ready: boolean;
  screen: Screen;
  pendingStarterId: string | null;
  scene: SceneState | null;
  sceneActive: boolean;
  activeRegionId: string | null;
  isWarden: boolean;
  skillsOwnedId: string | null;
  battle: BattleSession | null;
  result: ResultInfo | null;
  pendingEvolution: EvolutionInfo | null;
};

type Action =
  | { type: "load"; state: Persisted | null }
  | { type: "beginNewGame" }
  | { type: "resetNewGame" }
  | { type: "toggleMute" }
  | { type: "setName"; name: string }
  | { type: "arriveNext" }
  | { type: "pickStarter"; speciesId: string }
  | { type: "confirmStarter"; nickname: string }
  | { type: "openRegions" }
  | { type: "closeRegions" }
  | { type: "openNodeMap"; regionId: string }
  | { type: "closeNodeMap" }
  | { type: "enterNode"; nodeId: string }
  | { type: "claimDaily"; today: string; snackId: string }
  | { type: "claimDailyTask"; id: DailyTaskId; today: string }
  | { type: "sceneMove"; dx: number; dy: number; today: string }
  | { type: "sceneCloseMessage" }
  | { type: "battleMove"; moveId: string; today: string }
  | { type: "battleCatch"; today: string }
  | { type: "battleSwitch"; ownedId: string; today: string }
  | { type: "battleFlee" }
  | { type: "feed"; ownedId: string }
  | { type: "openSkills"; ownedId: string }
  | { type: "closeSkills" }
  | { type: "equipMove"; ownedId: string; moveId: string }
  | { type: "unequipMove"; ownedId: string; moveId: string }
  | { type: "openBuilder" }
  | { type: "addCustom"; creature: CreatureSpecies }
  | { type: "closeResult" }
  | { type: "finishEvolution" }
  | { type: "openDex" }
  | { type: "closeDex" }
  | { type: "claimDexReward"; caught: number }
  | { type: "openShop" }
  | { type: "closeShop" }
  | { type: "buySnack"; snackId: string };

const INITIAL: GameState = {
  ready: false,
  screen: "title",
  pendingStarterId: null,
  scene: null,
  sceneActive: false,
  activeRegionId: null,
  isWarden: false,
  skillsOwnedId: null,
  playerName: "",
  team: [],
  dex: {},
  stardust: 0,
  snacks: {},
  customCreatures: [],
  wardensDefeated: [],
  clearedNodes: [],
  shinyDex: [],
  dexRewardsClaimed: [],
  lastDailyReward: null,
  daily: null,
  audioSettings: defaultWonderAcademyAudioSettings,
  battle: null,
  result: null,
  pendingEvolution: null,
};

const random = (): number => Math.random();

const displayName = (owned: OwnedCreature): string => {
  if (owned.nickname) return owned.nickname;
  const sp = speciesById(owned.speciesId);
  return sp?.growthStages[owned.stage] ?? sp?.name ?? owned.speciesId;
};

const teamFieldSkillIds = (team: OwnedCreature[]): string[] => [
  ...new Set(
    team
      .map((owned) => speciesById(owned.speciesId)?.fieldSkillId)
      .filter((id): id is string => !!id),
  ),
];

function resolveOutcome(state: GameState, session: BattleSession): GameState {
  const activeOwnedId = session.active.ownedId;
  const wildSpeciesId = session.wild.speciesId;
  const wildName = speciesById(wildSpeciesId)?.name ?? "野生寵物";
  const lines: string[] = [];
  let team = state.team;
  let dex = state.dex;
  let stardust = state.stardust;
  let snacks = state.snacks;
  let shinyDex = state.shinyDex;
  let pendingEvolution: EvolutionInfo | null = null;

  const rewardSnack = () => {
    const pick = SNACK_POOL[Math.floor(random() * SNACK_POOL.length)];
    snacks = { ...snacks, [pick]: (snacks[pick] ?? 0) + 1 };
    lines.push(`撿到一個點心:${SNACK_NAMES[pick]}!🍪`);
  };

  const awardXp = (amount: number) => {
    team = team.map((o) => {
      if (o.ownedId !== activeOwnedId) return o;
      const res = gainXp(o.level, o.xp, amount);
      let owned: OwnedCreature = { ...o, level: res.level, xp: res.xp };
      if (res.levelsGained > 0) {
        lines.push(`${displayName(o)} 升到了 Lv.${res.level}!✨`);
      }
      const sp = speciesById(o.speciesId);
      const stages = sp?.growthStages.length ?? 1;
      if (sp && canEvolve(owned.stage, owned.level, stages)) {
        const nextStage = evolve(owned.stage, stages);
        dex = recordDex(dex, o.speciesId, "evolved");
        pendingEvolution = {
          display: displayName(o),
          after: sp.growthStages[nextStage],
          portrait: sp.portrait,
        };
        owned = { ...owned, stage: nextStage };
      }
      return owned;
    });
  };

  if (state.isWarden) {
    if (session.outcome === "won") {
      const regionId = state.activeRegionId;
      const reward = session.wild.level * 5;
      stardust += reward;
      const pick = SNACK_POOL[Math.floor(random() * SNACK_POOL.length)];
      snacks = { ...snacks, [pick]: (snacks[pick] ?? 0) + 2 };
      lines.push("🏆 你打敗了守關魔王!這片區域恢復了平靜!");
      lines.push(`✨ Stardust ×${reward} · 🍪 ${SNACK_NAMES[pick]} ×2`);
      const firstClear = !!regionId && !state.wardensDefeated.includes(regionId);
      const wardensDefeated = firstClear
        ? [...state.wardensDefeated, regionId]
        : state.wardensDefeated;
      if (firstClear) {
        const idx = REGIONS.findIndex((r) => r.id === regionId);
        const next = REGIONS[idx + 1];
        if (next) lines.push(`🔓 新區域解鎖:${next.name}!`);
      }
      awardXp(session.wild.level * 6);
      return {
        ...state,
        team,
        dex,
        stardust,
        snacks,
        wardensDefeated,
        isWarden: false,
        battle: null,
        pendingEvolution,
        result: { kind: "won", speciesId: wildSpeciesId, lines },
        screen: "result",
      };
    }
    lines.push(
      session.outcome === "lost"
        ? "魔王太強了…回去多練幾級、帶滿點心再來挑戰!"
        : "你暫時撤退了。",
    );
    return {
      ...state,
      team,
      dex,
      stardust,
      snacks,
      isWarden: false,
      battle: null,
      pendingEvolution,
      result: { kind: session.outcome, speciesId: wildSpeciesId, lines },
      screen: "result",
    };
  }

  if (session.outcome === "caught") {
    const shiny = !!session.wild.shiny;
    team = [
      ...team,
      {
        ownedId: `${wildSpeciesId}-${team.length}-${Math.floor(random() * 1e6)}`,
        speciesId: wildSpeciesId,
        nickname: "",
        level: session.wild.level,
        xp: 0,
        bond: 10,
        stage: 0,
        shiny,
      },
    ];
    dex = recordDex(dex, wildSpeciesId, "caught");
    stardust += 15;
    lines.push(`你和 ${wildName} 成為了朋友!🎉`);
    if (shiny) {
      lines.push("✨ 而且是閃閃發亮的稀有變體!");
      if (!shinyDex.includes(wildSpeciesId)) shinyDex = [...shinyDex, wildSpeciesId];
    }
    awardXp(session.wild.level * 4);
    rewardSnack();
  } else if (session.outcome === "won") {
    dex = recordDex(dex, wildSpeciesId, "seen");
    stardust += 5;
    lines.push(`${wildName} 累倒了,溜走了…`);
    awardXp(session.wild.level * 4);
    rewardSnack();
  } else if (session.outcome === "fled") {
    lines.push("你帶著夥伴安全撤退了。");
  } else {
    lines.push("你的夥伴都累倒了…回學院休息一下吧。");
  }

  return {
    ...state,
    team,
    dex,
    stardust,
    snacks,
    shinyDex,
    battle: null,
    pendingEvolution,
    result: { kind: session.outcome, speciesId: wildSpeciesId, lines },
    screen: "result",
  };
}

function afterBattle(state: GameState, next: BattleSession, today: string): GameState {
  if (next.outcome === "ongoing") return { ...state, battle: next };
  const resolved = resolveOutcome(state, next);
  // Daily quests: a catch or a win (incl. wardens) ticks its goal forward.
  if (next.outcome === "caught") return { ...resolved, daily: bumpDaily(resolved.daily, "catch", today) };
  if (next.outcome === "won") return { ...resolved, daily: bumpDaily(resolved.daily, "win", today) };
  return resolved;
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "load": {
      if (!action.state) return { ...INITIAL, ready: true, screen: "title" };
      return {
        ...INITIAL,
        ...action.state,
        ready: true,
        screen: action.state.team.length > 0 ? "hub" : "title",
      };
    }
    case "beginNewGame":
      return { ...state, screen: "arrival" };
    case "resetNewGame":
      return { ...INITIAL, ready: true, screen: "arrival" };
    case "toggleMute": {
      const audioSettings: WonderAcademyAudioSettings = {
        ...state.audioSettings,
        muted: !state.audioSettings.muted,
      };
      return { ...state, audioSettings };
    }
    case "setName":
      return { ...state, playerName: action.name };
    case "arriveNext":
      return { ...state, screen: "select" };
    case "pickStarter":
      return { ...state, pendingStarterId: action.speciesId, screen: "confirm" };
    case "confirmStarter": {
      const species = state.pendingStarterId
        ? speciesById(state.pendingStarterId)
        : undefined;
      if (!species) return state;
      return {
        ...state,
        team: [
          {
            ownedId: `${species.speciesId}-starter`,
            speciesId: species.speciesId,
            nickname: action.nickname.trim(),
            level: 5,
            xp: 0,
            bond: 20,
            stage: 0,
          },
        ],
        dex: recordDex(state.dex, species.speciesId, "caught"),
        snacks: starterSnackBundle(species),
        pendingStarterId: null,
        screen: "hub",
      };
    }
    case "openRegions":
      return state.team.length === 0 ? state : { ...state, screen: "regions" };
    case "closeRegions":
      return { ...state, screen: "hub" };
    case "openNodeMap": {
      if (state.team.length === 0) return state;
      const region = regionById(action.regionId);
      if (!region) return state;
      return { ...state, activeRegionId: region.id, screen: "nodeMap" };
    }
    case "closeNodeMap":
      return { ...state, screen: "regions" };
    case "enterNode": {
      if (state.team.length === 0) return state;
      const region = state.activeRegionId ? regionById(state.activeRegionId) : undefined;
      const node = region?.nodes.find((n) => n.id === action.nodeId);
      if (!region || !node) return state;
      const skillIds = teamFieldSkillIds(state.team);
      if (!isNodeUnlocked(node, region.id, state.clearedNodes, skillIds)) return state;
      if (node.kind === "warden") {
        if (state.wardensDefeated.includes(region.id)) return state;
        const warden = speciesById(region.wardenSpeciesId);
        if (!warden) return state;
        return {
          ...state,
          isWarden: true,
          battle: startBattle(state.team.map(toCombatant), toWarden(warden, region.wardenLevel)),
          result: null,
          screen: "battle",
        };
      }
      const key = nodeKey(region.id, node.id);
      return {
        ...state,
        clearedNodes: state.clearedNodes.includes(key) ? state.clearedNodes : [...state.clearedNodes, key],
        scene: { ...findStart(region.map), opened: [], message: null },
        sceneActive: true,
        screen: "scene",
      };
    }
    case "claimDaily": {
      if (state.lastDailyReward === action.today) return state;
      return {
        ...state,
        stardust: state.stardust + 20,
        snacks: { ...state.snacks, [action.snackId]: (state.snacks[action.snackId] ?? 0) + 1 },
        lastDailyReward: action.today,
      };
    }
    case "claimDailyTask": {
      const res = claimTask(state.daily, action.id, action.today);
      if (!res) return state;
      return { ...state, daily: res.progress, stardust: state.stardust + res.stardust };
    }
    case "sceneCloseMessage":
      return state.scene
        ? { ...state, scene: { ...state.scene, message: null } }
        : state;
    case "sceneMove": {
      if (!state.scene || state.team.length === 0) return state;
      const region = state.activeRegionId ? regionById(state.activeRegionId) : undefined;
      if (!region) return state;
      const perks = teamFieldPerks(
        state.team
          .map((o) => speciesById(o.speciesId)?.fieldSkillId)
          .filter((id): id is string => !!id),
      );
      const nx = state.scene.x + action.dx;
      const ny = state.scene.y + action.dy;
      const tile = tileAt(region.map, nx, ny);
      if (tile === null || tile === "T" || tile === "O") return state;
      const moved: SceneState = { ...state.scene, x: nx, y: ny, message: null };
      const cellId = `${nx},${ny}`;

      if (tile === "X") {
        return { ...state, scene: null, sceneActive: false, screen: "nodeMap" };
      }

      if (tile === "G" && random() < Math.min(0.85, 0.4 * perks.encounterMultiplier)) {
        const table: EncounterTable = {
          encounterChance: 1,
          entries: catchableSpecies().map((s) => ({
            speciesId: s.speciesId,
            weight: s.rarity === "common" ? 3 : 1 * perks.rareWeightBonus,
          })),
          minLevel: region.minLevel,
          maxLevel: region.maxLevel,
        };
        const enc = rollEncounter(table, random);
        const species = enc ? speciesById(enc.speciesId) : undefined;
        if (enc && species) {
          return {
            ...state,
            scene: moved,
            dex: recordDex(state.dex, enc.speciesId, "seen"),
            battle: startBattle(state.team.map(toCombatant), toWild(species, enc.level, rollShiny(random))),
            result: null,
            screen: "battle",
          };
        }
        return { ...state, scene: moved };
      }

      if (tile === "C" && !state.scene.opened.includes(cellId)) {
        const chestTable: LootTable = {
          rolls: 2 + perks.lootRollBonus,
          entries: [
            { itemId: "starberry-cookie", quantity: 1, weight: 2 },
            { itemId: "clover-macaron", quantity: 1, weight: 2 },
            { itemId: "moon-milk-puff", quantity: 1, weight: 2 },
            { itemId: "warm-cocoa-gem", quantity: 1, weight: 2 },
            { itemId: "stardust", quantity: 12, weight: 1 },
          ],
        };
        const loot = rollLoot(chestTable, random);
        let snacks = state.snacks;
        let stardust = state.stardust;
        const parts: string[] = [];
        for (const [item, qty] of Object.entries(loot)) {
          if (item === "stardust") {
            stardust += qty;
            parts.push(`✨ Stardust ×${qty}`);
          } else {
            snacks = { ...snacks, [item]: (snacks[item] ?? 0) + qty };
            parts.push(`🍪 ${SNACK_NAMES[item] ?? item} ×${qty}`);
          }
        }
        if (perks.chestStardustBonus > 0) {
          stardust += perks.chestStardustBonus;
          parts.push(`💎 Stardust ×${perks.chestStardustBonus}`);
        }
        const tierBonus = (region.lootTier - 1) * 8;
        if (tierBonus > 0) {
          stardust += tierBonus;
          parts.push(`✨ Stardust ×${tierBonus}`);
        }
        return {
          ...state,
          snacks,
          stardust,
          daily: bumpDaily(state.daily, "chest", action.today),
          scene: {
            ...moved,
            opened: [...state.scene.opened, cellId],
            message: `打開寶箱!獲得 ${parts.join(" · ")} 🎁`,
          },
        };
      }

      if (tile === "N") {
        if (!state.scene.opened.includes(cellId)) {
          const pick = SNACK_POOL[Math.floor(random() * SNACK_POOL.length)];
          const qty = 1 + perks.npcSnackBonus;
          return {
            ...state,
            snacks: { ...state.snacks, [pick]: (state.snacks[pick] ?? 0) + qty },
            scene: {
              ...moved,
              opened: [...state.scene.opened, cellId],
              message: `學長姐:「這個給你,路上會用到!」(獲得 ${SNACK_NAMES[pick]} 🍪 ×${qty})`,
            },
          };
        }
        return {
          ...state,
          scene: { ...moved, message: "學長姐:「森林深處住著更稀有的夥伴喔!」" },
        };
      }

      if (tile === "W") {
        if (state.wardensDefeated.includes(region.id)) {
          return {
            ...state,
            scene: { ...moved, message: "守護者:「謝謝你讓這片區域恢復了平靜。」🌟" },
          };
        }
        const warden = speciesById(region.wardenSpeciesId);
        if (!warden) return { ...state, scene: moved };
        return {
          ...state,
          scene: moved,
          isWarden: true,
          battle: startBattle(state.team.map(toCombatant), toWarden(warden, region.wardenLevel)),
          result: null,
          screen: "battle",
        };
      }

      return { ...state, scene: moved };
    }
    case "battleMove":
      return state.battle ? afterBattle(state, playerAttack(state.battle, action.moveId), action.today) : state;
    case "battleCatch": {
      if (!state.battle) return state;
      const fav = speciesById(state.battle.wild.speciesId)?.favoriteSnack;
      const choice = chooseCatchSnack(state.snacks, fav, SNACK_POOL);
      if (!choice) return state;
      return afterBattle(
        { ...state, snacks: choice.snacks },
        playerCatch(state.battle, choice.treatTier, choice.isFavorite, random),
        action.today,
      );
    }
    case "battleSwitch":
      return state.battle ? afterBattle(state, playerSwitch(state.battle, action.ownedId), action.today) : state;
    case "battleFlee":
      return state.battle ? resolveOutcome(state, playerFlee(state.battle)) : state;
    case "feed": {
      const owned = state.team.find((o) => o.ownedId === action.ownedId);
      if (!owned) return state;
      const fav = speciesById(owned.speciesId)?.favoriteSnack;
      const used =
        fav && (state.snacks[fav] ?? 0) > 0
          ? fav
          : Object.keys(state.snacks).find((k) => (state.snacks[k] ?? 0) > 0);
      if (!used) return state;
      const snacks = { ...state.snacks, [used]: (state.snacks[used] ?? 0) - 1 };
      const team = state.team.map((o) =>
        o.ownedId === owned.ownedId
          ? { ...o, bond: gainBond(o.bond, 10, used === fav) }
          : o,
      );
      return { ...state, snacks, team };
    }
    case "openSkills":
      return { ...state, skillsOwnedId: action.ownedId, screen: "skills" };
    case "closeSkills":
      return { ...state, skillsOwnedId: null, screen: "hub" };
    case "equipMove": {
      const team = state.team.map((o) => {
        if (o.ownedId !== action.ownedId) return o;
        return equipMoveForCreature(o, speciesById(o.speciesId), action.moveId);
      });
      return { ...state, team };
    }
    case "unequipMove": {
      const team = state.team.map((o) => {
        if (o.ownedId !== action.ownedId) return o;
        return unequipMoveForCreature(o, speciesById(o.speciesId), action.moveId);
      });
      return { ...state, team };
    }
    case "openBuilder":
      return { ...state, screen: "builder" };
    case "addCustom":
      return {
        ...state,
        customCreatures: [...state.customCreatures, action.creature],
        dex: recordDex(state.dex, action.creature.speciesId, "seen"),
        screen: "hub",
      };
    case "closeResult": {
      if (state.pendingEvolution) {
        return { ...state, result: null, screen: "evolve" };
      }
      return {
        ...state,
        result: null,
        screen: state.sceneActive ? "scene" : state.activeRegionId ? "nodeMap" : "hub",
      };
    }
    case "finishEvolution":
      return {
        ...state,
        pendingEvolution: null,
        screen: state.sceneActive ? "scene" : state.activeRegionId ? "nodeMap" : "hub",
      };
    case "openDex":
      return { ...state, screen: "dex" };
    case "closeDex":
      return { ...state, screen: "hub" };
    case "openShop":
      return { ...state, screen: "shop" };
    case "closeShop":
      return { ...state, screen: "hub" };
    case "buySnack": {
      if (state.stardust < SNACK_PRICE || !SNACK_NAMES[action.snackId]) return state;
      return {
        ...state,
        stardust: state.stardust - SNACK_PRICE,
        snacks: { ...state.snacks, [action.snackId]: (state.snacks[action.snackId] ?? 0) + 1 },
      };
    }
    case "claimDexReward": {
      const reward = DEX_REWARDS.find((r) => r.caught === action.caught);
      if (!reward || state.dexRewardsClaimed.includes(reward.caught)) return state;
      const caughtCount = dexCompletion(state.dex, allSpecies().map((c) => c.speciesId)).caught;
      if (caughtCount < reward.caught) return state;
      return {
        ...state,
        stardust: state.stardust + reward.stardust,
        snacks: { ...state.snacks, [reward.snack]: (state.snacks[reward.snack] ?? 0) + reward.qty },
        dexRewardsClaimed: [...state.dexRewardsClaimed, reward.caught],
      };
    }
    default:
      return state;
  }
}

// ---- small presentational pieces ----

function saveStatusLabel(status: WonderAcademySaveStatus, isGuest: boolean): string {
  if (isGuest && (status === "idle" || status === "saved")) return "本機保存";
  if (isGuest && status === "saving") return "保存中";

  switch (status) {
    case "loading":
      return "讀取中";
    case "saving":
      return "同步中";
    case "saved":
      return "已同步";
    case "pending":
      return "待同步";
    case "failed":
      return "同步失敗";
    case "idle":
    default:
      return "未保存";
  }
}

function saveStatusChip(status: WonderAcademySaveStatus): CSSProperties {
  const palette: Record<WonderAcademySaveStatus, { bg: string; border: string; color: string }> = {
    idle: { bg: "rgba(255,255,255,.58)", border: "rgba(60,40,90,.12)", color: "#8a83a3" },
    loading: { bg: "#eef5ff", border: "#b9d4ff", color: "#4270bc" },
    saving: { bg: "#eef5ff", border: "#b9d4ff", color: "#4270bc" },
    saved: { bg: "#eef9ee", border: "#b8ddb8", color: "#3b7b45" },
    pending: { bg: "#fff7e0", border: "#f0c869", color: "#9a6a10" },
    failed: { bg: "#ffecef", border: "#efb1bb", color: "#b64255" },
  };
  const c = palette[status];
  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 24,
    borderRadius: 999,
    padding: "2px 8px",
    border: `1px solid ${c.border}`,
    background: c.bg,
    color: c.color,
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
  };
}

function TypeBadge({ element }: { element: keyof typeof ELEMENT_META }) {
  const m = ELEMENT_META[element];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 999,
        color: m.fg,
        background: m.bg,
      }}
    >
      {m.emoji} {m.label}
    </span>
  );
}

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, Math.round((hp / maxHp) * 100));
  const color =
    pct > 50 ? "linear-gradient(90deg,#6fd07f,#42b86a)" : pct > 20 ? "linear-gradient(90deg,#ffcf5b,#f4a93a)" : "linear-gradient(90deg,#ff8a5b,#ef5b6e)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 999, background: "#e7e3ef", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color, transition: "width .35s" }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#8a83a3", minWidth: 28, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

function battleHeadline(session: BattleSession): string {
  const last = session.log[session.log.length - 1];
  const wildName = speciesById(session.wild.speciesId)?.name ?? "野生寵物";
  if (!last) return `野生的 ${wildName} 出現了!`;
  switch (last.kind) {
    case "playerMove":
      return last.effectiveness >= 2 ? "效果絕佳!⭐" : last.effectiveness <= 0.5 ? "效果不太好…" : `${session.active.name} 出招了!`;
    case "wildMove":
      return `${wildName} 反擊了!`;
    case "wildSleepy":
      return `${wildName} 想睡了 😴 — 趁現在遞點心!`;
    case "wildSlept":
      return `${wildName} 被搖籃曲哄睡了 💤 — 趁機收服!`;
    case "wildAsleep":
      return `${wildName} 呼呼…睡得正甜 💤`;
    case "switch":
      return `換 ${session.active.name} 上場!`;
    case "playerFainted":
      return `${session.active.name} 累倒了!`;
    case "catchAttempt":
      return last.caught ? "收服成功!🎉" : "差一點…牠掙脫了!";
    default:
      return `野生的 ${wildName}`;
  }
}

const PANEL_BG =
  "radial-gradient(120% 90% at 12% 0%, #fff7ec 0%, rgba(255,247,236,0) 55%), radial-gradient(120% 110% at 100% 0%, #efe7ff 0%, rgba(239,231,255,0) 50%), linear-gradient(180deg, #fbf6ff 0%, #f3eefe 60%, #efeafc 100%)";

function SkillsScreen({
  owned,
  onEquip,
  onUnequip,
  onClose,
}: {
  owned: OwnedCreature;
  onEquip: (moveId: string) => void;
  onUnequip: (moveId: string) => void;
  onClose: () => void;
}) {
  const sp = speciesById(owned.speciesId);
  if (!sp) return <div />;
  const equipped =
    owned.equippedMoveIds && owned.equippedMoveIds.length > 0
      ? owned.equippedMoveIds
      : defaultEquipped(sp);
  const pool = learnablePool(sp);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>技能</h1>
        <button onClick={onClose} style={btnGhost}><X size={16} /> 完成</button>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}>
        <img src={sp.portrait} alt={sp.name} style={{ width: 72, height: 72, objectFit: "contain" }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{owned.nickname || sp.growthStages[owned.stage] || sp.name}</div>
          <div style={{ fontSize: 12, color: "#8a83a3" }}>Lv.{owned.level} · 裝備 {equipped.length}/4</div>
        </div>
      </div>

      <div style={fieldLabel}>已裝備(點一下卸下)</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8, marginBottom: 18 }}>
        {equipped.map((id) => {
          const mv = getMoveById(id);
          if (!mv) return null;
          const m = ELEMENT_META[mv.element];
          return (
            <button key={id} onClick={() => onUnequip(id)} disabled={equipped.length <= 1} style={{ ...moveBtn, opacity: equipped.length <= 1 ? 0.6 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: m.fg }} />
                <span style={{ fontWeight: 800, fontSize: 13 }}>{mv.name}</span>
              </div>
              <div style={{ fontSize: 10, color: "#8a83a3", fontWeight: 700 }}>{mv.element} · 威力 {mv.power}</div>
            </button>
          );
        })}
      </div>

      <div style={fieldLabel}>可學招式</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8 }}>
        {pool.map((id, i) => {
          const mv = getMoveById(id);
          if (!mv) return null;
          const m = ELEMENT_META[mv.element];
          const isEquipped = equipped.includes(id);
          const unlockLv = moveUnlockLevel(i);
          const locked = owned.level < unlockLv;
          const canEquip = !isEquipped && !locked && equipped.length < 4;
          return (
            <button key={id} onClick={() => { if (canEquip) onEquip(id); }} disabled={!canEquip} style={{ ...moveBtn, opacity: locked ? 0.45 : isEquipped ? 0.5 : equipped.length >= 4 ? 0.6 : 1, cursor: canEquip ? "pointer" : "default" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: m.fg }} />
                <span style={{ fontWeight: 800, fontSize: 13 }}>{mv.name}</span>
              </div>
              <div style={{ fontSize: 10, color: "#8a83a3", fontWeight: 700 }}>
                {locked ? `🔒 Lv.${unlockLv} 解鎖` : isEquipped ? "✓ 已裝備" : `${mv.element} · 威力 ${mv.power}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StarterConfirm({
  species,
  onBack,
  onConfirm,
}: {
  species: CreatureSpecies;
  onBack: () => void;
  onConfirm: (nickname: string) => void;
}) {
  const [nickname, setNickname] = useState("");
  return (
    <div style={{ textAlign: "center", paddingTop: 18 }}>
      <style>{`@keyframes waRunIn{0%{opacity:0;transform:translateX(-110px) scale(.78)}62%{transform:translateX(9px) scale(1.06)}100%{opacity:1;transform:none}}@keyframes waHeartFloat{0%{opacity:0;transform:translateY(2px) scale(.6)}25%{opacity:1}100%{opacity:0;transform:translateY(-44px) scale(1.1)}}.wa-runin{animation:waRunIn .7s cubic-bezier(.2,.8,.2,1) both}.wa-heart{animation:waHeartFloat 2.2s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.wa-runin{animation:none}.wa-heart{display:none}}`}</style>
      <div style={{ letterSpacing: ".2em", fontSize: 11, fontWeight: 700, color: "#8a83a3", textTransform: "uppercase", marginBottom: 12 }}>序章 — 命定的夥伴</div>
      <div style={{ position: "relative", width: 160, margin: "0 auto 8px" }}>
        <img className="wa-runin" src={species.portrait} alt={species.name} style={{ width: 160, height: 160, objectFit: "contain", filter: "drop-shadow(0 10px 14px rgba(244,169,58,.3))" }} />
        <div className="wa-heart" style={{ position: "absolute", top: 6, right: 2, fontSize: 22 }}>💛</div>
        <div className="wa-heart" style={{ position: "absolute", top: 20, left: 2, fontSize: 16, animationDelay: ".7s" }}>💛</div>
        <div className="wa-heart" style={{ position: "absolute", bottom: 16, left: 10, fontSize: 18, animationDelay: "1.3s" }}>✨</div>
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px" }}><span style={{ color: "#f0922a" }}>{species.name}</span> 選擇了你!</h1>
      <p style={{ color: "#8a83a3", fontSize: 14, maxWidth: 360, margin: "0 auto 14px" }}>牠開心地跑向你 —— 從現在起,你們會一起走完整段冒險。</p>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
        {species.elements.map((e) => <TypeBadge key={e} element={e} />)}
      </div>
      <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={`幫牠取個暱稱?(預設 ${species.name})`} style={{ ...fieldInput, maxWidth: 300, margin: "0 auto 18px", textAlign: "center" }} />
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button onClick={onBack} style={btnGhost}>← 再想想</button>
        <button onClick={() => onConfirm(nickname)} style={ctaBtn}>和 {nickname.trim() || species.name} 一起出發 →</button>
      </div>
    </div>
  );
}

function CreatureBuilder({
  onSave,
  onCancel,
}: {
  onSave: (creature: CreatureSpecies) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [portrait, setPortrait] = useState("");
  const [elements, setElements] = useState<(keyof typeof ELEMENT_META)[]>([]);
  const [favoriteSnack, setFavoriteSnack] = useState(SNACK_POOL[0]);

  const toggleElement = (e: keyof typeof ELEMENT_META) =>
    setElements((cur) =>
      cur.includes(e)
        ? cur.filter((x) => x !== e)
        : cur.length < 2
          ? [...cur, e]
          : cur,
    );

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setPortrait(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  };

  const canSave =
    name.trim().length > 0 && portrait.length > 0 && elements.length > 0;
  const selectedFieldSkill = FIELD_SKILLS[fieldSkillForElements(elements)];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>建立寵物</h1>
        <button onClick={onCancel} style={btnGhost}><X size={16} /> 取消</button>
      </div>
      <p style={{ color: "#8a83a3", fontSize: 13, margin: "0 0 18px" }}>上傳一張圖、取名、選屬性 —— 就會多一隻能在森林裡遇到、收服的夥伴!</p>

      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 18, alignItems: "start" }}>
        <label style={{ ...cardStatic, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 140, cursor: "pointer", textAlign: "center", color: "#8a83a3" }}>
          {portrait ? (
            <img src={portrait} alt="預覽" style={{ width: 110, height: 110, objectFit: "contain" }} />
          ) : (
            <>
              <Upload size={22} />
              <span style={{ fontSize: 12, marginTop: 6 }}>上傳圖片</span>
            </>
          )}
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} style={{ display: "none" }} />
        </label>

        <div>
          <div style={fieldLabel}>名字</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如:咪咪" style={fieldInput} />

          <div style={{ ...fieldLabel, marginTop: 14 }}>屬性(選 1–2 個)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(Object.keys(ELEMENT_META) as (keyof typeof ELEMENT_META)[]).map((e) => {
              const m = ELEMENT_META[e];
              const on = elements.includes(e);
              return (
                <button key={e} onClick={() => toggleElement(e)} style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 999, cursor: "pointer", border: on ? `2px solid ${m.fg}` : "1px solid rgba(60,40,90,.15)", background: on ? m.bg : "#fff", color: m.fg }}>
                  {m.emoji} {m.label}
                </button>
              );
            })}
          </div>
          {elements.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#6a6585", background: "#fff", border: "1px solid rgba(60,40,90,.12)", borderRadius: 12, padding: "8px 10px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8a83a3", marginBottom: 3 }}>建立後探索能力</div>
              <div style={{ fontWeight: 800, color: "#33304a" }}>{selectedFieldSkill.emoji} {selectedFieldSkill.name}</div>
              <div>{selectedFieldSkill.desc}</div>
            </div>
          )}

          <div style={{ ...fieldLabel, marginTop: 14 }}>最愛點心</div>
          <select value={favoriteSnack} onChange={(e) => setFavoriteSnack(e.target.value)} style={fieldInput}>
            {SNACK_POOL.map((s) => (
              <option key={s} value={s}>{SNACK_NAMES[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
        <button
          disabled={!canSave}
          onClick={() => onSave(makeCustomCreature({ name, portrait, elements, favoriteSnack, seed: Math.floor(Date.now()) }))}
          style={{ ...ctaBtn, opacity: canSave ? 1 : 0.4, pointerEvents: canSave ? "auto" : "none" }}
        >
          ✨ 加入森林
        </button>
      </div>
    </div>
  );
}

type Props = { onExit?: () => void };

type SaveStatusSnapshot = {
  uid: string;
  status: WonderAcademySaveStatus;
};

export default function WonderAcademyGame({ onExit }: Props) {
  const { user, signInWithGoogle, authError } = useAuth();
  const isGuest = !user?.uid;
  const uid = user?.uid ?? "guest";
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [saveSnapshot, setSaveSnapshot] = useState<SaveStatusSnapshot>(() => ({
    uid,
    status: "loading",
  }));
  const [hasUnsyncedLocalProgress, setHasUnsyncedLocalProgress] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const loadedUidRef = useRef<string | null>(null);
  const latestSaveDataRef = useRef<Persisted | null>(null);
  const saveSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    loadedUidRef.current = null;

    void loadWonderAcademySave({
      uid,
      cloud: isGuest ? localOnlyWonderAcademyCloudAdapter : undefined,
    })
      .then((result) => {
        if (cancelled) return;
        dispatch({ type: "load", state: result.data });
        loadedUidRef.current = uid;
        setHasUnsyncedLocalProgress(!isGuest && result.hasUnsyncedLocalProgress);
        setSaveSnapshot({
          uid,
          status: isGuest && result.status === "idle" ? "saved" : result.status,
        });
      })
      .catch(() => {
        if (cancelled) return;
        dispatch({ type: "load", state: null });
        loadedUidRef.current = uid;
        setHasUnsyncedLocalProgress(false);
        setSaveSnapshot({ uid, status: "failed" });
      });

    return () => {
      cancelled = true;
    };
  }, [uid, isGuest]);

  // ---- audio ----
  const audioRef = useRef<WonderAcademyAudioManager | null>(null);
  const [dailyFlash, setDailyFlash] = useState<string | null>(null);
  const sfx = (id: Parameters<WonderAcademyAudioManager["playSfx"]>[0]) =>
    audioRef.current?.playSfx(id);
  const handleSignIn = () => {
    void signInWithGoogle().catch(() => {
      // Auth context exposes the localized error message.
    });
  };
  const startNewGame = () => {
    sfx("ui_select");
    dispatch({ type: "beginNewGame" });
  };
  const confirmResetNewGame = () => {
    sfx("ui_confirm");
    setResetConfirmOpen(false);
    dispatch({ type: "resetNewGame" });
  };

  useEffect(() => {
    audioRef.current = createWonderAcademyAudio({
      initialSettings: defaultWonderAcademyAudioSettings,
    });
    const audio = audioRef.current;
    return () => audio?.stopAll();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.setSettings(state.audioSettings);
    if (state.audioSettings.muted) {
      audio.stopAll();
      return;
    }
    const loop = selectWonderAcademyLoop({
      screen: state.screen,
      isWarden: state.isWarden,
    });
    for (const id of wonderAcademyLoopIds) {
      if (id !== loop) audio.stopLoop(id);
    }
    audio.startLoop(loop);
  }, [state.screen, state.isWarden, state.audioSettings]);

  useEffect(() => {
    if (!state.result) return;
    const k = state.result.kind;
    sfx(
      k === "caught"
        ? "attune_success"
        : k === "treasure"
          ? "wonderdex_update"
          : k === "won"
            ? "ui_confirm"
            : "ui_back",
    );
  }, [state.result]);

  useEffect(() => {
    if (state.screen === "evolve") sfx("attune_success");
  }, [state.screen]);

  useEffect(() => {
    if (!state.ready || loadedUidRef.current !== uid) return;
    const data: Persisted = {
      playerName: state.playerName,
      team: state.team,
      dex: state.dex,
      stardust: state.stardust,
      snacks: state.snacks,
      customCreatures: state.customCreatures,
      wardensDefeated: state.wardensDefeated,
      clearedNodes: state.clearedNodes,
      shinyDex: state.shinyDex,
      dexRewardsClaimed: state.dexRewardsClaimed,
      lastDailyReward: state.lastDailyReward,
      daily: state.daily,
      audioSettings: state.audioSettings,
    };
    latestSaveDataRef.current = data;
    const timer = window.setTimeout(() => {
      const seq = ++saveSeqRef.current;
      setSaveSnapshot({ uid, status: "saving" });
      void saveWonderAcademyProgress({
        uid,
        data,
        cloud: isGuest ? localOnlyWonderAcademyCloudAdapter : undefined,
      })
        .then((result) => {
          if (seq !== saveSeqRef.current) return;
          setHasUnsyncedLocalProgress(!isGuest && result.status === "pending");
          setSaveSnapshot({ uid, status: isGuest ? "saved" : result.status });
        })
        .catch(() => {
          if (seq !== saveSeqRef.current) return;
          setHasUnsyncedLocalProgress(!isGuest);
          setSaveSnapshot({ uid, status: "failed" });
        });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [uid, isGuest, state.ready, state.playerName, state.team, state.dex, state.stardust, state.snacks, state.customCreatures, state.wardensDefeated, state.clearedNodes, state.shinyDex, state.dexRewardsClaimed, state.lastDailyReward, state.daily, state.audioSettings]);

  useEffect(() => {
    if (!state.ready) return;
    let disposed = false;

    const syncPending = () => {
      if (isGuest || loadedUidRef.current !== uid) return;
      const seq = ++saveSeqRef.current;
      setSaveSnapshot({ uid, status: "saving" });
      void syncWonderAcademyPendingSave({ uid })
        .then((result) => {
          if (disposed || seq !== saveSeqRef.current || result.status === "idle") return;
          setHasUnsyncedLocalProgress(result.status === "pending");
          setSaveSnapshot({ uid, status: result.status });
        })
        .catch(() => {
          if (disposed || seq !== saveSeqRef.current) return;
          setHasUnsyncedLocalProgress(true);
          setSaveSnapshot({ uid, status: "failed" });
        });
    };

    const checkpoint = () => {
      if (loadedUidRef.current !== uid) return;
      const data = latestSaveDataRef.current;
      if (!data) return;
      checkpointWonderAcademyProgress({
        uid,
        data,
        queuePending: !isGuest,
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        checkpoint();
      } else {
        syncPending();
      }
    };

    window.addEventListener("online", syncPending);
    window.addEventListener("pagehide", checkpoint);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const retryTimer = window.setTimeout(syncPending, 0);

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.removeEventListener("online", syncPending);
      window.removeEventListener("pagehide", checkpoint);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [uid, isGuest, state.ready]);

  // Keep the runtime species registry in sync with the player's custom creatures.
  registerCustomCreatures(state.customCreatures);

  const completion = useMemo(
    () => dexCompletion(state.dex, allSpecies().map((c) => c.speciesId)),
    [state.dex],
  );
  const totalSnacks = useMemo(
    () => Object.values(state.snacks).reduce((a, b) => a + b, 0),
    [state.snacks],
  );
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }, []);
  const dailyClaimable = state.lastDailyReward !== today;
  const onClaimDaily = () => {
    const pick = SNACK_POOL[Math.floor(Math.random() * SNACK_POOL.length)];
    sfx("wonderdex_update");
    dispatch({ type: "claimDaily", today, snackId: pick });
    setDailyFlash(`✨ Stardust ×20 · 🍪 ${SNACK_NAMES[pick]} ×1`);
    window.setTimeout(() => setDailyFlash(null), 5000);
  };
  const effectiveSaveStatus: WonderAcademySaveStatus =
    saveSnapshot.uid === uid ? saveSnapshot.status : "loading";
  const saveLabel = saveStatusLabel(effectiveSaveStatus, isGuest);
  const entryCopy = getWonderAcademyEntryCopy({ isGuest });
  const showUnsyncedLocalNotice = !isGuest && hasUnsyncedLocalProgress;

  const frame = (children: ReactNode) => (
    <div style={{ minHeight: "100dvh", background: PANEL_BG, fontFamily: '-apple-system, "PingFang TC", "Noto Sans TC", sans-serif', color: "#33304a" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
        <button onClick={onExit} style={btnGhost}><ArrowLeft size={16} /> 離開</button>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em" }}>✦ Sparkleaf 星葉學院</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => dispatch({ type: "toggleMute" })} style={{ ...btnGhost, padding: 4 }} title={state.audioSettings.muted ? "開啟音效" : "靜音"}>
            {state.audioSettings.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <span aria-live="polite" style={saveStatusChip(effectiveSaveStatus)}>{saveLabel}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#8a83a3" }}>✨ {state.stardust}</span>
        </div>
      </header>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "4px 16px 40px" }}>{children}</div>
    </div>
  );

  if (!state.ready) return frame(<div style={{ textAlign: "center", padding: 60, color: "#8a83a3" }}>載入中…</div>);

  // ---------- TITLE ----------
  if (state.screen === "title") {
    return frame(
      <div style={{ textAlign: "center", paddingTop: 70 }}>
        <div style={{ fontSize: 56, marginBottom: 4 }}>✦</div>
        <h1 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 6px" }}>Wonder Academy</h1>
        <p style={{ color: "#8a83a3", fontSize: 15, margin: "0 0 28px" }}>在發光的森林裡,遇見、收服、養大你的夥伴。</p>
        {entryCopy.noticeTitle && entryCopy.noticeBody && (
          <div style={guestNoticeBox}>
            <div style={{ fontWeight: 900, color: "#5b3d00", marginBottom: 4 }}>{entryCopy.noticeTitle}</div>
            <div>{entryCopy.noticeBody}</div>
          </div>
        )}
        {authError && <div style={authErrorBox}>{authError}</div>}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={isGuest ? handleSignIn : startNewGame} style={ctaBtn}>{entryCopy.primaryLabel} →</button>
          {entryCopy.secondaryLabel && (
            <button onClick={startNewGame} style={btnOutline}>{entryCopy.secondaryLabel}</button>
          )}
        </div>
      </div>,
    );
  }

  // ---------- ARRIVAL (院長 welcome + name) ----------
  if (state.screen === "arrival") {
    return frame(
      <div style={{ borderRadius: 18, overflow: "hidden", boxShadow: "0 10px 30px rgba(80,50,130,.12)" }}>
        <div style={{ height: 196, position: "relative", background: "radial-gradient(70% 60% at 50% 25%, #fff0cf 0%, rgba(255,240,207,0) 60%), linear-gradient(180deg,#ffd9b8 0%, #f6c6d8 40%, #e9d4f3 75%, #dcd2f2 100%)" }}>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 66, background: "linear-gradient(180deg,#bfe3a8,#a6d493)", borderRadius: "50% 50% 0 0 / 22px" }} />
          <div style={{ position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)", fontSize: 34 }}>🎒</div>
          <div style={{ position: "absolute", top: 14, left: 14, fontSize: 10, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#fff", background: "rgba(124,95,192,.55)", padding: "4px 9px", borderRadius: 999 }}>序章 · 抵達學院</div>
        </div>
        <div style={{ background: "rgba(255,255,255,.8)", backdropFilter: "blur(14px)", padding: "16px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ flex: "0 0 auto", width: 60, height: 60, borderRadius: "50%", background: "radial-gradient(circle at 50% 40%,#e7d6ff,#b79be0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, border: "2px solid #fff", boxShadow: "0 6px 14px rgba(120,90,180,.25)" }}>🦉</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#7c5fc0", marginBottom: 4 }}>薇拉院長</div>
            <p style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 12px" }}>歡迎來到 <b>Sparkleaf 星葉學院</b>!這片發光森林裡,住著好多等著和你做朋友的小傢伙。在我們開始之前——你叫什麼名字?</p>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              <input value={state.playerName} onChange={(e) => dispatch({ type: "setName", name: e.target.value })} placeholder="輸入你的名字" style={{ flex: 1, minWidth: 150, fontSize: 15, padding: "10px 12px", borderRadius: 11, border: "1px solid rgba(60,40,90,.18)", background: "rgba(255,255,255,.85)", fontFamily: "inherit" }} />
              <button onClick={() => dispatch({ type: "arriveNext" })} style={{ ...ctaBtn, padding: "11px 20px", fontSize: 14 }}>這就是我 →</button>
            </div>
          </div>
        </div>
      </div>,
    );
  }

  // ---------- CONFIRM / BOND ----------
  if (state.screen === "confirm" && state.pendingStarterId) {
    const sp = speciesById(state.pendingStarterId);
    if (!sp) return frame(<div />);
    return frame(
      <StarterConfirm
        species={sp}
        onBack={() => dispatch({ type: "arriveNext" })}
        onConfirm={(nickname) => {
          sfx("attune_success");
          dispatch({ type: "confirmStarter", nickname });
        }}
      />,
    );
  }

  // ---------- STARTER SELECT ----------
  if (state.screen === "select") {
    return frame(
      <div>
        <div style={{ textAlign: "center", letterSpacing: ".2em", fontSize: 11, fontWeight: 700, color: "#8a83a3", textTransform: "uppercase", margin: "6px 0" }}>序章 — 命運的相遇</div>
        <h1 style={{ textAlign: "center", fontSize: 28, fontWeight: 800, margin: "0 0 6px" }}>選擇你的第一個夥伴</h1>
        <p style={{ textAlign: "center", color: "#8a83a3", fontSize: 14, maxWidth: 460, margin: "0 auto 22px" }}>牠會陪你走完整段冒險。看看牠的屬性、戰鬥定位、探索能力與進化線,再決定誰一起出發。</p>
        <style>{`@keyframes waPop{0%{opacity:0;transform:translateY(12px) scale(.94)}100%{opacity:1;transform:none}}.wa-starter{animation:waPop .42s cubic-bezier(.2,.8,.2,1) both}@media (prefers-reduced-motion: reduce){.wa-starter{animation:none}}`}</style>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
          {STARTER_SPECIES.map((s, i) => {
            const fs = s.fieldSkillId ? FIELD_SKILLS[s.fieldSkillId] : undefined;
            const finalForm = s.growthStages[s.growthStages.length - 1];
            return (
              <button key={s.speciesId} className="wa-starter" onClick={() => dispatch({ type: "pickStarter", speciesId: s.speciesId })} style={{ ...cardBtn, animationDelay: `${i * 0.08}s` }}>
                <img src={s.portrait} alt={s.name} style={{ width: 96, height: 96, objectFit: "contain", margin: "0 auto 8px", display: "block", filter: "drop-shadow(0 6px 8px rgba(0,0,0,.12))" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 18 }}>{s.name}</span>
                  {s.role && <span style={roleBadge}>{s.role}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#8a83a3", marginBottom: 8 }}>{s.category}</div>
                <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 }}>
                  {s.elements.map((e) => <TypeBadge key={e} element={e} />)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, minHeight: 32 }}>「{s.personality}」</div>
                {fs && (
                  <div style={{ fontSize: 11, marginTop: 6, padding: "5px 8px", borderRadius: 8, background: "#fff7e0", border: "1px solid #f0c869", color: "#8a6a12", textAlign: "left" }}>
                    {fs.emoji} <b>{fs.name}</b> · {fs.desc}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#8a83a3", marginTop: 6 }}>🌟 最終進化 <b style={{ color: "#6a52ff" }}>{finalForm}</b></div>
              </button>
            );
          })}
        </div>
      </div>,
    );
  }

  // ---------- NODE MAP ----------
  if (state.screen === "nodeMap") {
    const region = (state.activeRegionId ? regionById(state.activeRegionId) : FIRST_REGION) ?? FIRST_REGION;
    const wardenDone = state.wardensDefeated.includes(region.id);
    const skillIds = teamFieldSkillIds(state.team);
    const [br, bg, bb] = region.theme.bg;
    return frame(
      <div>
        <style>{`@keyframes waNodePulse{0%,100%{box-shadow:0 0 0 0 rgba(106,82,255,.5)}50%{box-shadow:0 0 0 7px rgba(106,82,255,0)}}@media (prefers-reduced-motion: reduce){.wa-node-live{animation:none!important}}`}</style>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{region.badge} {region.name}</h1>
          <button onClick={() => dispatch({ type: "closeNodeMap" })} style={btnGhost}><X size={16} /> 返回</button>
        </div>
        <p style={{ color: "#8a83a3", fontSize: 13, margin: "0 0 14px" }}>點亮著的地點出發探索;打敗 👑 守關魔王就能前往下一區。</p>
        <div style={{ position: "relative", width: "100%", height: 320, borderRadius: 18, overflow: "hidden", background: `radial-gradient(120% 90% at 30% 20%, rgba(255,255,255,.5), rgba(255,255,255,0) 55%), rgb(${br},${bg},${bb})`, border: "1px solid rgba(60,40,90,.1)", boxShadow: "0 6px 18px rgba(80,50,130,.12)" }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            {region.nodes.flatMap((n) =>
              n.requires.map((rid) => {
                const rn = region.nodes.find((m) => m.id === rid);
                if (!rn) return null;
                const active = state.clearedNodes.includes(nodeKey(region.id, rid));
                return <line key={`${rid}-${n.id}`} x1={rn.x * 100} y1={rn.y * 100} x2={n.x * 100} y2={n.y * 100} stroke={active ? "rgba(106,82,255,.55)" : "rgba(60,40,90,.22)"} strokeWidth={1.1} strokeDasharray={active ? undefined : "3 2"} />;
              }),
            )}
          </svg>
          {region.nodes.map((n) => {
            const unlocked = isNodeUnlocked(n, region.id, state.clearedNodes, skillIds);
            const cleared = n.kind === "warden" ? wardenDone : state.clearedNodes.includes(nodeKey(region.id, n.id));
            const isWardenNode = n.kind === "warden";
            const live = unlocked && !cleared;
            const unlockHint = nodeUnlockHint(n, region, state.clearedNodes, skillIds);
            const dotBg = !unlocked ? "#cdc6dd" : isWardenNode ? (cleared ? "#9ac0e0" : "#ef5b6e") : cleared ? "#5fbf7a" : "#7c6cff";
            const glyph = !unlocked ? "🔒" : isWardenNode ? (cleared ? "✨" : "👑") : cleared ? "✓" : "🐾";
            return (
              <button
                key={n.id}
                disabled={!unlocked || (isWardenNode && cleared)}
                className={live ? "wa-node-live" : undefined}
                onClick={() => { if (unlocked && !(isWardenNode && cleared)) { sfx("ui_confirm"); dispatch({ type: "enterNode", nodeId: n.id }); } }}
                style={{ position: "absolute", left: `${n.x * 100}%`, top: `${n.y * 100}%`, transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "transparent", border: "none", cursor: unlocked && !(isWardenNode && cleared) ? "pointer" : "default", padding: 0 }}
              >
                <span className={live ? "wa-node-live" : undefined} style={{ width: 38, height: 38, borderRadius: "50%", background: dotBg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, border: "2px solid #fff", boxShadow: "0 4px 10px rgba(60,40,90,.25)", animation: live ? "waNodePulse 1.8s ease-in-out infinite" : undefined }}>{glyph}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: unlocked ? "#33304a" : "#8a83a3", background: "rgba(255,255,255,.82)", borderRadius: 8, padding: "2px 7px", whiteSpace: "nowrap" }}>{n.label}</span>
                {unlockHint && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#6a6585", background: "rgba(255,255,255,.82)", borderRadius: 8, padding: "2px 6px", whiteSpace: "nowrap", boxShadow: "0 2px 6px rgba(60,40,90,.08)" }}>🔒 {unlockHint}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>,
    );
  }

  // ---------- EXPLORE SCENE ----------
  if (state.screen === "scene" && state.scene) {
    const region = (state.activeRegionId ? regionById(state.activeRegionId) : FIRST_REGION) ?? FIRST_REGION;
    return frame(
      <ExploreSceneKaplay
        scene={state.scene}
        map={region.map}
        theme={region.theme}
        wardenDone={state.wardensDefeated.includes(region.id)}
        onMove={(dx, dy) => dispatch({ type: "sceneMove", dx, dy, today })}
        onCloseMessage={() => dispatch({ type: "sceneCloseMessage" })}
      />,
    );
  }

  // ---------- HUB ----------
  if (state.screen === "hub") {
    const daily = rolloverDaily(state.daily, today);
    return frame(
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "8px 0 2px" }}>學院大廳</h1>
        <p style={{ color: "#8a83a3", fontSize: 14, margin: "0 0 18px" }}>圖鑑進度 {completion.caught}/{completion.total} 已收服 · {completion.seen} 已遇見 · 🍪 點心 ×{totalSnacks}</p>
        {isGuest && entryCopy.noticeTitle && entryCopy.noticeBody && (
          <div style={{ ...guestNoticeBox, margin: "0 0 16px", textAlign: "left", maxWidth: "none" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 240px" }}>
                <div style={{ fontWeight: 900, color: "#5b3d00", marginBottom: 3 }}>{entryCopy.noticeTitle}</div>
                <div>{entryCopy.noticeBody}</div>
              </div>
              <button onClick={handleSignIn} style={{ ...btnOutline, padding: "9px 13px", fontSize: 12 }}>登入同步</button>
            </div>
            {authError && <div style={{ ...authErrorBox, margin: "10px 0 0", textAlign: "left" }}>{authError}</div>}
          </div>
        )}
        {showUnsyncedLocalNotice && (
          <div style={unsyncedNoticeBox}>
            <div style={{ fontWeight: 900, color: "#5b3d00", marginBottom: 3 }}>
              此裝置有尚未同步的 Wonder Academy 進度
            </div>
            <div>我會自動同步到雲端。同步完成前,請先不要在其他裝置覆蓋這份進度。</div>
          </div>
        )}

        <style>{`@keyframes waBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}@media (prefers-reduced-motion: reduce){.wa-bob{animation:none!important}}`}</style>
        <div style={{ position: "relative", height: 152, borderRadius: 16, overflow: "hidden", marginBottom: 20, backgroundImage: `url(${academyHubUrl})`, backgroundSize: "cover", backgroundPosition: "center", boxShadow: "inset 0 -34px 44px rgba(0,0,0,.14), 0 6px 18px rgba(80,50,130,.1)" }}>
          {state.team.map((o, i) => {
            const sp = speciesById(o.speciesId);
            return (
              <img key={o.ownedId} className="wa-bob" src={sp?.portrait} alt={sp?.name} title={displayName(o)}
                style={{ position: "absolute", bottom: 8, left: `${8 + (i % 5) * 18}%`, width: 78, height: 78, objectFit: "contain", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.28))", animation: "waBob 2.8s ease-in-out infinite", animationDelay: `${(i % 5) * 0.4}s` }} />
            );
          })}
        </div>

        {dailyClaimable ? (
          <button onClick={onClaimDaily} style={dailyBtn}>
            <Gift size={18} /> 領取每日獎勵 <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>✨20 · 🍪×1</span>
          </button>
        ) : dailyFlash ? (
          <div style={dailyFlashBox}>
            <Gift size={16} /> 領到了!{dailyFlash}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: "#8a83a3", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <Gift size={14} /> 今日獎勵已領取,明天再來!
          </div>
        )}

        <div style={{ ...cardStatic, marginBottom: 20, padding: "12px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: "#8a83a3", textTransform: "uppercase", marginBottom: 10 }}>📋 今日任務</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {DAILY_TASKS.map((t) => {
              const count = Math.min(daily.counts[t.id], t.goal);
              const done = count >= t.goal;
              const claimed = daily.claimed.includes(t.id);
              const pct = Math.round((count / t.goal) * 100);
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                      <span style={{ color: claimed ? "#8a83a3" : "#33304a" }}>{claimed ? "✓ " : ""}{t.label}</span>
                      <span style={{ color: "#8a83a3", fontSize: 11, fontWeight: 700 }}>{count}/{t.goal}</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: "#ece8f4", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: done ? "linear-gradient(90deg,#6fd07f,#42b86a)" : "linear-gradient(90deg,#7c6cff,#6a52ff)", transition: "width .35s" }} />
                    </div>
                  </div>
                  <button
                    disabled={!done || claimed}
                    onClick={() => { if (done && !claimed) { sfx("wonderdex_update"); dispatch({ type: "claimDailyTask", id: t.id, today }); } }}
                    style={{ fontSize: 12, fontWeight: 800, padding: "7px 12px", borderRadius: 11, border: "1px solid", whiteSpace: "nowrap", cursor: done && !claimed ? "pointer" : "default", borderColor: claimed ? "#bfe3a3" : done ? "#f0c869" : "rgba(60,40,90,.15)", background: claimed ? "#eefbe9" : done ? "linear-gradient(180deg,#ffd66b,#f7b13a)" : "#fff", color: claimed ? "#42b86a" : done ? "#5b3d00" : "#8a83a3" }}
                  >
                    {claimed ? "✓ 已領" : done ? `🎁 ✨${t.stardust}` : `✨${t.stardust}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
          <button onClick={() => dispatch({ type: "openRegions" })} style={ctaBtn}><Compass size={18} /> 出發探索</button>
          <button onClick={() => dispatch({ type: "openDex" })} style={btnOutline}><Sparkles size={16} /> 圖鑑</button>
          <button onClick={() => dispatch({ type: "openShop" })} style={btnOutline}><ShoppingBag size={16} /> 商店</button>
          <button onClick={() => dispatch({ type: "openBuilder" })} style={btnOutline}><Plus size={16} /> 建立寵物</button>
          <button
            onClick={() => {
              if (shouldConfirmWonderAcademyOverwrite(state.team.length)) {
                setResetConfirmOpen(true);
              } else {
                dispatch({ type: "resetNewGame" });
              }
            }}
            style={dangerOutlineBtn}
          >
            <RotateCcw size={16} /> 重新開始
          </button>
        </div>
        {resetConfirmOpen && (
          <div role="dialog" aria-labelledby="wa-reset-title" style={resetConfirmBox}>
            <div id="wa-reset-title" style={{ fontSize: 15, fontWeight: 900, color: "#5f2030", marginBottom: 4 }}>確定要重新開始?</div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "#7a5160", margin: "0 0 12px" }}>
              目前的隊伍、星塵、圖鑑與地圖進度會被新的存檔覆蓋。這個動作會在下一次保存時同步。
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button onClick={() => setResetConfirmOpen(false)} style={{ ...btnOutline, padding: "9px 13px", fontSize: 12 }}>取消</button>
              <button onClick={confirmResetNewGame} style={dangerBtn}>清空並重新開始</button>
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".1em", color: "#8a83a3", textTransform: "uppercase", marginBottom: 10 }}>你的隊伍</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          {state.team.map((o) => {
            const sp = speciesById(o.speciesId);
            const hearts = Math.min(5, Math.round(o.bond / 20));
            return (
              <div key={o.ownedId} style={cardStatic}>
                <img src={sp?.portrait} alt={sp?.name} style={{ width: 64, height: 64, objectFit: "contain", margin: "0 auto 6px", display: "block", filter: o.shiny ? SHINY_FILTER : undefined }} />
                <div style={{ fontWeight: 800, textAlign: "center" }}>{o.shiny && "✨ "}{displayName(o)}</div>
                <div style={{ fontSize: 11, color: "#8a83a3", textAlign: "center", marginBottom: 6 }}>Lv.{o.level} · {sp?.category}</div>
                <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 6 }}>
                  {sp?.elements.map((e) => <TypeBadge key={e} element={e} />)}
                </div>
                <div style={{ textAlign: "center", fontSize: 12, marginBottom: 8 }} title={`羈絆 ${o.bond}/100`}>
                  {"💛".repeat(hearts)}
                  <span style={{ opacity: 0.3 }}>{"🤍".repeat(5 - hearts)}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => { sfx("snack_use"); dispatch({ type: "feed", ownedId: o.ownedId }); }}
                    disabled={totalSnacks === 0}
                    style={{ ...feedBtn, flex: 1, opacity: totalSnacks === 0 ? 0.4 : 1, cursor: totalSnacks === 0 ? "default" : "pointer" }}
                  >
                    🍪 餵
                  </button>
                  <button
                    onClick={() => dispatch({ type: "openSkills", ownedId: o.ownedId })}
                    style={{ ...feedBtn, flex: 1, color: "#6a52ff", background: "#efeaff", border: "1px solid #cdb6ef" }}
                  >
                    ✨ 技能
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>,
    );
  }

  // ---------- REGION SELECT ----------
  if (state.screen === "regions") {
    return frame(
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>選擇探索地點</h1>
          <button onClick={() => dispatch({ type: "closeRegions" })} style={btnGhost}><X size={16} /> 返回</button>
        </div>
        <p style={{ color: "#8a83a3", fontSize: 14, margin: "0 0 14px" }}>打敗一個區域的守關魔王,就能解鎖下一個更深的地方。</p>
        {(() => {
          const skillIds = teamFieldSkillIds(state.team);
          if (skillIds.length === 0) return null;
          return (
            <div style={{ ...cardStatic, marginBottom: 16, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: "#8a83a3", textTransform: "uppercase", marginBottom: 8 }}>隊伍探索能力</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {skillIds.map((id) => {
                  const f = FIELD_SKILLS[id];
                  if (!f) return null;
                  return (
                    <span key={id} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", border: "1px solid rgba(60,40,90,.12)", borderRadius: 999, padding: "4px 10px" }}>
                      <b>{f.emoji} {f.name}</b> <span style={{ color: "#8a83a3" }}>{f.desc}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })()}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
          {REGIONS.map((r, i) => {
            const unlocked = isRegionUnlocked(i, state.wardensDefeated);
            const cleared = state.wardensDefeated.includes(r.id);
            return (
              <button
                key={r.id}
                disabled={!unlocked}
                onClick={() => { if (unlocked) { sfx("ui_confirm"); dispatch({ type: "openNodeMap", regionId: r.id }); } }}
                style={{ ...cardBtn, textAlign: "left", cursor: unlocked ? "pointer" : "default", opacity: unlocked ? 1 : 0.6 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 30 }}>{r.badge}</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 17 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "#8a83a3" }}>{r.subtitle}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 5, color: cleared ? "#42b86a" : unlocked ? "#6a52ff" : "#8a83a3" }}>
                  {!unlocked ? (<><Lock size={14} /> 打敗前一區魔王解鎖</>) : cleared ? (<><MapPin size={14} /> 已平定 · 再次探索 →</>) : (<><Compass size={14} /> 出發探索 →</>)}
                </div>
              </button>
            );
          })}
        </div>
      </div>,
    );
  }

  // ---------- DEX ----------
  if (state.screen === "shop") {
    return frame(
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>🛍️ 點心商店</h1>
          <button onClick={() => dispatch({ type: "closeShop" })} style={btnGhost}><X size={16} /> 關閉</button>
        </div>
        <p style={{ color: "#8a83a3", fontSize: 14, margin: "0 0 18px" }}>用探險賺到的 ✨ Stardust 換點心 —— 帶夥伴最愛的點心收服更容易!目前有 ✨ {state.stardust}。</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
          {SNACK_POOL.map((id) => {
            const owned = state.snacks[id] ?? 0;
            const afford = state.stardust >= SNACK_PRICE;
            return (
              <div key={id} style={{ ...cardStatic, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>🍪 {SNACK_NAMES[id]}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#8a83a3" }}>持有 {owned}</span>
                </div>
                <button
                  disabled={!afford}
                  onClick={() => { sfx("snack_use"); dispatch({ type: "buySnack", snackId: id }); }}
                  style={{ ...feedBtn, color: afford ? "#5b3d00" : "#b9b3c7", background: afford ? "linear-gradient(180deg,#ffd66b,#f7b13a)" : "#f0eef6", border: afford ? "none" : "1px solid rgba(60,40,90,.12)", cursor: afford ? "pointer" : "default" }}
                >
                  ✨ {SNACK_PRICE} 購買
                </button>
              </div>
            );
          })}
        </div>
      </div>,
    );
  }

  if (state.screen === "dex") {
    return frame(
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Wonderdex</h1>
          <button onClick={() => dispatch({ type: "closeDex" })} style={btnGhost}><X size={16} /> 關閉</button>
        </div>
        <p style={{ color: "#8a83a3", fontSize: 14, margin: "0 0 14px" }}>已收服 {completion.caught} / {completion.total}{state.shinyDex.length > 0 && ` · ✨ ${state.shinyDex.length} 隻閃光`}</p>

        <div style={{ ...cardStatic, padding: "10px 14px", marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: "#8a83a3", textTransform: "uppercase", marginBottom: 8 }}>收集獎勵</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {DEX_REWARDS.map((r) => {
              const claimed = state.dexRewardsClaimed.includes(r.caught);
              const ready = completion.caught >= r.caught;
              return (
                <button
                  key={r.caught}
                  disabled={!ready || claimed}
                  onClick={() => { if (ready && !claimed) { sfx("wonderdex_update"); dispatch({ type: "claimDexReward", caught: r.caught }); } }}
                  style={{ fontSize: 12, fontWeight: 800, padding: "7px 11px", borderRadius: 11, border: "1px solid", cursor: ready && !claimed ? "pointer" : "default", borderColor: claimed ? "#bfe3a3" : ready ? "#f0c869" : "rgba(60,40,90,.15)", background: claimed ? "#eefbe9" : ready ? "#fff4d6" : "#fff", color: claimed ? "#42b86a" : ready ? "#8a6a12" : "#8a83a3" }}
                >
                  {claimed ? "✓ " : ready ? "🎁 " : "🔒 "}收集 {r.caught} 隻
                  <span style={{ fontWeight: 700, opacity: 0.85 }}> · ✨{r.stardust}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12 }}>
          {allSpecies().map((s) => {
            const status = state.dex[s.speciesId] ?? "unseen";
            const seen = status !== "unseen";
            const caught = status === "caught" || status === "evolved";
            const shinyCaught = state.shinyDex.includes(s.speciesId);
            return (
              <div key={s.speciesId} style={{ ...cardStatic, opacity: seen ? 1 : 0.55, textAlign: "center" }}>
                <img src={s.portrait} alt={seen ? s.name : "???"} style={{ width: 64, height: 64, objectFit: "contain", margin: "0 auto 6px", display: "block", filter: !caught ? "grayscale(1) brightness(.7)" : shinyCaught ? SHINY_FILTER : "none" }} />
                <div style={{ fontWeight: 800 }}>{shinyCaught && "✨ "}{seen ? s.name : "？？？"}</div>
                <div style={{ fontSize: 11, color: caught ? "#42b86a" : "#8a83a3", fontWeight: 700 }}>
                  {caught ? (shinyCaught ? "已收服 ✨閃光" : "已收服") : seen ? "已遇見" : "未發現"}
                </div>
              </div>
            );
          })}
        </div>
      </div>,
    );
  }

  // ---------- SKILLS ----------
  if (state.screen === "skills" && state.skillsOwnedId) {
    const owned = state.team.find((o) => o.ownedId === state.skillsOwnedId);
    if (!owned) return frame(<div />);
    return frame(
      <SkillsScreen
        owned={owned}
        onEquip={(moveId) => dispatch({ type: "equipMove", ownedId: owned.ownedId, moveId })}
        onUnequip={(moveId) => dispatch({ type: "unequipMove", ownedId: owned.ownedId, moveId })}
        onClose={() => dispatch({ type: "closeSkills" })}
      />,
    );
  }

  // ---------- BUILDER ----------
  if (state.screen === "builder") {
    return frame(
      <CreatureBuilder
        onCancel={() => dispatch({ type: "closeDex" })}
        onSave={(creature) => {
          sfx("ui_confirm");
          dispatch({ type: "addCustom", creature });
        }}
      />,
    );
  }

  // ---------- RESULT ----------
  if (state.screen === "result" && state.result) {
    const sp = state.result.speciesId ? speciesById(state.result.speciesId) : undefined;
    const caught = state.result.kind === "caught";
    const treasure = state.result.kind === "treasure";
    const justCaughtShiny = caught && !!state.team[state.team.length - 1]?.shiny;
    return frame(
      <div style={{ textAlign: "center", paddingTop: 24 }}>
        {caught && (
          <style>{`
            @keyframes waCatchPop{0%{transform:scale(.6)}55%{transform:scale(1.12)}100%{transform:scale(1)}}
            @keyframes waConfetti{0%{opacity:0;transform:translate(-50%,-50%) rotate(0) scale(.3)}12%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty))) rotate(var(--rot)) scale(1)}}
            .wa-catch-pop{animation:waCatchPop .6s cubic-bezier(.2,.8,.2,1) both}
            .wa-confetti{position:absolute;top:50%;left:50%;animation:waConfetti 1.15s ease-out forwards}
            @media (prefers-reduced-motion: reduce){.wa-catch-pop{animation:none}.wa-confetti{display:none}}
          `}</style>
        )}
        {treasure ? (
          <div style={{ fontSize: 96, margin: "0 0 8px", filter: "drop-shadow(0 8px 12px rgba(244,169,58,.35))" }}>🎁</div>
        ) : sp ? (
          <div style={{ position: "relative", width: 160, margin: "0 auto 10px" }}>
            {caught && CATCH_CONFETTI.map((p, i) => (
              <span key={i} className="wa-confetti" style={{ width: p.size, height: p.size, background: p.color, borderRadius: p.round ? "50%" : 2, animationDelay: `${p.delay}s`, "--tx": `${p.tx}px`, "--ty": `${p.ty}px`, "--rot": `${p.rot}deg` } as CSSProperties} />
            ))}
            <img className={caught ? "wa-catch-pop" : undefined} src={sp.portrait} alt={sp.name} style={{ position: "relative", zIndex: 1, width: 140, height: 140, objectFit: "contain", margin: "0 auto", display: "block", filter: justCaughtShiny ? SHINY_FILTER : caught ? "drop-shadow(0 8px 12px rgba(244,169,58,.35))" : "grayscale(.4)" }} />
          </div>
        ) : null}
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 14px" }}>{treasure ? "🎁 尋寶!" : caught ? "🎉 新夥伴!" : state.result.kind === "won" ? "戰鬥結束" : state.result.kind === "fled" ? "撤退" : "回去休息"}</h1>
        <div style={{ maxWidth: 380, margin: "0 auto 22px" }}>
          {state.result.lines.map((l, i) => (
            <p key={i} style={{ fontSize: 15, margin: "6px 0", color: "#33304a" }}>{l}</p>
          ))}
        </div>
        <button onClick={() => dispatch({ type: "closeResult" })} style={ctaBtn}>{state.sceneActive ? "回到森林 →" : state.activeRegionId ? "回到地圖 →" : "回到學院 →"}</button>
      </div>,
    );
  }

  // ---------- EVOLVE ----------
  if (state.screen === "evolve" && state.pendingEvolution) {
    const ev = state.pendingEvolution;
    return frame(
      <div style={{ textAlign: "center", paddingTop: 28 }}>
        <style>{`
          @keyframes waEvoGlow{0%,100%{opacity:.3;transform:scale(.9)}50%{opacity:.85;transform:scale(1.25)}}
          @keyframes waEvoPop{0%,100%{transform:scale(1)}55%{transform:scale(1.1)}}
          @keyframes waEvoSpark{0%{opacity:0;transform:translateY(6px) scale(.5)}30%{opacity:1}100%{opacity:0;transform:translateY(-34px) scale(1.1)}}
          .wa-evo-img{animation:waEvoPop 1.6s ease-in-out infinite}
          .wa-evo-glow{animation:waEvoGlow 1.6s ease-in-out infinite}
          .wa-evo-spark{animation:waEvoSpark 1.9s ease-in-out infinite}
          @media (prefers-reduced-motion: reduce){.wa-evo-img,.wa-evo-glow,.wa-evo-spark{animation:none}.wa-evo-spark{display:none}}
        `}</style>
        <div style={{ letterSpacing: ".25em", fontSize: 11, fontWeight: 800, color: "#8a83a3", textTransform: "uppercase", marginBottom: 14 }}>✨ 進化 ✨</div>
        <div style={{ position: "relative", width: 200, margin: "0 auto 12px" }}>
          <div className="wa-evo-glow" style={{ position: "absolute", inset: "8%", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,236,160,.95), rgba(124,108,255,.4) 58%, rgba(124,108,255,0) 74%)", zIndex: 0 }} />
          <img className="wa-evo-img" src={ev.portrait} alt={ev.after} style={{ position: "relative", zIndex: 1, width: 200, height: 200, objectFit: "contain", filter: "drop-shadow(0 8px 16px rgba(124,108,255,.4))" }} />
          <div className="wa-evo-spark" style={{ position: "absolute", top: 8, left: 18, fontSize: 22, zIndex: 2 }}>✨</div>
          <div className="wa-evo-spark" style={{ position: "absolute", top: 28, right: 14, fontSize: 18, zIndex: 2, animationDelay: ".6s" }}>⭐</div>
          <div className="wa-evo-spark" style={{ position: "absolute", bottom: 22, left: 30, fontSize: 16, zIndex: 2, animationDelay: "1.1s" }}>✨</div>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px" }}>🌟 {ev.display} 進化了!</h1>
        <p style={{ color: "#8a83a3", fontSize: 15, margin: "0 0 22px" }}>成為 <b style={{ color: "#6a52ff" }}>{ev.after}</b>!</p>
        <button onClick={() => dispatch({ type: "finishEvolution" })} style={ctaBtn}>太棒了 →</button>
      </div>,
    );
  }

  // ---------- BATTLE ----------
  if (state.screen === "battle" && state.battle) {
    const s = state.battle;
    const wildSp = speciesById(s.wild.speciesId);
    const activeSp = speciesById(s.active.speciesId);
    const wildSleepy = isSleepy(s.wild);
    const wildAsleep = (s.wild.asleep ?? 0) > 0;
    const favSnack = wildSp?.favoriteSnack;
    const favCount = favSnack ? (state.snacks?.[favSnack] ?? 0) : 0;
    const hasFav = favCount > 0;
    const hasCatchSnack = SNACK_POOL.some((id) => (state.snacks?.[id] ?? 0) > 0);
    return frame(
      <div>
        <div style={{ borderRadius: 18, overflow: "hidden", boxShadow: "0 10px 30px rgba(80,50,130,.12)" }}>
          <div style={{ background: "radial-gradient(60% 50% at 78% 18%, #fff6d8 0%, rgba(255,246,216,0) 60%), linear-gradient(180deg,#cdeffb 0%, #d7f0d0 52%, #bfe3a3 100%)", padding: 12 }}>
            {/* enemy info */}
            <div style={{ ...infoCard, width: "min(230px, 100%)", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800 }}>{s.wild.shiny && "✨ "}{wildSp?.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#8a83a3" }}>Lv.{s.wild.level}</span>
              </div>
              <div style={{ display: "flex", gap: 4, margin: "3px 0 5px" }}>{s.wild.elements.map((e) => <TypeBadge key={e} element={e} />)}{s.wild.shiny && <span style={{ fontSize: 10, fontWeight: 800, color: "#c98a12", background: "#fff4d6", padding: "1px 7px", borderRadius: 999 }}>✨ 閃光</span>}</div>
              <HpBar hp={s.wild.hp} maxHp={s.wild.maxHp} />
              <div style={{ display: "flex", gap: 5, marginTop: 5 }}>
                {wildAsleep && <span style={{ fontSize: 11, fontWeight: 800, color: "#6a52ff", background: "#efeaff", padding: "2px 8px", borderRadius: 999 }}>💤 睡著了</span>}
                {wildSleepy && <span style={{ fontSize: 11, fontWeight: 800, color: "#c98a12", background: "#fff4d6", padding: "2px 8px", borderRadius: 999 }}>😴 想睡了 — 好收服!</span>}
              </div>
            </div>
            {/* animated stage (Kaplay) */}
            <BattleStageKaplay
              key={s.active.ownedId}
              wildPortrait={wildSp?.portrait ?? ""}
              playerPortrait={activeSp?.portrait ?? ""}
              wildSleepy={wildSleepy || wildAsleep}
              wildShiny={!!s.wild.shiny}
              heroShiny={!!s.active.shiny}
              event={{ kind: s.log[s.log.length - 1]?.kind ?? "start", seq: s.log.length }}
            />
            {/* player info */}
            <div style={{ ...infoCard, width: "min(230px, 100%)", marginLeft: "auto", marginTop: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800 }}>{s.active.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#8a83a3" }}>Lv.{s.active.level}</span>
              </div>
              <HpBar hp={s.active.hp} maxHp={s.active.maxHp} />
            </div>
          </div>

          <div style={{ background: "#2c2a3f", color: "#fdfcff", fontSize: 13.5, fontWeight: 600, padding: "11px 16px" }}>{battleHeadline(s)}</div>

          <div style={{ padding: 14, background: "#f6f2fc", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
            <div style={{ gridColumn: "1 / span 2", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              {s.active.moveIds.slice(0, 4).map((id) => {
                const mv = getMoveById(id);
                if (!mv) return null;
                const eff = getEffectivenessAgainst(mv.element, s.wild.elements);
                const badge = effectivenessBadge(eff);
                const m = ELEMENT_META[mv.element];
                return (
                  <button key={id} onClick={() => dispatch({ type: "battleMove", moveId: id, today })} style={moveBtn}>
                    {badge && (
                      <span style={badge.tone === "weak" ? { ...effBadge, background: "#9aa0b5" } : effBadge}>
                        {badge.label}
                      </span>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: m.fg }} />
                      <span style={{ fontWeight: 800, fontSize: 13 }}>{mv.name}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#8a83a3", fontWeight: 700 }}>{mv.element} · 威力 {mv.power}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {state.isWarden ? (
                <div style={{ ...actBtn, background: "#efe7ff", color: "#7c5fc0", border: "1px solid #cdb6ef", lineHeight: 1.25, cursor: "default" }}>
                  👑 守關魔王
                  <small style={{ display: "block", fontSize: 9.5, fontWeight: 700, opacity: 0.85, marginTop: 2 }}>打敗牠就好,無法收服</small>
                </div>
              ) : (
                <button
                  disabled={!hasCatchSnack}
                  onClick={() => { if (hasCatchSnack) dispatch({ type: "battleCatch", today }); }}
                  style={{ ...actBtn, opacity: hasCatchSnack ? 1 : 0.55, cursor: hasCatchSnack ? "pointer" : "not-allowed", background: "linear-gradient(180deg,#ffd66b,#f7b13a)", color: "#5b3d00", border: "none", boxShadow: hasCatchSnack ? "0 6px 16px rgba(247,177,58,.4)" : "none", lineHeight: 1.25 }}
                >
                  🍪 遞點心收服
                  {favSnack && (
                    <small style={{ display: "block", fontSize: 9.5, fontWeight: 700, opacity: 0.85, marginTop: 2 }}>
                      {hasFav
                        ? `最愛 ${SNACK_NAMES[favSnack] ?? favSnack} ×${favCount} · 加成!`
                        : hasCatchSnack
                          ? `最愛 ${SNACK_NAMES[favSnack] ?? favSnack}(沒有) · 改用一般點心`
                          : "沒有可用點心"}
                    </small>
                  )}
                </button>
              )}
              {s.bench.map((b) => (
                <button key={b.ownedId} onClick={() => dispatch({ type: "battleSwitch", ownedId: b.ownedId, today })} style={actBtnSub}>🔄 換 {b.name}</button>
              ))}
              <button onClick={() => dispatch({ type: "battleFlee" })} style={actBtnSub}>🏃 逃跑</button>
            </div>
          </div>
        </div>
      </div>,
    );
  }

  return frame(<div style={{ textAlign: "center", padding: 60, color: "#8a83a3" }}>…</div>);
}

// ---- shared styles ----
const btnGhost: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: "#6a6585", background: "transparent", border: "none", cursor: "pointer", padding: "6px 8px" };
const btnOutline: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 800, color: "#6a52ff", background: "rgba(255,255,255,.7)", border: "1px solid rgba(106,82,255,.3)", borderRadius: 13, padding: "12px 18px", cursor: "pointer" };
const dangerOutlineBtn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 800, color: "#b64255", background: "rgba(255,255,255,.72)", border: "1px solid rgba(182,66,85,.24)", borderRadius: 13, padding: "12px 18px", cursor: "pointer" };
const ctaBtn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 800, color: "#fff", background: "linear-gradient(180deg,#7c6cff,#6a52ff)", border: "none", padding: "13px 24px", borderRadius: 14, boxShadow: "0 8px 20px rgba(106,82,255,.34)", cursor: "pointer" };
const dangerBtn: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12.5, fontWeight: 900, color: "#fff", background: "linear-gradient(180deg,#d95f72,#b64255)", border: "none", padding: "10px 14px", borderRadius: 12, boxShadow: "0 7px 16px rgba(182,66,85,.24)", cursor: "pointer" };
const dailyBtn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800, color: "#5b3d00", background: "linear-gradient(180deg,#ffd66b,#f7b13a)", border: "none", padding: "11px 18px", borderRadius: 13, boxShadow: "0 6px 16px rgba(247,177,58,.4)", cursor: "pointer", marginBottom: 14 };
const dailyFlashBox: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 800, color: "#5b3d00", background: "#fff4d6", border: "1px solid #f0c869", padding: "10px 16px", borderRadius: 13, marginBottom: 14 };
const guestNoticeBox: CSSProperties = { maxWidth: 520, margin: "0 auto 16px", padding: "12px 14px", borderRadius: 14, background: "#fff7e0", border: "1px solid #f0c869", color: "#8a6a12", fontSize: 12.5, lineHeight: 1.5, boxShadow: "0 5px 14px rgba(120,86,30,.07)" };
const unsyncedNoticeBox: CSSProperties = { ...guestNoticeBox, maxWidth: "none", margin: "0 0 16px", textAlign: "left" };
const authErrorBox: CSSProperties = { maxWidth: 520, margin: "0 auto 14px", padding: "9px 12px", borderRadius: 12, background: "#ffecef", border: "1px solid #efb1bb", color: "#b64255", fontSize: 12.5, fontWeight: 800 };
const resetConfirmBox: CSSProperties = { margin: "-8px 0 22px", padding: "14px 16px", borderRadius: 14, background: "#fff2f4", border: "1px solid #efb1bb", boxShadow: "0 8px 22px rgba(182,66,85,.12)" };
const roleBadge: CSSProperties = { fontSize: 10, fontWeight: 800, color: "#6a52ff", background: "#efeaff", border: "1px solid #cdb6ef", borderRadius: 999, padding: "1px 7px" };
const cardBtn: CSSProperties = { background: "rgba(255,255,255,.66)", backdropFilter: "blur(14px)", border: "1px solid rgba(60,40,90,.1)", borderRadius: 18, padding: "16px 14px", textAlign: "center", cursor: "pointer", boxShadow: "0 6px 18px rgba(80,50,130,.08)", transition: "transform .18s" };
const cardStatic: CSSProperties = { background: "rgba(255,255,255,.66)", border: "1px solid rgba(60,40,90,.1)", borderRadius: 16, padding: 12, boxShadow: "0 5px 14px rgba(80,50,130,.07)" };
const infoCard: CSSProperties = { background: "rgba(255,255,255,.85)", backdropFilter: "blur(6px)", border: "1px solid rgba(60,40,90,.1)", borderRadius: 12, padding: "8px 11px", width: 200, boxShadow: "0 5px 12px rgba(60,40,90,.1)" };
const moveBtn: CSSProperties = { position: "relative", background: "#fff", border: "1px solid rgba(60,40,90,.12)", borderRadius: 12, padding: "10px 11px", cursor: "pointer", textAlign: "left", boxShadow: "0 2px 6px rgba(60,40,90,.06)" };
const effBadge: CSSProperties = { position: "absolute", top: -8, right: -6, fontSize: 10, fontWeight: 800, color: "#fff", background: "#ef5b6e", padding: "2px 7px", borderRadius: 999, boxShadow: "0 3px 7px rgba(239,91,110,.4)" };
const actBtn: CSSProperties = { borderRadius: 12, padding: "10px 8px", fontSize: 12.5, fontWeight: 800, textAlign: "center", cursor: "pointer", border: "1px solid rgba(60,40,90,.12)", background: "#fff" };
const actBtnSub: CSSProperties = { ...actBtn, color: "#6a6585" };
const feedBtn: CSSProperties = { width: "100%", borderRadius: 10, padding: "7px 8px", fontSize: 12, fontWeight: 800, color: "#c98a12", background: "#fff7e0", border: "1px solid #f0c869" };
const fieldLabel: CSSProperties = { fontSize: 12, fontWeight: 800, color: "#33304a", marginBottom: 6 };
const fieldInput: CSSProperties = { width: "100%", fontSize: 14, padding: "9px 11px", borderRadius: 10, border: "1px solid rgba(60,40,90,.18)", background: "rgba(255,255,255,.85)", fontFamily: "inherit", color: "#33304a" };
