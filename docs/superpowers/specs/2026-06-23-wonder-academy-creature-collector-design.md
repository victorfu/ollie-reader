# Wonder Academy 重新設計 —— 探索・捕捉・養成的萌系收集冒險

<metadata>
date: 2026-06-23
status: approved (design); pending implementation plan
supersedes: docs/superpowers/specs/2026-06-23-wonder-academy-redesign-design.md（取代其「療癒對話式」玩法方向）、docs/superpowers/specs/2026-06-21-wonder-academy-rpg-design.md（取代玩法方向）。三者共用的美術、音訊、與已強化的持久化層皆保留並延用。
audience: 開發者的 10 歲女兒(台灣國小四年級、繁中閱讀流暢)+ 開發者本人,親子共玩;私人使用、不公開發行。
</metadata>

## 1. 摘要與定位

前一版把 Wonder Academy 設計成「療癒系對話 befriend 遊戲」(讀情緒線索→選回應)。實際檢視後,核心問題是**缺乏遊戲性**——它比較像一則故事,而不是一款會讓孩子想一直玩的遊戲。本次重新設計把它轉成一款**寶可夢式的探索・捕捉・養成冒險**:在發光森林裡探索、尋寶、遇見野生寵物,用屬性相剋把牠打到「想睡」再遞點心收服,組隊、養大、進化,填滿圖鑑,挑戰各區守關魔王(Warden)。

**一句話:** 你和女兒是 Sparkleaf 星葉學院的見習馴獸師。出門探索 → 草叢遇見寵物 → 輕策略戰鬥打到牠想睡 → 遞點心收服 → 回學院養大/進化 → 解鎖更深的森林與更稀有的寵物 → 再出發。

**定位決策(與使用者腦力激盪確立):**

- **要的是遊戲性,不是故事。** 重點在「探索→戰鬥→捕捉→養成」這個會上癮的循環,而非劇情演出。
- **親子共玩、輕策略。** 目標玩家是 10 歲 + 家長。戰鬥保留真正的策略樂趣(屬性相剋、隊伍搭配),但去掉太硬的數值細節,節奏輕鬆好上手。
- **不暴力、療癒基調。** 寶可夢式「累倒/想睡」而非傷害;捕捉是「遞點心做朋友」而非強抓。延續既有世界觀的溫暖。
- **保留既有美術/音訊/存檔,重做玩法。** 既有的 4 隻初始寵物(含 sprite/立繪/剪影)、背景、BGM/SFX、雲端存檔同步全部沿用。
- **混合渲染。** 探索場景與戰鬥畫面用 Kaplay canvas(會動的 sprite、攻擊演出);選單、隊伍、圖鑑、背包用 React/DOM + Framer Motion(手感)。
- **美術可抽換 + 自訂寵物為一等公民。** 每隻寵物 = 一張圖 + 一筆資料;新增一隻要極簡。專案出貨只附**原創**萌寵;使用者可在私人版本用同一管線放入自己的圖。

## 2. 目標與非目標

**目標**
- 一個完整、會上癮的「探索 → 戰鬥 → 捕捉 → 養成 → 填圖鑑」循環,短時段也好玩、適合親子共玩。
- 輕策略但有深度感的戰鬥:8 屬性相剋一眼看懂,隊伍搭配有意義。
- 精心設計的**序章**(開場 → 選第一隻寵物 → 啟程),作為強烈的第一印象。
- 出色手感:控制層為真實 DOM 按鈕;探索/戰鬥的「會動感」交給 canvas。
- 最大化重用既有美術、音訊、持久化與已建模的資料系統(屬性、角色、技能、進化、地圖節點、守關魔王皆已存在)。
- **新增一隻寵物極簡**:丟一張圖 + 一筆資料即可——這也是使用者把家裡愛的角色加進私人版本的管道。

**非目標**
- 不公開發行、不做多人連線/排行榜/付費。
- **不暴力**:無流血、無死亡。戰鬥框架是「累倒/想睡」,捕捉是「遞點心做朋友」。
- 不在**專案出貨/版控內容**裡打包任何第三方版權角色或其美術(見 §7)。
- MVP 不依賴大量委製新美術(用既有原創寵物 + 變體/進化階段 + 自訂管線擴充)。
- 不做正統寶可夢的完整數值深度(PP、能力增減、複雜道具、狀態效果叢集)——MVP 走輕策略,深度留待後續分階段加。

## 3. 核心循環

一圈約 2–4 分鐘、可重複:

```
節點地圖選一個地點
   → 進入小探索場景(走動・踩草叢・開寶箱・找 NPC)
   → 草叢遇到野生寵物 → 進入戰鬥
   → 用屬性相剋把牠打到 HP 低、「想睡」
   → 遞點心收服 → 加入圖鑑
   → 回學院:餵點心養感情・升級・進化・換隊伍
   → 解鎖更深地點 / 更稀有寵物 / 守關魔王
   → 再出發 ↻
```

學院(Hub)是收集的情感錨點:收服到的寵物在此漫遊。

## 4. 序章:開場 → 選寵 → 啟程(精心設計)

序章是一段**一氣呵成、可跳過**的儀式,只在存檔尚未設定 `starterSpeciesId` 時播放;選完即設值並標記完成,之後自動略過。設計原則:**低文字、靠畫面與聲音帶情緒;handfeel 優先(DOM + Framer Motion);無新美術門檻(導師 NPC 先以對話框呈現);尊重 `reducedMotion`。**

### 4.1 六個 Beat

| Beat | 內容 |
|---|---|
| 0 · 標題 | Wonder Academy logo + 柔光 + `hub_loop`;「開始冒險」按鈕。 |
| 1 · 抵達學院 | 用 `academy-hub` 背景的破曉場景;原創導師 **薇拉院長 🦉** 登場歡迎,建立「你是新來的見習馴獸師」身分。視覺小說式對話框。 |
| 2 · 取名 | 「你叫什麼名字?」→ 輸入 `playerName`。 |
| 3 · 命運的相遇(核心) | 4 個發光剪影 → 逐一點擊使寵物醒來/探頭亮相(立繪 + SFX + squash/stretch);顯示名字、屬性徽章、玩法標籤、個性一句話、**進化線預覽(最終型)**。可來回比較。 |
| 4 · 確認與羈絆 | 選定 →「確定選 ___ 當第一個夥伴嗎?」→ 被選中的寵物開心跑向你(動畫 + `attune_success`/`ui_confirm` + 愛心)。情感高潮。 |
| 5 · 取暱稱 | 「幫牠取個暱稱嗎?」→ `starterNickname`(可跳過用本名)。 |
| 6 · 啟程(= 正式開始) | 導師給起始道具(數顆點心 + 收服用點心);學院大門打開,踏出第一步 → 切到節點地圖。**遊戲正式開始**,寫入 `starterSpeciesId`。 |

### 4.2 四選一的初始寵物(資料已存在)

4 隻剛好把 8 種屬性**各佔 2 種、零重疊**,設計上很乾淨;每隻在「屬性/戰鬥定位/場地技能」三軸都不同,讓選擇有意義(影響戰鬥手感,也影響早期能探索/挖到的東西)。

| 寵物 | 類型 | 屬性 | 戰鬥定位 | 最愛零食 | 場地技能 | 個性 | 進化線(4 階) |
|---|---|---|---|---|---|---|---|
| **Lumi** | 星光小狐 | light · spark | 速攻(striker/trickster) | starberry-cookie | light-trail | 聰明、急性子、想證明自己 | → Tailglow → Prismtail → **Aurorafox** |
| **Momo** | 雲朵小貓 | dream · tide | 守護/補(healer/guardian) | moon-milk-puff | soft-float | 愛睡、溫柔、關鍵時刻可靠 | → Rainpuff → Mooncloud → **Dreamnimbus** |
| **Pico** | 星塵小妖精 | star · leaf | 巧術/探索(trickster/scout) | clover-macaron | secret-sense | 好奇、愛惡作劇、會找祕密 | → Budspark → Wishpetal → **Celestibloom** |
| **Nibi** | 迷你小龍 | ember · crystal | 坦克/猛攻(guardian/striker) | warm-cocoa-gem | crystal-push | 勇敢、逞強、其實怕寂寞 | → Pebblehorn → Embercrest → **Hearthdrake** |

## 5. 三大支柱

### ① 探索(混合地圖)
- **節點地圖**(沿用 `sparkleaf-map`)作為移動骨幹:點節點旅行。
- 進入某些地點 = 一小塊**可走動的 Kaplay 場景**:小主角走動、**草叢觸發野生遭遇**、**寶箱**給點心/道具/材料、**NPC** 給對話與任務。
- **守關節點**(`kind: "warden"`)= 魔王戰,沿用 `warden_trial_loop` 與每章 `wardenSpeciesId`。
- **場地技能**(`fieldSkillId`:light-trail / soft-float / secret-sense / crystal-push)解鎖/加成特定探索內容(如 secret-sense 揭示隱藏寶箱或稀有寵物)——讓初始選擇與多樣化陣容有意義。
- 更深/更稀有的地點隨進度解鎖(`storyProgress` 指標已建模)。

**可單元測試的純邏輯:** 遭遇擲骰(given 地點 + 隊伍)、寶箱掉落表、節點解鎖條件。

### ② 戰鬥 + 捕捉(輕策略)
- 回合制 **1v1**,可在隊伍(在場最多 3 隻)間**切換**。
- 每隻 **4 招**;**無 PP**、**MVP 不做狀態效果**(照「親子輕鬆玩」路線)。
- 核心策略 = **8 屬性相剋**(見 §6):剋制 2×、被剋 0.5×。UI 用紅徽章「剋制 2×」即時提示,讓 10 歲一眼看懂。
- **捕捉(不暴力):** 把野生寵物打到 HP 低 → 進入「**想睡 😴**」狀態 → 用「**遞點心收服**」動作。成功率 = f(剩餘 HP 越低、稀有度、點心等級)。**帶其 `favoriteSnack`** = 大加成。失敗時牠**溫和逃走**(可再遇),不殘酷。
- 戰鬥拿 **XP**;魔王戰是區域里程碑。

**可單元測試的純邏輯:** 傷害計算、屬性相剋倍率、行動順序、收服成功率、勝負/逃走判定。

### ③ 收集 + 養成
- **升級**:戰鬥/收服得 XP → 提升能力、解鎖招式槽。
- **進化**:達等級門檻 + 條件,沿 `growthStages`(4 階)推進 = 視覺升級 + 變強,重要滿足感節拍。
- **技能**:`learnableSkillIds` / `equippedSkillIds` / `skillLoadouts`,升級解鎖、裝備有限數量。
- **感情(bond)**:餵 `favoriteSnack`、帶去探險而上升;高 bond 給加成 + 可愛互動。
- **圖鑑(Wonderdex)**:未見 / 已收服 / 已進化;分區完成 → 獎勵 → 驅動「全部收集」。
- **經濟極簡**:一種軟貨幣(如 Stardust)+ 少數進化材料;優先映射既有 `snacks`/`charms`/`careerLevels`,必要時加小型 `materials`。

## 6. 屬性相剋(輕策略型)

8 屬性排成一個平衡循環,**每個剋制循環中接下來 2 個、被前面 2 個剋制,其餘普通**。初版循環(保留直覺對應:電剋水、火剋草、水剋火),確切數值於實作 playtest 微調:

```
spark → tide → ember → leaf → crystal → dream → star → light →(回到 spark)
```

| 屬性 | 剋制(2×) | 被剋(0.5×) |
|---|---|---|
| spark ⚡ | tide, ember | light, star |
| tide 🌊 | ember, leaf | spark, light |
| ember 🔥 | leaf, crystal | tide, spark |
| leaf 🍀 | crystal, dream | ember, tide |
| crystal 💎 | dream, star | leaf, ember |
| dream 🌙 | star, light | crystal, leaf |
| star ⭐ | light, spark | dream, crystal |
| light ☀️ | spark, tide | star, dream |

雙屬性寵物:對其任一屬性的剋制取「最有利」倍率(MVP 簡化;細節留實作)。

## 7. 自訂寵物管線(一等公民)+ 美術策略

每隻寵物 = **一筆資料 + 一張圖**(`portraitAsset`/`spriteAsset`/可選 `silhouetteAsset` + `artPrompt` 欄位已存在)。架構上「角色」與「美術」完全解耦——戰鬥/捕捉/地圖/相剋/進化都不在意最終塞什麼圖。

- **新增一隻寵物極簡**:把圖放進資料夾 + 加一筆 species 資料(名字、屬性、招式、進化、最愛零食、稀有度)。
- **MVP**:用「丟檔 + 資料」的開發者流程即可。**Phase 2** 可做 app 內「建立寵物」表單(上傳圖、填欄位,存進個人存檔/Storage)。
- **美術廣度**:目前約 6 隻原創設計(4 初始 + Mossmew + Sparkleaf Fawn)。以「**可擴展架構 + 延展既有美術**」放大收集量:4 進化階段各算一筆圖鑑、顏色/屬性變體(tinting,不重畫)、稀有度階層 → 約 6 base 可撐 20+ 圖鑑格。

**版權邊界(明確):** 本專案**出貨與版控內容只包含原創萌寵與原創美術**,不打包任何第三方版權角色(如各家商業吉祥物)或其圖。自訂寵物管線是**內容中性**的能力(類似自訂 sprite 包);使用者在自己的私人、不公開版本裡要放入哪些自有圖檔,屬其自行決定與自備,不由本專案產製或散布。

## 8. 渲染架構(混合)

```
┌─────────────────────────────────────────────┐
│  React / DOM + Framer Motion（控制層）         │
│  序章卡片・選單・隊伍・圖鑑・背包・戰鬥指令面板    │
│   ┌─────────────────────────────────────┐     │
│   │  Kaplay canvas（會動的層）             │     │
│   │  探索場景(走動/草叢/寶箱)、            │     │
│   │  戰鬥舞台(sprite/攻擊演出/想睡)        │     │
│   └─────────────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

- **控制項全留 DOM** → 手感從根本修正(真實按鈕、hover/focus、RWD、a11y、設計系統)。
- **Kaplay 負責「會動的場景」**:探索的可走動場景 + 戰鬥舞台的 sprite 與演出;戰鬥的指令面板(招式/收服按鈕)仍是 DOM 疊加層 → 視覺有汁、按鈕手感好。
- **不需 spritesheet**:單立繪「偶動畫」(移動 + squash + hop)即可,契合既有美術;逐格動畫是後期投資。
- 重用既有 `kaplayLifecycle` helper。
- **CJK 注意**:canvas 內文字須傳 CSS font-family(PingFang TC / Noto Sans TC),避免豆腐字;盡量讓文字留在 DOM 層。

## 9. 技術架構

**保留**
- `services/wonderAcademyProgressService.ts` + `components/.../wonderAcademyPersistence.ts` —— 已強化的雲端/本地存檔同步,原樣重用。
- `wonderAcademyAudio.ts` —— 音樂/SFX 管理器,接上新 UI。
- `data/wonderAcademyData.ts` + `types/wonderAcademy.ts` —— 內容資料 + schema,保留並擴充。

**替換**
- `components/LittleGames/wonder-academy/wonderAcademyGame.ts`(1083 行全 Kaplay UI)→ 角色縮小為「探索場景 + 戰鬥舞台」兩個 canvas 模組。
- `WonderAcademyHost.tsx`(canvas host)→ 改造為 canvas 場景的包裝層。
- 596 行萬用 `wonderAcademyLogic.ts` → 依領域切成純、可測試模組:`battleLogic`、`catchLogic`、`explorationLogic`、`progressionLogic`、`dexLogic`、`typeChart`。保留 reducer 模式、重設 action 集合。

**新增(遵循 CLAUDE.md:Context/hooks、PascalCase 元件、camelCase utils、2-space、strict TS)**
- `WonderAcademyPage.tsx` —— 精簡為 auth / load / save 外殼。
- `useWonderAcademyGame.ts`(hook)—— 狀態 + dispatch。
- `screens/`:`IntroSequence`(序章)、`HubScreen`、`MapScreen`、`ExploreScene`(Kaplay 包裝)、`BattleScreen`、`TeamScreen`、`WonderdexScreen`、`BagScreen`。
- `components/`:`StarterCard`、`DialogueBox`、`WonderlingCard`、`TeamPicker`、`HpBar`、`MoveButton`、`TypeBadge`、`CatchPrompt`、`CreatureSprite`、`BattleStage`/`ExploreCanvas`(Kaplay wrappers)等。
- **狀態管理**:Reducer(`applyWonderAcademyAction`)+ context/hook,符合「Context API 管全域、custom hooks 管業務邏輯」慣例。

**測試**:vitest(專案 runner)。純邏輯(相剋倍率、傷害、收服率、遭遇/掉落擲骰、升級/進化門檻、圖鑑完成度)以 TDD 開發。既有持久化測試保留。

**路由/入口**:維持現狀。

## 10. 資料模型改動

既有 `WonderAcademyProgress` 已涵蓋多數所需(`ownedWonderlings`、`wonderdex`、`keeperTeam`、`skillLoadouts`、`snacks`、`charms`、`careerLevels` 等)。改動:

- **提升 `schemaVersion`(1 → 2)並重置舊存檔**(無遷移)。理由:遊戲早期、唯一玩家是開發者家庭;新結構差異大。存檔機制不變,只變 blob 結構。
- **新增資料(內容層,非存檔)**:`typeChart`(§6)、`moves`(招式:屬性、威力、效果)、每地點的 `encounterTable`(野生物種 + 機率)、`treasureTable`、野生寵物的等級範圍。
- **存檔新增**:`materials: Record<string, number>`(或復用 `charms`/`careerLevels`,實作時定案);(Phase 2)`customCreatures` 存放使用者自建寵物。
- **戰鬥屬性**:在 species/owned 上補必要的戰鬥數值(HP、攻防或簡化的 power、各 owned 的當前 HP/狀態於戰鬥期暫存)。
- **擴充 `wonderdex` enum**:表示 未見/已收服/已進化(或加平行 `wonderdexVariants` map),實作時定案。
- **啟用既有停擺欄位**:`fieldSkillId`、`growthStages`、`learnableSkillIds`、`favoriteSnack`、`rarity`、`personality`、各章 `wardenSpeciesId`、節點 `kind`。
- 序章的初始選擇 UI 取代暫時寫死的「直接給 Lumi」。

## 11. 分階段

每階段都交付可玩成果;先把「探索→戰鬥→捕捉→養成」核心做好,再加深度。

**Phase 1 — MVP(垂直切片:核心循環手感良好)**
- React UI 外殼 + 導覽 + DaisyUI/Framer Motion;Kaplay 縮為探索/戰鬥場景;新 schema + 重置 + 重用持久化。
- **序章**(開場 → 四選一選寵 → 羈絆 → 啟程)。
- **探索**:節點地圖 + 1–2 個可走動小場景(草叢遭遇、寶箱、NPC)。
- **戰鬥**:1v1 + 切換、8 屬性相剋、每隻 4 招、HP;無 PP、無狀態。
- **捕捉**:打到想睡 + 遞點心 + 最愛零食加成。
- **養成**:餵點心、升級、基本 bond。
- **圖鑑**:未見/已收服 + 收集總覽。
- **一場守關魔王戰**作為里程碑。
- 既有約 6 隻寵物;純邏輯由 vitest 覆蓋。自訂寵物支援「丟檔 + 資料」流程。
- → 一款完整的小遊戲:探索 → 戰鬥 → 收服 → 養成 → 填圖鑑。

**Phase 2 — 深度與廣度**
- 進化動畫 + 4 階進化全開;技能解鎖/裝備、場地技能 gating 探索;顏色/屬性變體(shiny)擴充收集;更多地點/魔王/稀有度/掉落表;圖鑑完成獎勵;**app 內「建立寵物」上傳表單**;狀態效果(先加 1 種,如「想睡」入戰);更豐富的探索場景。

**Phase 3 — 內容與打磨(持續)**
- 更多寵物與區域;經濟/材料精修;每日節奏;音訊與無障礙(reduced-motion)打磨;探索/戰鬥演出加汁。

## 12. 風險與待解問題

- **戰鬥平衡**:輕策略要「有得想又不卡關」,屬性循環倍率與野生等級需 playtest 微調。
- **相剋可讀性**:10 歲要能一眼看懂剋制——徽章/顏色/提示文案需測。
- **美術廣度**:收集要夠豐富;以變體/階段緩解,隨陣容成長再評估。
- **收服手感**:成功率公式(HP/稀有度/點心)要「努力打就抓得到、稀有的要拼一下」的甜蜜點。
- **場景範圍蔓延**:MVP 探索場景保持小(走動 + 草叢 + 寶箱),日夜/視差等留 Phase 2+。
- **材料/經濟結構**、**圖鑑變體表示法**:實作計畫定案。
- **進化階段數假設**:進化邏輯的 `EVOLUTION_LEVELS` 目前寫死 3 個門檻(對應 4 階成長線)。若未來有寵物超過 4 階,會在第 2 階後無聲卡住、無法再進化。reducer/整合計畫需限制 `totalStages <= EVOLUTION_LEVELS.length + 1`,或改為每物種自帶門檻。

## 13. 決策紀錄(來自腦力激盪)

| 決策 | 選擇 |
|---|---|
| 在 app 中的角色 | 純樂趣遊戲;**要遊戲性、非故事**;不公開、親子共玩 |
| 類型方向 | 寶可夢式:地圖探索 + 尋寶 + 戰鬥捕捉 + 養成 |
| 目標玩家 | 10 歲(國小四年級,繁中流暢)+ 家長共玩 |
| 戰鬥深度 | **輕策略**:8 屬性相剋 + 隊伍切換;無 PP、MVP 無狀態效果 |
| 捕捉機制 | 打到「想睡」→ 遞點心收服;不暴力;最愛零食加成;失敗溫和逃走 |
| 地圖探索 | **混合**:節點地圖移動 + 場景小探索(草叢/寶箱/NPC) |
| 序章 | 精心設計、一氣呵成:開場 → 四選一選寵 → 羈絆 → 啟程才算正式開始 |
| 導師角色 | 原創「薇拉院長 🦉」,MVP 先以對話框呈現 |
| 美術/IP | 出貨只附**原創**萌寵;美術可抽換;自訂寵物管線供使用者於私人版本自備自有圖 |
| 渲染 | 混合:探索/戰鬥用 Kaplay canvas,選單/控制用 DOM + Framer Motion |
| 存檔遷移 | 重置(bump schemaVersion);無遷移 |
