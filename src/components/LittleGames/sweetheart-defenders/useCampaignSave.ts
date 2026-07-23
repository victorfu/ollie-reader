import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { logger } from "../../../utils/logger";
import { getLevel } from "./data/levels";
import { applyRunResult, type RunOutcome } from "./engine/progress";
import { awardGameCoins } from "../../../services/gameProgressService";
import {
  createEmptySave,
  loadCloud,
  mergeSaves,
  readCache,
  saveCloud,
  writeCache,
  type SweetheartSaveV1,
  type SyncStatus,
} from "./storage";

export type CampaignSave = {
  save: SweetheartSaveV1;
  status: SyncStatus;
  /** 有登入才會同步到雲端；沒登入就只存這台裝置。 */
  isSignedIn: boolean;
  /** 回傳這一場賺到的扭蛋代幣，讓結算頁顯示出來。 */
  recordResult: (levelId: string, outcome: RunOutcome) => number;
};

/**
 * 闖關進度的存取。
 *
 * 先讀本機快取讓畫面立刻有東西，再去雲端拿，兩份用 mergeSaves 合起來——進度
 * 只會往前，所以合併不會有衝突，兩台裝置各自的進度都留得住。
 *
 * 沒登入時一樣存本機（key 是 guest）；之後登入了，雲端載入會把記憶體裡這份
 * guest 進度一起併進帳號存檔，小孩先玩了半天才想到要登入也不會白玩。
 */
export function useCampaignSave(): CampaignSave {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [save, setSave] = useState<SweetheartSaveV1>(() => {
    const local = readCache(uid) ?? createEmptySave();
    const guest = uid ? readCache(null) : null;
    return guest ? mergeSaves(local, guest) : local;
  });
  const [cloudStatus, setCloudStatus] = useState<SyncStatus>("loading");

  // recordResult 會被交給戰鬥畫面的 rAF 迴圈，所以它的 identity 必須穩定——
  // 每次存檔變動就換一個新的 callback 會讓迴圈整個重建。用 ref 讀最新的存檔，
  // 並且在 effect 裡更新（render 期間寫 ref 會讓畫面與 ref 不同步）。
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    loadCloud(uid)
      .then((cloud) => {
        if (cancelled) return;

        // 三份合起來：記憶體（可能含 guest 進度）、這個帳號的本機快取、雲端。
        const merged = mergeSaves(
          mergeSaves(saveRef.current, readCache(uid) ?? createEmptySave()),
          cloud,
        );
        setSave(writeCache(uid, merged));
        setCloudStatus("saved");

        // 本機有雲端沒有的進度時（離線玩過、或剛從 guest 接過來），推回雲端。
        if (JSON.stringify(merged) !== JSON.stringify(cloud)) {
          void saveCloud(uid, merged).catch((error) => {
            logger.warn("甜心防衛隊：回填雲端存檔失敗", error);
          });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        // 讀不到雲端不該擋住遊戲——本機那份照樣能玩，之後再同步。
        logger.warn("甜心防衛隊：讀取雲端存檔失敗，改用本機進度", error);
        setCloudStatus("offline");
      });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  const recordResult = useCallback(
    (levelId: string, outcome: RunOutcome): number => {
      const reward = getLevel(levelId)?.coinReward ?? { clear: 0, threeStars: 0 };
      const { progress, coinsEarned } = applyRunResult(
        saveRef.current,
        levelId,
        outcome,
        reward,
      );
      if (progress === saveRef.current) return 0;

      const next: SweetheartSaveV1 = {
        ...saveRef.current,
        ...progress,
        updatedAt: Date.now(),
      };

      // 先寫本機：就算雲端寫失敗，這一場的進度也不會消失。
      const persisted = writeCache(uid, next);
      setSave(persisted);

      if (!uid) return coinsEarned;

      setCloudStatus("saving");
      saveCloud(uid, persisted)
        .then(() => setCloudStatus("saved"))
        .catch((error) => {
          logger.warn("甜心防衛隊：寫入雲端存檔失敗，進度留在本機", error);
          setCloudStatus("offline");
        });

      // 代幣寫在共用的 gameProgress 文件，跟塔防存檔是兩筆不同的寫入。
      // 存檔已經記下「領過了」，所以就算這筆失敗也不會重複發——代價是那次的
      // 代幣就沒了，比起可能重複發錢，這個方向的錯誤比較不傷。
      if (coinsEarned > 0) {
        void awardGameCoins(uid, coinsEarned).catch((error) => {
          logger.warn("甜心防衛隊：發放扭蛋代幣失敗", error);
        });
      }

      return coinsEarned;
    },
    [uid],
  );

  return {
    save,
    // 沒登入就沒有雲端狀態可言，畫面改提示「只存在這台裝置」。
    status: uid ? cloudStatus : "idle",
    isSignedIn: uid !== null,
    recordResult,
  };
}
