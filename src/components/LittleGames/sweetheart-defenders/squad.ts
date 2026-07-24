import { MAX_SQUAD_SIZE } from "./constants";
import { ARCHETYPE_BY_ELEMENT } from "./data/elements";
import { defaultStorage, type SaveStorage } from "./storage";
import { RARITIES, type TowerArchetype, type TowerCharacter } from "./types";

// 出戰隊伍：進關前從收藏裡挑最多 MAX_SQUAD_SIZE 種角色帶進戰鬥。
// 這裡只有名單邏輯與本機快取，畫面在 ui/SquadSelect.tsx。

/**
 * 把任何來源的隊伍名單整理成合法的：只留字串、只留可用角色、去重、截到上限。
 * 快取可能是舊帳號留下的（角色沒抽到）或被手動改過，壞資料一律丟掉不報錯。
 */
export function sanitizeSquad(
  raw: unknown,
  available: TowerCharacter[],
): string[] {
  if (!Array.isArray(raw)) return [];

  const availableIds = new Set(available.map((character) => character.id));
  const squad: string[] = [];

  for (const id of raw) {
    if (squad.length >= MAX_SQUAD_SIZE) break;
    if (typeof id !== "string") continue;
    if (!availableIds.has(id)) continue;
    if (squad.includes(id)) continue;
    squad.push(id);
  }

  return squad;
}

/**
 * 打法的補位優先序。輸出型打法排前面——只帶輔助塔是打不贏的；
 * 糖漿、藤蔓這類控場排中段，催眠與應援最花俏，留到最後。
 */
const ARCHETYPE_PRIORITY: TowerArchetype[] = [
  "rapid",
  "burst",
  "sniper",
  "cannon",
  "syrup",
  "vine",
  "lullaby",
  "cheer",
];

function archetypeOf(character: TowerCharacter): TowerArchetype {
  return ARCHETYPE_BY_ELEMENT[character.elements[0]];
}

/** 稀有度越高越強（RARITIES 是由弱到強排的）。 */
function rarityRank(character: TowerCharacter): number {
  return RARITIES.indexOf(character.rarity);
}

/** 同打法裡挑最稀有的；一樣稀有就取排在前面的，結果才穩定。 */
function bestOf(candidates: TowerCharacter[]): TowerCharacter | undefined {
  let best: TowerCharacter | undefined;
  for (const candidate of candidates) {
    if (!best || rarityRank(candidate) > rarityRank(best)) best = candidate;
  }
  return best;
}

/**
 * 「推薦」按鈕的邏輯：保留已選的，補滿到上限。
 *
 * 先照 ARCHETYPE_PRIORITY 補還沒涵蓋的打法（每種取最稀有的一隻），
 * 八種打法都有人之後，剩的名額直接按稀有度往下填。孩子按一顆鍵就能拿到
 * 一隊打法齊全的隊伍，而不是五隻長得可愛但全是應援的。
 */
export function recommendSquad(
  available: TowerCharacter[],
  picked: string[],
): string[] {
  const squad = sanitizeSquad(picked, available);
  const inSquad = new Set(squad);
  const byId = new Map(available.map((character) => [character.id, character]));
  const covered = new Set(
    squad.map((id) => archetypeOf(byId.get(id) as TowerCharacter)),
  );

  for (const archetype of ARCHETYPE_PRIORITY) {
    if (squad.length >= MAX_SQUAD_SIZE) return squad;
    if (covered.has(archetype)) continue;

    const best = bestOf(
      available.filter(
        (character) =>
          !inSquad.has(character.id) && archetypeOf(character) === archetype,
      ),
    );
    if (!best) continue;

    squad.push(best.id);
    inSquad.add(best.id);
    covered.add(archetype);
  }

  // 穩定排序：稀有度相同時維持 CHARACTERS 的原始順序。
  const rest = available
    .filter((character) => !inSquad.has(character.id))
    .sort((a, b) => rarityRank(b) - rarityRank(a));

  for (const character of rest) {
    if (squad.length >= MAX_SQUAD_SIZE) break;
    squad.push(character.id);
  }

  return squad;
}

// === 本機快取 ===
// 隊伍是裝置層級的偏好、不是進度，所以只存 localStorage 不上雲端。
// 讀出來的名單一定要再過 sanitizeSquad——快取裡可能有現在沒擁有的角色。

const SQUAD_CACHE_PREFIX = "ollie-sweetheart-defenders-squad-v1:";
const GUEST_KEY = "guest";

export function getSquadCacheKey(uid: string | null): string {
  return `${SQUAD_CACHE_PREFIX}${uid ?? GUEST_KEY}`;
}

export function readSquadCache(
  uid: string | null,
  storage: SaveStorage | null = defaultStorage(),
): string[] {
  if (!storage) return [];

  try {
    const raw = storage.getItem(getSquadCacheKey(uid));
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function writeSquadCache(
  uid: string | null,
  squadIds: string[],
  storage: SaveStorage | null = defaultStorage(),
): void {
  if (!storage) return;

  try {
    storage.setItem(getSquadCacheKey(uid), JSON.stringify(squadIds));
  } catch {
    // 無痕模式或容量滿了：下次進關重選一次而已，不用讓遊戲中斷。
  }
}
