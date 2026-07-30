import { getLevel } from "./data/levels";

// 「玩到哪一關」的分頁級紀錄。
//
// 這個 app 裡整頁 reload 是常態:部署後 PWA 自動更新會讓每個開著的分頁
// 自己重載(見 utils/registerPwa.ts)、iPad 會回收背景分頁、錯誤畫面的
// 「重試」也會重掛整棵樹。畫面進度只放記憶體的話,上述任何一件事都會把
// 打到一半的小孩踢回標題頁。
//
// 存 sessionStorage:活得過 reload 與分頁回收,又是 per-tab,關掉分頁
// 自然歸零,兩個遊戲分頁也不會互相蓋。回復時一律落在該關的「選隊畫面」
// (隊伍預選由 squad.ts 的快取負責)——比直接把人丟回戰鬥溫和,殘留的
// 舊紀錄被回復時也不突兀。

const SCREEN_SESSION_KEY = "ollie-sweetheart-defenders-screen-v1";

export type ScreenStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export function getScreenSessionKey(): string {
  return SCREEN_SESSION_KEY;
}

export function defaultScreenStorage(): ScreenStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** 回傳上次離開時所在的關卡 id;沒有紀錄或關卡已不存在就回 null。 */
export function readScreenSession(
  storage: ScreenStorage | null = defaultScreenStorage(),
): string | null {
  if (!storage) return null;

  try {
    const levelId = storage.getItem(SCREEN_SESSION_KEY);
    if (!levelId || !getLevel(levelId)) return null;
    return levelId;
  } catch {
    return null;
  }
}

/** 記下目前所在的關卡;傳 null(回到標題)就清掉紀錄。 */
export function writeScreenSession(
  levelId: string | null,
  storage: ScreenStorage | null = defaultScreenStorage(),
): void {
  if (!storage) return;

  try {
    if (levelId === null) storage.removeItem(SCREEN_SESSION_KEY);
    else storage.setItem(SCREEN_SESSION_KEY, levelId);
  } catch {
    // 無痕模式或容量滿了:只是少了斷線回復,不用讓遊戲中斷。
  }
}
