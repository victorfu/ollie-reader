import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { logger } from "../../../utils/logger";
import {
  getGachaCacheKey,
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

type RosterSession = {
  uid: string | null;
  owned: GachaSaveV1["ownedCounts"];
};

function localRoster(uid: string | null): RosterSession {
  return {
    uid,
    owned: uid ? (readGachaCache(uid)?.ownedCounts ?? {}) : {},
  };
}

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

  const [session, setSession] = useState<RosterSession>(() => localRoster(uid));
  const visibleSession = useMemo(
    () => (session.uid === uid ? session : localRoster(uid)),
    [session, uid],
  );
  const sessionRef = useRef(visibleSession);
  useLayoutEffect(() => {
    sessionRef.current = visibleSession;
  }, [visibleSession]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    let requestSequence = 0;
    const cacheKey = getGachaCacheKey(uid);

    const applyOwned = (owned: GachaSaveV1["ownedCounts"]): void => {
      if (cancelled || sessionRef.current.uid !== uid) return;
      const next = { uid, owned };
      sessionRef.current = next;
      setSession(next);
    };
    const refreshFromCache = (): void => {
      requestSequence += 1;
      applyOwned(readGachaCache(uid)?.ownedCounts ?? {});
    };
    const refreshFromCloud = (): void => {
      const sequence = ++requestSequence;
      void loadGachaCloud(uid)
        .then((save) => {
          if (sequence !== requestSequence) return;
          applyOwned(save.ownedCounts);
        })
        .catch((error) => {
          if (cancelled || sequence !== requestSequence) return;
          // 讀不到雲端就用本機那份，玩得下去比較重要。
          logger.warn("甜心防衛隊：讀取扭蛋收藏失敗，改用本機快取", error);
        });
    };
    const refreshOnReturn = (): void => {
      // Same-tab acknowledgements update localStorage without a storage event.
      refreshFromCache();
      refreshFromCloud();
    };
    const handleStorage = (event: StorageEvent): void => {
      if (event.key !== cacheKey) return;
      // Apply the spoiler-safe local baseline immediately, then reconcile the
      // authoritative cloud state. This also invalidates any older response.
      refreshOnReturn();
    };
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") refreshOnReturn();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    refreshFromCloud();

    return () => {
      cancelled = true;
      requestSequence += 1;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [uid]);

  return useMemo(() => {
    const ownedIds = Object.entries(visibleSession.owned)
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
  }, [visibleSession.owned, uid]);
}
