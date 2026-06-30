# Wonder Academy Canonical Spec — 探索、捕捉、養成的萌系收集冒險

<metadata>
date: 2026-06-23
last_updated: 2026-06-30
status: canonical merged spec
scope: /games/wonder-academy
audience: 開發者的 10 歲女兒(台灣國小四年級、繁中閱讀流暢)+ 開發者本人,親子共玩;私人使用、不公開發行。
</metadata>

## 1. 定位

Wonder Academy 是一款親子共玩的可愛收集冒險遊戲。玩家是剛入學的 Wonder Keeper，在 Sparkleaf 星葉學院中選擇第一隻夥伴，前往發光森林與後續區域探索、尋寶、遇見野生 Wonderlings，透過輕策略戰鬥把牠們打到「想睡」，再遞點心收服。回到學院後，玩家能餵點心、升級、進化、調整隊伍、填滿 Wonderdex，並挑戰各區 Warden。

這份 spec 是 Wonder Academy 的唯一 canonical design。它融合並取代舊 RPG 世界觀 spec 與後續療癒 redesign spec：保留世界觀、角色、章節、存檔、音訊與驗證要求；玩法方向以目前的「探索 -> 戰鬥 -> 捕捉 -> 養成」為準。舊的 Mood Trial / Befriend 對話選項玩法不再是主軸，只作為世界觀語彙與非暴力調性的來源。

一句話：

> 你和女兒是 Sparkleaf 星葉學院的見習馴獸師。出門探索 -> 草叢遇見寵物 -> 用屬性相剋打到牠想睡 -> 遞點心收服 -> 回學院養大/進化 -> 解鎖更深的區域與更稀有的寵物 -> 再出發。

## 2. 設計目標

- 做成真正可重複遊玩的遊戲，而不是故事展示。核心樂趣是探索、戰鬥、收服、養成、收集。
- 適合 10 歲孩子與家長共玩。規則要能看懂，但隊伍搭配、屬性相剋、點心與收服率要有可討論的策略。
- 保持溫暖、不暴力。戰鬥語彙是累了、想睡、休息；捕捉是遞點心做朋友，不是強抓。
- 每次遊玩 10-20 分鐘要能完成一個有意義的小目標，例如開一個寶箱、收服一隻、打過一個節點、領一個圖鑑獎勵。
- 保留並善用既有原創美術、BGM/SFX、Firestore/local save、React + Kaplay 技術基礎。
- 自訂寵物是重要能力。專案出貨只含原創內容，但私人版本可透過資料 + 圖檔加入自己的寵物。

## 3. 非目標

- 不公開發行、不做多人連線、排行榜、付費、抽卡或營利機制。
- 不在版控內容中打包任何第三方版權角色或其美術。
- 不做正統寶可夢的完整數值深度。MVP 不需要 PP、複雜道具、能力階段、天氣、繁殖等系統。
- 不以長篇劇情或大量文字作為主要內容。世界觀提供情感與方向，但每個互動都要優先服務可玩性。
- 初期不新增 Cloud Functions 或自訂後端服務；使用既有 Firebase Auth + Firestore。

## 4. 核心循環

一圈約 2-4 分鐘：

```text
節點地圖選一個地點
  -> 進入小探索場景(走動、草叢、寶箱、NPC)
  -> 草叢遇到野生 Wonderling
  -> 進入 1v1 戰鬥
  -> 用屬性相剋把牠打到低 HP / 想睡
  -> 遞點心收服
  -> 更新 Wonderdex、隊伍、XP、Stardust、每日任務
  -> 回學院餵點心、裝技能、進化、買點心
  -> 解鎖更深節點 / Warden / 新區域
```

學院 Hub 是情感錨點：收服的 Wonderlings 在這裡被看見、餵養、升級、進化。Map / Explore / Battle 是外出冒險節奏；Wonderdex / Team / Shop / Builder 是收集與養成節奏。

## 5. 世界觀

玩家是剛入學的新生 Wonder Keeper。Wonder Academy 是漂浮在雲海上的溫暖學院，連接著發光森林、玻璃海岸、鐘塔宿舍、雲端市集、雪鈴山脊、夢境祭典、星空列車與 Crystal Bell Tower。

舊 RPG spec 中的 Crystal Bell 世界觀保留為長期敘事背景：Crystal Bell 的聲音逐漸變弱，Wonderlings 與 Wardens 變得不安、迷路或封閉。玩家不是去打敗敵人，而是透過探索、照顧、收服、訓練與挑戰 Warden，重新建立學院與各地區的連結。

### 5.1 主要角色

- **薇拉院長 / Professor Bellwyn**：Wonder Academy 的院長，負責 Crystal Bell 傳統與 Wonder Keeper 儀式。MVP 可用原創對話框與貓頭鷹符號呈現，不必先做完整立繪。
- **Keeper Mira**：新生導師，負責教學、任務、隊伍管理與早期探索。可作為 tutorial 與 current objective 的主要聲音。
- **Chef Pippa**：Snack Workshop 老師，負責點心、最愛零食、捕捉加成與親密度。
- **Inventor Tink**：工房老師，負責 charms、探索道具、場景機關與區域工具。
- **Ranger Rowan**：野外老師，教玩家追蹤、探索、稀有 Wonderlings 出現條件與 Warden 生態。
- **Archivist Lune**：圖書館老師，負責 Wonderdex、Bell Pages、Crystal Bell 歷史與傳說線索。
- **Kiki**：同班同學與友善競爭者。不是反派，可用於後續教學、挑戰與成長對照。
- **The First Keeper**：歷史人物。曾試圖用力量控制 Crystal Bell，後期故事可補完這段歷史。
- **The Silent Bellheart**：Crystal Bell 的心，也是最終 Warden。最終目標不是破壞牠，而是讓牠重新信任 Wonder Keepers。

### 5.2 學院 Hub

- **Dorm Room**：玩家身份、初始夥伴暱稱、隊伍與外觀設定。
- **Wonderdex Hall**：依區域、稀有度、屬性、已見 / 已收服 / 已進化查看收藏。
- **Snack Workshop**：購買、製作與管理點心；強化 favorite snack 機制。
- **Training Garden**：餵養、訓練、技能 loadout、升級與進化。
- **Charm Workshop**：後續 charms / 探索道具 / field skill 擴充。
- **Map Atrium**：進入 region map、查看 current objective 與可探索區域。

## 6. 序章

序章是一段一氣呵成、可跳過的儀式，只在新存檔或尚未選 starter 時播放。原則是低文字、靠畫面和聲音建立情緒；控制項使用 DOM + Framer Motion；動畫尊重 `prefers-reduced-motion`。

| Beat | 內容 |
|---|---|
| 0 · 標題 | Wonder Academy logo、柔光、`hub_loop`、「開始冒險」。 |
| 1 · 抵達學院 | 用 academy hub 背景與薇拉院長對話框，建立「新生 Wonder Keeper」身份。 |
| 2 · 取名 | 輸入 `playerName`。 |
| 3 · 命運的相遇 | 四隻 starter 逐一亮相，顯示名字、屬性、戰鬥定位、field skill、個性與最終進化預覽。 |
| 4 · 確認與羈絆 | 選定夥伴後播放成功 SFX / 愛心 / 小動畫。 |
| 5 · 暱稱 | 可替 starter 取暱稱；略過時使用 species 名。 |
| 6 · 啟程 | 發放起始點心，寫入 starter，切到地圖。 |

### 6.1 Starter

四隻 starter 剛好覆蓋 8 種屬性且不重疊。選擇應同時影響戰鬥、探索與早期資源。

| 寵物 | 類型 | 屬性 | 戰鬥定位 | 最愛零食 | 場地技能 | 個性 | 進化線 |
|---|---|---|---|---|---|---|---|
| **Lumi** | 星光小狐 | light · spark | 速攻 / trickster | starberry-cookie | light-trail | 聰明、急性子、想證明自己 | Tailglow -> Prismtail -> Aurorafox |
| **Momo** | 雲朵小貓 | dream · tide | 守護 / healer | moon-milk-puff | soft-float | 愛睡、溫柔、關鍵時刻可靠 | Rainpuff -> Mooncloud -> Dreamnimbus |
| **Pico** | 星塵小妖精 | star · leaf | 巧術 / scout | clover-macaron | secret-sense | 好奇、愛惡作劇、會找祕密 | Budspark -> Wishpetal -> Celestibloom |
| **Nibi** | 迷你小龍 | ember · crystal | 坦克 / striker | warm-cocoa-gem | crystal-push | 勇敢、逞強、其實怕寂寞 | Pebblehorn -> Embercrest -> Hearthdrake |

## 7. 探索

探索由兩層組成：

- **Region / Node Map**：節點式移動骨幹。每個 region 有數個 explore node 與一個 warden node。節點有 locked condition、推薦目標、完成狀態與短時間目標。
- **Walkable Scene**：進入 explore node 後開啟小型 Kaplay 場景。玩家可走動、踩草叢、開寶箱、碰 NPC、從出口返回節點地圖。

探索內容：

- 草叢觸發野生 encounter，依 region、節點、稀有度、隊伍 field skills 擲骰。
- 寶箱給 Stardust、點心、材料或 charm。更深 region 有更高 tier 掉落。
- NPC 給短句、提示、任務或 field skill bonus。
- Warden node 進入 boss battle。打敗該 region 的 Warden 後解鎖下一個 region。
- 支線節點可用 field skill、snack、quest flag 或 Wonderdex clue 解鎖。

Field skills：

- `light-trail`：提高 encounter 節奏或揭示安全路線。
- `soft-float`：增加 NPC / support 互動收益。
- `secret-sense`：提高稀有 encounter 權重、揭示隱藏寶箱。
- `crystal-push`：增加寶箱 Stardust 或解鎖晶石障礙。

## 8. 戰鬥與捕捉

戰鬥是非暴力的 1v1 輕策略系統。每隻 Wonderling 有 HP、level、屬性、4 招與暫時狀態。玩家可攻擊、切換隊伍、遞點心收服或撤退。

規則：

- 每隻最多帶 4 招，MVP 無 PP。
- 核心策略是 8 屬性相剋。UI 需顯示招式屬性與「剋制 2x / 不利 0.5x」提示。
- HP 低於門檻時，野生 Wonderling 進入「想睡」狀態，捕捉率提高。
- `sleep` 類狀態可作為 Phase 2+ 的第一個狀態效果；它應保持簡單且可讀。
- 捕捉是「遞點心做朋友」。成功率受剩餘 HP、稀有度、點心等級與 favorite snack 影響。
- 捕捉失敗時，野生 Wonderling 溫和逃走或繼續互動，不使用殘酷語彙。
- Warden 可被打敗並記錄，但不一定用一般捕捉流程加入隊伍；可作為 region blessing、support 或故事解鎖。

## 9. 屬性系統

8 屬性形成可讀的輕策略循環：

```text
spark -> tide -> ember -> leaf -> crystal -> dream -> star -> light -> spark
```

每個屬性剋制循環中接下來 2 個屬性，被前面 2 個剋制，其餘普通。

| 屬性 | 剋制(2x) | 被剋(0.5x) |
|---|---|---|
| spark | tide, ember | light, star |
| tide | ember, leaf | spark, light |
| ember | leaf, crystal | tide, spark |
| leaf | crystal, dream | ember, tide |
| crystal | dream, star | leaf, ember |
| dream | star, light | crystal, leaf |
| star | light, spark | dream, crystal |
| light | spark, tide | star, dream |

雙屬性防守時，MVP 取對玩家最容易理解的倍率：任一屬性被剋就顯示有利，任一屬性抵抗且沒有被剋才顯示不利。若後續平衡需要，可改為乘法倍率，但 UI 必須保持簡單。

## 10. 收集與養成

### 10.1 Team

- Active adventure team 初期最多 3 隻；長期可擴充到 6 隻 Keeper Team。
- 戰鬥中可切換隊友。
- 隊伍中的 field skills 影響探索收益與節點解鎖。

### 10.2 XP、Level、Bond

- 戰鬥、收服、Warden、每日任務與探索可給 XP。
- Level 提升 HP / power，並解鎖 move pool 中更高階招式。
- Bond 透過餵 favorite snack、帶出探索、完成目標提升。
- 高 bond 可給小型加成、Hub 互動或特殊稱號，但不應讓戰鬥失衡。

### 10.3 進化

- 每個 species 有 `growthStages`。達到等級門檻與條件後可進化。
- 進化是重要滿足感節拍，要有明確動畫、SFX、前後名字。
- MVP 可使用固定 `EVOLUTION_LEVELS`，但資料層需限制 `totalStages <= EVOLUTION_LEVELS.length + 1`，或改成每 species 自帶門檻，避免超過 4 階時無聲卡住。

### 10.4 Skills

- Species 定義 `learnableSkillIds`。
- Owned creature 有 equipped move IDs / loadout。
- 升級解鎖招式，玩家在 Hub 中裝備。
- 戰鬥 UI 顯示屬性、威力與相剋提示。

### 10.5 Wonderdex

Wonderdex 是主要收集畫面。狀態至少包含：

- `unseen`
- `seen`
- `caught`
- `evolved`

延伸狀態：

- shiny / variant 是否已收服。
- Warden recorded / defeated。
- 地區完成度與獎勵。

Wonderdex 應支援 completion rewards，讓「全部收集」有明確動機。

### 10.6 Economy

- 使用一種軟貨幣：Stardust。
- Stardust 來源：探索寶箱、戰鬥、每日任務、圖鑑獎勵。
- Stardust 用途：買點心、後續買 charm / 材料。
- MVP 點心種類維持少量，與 starter favorite snack 對應。

## 11. 自訂寵物與美術策略

每隻 Wonderling = 一筆資料 + 一張圖：

- `speciesId`
- `name`
- `elements`
- `rarity`
- `favoriteSnack`
- `fieldSkillId`
- `growthStages`
- `learnableSkillIds`
- `portraitAsset`
- optional `spriteAsset`
- optional `silhouetteAsset`
- optional `artPrompt`

新增寵物的最小流程是放入圖檔並新增資料。App 內 builder 是 Phase 2+ 能力：可輸入名字、選屬性、上傳圖、選 favorite snack，存入個人存檔或 Storage。專案出貨只附原創內容；私人自訂圖由使用者自備。

美術廣度可透過以下方式放大：

- 進化階段。
- 顏色 / shiny 變體。
- 稀有度階層。
- Warden 版本。
- 自訂寵物。

## 12. Region 與長期章節

MVP 至少要有 Sparkleaf Grove / 星葉森林與一場 Warden。Phase 2 可擴到第二區。長期世界章節如下，作為內容 roadmap，而不是單一 MVP 的完成條件。

| 階段 | 地區 | 主題 | Warden / 目標 |
|---|---|---|---|
| Prologue | Wonder Academy | 入學、選 starter、取得 Wonderdex | 解鎖 Sparkleaf Grove |
| Chapter 1 | Sparkleaf Grove | 發光森林、草叢、入門收服 | Sparkleaf Fawn |
| Chapter 2 | Tideglass Coast | 潮汐、玻璃海岸、水系互動 | Pearlwhisker Seal |
| Chapter 3 | Clocktower Dorms | 宿舍、時間機關、節奏謎題 | Clockbell Tanuki |
| Chapter 4 | Sugarcloud Market | 點心、商店、表演、經濟 | Marshmallow Maestro |
| Chapter 5 | Snowbell Ridge | 寒冷、耐久、守護角色 | Aurora Alpaca |
| Chapter 6 | Dreamcloud Festival | 夢境、狀態、支援技能 | Pillowmoon Ram |
| Chapter 7 | Starrail Observatory | 星空、稀有 encounter、圖鑑線索 | Comet Kitsune |
| Final | Crystal Bell Tower | 信任、Crystal Bell、最終挑戰 | The Silent Bellheart |
| Postgame | Wonder Keeper Trials | rematch、Mythlings、稀有變體、挑戰塔 | 長期收集 |

## 13. 渲染與 UI 架構

採混合架構：

```text
React / DOM + Framer Motion
  序章、Hub、Region map、Team、Wonderdex、Shop、Builder、Battle commands

Kaplay canvas
  可走動探索場景、戰鬥舞台、sprite 偶動畫、攻擊/收服/進化演出
```

原則：

- 互動控制項使用真實 DOM button/input，保留 keyboard、focus、hover、touch 與 responsive 行為。
- Kaplay 只負責會動的場景與角色，不承擔大量文字或主控制 UI。
- CJK 文字盡量留在 DOM；若進 canvas，需使用正確 font family，避免豆腐字。
- 網頁版遵循 macOS HIG for Web：玻璃只用於浮層，主內容清楚、低噪、touch target 足夠。
- 遊戲是獨立 route，不繼承主 app layout。

主要畫面：

- Title / Continue
- Intro / Starter Selection
- Academy Hub
- Region Map
- Node Map
- Explore Scene
- Battle
- Team / Skills / Growth
- Wonderdex
- Snack Shop
- Creature Builder
- Result / Evolution

## 14. 技術架構

目標架構：

- `WonderAcademyCollector` 或後續 `WonderAcademyPage` 作為獨立 page shell，負責 auth、load/save、audio lifecycle、route exit。
- 狀態由 reducer 管理，action 必須可測且副作用集中在 shell / effects。
- 純邏輯拆到 `logic/`：
  - `typeChart`
  - `rng`
  - `battleLogic`
  - `battleSession`
  - `catchLogic`
  - `progression`
  - `evolution`
  - `bond`
  - `weighted`
  - `encounter`
  - `loot`
  - `wonderdex`
  - `fieldSkills`
  - `dailyTasks`
- `wonderAcademyCreatures.ts` 管 species registry、starter、wild、custom creatures、portrait mapping。
- `wonderAcademyRegions.ts` 管 regions、nodes、tile maps、warden data。
- `ExploreSceneKaplay.tsx` 與 `BattleStageKaplay.tsx` 包裝 canvas。
- `wonderAcademyAudio.ts` 管 SFX、loops、mute、volume。

如果檔案過大，優先拆出 screens / components，而不是新增跨層全域狀態。

## 15. 存檔與同步

存檔必須保護孩子的長期進度。Firestore 是正式持久來源；localStorage 只能是啟動快取與離線 pending queue。若目前實作採 localStorage primary、cloud best-effort，視為技術債，後續應收斂到本節。

Firestore path：

```text
gameProgress/{uid}/littleGames/wonderAcademy
```

要求：

- 未登入時，New Game / Continue 前要引導登入；不要默默建立只有本機存在的長期進度。可允許 guest demo，但必須明確標示不保證跨裝置保存。
- Save blob 包含 schema version。
- local cache 可用於快速啟動，但不能無提示覆蓋較新的 cloud save。
- 離線時寫入 pending save queue；恢復連線後同步。
- UI 顯示 Saved、Saving、Offline changes pending、Save failed。
- 保存失敗不能讓玩家誤以為已保存。
- Reset / New Game overwrite 必須二次確認。
- 跨裝置讀取時若 local 比 cloud 新，要提示「此裝置有尚未同步的進度」。

存檔時機：

- New Game 建立 starter 後。
- 每次進入或完成 node。
- 收服成功、Wonderdex 更新、Warden 完成、隊伍/技能/暱稱調整。
- 餵食、進化、購買、領取每日/圖鑑獎勵。
- 返回 Hub、離開 route、頁面背景化。
- 較長 Warden / chapter 事件需 phase checkpoint。

存檔資料至少包含：

- player name / uid
- starter species + nickname
- owned Wonderlings / team / loadouts
- Wonderdex states + shiny / variants
- region / node progress / wardens defeated
- snacks / stardust / materials / charms
- daily progress / claimed rewards
- custom creatures metadata
- audio settings
- schema version / updatedAt / pending sync metadata

## 16. 音效與音樂

聲音是療癒感的一部分，不是最後 polish。

方向：

- BGM 輕柔、溫暖、低壓力，適合親子長時間聽。
- Hub 像安靜學院與雲端房間。
- Region / Explore 有輕微地方感。
- Battle / Warden 有節奏，但不緊張刺耳。
- UI SFX 柔和：select、confirm、back、locked、unlock、save、treasure、Wonderdex update。
- Wonderling 互動音效避免高頻、突兀、過度重複。

必要 loop：

- `hub_loop`
- `region_map_loop`
- `mood_trial_loop` / normal battle loop
- `warden_trial_loop`

必要 SFX：

- `ui_select`
- `ui_confirm`
- `ui_back`
- `ui_locked`
- `node_unlock`
- `save_success`
- `save_pending`
- `attune_ready`
- `attune_success`
- `attune_fail_soft`
- `wonderdex_update`
- `snack_use`
- `bond_skill_ready`

音訊設定跟隨存檔同步，但本機互動必須立即生效。瀏覽器 autoplay policy 下，首次播放需由使用者手勢觸發。

## 17. 分階段

### Phase 1 — MVP 核心循環

- 獨立 `/games/wonder-academy` route，舊 `/games/monster-academy` redirect。
- Title、New Game、四選一 starter、暱稱、Hub。
- Region / node map。
- 1-2 個可走動探索場景：草叢、寶箱、NPC、出口。
- 1v1 battle：攻擊、切換、撤退、捕捉。
- 8 屬性相剋、4 招、HP、想睡捕捉。
- 收服、XP、level、bond、餵點心。
- Wonderdex：未見 / 已見 / 已收服。
- 至少一場 Warden。
- Firestore/local save 基礎與可理解 save status。
- Vitest 覆蓋核心純邏輯。

### Phase 2 — 深度與廣度

- 進化動畫 + 4 階進化完整化。
- 技能解鎖 / 裝備 / loadout。
- Field skills gating 探索。
- Shiny / variant 收集。
- 更多地點 / Warden / 稀有度 / 掉落表。
- Wonderdex completion rewards。
- App 內 Creature Builder。
- 第一種狀態效果：sleep。
- 第二 region 與更豐富探索場景。
- 存檔衝突、pending queue 與跨裝置同步完善。

### Phase 3 — 長期內容與打磨

- 更多章節、Wonderlings、Warden、postgame trials。
- 經濟 / 材料 / charms 精修。
- 每日任務、每日 reward、短期目標節奏。
- 音訊品質與區域 BGM 擴充。
- Reduced motion、mobile layout、keyboard/touch QA。
- 戰鬥、收服、進化、開寶箱等演出加汁。

## 18. 驗證策略

### Unit tests

- Species / move data validation。
- Type chart effectiveness。
- Battle damage、turn resolution、sleep、faint / sleepy 判定。
- Catch chance formula。
- Battle session：start、enemy turn、player attack、catch、switch、flee。
- RNG、weighted pick、encounter roll、loot roll。
- XP / level / evolution / bond。
- Wonderdex state promotion and completion。
- Field skill aggregation。
- Daily task rollover、progress、claim。
- Audio manifest、volume、mute、fallback。
- Save parser、schema migration、malformed save、local/cloud precedence、pending queue。

### Browser smoke

- 開啟 GameHub。
- 開啟 `/games/wonder-academy`。
- `/games/monster-academy` redirect 到新 route。
- New Game。
- 選 starter、輸入 player name / nickname。
- 進入 Hub。
- 開啟 Wonderdex、Team / Skills、Shop。
- 進入 Region Map 與 Node Map。
- 使用 mouse / touch / keyboard 選節點。
- Locked node 顯示條件。
- 進入 Explore Scene，確認 canvas 非空，可移動、草叢、寶箱、NPC、出口。
- 進入 Battle，確認 DOM 指令面板可操作。
- 完成捕捉、開寶箱、Warden。
- 離開 route 再進入，確認沒有重複 loop 或 stale canvas。
- reload / 換瀏覽器登入同帳號，確認 Firestore progress 可讀。
- 模擬離線與保存失敗，確認 pending / error UI。

### Visual QA

- Desktop / mobile screenshots。
- Canvas pixel check 非空。
- 文字不破版、不互相遮擋。
- 觸控目標最小 44px。
- Reduced motion 下動畫停止或簡化。
- CJK 文字正常顯示。
- Wonder Academy route 不繼承 main app layout。

## 19. 風險與待解問題

- **戰鬥平衡**：屬性倍率、野生等級、Warden 等級、捕捉率需要 playtest。
- **相剋可讀性**：10 歲要能一眼懂 UI。徽章、顏色、文案要實測。
- **收服手感**：稀有寵不能太難，也不能完全無腦。
- **美術廣度**：原創數量有限，需靠階段、variant、shiny、自訂寵物與後續追加支撐。
- **存檔一致性**：local/cloud/pending 的 precedence 必須明確，避免覆蓋孩子進度。
- **檔案邊界**：若單一 React file 過大，應拆 screens/components/hooks，保持可測性。
- **長期 scope**：完整章節世界很大；每階段都要交付可玩的垂直 slice，不一次吃完整世界。

## 20. 決策紀錄

| 決策 | 選擇 |
|---|---|
| 遊戲角色 | 私人親子共玩小遊戲，不公開發行 |
| 核心類型 | 寶可夢式探索 + 戰鬥捕捉 + 養成收集 |
| 舊玩法 | Mood Trial / Befriend 不再是主軸 |
| 調性 | 非暴力、療癒、可愛，但要有實際遊戲性 |
| 目標玩家 | 10 歲孩子 + 家長 |
| 戰鬥深度 | 8 屬性相剋 + 隊伍切換 + favorite snack |
| 捕捉 | 打到想睡 -> 遞點心收服 |
| 地圖 | 節點地圖 + 小型 walkable Kaplay scene |
| UI | DOM 控制層 + Kaplay 動態層 |
| 存檔 | Firestore 正式來源；localStorage 作 cache / pending |
| IP | Repo 只含原創內容；自訂管線允許私人自備圖 |
| 擴充 | 先核心循環，再章節、更多 Warden、postgame |
