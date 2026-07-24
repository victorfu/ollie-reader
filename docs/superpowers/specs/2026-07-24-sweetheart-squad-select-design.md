# 甜心防衛隊 — 出戰隊伍選擇（進關前選角，上限 5 隻）

<metadata>
date: 2026-07-24
status: approved for implementation
scope: src/components/LittleGames/sweetheart-defenders
</metadata>

## 1. 問題

目前扭蛋抽到的角色**全部**都能在戰鬥中放上塔位。收藏一多（最多 57 隻），
TowerPanel 的角色列表會長到要一直捲，而且「隨時想放誰就放誰」讓搭配隊伍
這件事完全沒有取捨——塔防的樂趣有一半在賽前規劃。

## 2. 需求（來自使用者）

- 進入每一關**之前**先選擇要帶哪些角色進場。
- 一關最多帶 **5 種**角色；沒被選進隊伍的角色這一場不能用。
- 也就是說：不再是「所有收藏的角色都能上」。

## 3. 方案比較

| 方案 | 說明 | 取捨 |
|------|------|------|
| **A. 全螢幕選隊畫面（採用）** | Title → 點關卡 → SquadSelect → 戰鬥 | 跟現有的畫面狀態機（title/dex/battle）一致；手機上有足夠空間排卡片 |
| B. TitleScreen 上疊 modal | 少一個畫面 | 手機上 57 張卡片塞在 modal 裡很擠；跟全螢幕的遊戲風格不合 |
| C. 戰鬥準備階段內選隊 | 不加畫面 | 「進關前」的需求名不符實；戰鬥 UI 又多一層狀態 |

## 4. 玩家流程

1. TitleScreen 照舊選難度、點關卡。
2. 進入 **SquadSelect**：顯示該關名稱與難度，列出**已擁有**的角色
   （預設班底 ∪ 扭蛋收藏，跟現行 roster 一樣）。
3. 點角色加入／移除隊伍，即時顯示「n / 5」。隊伍滿了再點未選角色會播
   denied 音效並顯示提示。
4. 「推薦」按鈕自動補滿：保留已選的，優先補**還沒被涵蓋的打法**
   （速射、爆裂、狙擊、重砲、糖漿、藤蔓、催眠、應援的順位），同打法取
   稀有度最高者；打法都涵蓋後按稀有度補。
5. 「出發」帶隊伍進戰鬥（0 隻時停用）。戰鬥中 TowerPanel 只列隊伍成員。
6. 重試（retry）沿用同一隊；退回路線頁重進關卡才會重新選（會帶入上次隊伍）。

## 5. 模組切分

| 檔案 | 內容 |
|------|------|
| `constants.ts` | `MAX_SQUAD_SIZE = 5`（調參集中地） |
| `squad.ts`（新） | 純邏輯 + 本機快取：`sanitizeSquad`（過濾不存在/未擁有、去重、截到上限）、`recommendSquad`（補滿邏輯）、`readSquadCache` / `writeSquadCache`（per-uid localStorage，注入式 `SaveStorage`，格式壞掉回空陣列） |
| `squad.test.ts`（新） | 上述純邏輯與快取的 vitest |
| `ui/CharacterTags.tsx`（新） | 從 TowerPanel 私有的 `PetTags` 抽出來的打法＋特性標籤，SquadSelect 與 TowerPanel 共用 |
| `ui/SquadSelect.tsx`（新） | 全螢幕選隊畫面（純 UI + 本地 state，初始隊伍與確認回呼由外部傳入） |
| `SweetheartDefenders.tsx` | 畫面狀態機加 `{ kind: "squad" }`；battle 狀態多帶 `squadIds`；用它過濾 roster 傳給 BattleScreen |

## 6. 資料與邊界情況

- **隊伍記憶**：localStorage key `ollie-sweetheart-defenders-squad-v1:{uid|guest}`，
  跟 storage.ts 的快取同一個命名模式。只存本機，不上 Firestore——隊伍是裝置
  層級的偏好，不是進度。
- **開畫面時的預設**：讀快取 → `sanitizeSquad` 對現有 roster 過濾；結果為空
  （第一次玩）就用 `recommendSquad` 直接填滿 5 隻，孩子按「出發」就能玩。
- **快取裡有已經不在 roster 的 id**（換帳號、雲端收藏比本機少）：sanitize 直接
  丟掉，不報錯。
- **戰鬥端保險**：BattleScreen 拿到的隊伍萬一過濾後是空的（理論上被出發鍵擋
  住），退回整個 roster，遊戲不可以變成無塔可放。
- **重試**：`squadIds` 存在 battle 畫面狀態裡，runId +1 不影響隊伍。

## 7. 不做的事（YAGNI）

- 不做隊伍多組存檔（隊伍 1/2/3）。
- 不在 SquadSelect 裡顯示完整數值面板——標籤（打法＋特性）與造價就夠選了，
  詳細數值去圖鑑看。
- 不動戰鬥模擬層（simulation/economy），它們只看得到「可用角色」列表。
- 不做關卡對隊伍的額外限制（例如某關禁用某元素）。

## 8. 驗證

- `npm run test`：squad.ts 的單元測試（sanitize、recommend、快取讀寫、壞資料）。
- `npm run lint`、`npm run build`。
- 瀏覽器預覽在沙盒環境因 Firebase App Check 打不開，靠測試與型別把關
  （見 memory：firebase-appcheck-headless-render）。
