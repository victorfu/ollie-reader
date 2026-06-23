# Wonder Academy 重新設計 —— 療癒系收集養成遊戲

<metadata>
date: 2026-06-23
status: approved (design); pending implementation plan
supersedes: docs/superpowers/specs/2026-06-21-wonder-academy-rpg-design.md（僅取代玩法方向 —— 該版本的美術素材、音訊，以及已強化的持久化層皆予以保留）
</metadata>

## 1. 摘要與定位

Wonder Academy 目前是一款完全在 Kaplay canvas 上渲染的薄型回合制探索／羈絆 RPG。玩家只有一隻寫死的初始夥伴（Lumi），在節點地圖上行走，並完成單一腳本化的「Mood Trial」來與一隻生物結為朋友。大多數系統（技能、零食、升級、隊伍、進化、其他生物、第二章）在資料中已建模卻是停擺狀態。整體只有一場可玩的遭遇（約 5–10 分鐘）。其互動本質是「畫在 canvas 上的假按鈕」，這正是手感不佳的根源。

本次重新設計保留美術、音訊與存檔系統，並**將玩法重建為一款療癒系收集養成生物遊戲**。

**一句話定位：** 你是 Sparkleaf Academy 的飼育員。你派遣可愛的 Wonderlings 進行短程探險，深入發光的森林，與牠們遇見的生物結為朋友，把牠們養大（升級／進化／技能），並填滿你的 Wonderdex。

**明確的定位決策（與使用者在 brainstorming 時共同確立）：**

- **純粹的樂趣，而非英語學習。** 這款遊戲是一種放鬆的「休息」體驗。它刻意**不**教授英語內容、也不以英語內容作為通關門檻。（這消除了「學習 app 內含一款不教學的寵物遊戲」的違和感 —— 透過刻意讓「休息遊戲」這個角色成立。）
- **保留既有美術、重做玩法。** 重用學院／森林背景、4 張初始夥伴肖像（Lumi/Momo/Pico/Nibi）、生物肖像，以及 4 首 BGM 與 SFX。
- **核心樂趣 = 收集 + 養成。** 「玩得越多越豐富，讓你停不下來。」這同時呼應了玩家的第一直覺（「我不是應該要選一個夥伴嗎？」）。
- **手感必須出色。** 控制層移出 canvas，改為真正的 React/DOM UI。
- **混合渲染。** 玩家想要一個「有生命、會動的場景」。因此 UI 為 DOM，但由一個專屬、隔離的 canvas 元件（重用 Kaplay）渲染這個有生命的場景（生物在學院中漫遊）。

## 2. 目標與非目標

**目標**
- 一個完整、令人滿足的「收集 → 養成 → 填滿圖鑑」循環，在短時段內也好玩。
- 出色的手感：真實按鈕、hover/focus、響應式（行動裝置 + 桌機）、無障礙、與設計系統一致、流暢的 Framer Motion 轉場。
- 一個「有生命的家」學院場景，讓玩家的生物感覺鮮活。
- 最大化重用既有美術、音訊、持久化，以及已建模的資料系統。
- 讓新增一隻生物變得輕而易舉（放進美術素材 + 一筆資料即可）。

**非目標**
- 不整合英語學習。
- 不含戰鬥／暴力 —— 羈絆是情感的、和諧的，與既有的基調一致。
- 不做多人連線、排行榜或付費機制。
- MVP 不依賴大量委製新美術（用變體 + 成長階段來延展既有美術）。
- 並非一次性建置 —— 分階段交付（見 §11）。

## 3. 核心循環

單一循環約 1–3 分鐘且可重複：

```
派遣一支隊伍前往森林目的地
   →（短暫的即時探險）
   → 隊伍帶著素材 + XP 返回，並有機率遇見新生物
   → Befriend 互動將該生物加入 Wonderdex
   → 養成生物（餵零食 · 升級 · 進化 · 裝備技能）
   → 解鎖更深的森林 / 更稀有的生物
   → 再次派遣 ↻
```

主基地（Academy）是一個有生命的場景，收集到的生物在其中漫遊；它是整個收集體驗的情感錨點。

## 4. 畫面與導覽

共五個畫面，全部為真實的 React UI，透過底部分頁列（行動裝置）／側邊欄（桌機）切換，與 app 的 macOS-HIG 設計系統一致（DaisyUI + `src/index.css` 內的 Tailwind tokens）。

1. **Academy（首頁）** —— 有生命的場景（Kaplay canvas），顯示當前隊伍／收藏在其中漫遊；今日問候；一眼掌握的收集進度；通往其他所有畫面的入口。DOM 控制項疊加在 canvas 之上。
2. **Expeditions** —— 選擇一個目的地（既有的地圖節點），指派 1–3 隻 Wonderling 組成隊伍並派遣。多個探險槽位（從 1 個開始，可解鎖更多）。返回的探險會顯示一段有「汁感」的成果揭曉。
3. **Befriend** —— 當探險遇見新生物時觸發。「讀懂生物 → 給出合宜回應」的互動。成功後將其加入 Wonderdex。（可選的混合方案：生物本身在小 canvas 中渲染以增添生氣；回應按鈕仍為 DOM。）
4. **Nursery（養成）** —— 餵零食、升級、進化（4 個成長階段）、裝備技能、看著羈絆成長。
5. **Wonderdex** —— 收藏：已見／已結友／已進化等狀態；區域完成獎勵；驅動「全部收集」的動力。

## 5. 樂趣支柱一 —— Befriend 互動

以一個**讀懂並回應**的微互動（約 15–30 秒）取代固定流程的 Mood Trial（comfort → flash → snack → attune）。這是主要的*主動*樂趣。

**機制**
- 野生生物會發出**情緒線索**（害羞探頭、興奮彈跳、肚子咕嚕、好奇靠近⋯），透過 Framer Motion 偶動畫（squash/stretch、bob）、漂浮愛心與 SFX 呈現。
- 玩家擁有一小組**回應動作**（安撫 / 玩耍 / 給零食 / 送禮 / 哼歌⋯）。
- **線索與回應相符** → 信任上升 + 開心反應。**不相符** → 受驚上升 + 退縮。
- 每個物種都有一種**性情**（既有的 `personality` 欄位），會偏向特定線索的出現；玩家在幾個回合內逐漸「讀懂」這隻生物。
- **信任量表**朝著「已結友 🎉」累積。**受驚量表**先填滿則代表生物逃走 —— 但是*溫和地*（之後仍可再次遇見；無嚴厲懲罰，符合療癒基調）。
- 帶上生物的**最愛零食**（既有的 `favoriteSnack` 欄位）能給予大量信任加成 → 促使玩家在探險中收集零食並偵察偏好。
- 越稀有的生物（既有的 `rarity` 欄位）→ 回合越多 / 線索越挑剔。

**重用：** `personality`、`favoriteSnack`、`rarity`、零食庫存、SFX、肖像。

**可做單元測試的純邏輯：** 線索生成（seeded）、在給定（線索、回應、性情、零食）下的信任／受驚結算、勝敗判定。

## 6. 樂趣支柱二 —— Expeditions

收集養成的引擎；*閒置／返回*的節奏。

**機制**
- 每個**目的地** = 一個既有的地圖節點，包含：主題、時長、戰利品表（素材 + 可能出現的物種）、建議隊伍等級，以及所需／加成的場地技能。
- 指派 **1–3 隻 Wonderling**。隊伍等級／屬性／技能會影響結果：等級越高 → 越快、戰利品越好、稀有遭遇機率越高。
- **場地技能**（既有的 `fieldSkillId`：light-trail / soft-float / secret-sense / crystal-push）可解鎖或加成特定目的地（例如 secret-sense 能揭示躲在洞穴中的生物）。這終於讓場地技能有了用處，並獎勵玩家培養*多樣化*的陣容。
- **時長：** 短暫的即時等待。持久化 `startedAt` + `durationMs`；在載入／返回時以系統時鐘比對來結算完成（單人療癒遊戲 —— 不需防作弊）。可選的加速。
- **槽位：** 從 1 個開始，可解鎖更多 → 帶來「同時跑好幾趟、回頭查看」的滿足感。
- **返回揭曉：** 素材清點 + 獲得的 XP；亮點「✨ 遇見了一隻新生物！」會交棒給 Befriend 互動。
- 更深／更稀有的節點隨進度解鎖（劇情指標已建模）。

**重用：** 地圖節點、`fieldSkillId`、`keeperTeam` 槽位、零食／素材、XP/level。

**可做單元測試的純邏輯：** 探險結算（在給定隊伍 + 目的地下，seeded 的戰利品／遭遇擲骰）、完成計時。

## 7. 進度與收集

**養成（每隻 OwnedWonderling —— 欄位皆已存在）**
- **升級：** XP 來自探險（與結友）。提升能力值；解鎖技能槽。
- **進化：** 在等級門檻 + 素材條件下，沿既有的 4 個 `growthStages` 推進。進化 = 視覺升級 + 力量提升；是收集／滿足感的重要節拍。
- **技能：** 既有的 `learnableSkillIds` / `equippedSkillIds` / `skillLoadouts`。升級時解鎖、可裝備有限數量；技能對探險（場地技能）與結友（部分回應）皆有影響。
- **羈絆：** 透過餵食最愛零食與帶生物去探險而上升；高羈絆給予加成 + 可愛互動（療癒層）。

**貨幣／素材（刻意極簡）**
- 一種軟貨幣（例如「Stardust」）+ 幾種進化素材類型。
- 映射到既有欄位：`snacks`（零食庫存）、`charms` / `careerLevels` 可重用；若有需要再加一個小型 `materials` 庫存。不做複雜經濟系統。

**收集 / Wonderdex**
- 顯示所有可發現的物種及其狀態：未見 / 已見 / 已結友 / 已進化（擴充既有的 `wonderdex` 狀態 enum）。
- 區域完成 → 獎勵 → 驅動「全部收集」。

**美術廣度限制（誠實面對）**
今天只有約 6 張生物肖像（4 隻初始夥伴 + Mossmew + Sparkleaf Fawn）。一款「大量收集」的遊戲需要廣度。策略 —— **建構可擴展的架構 + 延展既有美術**，而*非*為 MVP 委製大量美術：
1. **可擴展架構：** 新增一隻生物 = 放進美術素材 + 一筆資料。
2. **以少數基礎設計衍生出多倍收集量：** 4 個成長階段形態各算一筆圖鑑條目；顏色／屬性變體（shiny / 季節調色透過 tinting —— 無需重畫）；稀有度階層。約 6 個基礎設計 → 20+ 圖鑑欄位，且不需新繪製。
3. **（可選，後期）** 使用者新增／生成新肖像；系統將其整合進來。

## 8. 有生命的場景（混合渲染）

玩家想要一個有生命、會動的場景；這正是 canvas／遊戲引擎真正發揮價值之處（大量移動的 sprite、環境動態），因此 **Kaplay 保留但重新定位** —— 從「整個遊戲」縮小為「有生命的場景元件」。

```
┌─────────────────────────────────────────────┐
│  React / DOM + Framer Motion（控制層）         │
│  按鈕、清單、卡片、選單、隊伍指派、              │
│  befriend 回應、nursery、dex …                │
│   ┌─────────────────────────────────────┐     │
│   │  Kaplay canvas（有生命的場景層）        │     │
│   │  生物在學院大廳漫遊、                    │     │
│   │  待機 bob/hop、點擊 → 可愛反應           │     │
│   └─────────────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

- **所有控制項都留在 DOM** → 手感從根本上修正（真實按鈕、hover/focus、RWD、a11y、設計系統）。
- **Kaplay 只渲染環境場景**，嵌在 DOM 畫面內，重用既有的 `kaplayLifecycle` 輔助函式。界線清晰 —— 不再回到全 canvas 的假按鈕。
- **不需要 spritesheet：** 採用單肖像「偶動畫」（移動 + squash + hop），就像目前的漂浮肖像那樣；契合既有美術。更豐富的逐格動畫是後期的美術投資。
- **放置位置：** 主要的生命場景 = Academy 大廳（生物漫遊、點擊撫摸）。MVP 推出一個*基本*的生命大廳（當前隊伍漫遊 + 點擊反應）。Phase 2+：整個收藏漫遊、日夜、視差、環境反應；可選的森林探險動畫場景，以及 Befriend 畫面中一隻活靈活現的生物。
- **CJK 注意事項：** 任何 canvas 內文字都必須傳入一個 CSS font-family（PingFang TC / Noto Sans TC 字體堆疊），以避免出現豆腐字（已知的 Kaplay 限制）。盡量讓文字留在 DOM 層；canvas 應大致無文字。

## 9. 技術架構

**保留（可運作、有價值的部分）**
- `services/wonderAcademyProgressService.ts` + `wonderAcademyPersistence.ts` —— 已強化的雲端／本地存檔同步；以 progress blob 為操作對象，原樣重用。
- `wonderAcademyAudio.ts` —— 音樂／SFX 管理器；接上新 UI。
- `data/wonderAcademyData.ts` + `types/wonderAcademy.ts` —— 內容資料 + schema；保留並擴充。

**替換（手感問題的根源）**
- `wonderAcademyGame.ts`（1083 行的全 Kaplay UI）→ 不再作為 UI。其角色縮小為一個小型的生命場景 canvas 模組。
- `WonderAcademyHost.tsx`（canvas host）→ 移除／改造為生命場景的包裝層。
- 生物／UI 動畫 → 在 DOM 中改用 Framer Motion + CSS。

**新增（新結構，遵循 CLAUDE.md 慣例：Context/hooks、PascalCase 元件、camelCase utils、2-space、strict TS）**
- `WonderAcademyPage.tsx` —— 精簡為 auth / load / save 外殼。
- `useWonderAcademyGame.ts`（hook）—— 狀態 + dispatch + 探險計時器（以時間戳為基礎；於載入時結算）。
- `screens/`：`HubScreen`、`ExpeditionScreen`、`BefriendScreen`、`NurseryScreen`、`WonderdexScreen`。
- `components/`：`WonderlingCard`、`TeamPicker`、`ExpeditionSlot`、`TrustMeter`、`CreatureSprite`、`LivingScene`（Kaplay 包裝層）等。
- **依領域切分為純粹、可測試的模組**（befriend / expedition / progression / dex），取代 596 行的萬用 `wonderAcademyLogic.ts`。保留 reducer 模式；action 集合為新循環重新設計。

**狀態管理**
- Reducer（`applyWonderAcademyAction`）+ 一個持有狀態與 dispatch 的 context/hook，符合 app 的「Context API 管理全域狀態、custom hooks 管理業務邏輯」慣例。
- 探險以 `{ destinationId, teamOwnedIds, startedAt, durationMs, status }` 儲存；完成由系統時鐘計算；於載入／返回時結算。

**測試：** vitest（專案 runner）。純邏輯（探險結算、befriend 信任計算、升級／進化、圖鑑完成度）以 TDD 開發。保留既有的持久化測試。

**路由／入口：** 維持現狀。

## 10. 資料模型變更

既有的 `WonderAcademyProgress` 已建模了我們所需的大部分內容（`ownedWonderlings`、`wonderdex`、`keeperTeam`、`skillLoadouts`、`snacks`、`charms`、`careerLevels`、音訊／無障礙設定）。變更如下：

- **提升 `schemaVersion`**（1 → 2）並**重置舊存檔**（不做遷移）。理由：遊戲仍在早期、唯一玩家是開發者本人；新結構差異夠大，遷移不值得其風險／成本。存檔的*機制*不變 —— 改變的只有它承載的 blob 結構。
- **新增**一個 `expeditions` 陣列（如上所述的進行中／排隊探險槽位）與 `expeditionSlots` 數量。
- **新增**一個 `materials: Record<string, number>` 庫存（若規劃時發現 `charms`/`careerLevels` 能乾淨地對應，則重用之）。
- **擴充** `wonderdex` 的 value enum 以表示階段／變體的收集狀態（例如各階段的已見／已擁有），或新增一個並行的 `wonderdexVariants` map —— 確切結構於實作計畫中決定。
- **重新啟用**目前停擺的欄位（`fieldSkillId`、`growthStages`、`learnableSkillIds`、`favoriteSnack`、`rarity`、`personality`），依 §5–§7 注入實際機制。
- 初始夥伴選擇 UI（Lumi/Momo/Pico/Nibi）取代暫時寫死的「Start with Lumi」畫面，呼應原本「選擇你的第一個夥伴」的目標。

## 11. 階段規劃

每個階段都交付可玩的東西；先建構樂趣核心，再增添深度。

**Phase 1 —— MVP：核心循環手感良好（垂直切片）**
- React UI 外殼 + 導覽 + DaisyUI/Framer Motion；移除作為 UI 的 Kaplay；新 schema + 重置 + 重用持久化。
- **初始夥伴選擇**（4 隻初始夥伴）取代佔位畫面。
- **Expeditions：** 2–3 個目的地、隊伍指派、短暫的即時計時器、帶著素材／XP／遭遇機率返回。
- **Befriend：** 讀懂並回應的互動，含信任／受驚 + 最愛零食加成。
- **Nursery：** 餵零食、升級、基本羈絆。
- **Wonderdex：** 已見／已結友狀態 + 收集總覽。
- **基本的生命 Academy 大廳**（當前隊伍漫遊 + 點擊反應）—— 交付玩家想要的「生命場景」感受。
- 既有約 6 隻生物；純邏輯以 vitest 覆蓋。
- → 一款完整的小遊戲：收集（探險 + 結友）→ 養成（升級／餵食）→ 填滿圖鑑。

**Phase 2 —— 深度與汁感**
- 進化（4 個成長階段）+ 進化動畫；技能（解鎖／裝備；場地技能作為探險門檻）；顏色／屬性變體（shiny）以擴大收集；更多探險槽位 / 更深節點 / 稀有度階層 / 戰利品表；圖鑑完成度獎勵；更豐富的生命場景（整個收藏漫遊、日夜、視差）。

**Phase 3 —— 內容與打磨（持續進行）**
- 更多生物（放進美術即可）；Sparkleaf Grove 以外的區域；charms/career 系統；每日節奏；音訊打磨；無障礙 + reduced-motion 檢查；可選的森林／befriend 動畫 canvas。

## 12. 風險與待解問題

- **美術廣度**是「大量收集」能否豐富的主要風險；以變體／階段緩解（§7），隨陣容成長再行檢視。
- **即時探險時長**需要為一款休息遊戲調校（短到令人滿足，又長到能形成回頭查看的節奏）；確切數值於實作／playtesting 中決定。
- **素材／經濟結構**（新增 `materials` 或重用 `charms`/`careerLevels`）於實作計畫中定案。
- **Wonderdex 變體表示法**（擴充 enum 或並行 map）於實作計畫中定案。
- **生命場景的範圍蔓延** —— 讓 MVP 的場景保持基本（隊伍漫遊 + 點擊）；在 Phase 2 之前抗拒加入日夜／視差。

## 13. 決策紀錄（來自 brainstorming）

| 決策 | 選擇 |
|---|---|
| 在 app 中的角色 | 純樂趣「休息」遊戲；**不**綁定英語學習 |
| 美術與世界觀 | 保留既有美術／音訊；重做玩法 |
| 核心樂趣 | 收集 + 養成 |
| 玩法方向 | A —— 派遣／探險型收集 |
| 手感修正 | 控制層 → React/DOM + Framer Motion |
| 生命場景 | 是 —— 混合；Kaplay 重新定位為生命場景 canvas |
| 存檔遷移 | 重置（提升 schemaVersion）；不做遷移 |
| Kaplay | 僅保留給生命場景元件 |
