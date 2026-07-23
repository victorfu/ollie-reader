import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { logger } from "../../../utils/logger";
import {
  loadGachaCloud,
  readGachaCache,
} from "../gacha-machine/gachaStorage";
import type { GachaSaveV1 } from "../gacha-machine/gachaTypes";
import { CHARACTERS, DEFAULT_ROSTER_IDS } from "./data/characters";
import type { TowerCharacter } from "./types";

export type TowerRoster = {
  /** 這場可以放上塔位的角色 */
  available: TowerCharacter[];
  availableIds: string[];
  /** 扭蛋抽到的數量（不含預設班底），用來顯示「已收集 n / 57」 */
  ownedCount: number;
  isSignedIn: boolean;
};

/**
 * 可以當塔的角色 = 扭蛋機收藏 ∪ 預設班底。
 *
 * 這是兩個遊戲的接點：打塔防賺代幣 → 抽扭蛋 → 新角色回來讓塔防更強。
 * 讀法跟其他存檔一樣是 local-first：先拿本機快取讓畫面立刻有東西，再抓雲端。
 *
 * 沒登入就只有預設班底——扭蛋收藏本來就綁帳號（gachaStorage 沒有 uid 會丟例外）。
 */
export function useTowerRoster(): TowerRoster {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [owned, setOwned] = useState<GachaSaveV1["ownedCounts"]>(() =>
    uid ? (readGachaCache(uid)?.ownedCounts ?? {}) : {},
  );

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    loadGachaCloud(uid)
      .then((save) => {
        if (!cancelled) setOwned(save.ownedCounts);
      })
      .catch((error) => {
        // 讀不到雲端就用本機那份，玩得下去比較重要。
        logger.warn("甜心防衛隊：讀取扭蛋收藏失敗，改用本機快取", error);
      });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  return useMemo(() => {
    const ownedIds = Object.entries(owned)
      .filter(([, count]) => (count ?? 0) > 0)
      .map(([id]) => id);

    const availableIds = new Set([...DEFAULT_ROSTER_IDS, ...ownedIds]);

    return {
      // 照 CHARACTERS 的順序，畫面上的排列才穩定。
      available: CHARACTERS.filter((character) => availableIds.has(character.id)),
      availableIds: [...availableIds],
      ownedCount: ownedIds.length,
      isSignedIn: uid !== null,
    };
  }, [owned, uid]);
}
