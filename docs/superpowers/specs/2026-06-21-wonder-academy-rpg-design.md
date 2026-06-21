# Wonder Academy RPG 設計規格

日期：2026-06-21

## 狀態

本設計已通過方向確認，準備作為後續實作計畫的基礎。這份文件只描述遊戲設計，不包含程式實作。

## 設計目標

- 做成一個真正有世界觀、章節、隊伍、成長與收藏的 RPG，不是小型 demo。
- 整體感覺要可愛、溫暖、療癒，但仍保留 RPG 策略深度。
- 避免使用 monster / battle / capture 這類打怪語彙。
- 可收集角色統稱為 **Wonderlings**。
- 玩家身份是 **Wonder Keeper**。
- Starter 必須能讓玩家自訂名字。
- 內建角色與資產全部使用原創設定。
- 可以支援本機自訂角色槽，但專案不內建、不產生、不提交可識別第三方 IP 角色或名稱。

## 核心名詞

| 概念 | 遊戲內名詞 |
| --- | --- |
| 遊戲 | Wonder Academy |
| 玩家身份 | Wonder Keeper |
| 可收集角色 | Wonderlings |
| 圖鑑 | Wonderdex |
| 建立連結 | Attune |
| 挑戰 / 戰鬥系統 | Mood Trial |
| 玩家隊伍 | Keeper Team |
| 區域守護者 | Warden |
| 傳說級角色 | Mythlings |
| 本機自訂角色槽 | Guest Wonderling Slot |

## 核心概念

Wonder Academy 是一所漂浮在雲海上的學院，連接著許多溫暖奇幻的區域：發光森林、玻璃海岸、鐘塔宿舍、雲端市集、雪鈴山脊、夢境祭典、星空列車，以及最終的 Crystal Bell Tower。

玩家是剛入學的新生 Wonder Keeper。入學日當天，維繫整個學院與各地區情緒節奏的 **Crystal Bell** 突然失去聲音。鐘聲消失後，Wonderlings 和 Wardens 開始變得焦躁、害羞、封閉或迷路。牠們不是敵人，也不是壞掉了，而是需要被理解。

玩家會選擇一隻初始夥伴 Wonderling，替牠取名字，並和老師、同學與 Keeper Team 一起前往各地，找回散落的 Bell Tones，逐步讓 Crystal Bell 重新響起。

## 故事調性

- 溫暖、可愛、適合親子一起玩。
- 有神秘感，但不陰暗。
- 衝突來自誤解、孤單、害怕、記憶遺失與信任破裂。
- Mood Trial 的目標不是擊敗對方，而是安撫、理解、建立連結。
- 小孩能理解主要目標，大人能看到隊伍、技能、職業與圖鑑策略。

## Starter 系統

遊戲開局提供四隻初始夥伴 Wonderlings。玩家從中選一隻作為第一個夥伴，並可以替牠輸入暱稱。

資料儲存方式：

- `speciesName`：固定物種名稱，例如 `Lumi`。
- `nickname`：玩家輸入的暱稱。
- `displayName`：若有 nickname 就顯示 nickname，否則顯示 speciesName。

### Lumi

- 物種：星光小狐
- 屬性：Light / Spark
- 定位：Striker / Trickster
- 個性：聰明、急性子、很想證明自己
- 玩法：速度快、互動多、擅長連擊與干擾，也能提高 Attune 成功率
- Field Skill：**Light Trail**，照亮隱藏路線並找出星塵道具

Bond Forms：

- Lumi
- Lumi Tailglow
- Lumi Prismtail
- Lumi Aurorafox

代表技能：

- Tiny Flash
- Zip Spark
- Wink Feint
- Starstep Dash
- Bond Skill: Aurora Parade

### Momo

- 物種：雲朵小貓
- 屬性：Dream / Tide
- 定位：Healer / Guardian
- 個性：愛睡、溫柔、慢半拍，但關鍵時刻很可靠
- 玩法：回復、護盾、容錯高，適合穩健與療癒玩法
- Field Skill：**Soft Float**，讓隊伍跨過裂縫或飄到雲平台

Bond Forms：

- Momo
- Momo Rainpuff
- Momo Mooncloud
- Momo Dreamnimbus

代表技能：

- Bubble Pat
- Cozy Shield
- Nap Song
- Moon Drizzle
- Bond Skill: Dreamcloud Haven

### Pico

- 物種：星塵小妖精
- 屬性：Star / Leaf
- 定位：Trickster / Healer / Scout
- 個性：好奇、愛惡作劇、很會發現秘密
- 玩法：探索、收集、狀態效果、Attune 加成與支援
- Field Skill：**Secret Sense**，發現隱藏 Wonderlings、寶箱與支線入口

Bond Forms：

- Pico
- Pico Budspark
- Pico Wishpetal
- Pico Celestibloom

代表技能：

- Leaf Wink
- Stardust Peek
- Clover Patch
- Secret Signal
- Bond Skill: Wishbloom Spiral

### Nibi

- 物種：迷你小龍
- 屬性：Ember / Crystal
- 定位：Guardian / Striker
- 個性：勇敢、逞強，其實怕寂寞
- 玩法：耐久高、反擊強、適合 Warden Trial 與障礙突破
- Field Skill：**Crystal Push**，推開石門並清除晶化障礙

Bond Forms：

- Nibi
- Nibi Pebblehorn
- Nibi Embercrest
- Nibi Hearthdrake

代表技能：

- Warm Puff
- Crystal Brace
- Brave Bump
- Hearth Guard
- Bond Skill: Hearth Crystal Roar

## 主要角色

### Professor Bellwyn

Wonder Academy 的院長，負責 Crystal Bell 傳統與 Wonder Keeper 儀式。Bellwyn 年輕時見過上一段 Keeper 歷史的失敗，因此一開始會過度保護學生，也隱瞞了一些真相。

### Keeper Mira

新生導師，負責教學、任務、隊伍管理與早期探索。Mira 個性俐落，但很照顧學生，是前期最常出現的引導 NPC。

### Chef Pippa

點心工坊老師。她教玩家製作 snacks，用來回復 Mood、提高 Attune 成功率、吸引特定 Wonderlings，或解開特定事件。

### Inventor Tink

工房老師。負責 charms、探索道具、場景機關與區域工具，例如 Firefly Lantern、Tide Shell Compass。

### Ranger Rowan

野外老師。教玩家追蹤、探索、稀有 Wonderlings 出現條件與 Warden 生態。

### Archivist Lune

圖書館老師，負責 Wonderdex、Bell Pages、Crystal Bell 歷史與傳說線索。她是中後期主線真相的重要角色。

### Kiki

玩家的同班同學與友善競爭者。Kiki 不是反派。她一開始比較急著變強，後來會學到 Keeper Team 的價值不是只看勝負。

### The First Keeper

歷史人物，不是現代反派。The First Keeper 曾試圖用力量控制 Crystal Bell，導致 Bellheart 對 Keepers 失去信任。後期與 postgame 會補完這段故事。

### The Silent Bellheart

Crystal Bell 的心，也是最終 Warden。最終目標不是破壞或擊敗牠，而是讓牠重新願意相信 Wonder Keepers，並完成最後的 Attune。

## 玩家職業

玩家一開始是 **Wonder Keeper Trainee**。中前期解鎖職業後，可以在學院切換職業。職業不永久鎖死，但每個職業有自己的等級與技能樹。

### Chef Keeper

- 核心：snack、回復、Attune
- Passive：snack 效果提升
- Battle Support：分享 snack，全隊小回復
- Field：製作特殊 snack，引出特定 Wonderlings
- 經驗來源：料理、snack 使用、snack-based Attune

### Inventor Keeper

- 核心：charm、工具、機關
- Passive：charm 效果提升
- Battle Support：部署 gadget，提供護盾或干擾
- Field：修橋、開裝置、偵測隱藏物
- 經驗來源：使用 gadget、charm、解機關

### Ranger Keeper

- 核心：遭遇、追蹤、稀有 Wonderlings
- Passive：稀有遭遇率提升
- Battle Support：Scout Weakness，顯示弱點與建議行動
- Field：追蹤足跡、穿越自然障礙
- 經驗來源：探索、發現稀有角色、完成區域任務

### Performer Keeper

- 核心：小互動、combo、Mood Trial 表現
- Passive：時機與節奏互動的成功區間稍微變大
- Battle Support：Encore，複製上一次成功技能的部分效果
- Field：市集表演、音樂機關
- 經驗來源：高評價互動、combo、表演任務

### Archivist Keeper

- 核心：Wonderdex、故事、弱點、支線
- Passive：Wonderdex 顯示更完整線索
- Battle Support：Recall Lore，提示對方喜歡的 snack 或 Attune 條件
- Field：解讀古文、開啟傳說任務
- 經驗來源：圖鑑完成、Bell Pages、故事線索

### 職業等級

每個職業 10 級：

- Lv.1：職業 passive
- Lv.2：第一個 battle support
- Lv.3：field skill
- Lv.4：passive 強化
- Lv.5：第二個 battle support
- Lv.6：特殊 craft、encounter 或 lore 能力
- Lv.7：隊伍加成
- Lv.8：高階 field shortcut
- Lv.9：職業支線獎勵
- Lv.10：Master Keeper 技能

## 世界章節

Wonder Academy 是中心 hub。每個章節是一個區域，包含 6-10 個節點、支線、遭遇、隱藏條件與 Warden。

### Prologue: First Bell Day

- 地點：Wonder Academy
- 重點：建立角色、選初始夥伴、自訂名字、第一次 Mood Trial
- 解鎖：Wonderdex、Keeper Team、Sparkleaf Grove

### Chapter 1: Sparkleaf Grove

- 主題：發光森林、第一次 Attune、害怕改變
- Warden：Sparkleaf Fawn
- 新系統：Attune、屬性基礎、初始夥伴 field skill

### Chapter 2: Tideglass Coast

- 主題：玻璃海岸、潮汐洞窟、漂流瓶、想被聽見
- Warden：Pearlwhisker Seal
- 新系統：snack crafting、潮汐地形、Healer 玩法深化

### Chapter 3: Clocktower Dorms

- 主題：宿舍、鐘塔、學院夜晚、害怕犯錯
- Warden：Clockbell Tanuki
- 新系統：簡單解謎、隊伍切換、職業選擇

### Chapter 4: Sugarcloud Market

- 主題：雲端市集、分享、競爭、節慶
- Warden：Marshmallow Maestro
- 新系統：配方、交易、Festival Wonderlings、迷你遊戲

### Chapter 5: Snowbell Ridge

- 主題：雪鈴村、孤單、保護
- Warden：Aurora Alpaca
- 新系統：Guardian roles、寒冷狀態、隊伍耐久

### Chapter 6: Dreamcloud Festival

- 主題：夢境祭典、願望、記憶、失落
- Warden：Pillowmoon Ram
- 新系統：Dream 屬性、角色心願支線、夢境分支路線

### Chapter 7: Starrail Observatory

- 主題：星空列車、天文台、真相、記憶
- Warden：Comet Kitsune
- 新系統：Light / Star 屬性擴充、Mythling 線索、Crystal Bell 真相

### Final Chapter: Crystal Bell Tower

- 主題：信任、所有屬性、Bell Tone 修復
- Final Warden：The Silent Bellheart
- 新系統：多隊伍試煉、最終 Bond Skill、結局選擇

### Postgame: Wonder Keeper Trials

- 主題：精通與補完收藏
- 內容：Warden rematch、Mythlings、稀有變體、挑戰塔、節慶輪替

## 學院 Hub

### Dorm Room

管理初始夥伴暱稱、Keeper Team、外觀設定與存檔身份。

### Wonderdex Hall

依照區域、分類、稀有度、屬性、已遇見 / 已 Attune 狀態查看 Wonderlings。

### Snack Workshop

製作 snacks，用於 Mood 回復、Attune 加成、特殊遭遇與支線任務。

### Training Garden

練習 Mood Trial 小互動，不造成進度懲罰。

### Charm Workshop

製作與裝備 charms，改變探索或 Mood Trial 行為。

### Map Atrium

選擇下一個區域、回訪已完成區域、查看章節進度。

## Wonderlings 圖鑑規模

完整遊戲目標約 100-130 隻 Wonderlings。

稀有度：

- Common
- Uncommon
- Rare
- Warden
- Mythling

遭遇類型：

- 一般節點遭遇
- 稀有條件遭遇
- snack 吸引遭遇
- field skill 遭遇
- quest 遭遇
- postgame variant

### Wonder Academy

- Starter：Lumi、Momo、Pico、Nibi
- 常駐：Notebook Chirp、Teacup Foxlet、Backpack Bun、Inkdrop Cat、Nap Pillow Cub

### Sparkleaf Grove

- Common：Mossmew、Berrybun、Acorn Pup、Fern Ferret、Pebble Turtle、Pip Puff
- Rare：Teacup Foxlet、Lantern Mothlet、Cloudmop Lamb
- Quest：Bookmark Bird、Firefly Sprite
- Warden：Sparkleaf Fawn

### Tideglass Coast

- Common：Dewdrop Seal、Shellmouse、Bubble Pup、Coral Kit、Drift Duck、Pearl Pika
- Rare：Jellydream、Moonpool Otter、Glassfin Ray
- Quest：Bottlepost Crab、Lullaby Conch
- Warden：Pearlwhisker Seal

### Clocktower Dorms

- Common：Ticktock Tanuki、Blanket Bat、Pencil Hedgehog、Bookmark Bird、Slipper Mouse
- Rare：Musicbox Rabbit、Keyhole Kitten、Midnight Marmot
- Quest：Inkdrop Cat、Star Eraser Sprite
- Warden：Clockbell Tanuki

### Sugarcloud Market

- Common：Pudding Penguin、Waffle Bear、Cookie Pup、Strawberry Bun、Milk Tea Otter
- Rare：Marshmallow Cat、Candyfloss Lamb、Jellyfish Jelly
- Quest：Ribbon Rabbit、Festival Firebird
- Warden：Marshmallow Maestro

### Snowbell Ridge

- Common：Snowflake Fox、Bell Alpaca、Mittens Mole、Frost Puffin、Cocoa Cub
- Rare：Aurora Deerling、Snowglobe Turtle、Icicle Ferret
- Quest：Lost Sleigh Pup、Warm Lantern Sprite
- Warden：Aurora Alpaca

### Dreamcloud Festival

- Common：Pillowcloud、Sleepcap Sheep、Dream Bubble Jelly、Nightlight Bat、Planet Hamster
- Rare：Moonshadow Otter、Wishmoth、Drowsy Dragonette
- Quest：Memory Lamb、Wish Ticket Sprite
- Warden：Pillowmoon Ram

### Starrail Observatory

- Common：Comet Cub、Starglass Finch、Orbit Mouse、Telescope Turtle、Nebula Kit
- Rare：Comet Kitsune、Meteor Pony、Prism Lynx
- Quest：Old Map Sprite、Constellation Fawn
- Warden：Comet Kitsune

### Crystal Bell Tower

- Common：Crystal Mew、Bell Sprite、Echo Cub、Prism Pup、Silent Finch
- Rare：First Bell Fawn、Luminara Kit、Hearthscale Dragon
- Quest：Lost Keeper's Companion、Bellshard Sprite
- Final Warden：The Silent Bellheart

### Postgame Mythlings

- Aurora Whale
- Dreamrail Dragon
- Starlight Kirin
- Sugarcloud Phoenix
- Crystal Moonhare
- First Keeper's Companion

## Wonderling 資料模型

`WonderlingSpecies` 應支援：

- `speciesId`
- `speciesName`
- `category`
- `rarity`
- `elements`
- `roles`
- `regionIds`
- `favoriteSnack`
- `personality`
- `fieldSkillId`
- `learnableSkillIds`
- `attuneCondition`
- `growthStages`
- `artPrompt`
- `silhouetteAsset`
- `portraitAsset`
- `spriteAsset`

`OwnedWonderling` 應支援：

- `ownedId`
- `speciesId`
- `nickname`
- `level`
- `xp`
- `bond`
- `moodMax`
- `equippedSkillIds`
- `unlockedSkillIds`
- `attunedAt`
- `currentGrowthStage`

## 屬性系統

完整遊戲使用 8 種屬性：

- Spark：速度、連擊、干擾
- Tide：回復、護盾、節奏控制
- Leaf：安撫、持續效果、Attune 加成
- Light：支援、命中、解除負面狀態
- Dream：睡眠、迷惑、特殊互動
- Ember：高輸出、勇氣、破障礙
- Crystal：防禦、反擊、穩定
- Star：稀有屬性，和 Bond、Mythlings、後期技能相關

基礎三角：

- Spark 克 Tide
- Tide 克 Leaf
- Leaf 克 Spark

進階關係：

- Light 穩定 Dream
- Dream 干擾 Crystal
- Crystal 抵抗 Ember
- Ember 壓制 Leaf
- Star 不硬剋所有屬性，但強化 Bond 與後期 synergy

相剋要有幫助，但不能懲罰過重：

- 有利時 +1 或 +2 Mood Shift。
- 不利時效果降低，但至少仍有 1 點有效效果。
- 同屬性互動可提高 Attune 或 Bond 成長。

## 角色定位

- Striker：高 Mood Shift，適合快速推進。
- Guardian：護盾、保護、反擊。
- Healer：Team Mood 回復與狀態解除。
- Trickster：狀態效果、Attune 成功率、節奏控制。
- Scout：稀有遭遇、先手、隱藏線索。
- Performer：互動成功區間、combo、節奏技能。

## Mood Trial

Mood Trial 是核心挑戰系統，取代傳統戰鬥語彙。

### Mood 狀態

對方 Wonderling 可能處於：

- Upset
- Guarded
- Curious
- Calm
- Open

玩家隊伍有 Team Mood。若 Team Mood 歸零，不會 Game Over。玩家會回到上一個安全節點，保留故事進度，並得到提示。

### 回合流程

1. 選擇 active Wonderling。
2. 選擇行動：Comfort、Skill、Snack、Switch、Attune、Leave。
3. 若使用 skill，進入短互動。
4. 結算 Mood Shift、回復、狀態與 Bond 效果。
5. 對方回應。
6. 若對方進入 Attune range，玩家可以嘗試 Attune。

### 主要行動

- Comfort：安全、穩定、低風險的安撫行動。
- Skill：開啟已裝備技能選單。
- Snack：使用 snack，回復、提高 Attune 或觸發條件。
- Switch：切換 active Wonderling，通常消耗一回合。
- Attune：條件符合時嘗試建立連結。
- Leave：非主線試煉可離開。

### 技能配置

每隻 Wonderling 可以學多招，但 Mood Trial 中只裝備 4 招。

技能類型：

- Basic Skill
- Element Skill
- Role Skill
- Bond Skill
- Field Skill

### 小互動類型

- Tap Timing：光點到達目標時點擊。
- Hold Release：按住並在安全區放開。
- Pattern Match：照順序輸入 2-4 個符號。
- Shield Tap：對方回應時點盾牌，降低 Mood 損失。
- Card Pick：三選一卡牌。
- Rhythm Tap：短節奏連點。

### 正面狀態

- Inspired：下一招效果 +1。
- Shielded：下一次 Mood 損失降低。
- Focused：互動成功區間變大。
- Bonded：Bond Skill 可用。
- Lucky：Attune 機率提升。

### 負面狀態

- Rattled：技能效果降低。
- Sleepy：可能跳過行動，但更容易 Attune。
- Soggy：Spark 技能變弱，Tide 技能變強。
- Tangled：Switch 受限。
- Shy：Attune 機率下降，但 Comfort 效果提升。

## Attune

Attune 取代 capture。

普通 Wonderlings：

- 需要對方 Mood 進入足夠低、Calm 或 Open 狀態。
- 成功率受 snack、角色定位、玩家職業、狀態、Wonderdex 線索影響。
- 必須有緊張感，但不能變成過度挫折的隨機抽獎。

Wardens：

- 不使用一般隨機 Attune。
- 透過故事通關加入 Wonderdex。
- 可能解鎖 Warden Support 或 region blessing。

Mythlings：

- 需要 postgame 任務、稀有條件或跨區域故事鏈。

## 隊伍與成長

Keeper Team 最多 6 隻：

- 1 隻 active Wonderling
- 2 隻 support slots
- 3 隻 reserve

Support slots 會提供 passive：

- Guardian support：提高 Team Mood 或減少損失。
- Healer support：每幾回合小回復。
- Trickster support：提高 Attune 成功率。
- Scout support：稀有提示或先手。
- Performer support：互動加成。
- Striker support：技能效果提升，但防禦較低。

成長內容：

- level
- XP
- Bond
- growth stage
- 技能解鎖
- mood max
- role scaling

Starter 使用 Bond Forms，而不是進化成完全陌生的角色。外型應變得更華麗，但保留原本辨識度。

## Wonderdex

Wonderdex 是主要收藏畫面。

狀態：

- Unknown silhouette
- Seen
- Attuned
- Variant found
- Warden recorded
- Mythling recorded

Attuned entries 顯示：

- 角色圖
- 出現區域
- 稀有度
- 屬性
- 定位
- 喜歡的 snack
- 個性描述
- field skill
- learnable skills
- Attune condition hint
- growth forms

## Guest Wonderling Slots

遊戲可以支援本機自訂 slot，但不內建第三方 IP：

- Guest slot 可使用本機圖片或匯入檔案。
- Guest slot 可由使用者自行輸入名稱。
- Guest slot 映射到現有元素、定位與數值。
- Guest assets 不由專案生成、提交或散布。
- 內建遊戲必須只靠原創 Wonderlings 就能完整遊玩。

## 主要畫面

### Title / Continue

- New Game
- Continue
- Settings
- 若有存檔，顯示初始夥伴、Keeper Level、Wonderdex 進度與章節

### Starter Selection

- 顯示四隻初始夥伴的角色圖、屬性、定位、玩法與個性。
- 玩家可輸入暱稱。
- 開始前需要確認。

### Academy Hub

- 以房間式導航呈現，不做 landing page。
- 可前往 Wonderdex、Team、Snack Workshop、Training Garden、Charm Workshop、Map Atrium。

### Region Map

- 每章 6-10 個節點。
- 顯示主線、支線、locked condition、Warden node、回訪進度。

### Mood Trial

- Canvas-first 遊戲畫面。
- 上方顯示對方 Wonderling、Mood state、屬性。
- 下方顯示 active Wonderling 與 Team Mood。
- 行動選單：Comfort、Skills、Snack、Switch、Attune、Leave。
- Skills 子選單顯示 4 招已裝備技能。
- 中央區域播放短互動。

### Team / Growth

- Keeper Team 6 隻。
- active / support / reserve 編成。
- 暱稱編輯。
- skill loadout。
- Bond 與 growth form 進度。

### Wonderdex

- 依 region、element、rarity、state 篩選。
- 未知項目顯示 silhouette。
- Attuned entries 顯示完整資訊。

### Quest Log

- 主線
- 區域任務
- 職業任務
- Warden notes
- Mythling clues

## 存檔資料

初期使用 localStorage，但資料結構要能未來遷移。

存檔應包含：

- schema version
- 未來若加入玩家名，儲存 player name
- 初始夥伴物種與暱稱
- story progress
- unlocked regions and nodes
- completed quests
- owned Wonderlings
- Wonderdex seen / Attuned states
- Keeper Team setup
- skill loadouts
- snacks and charms
- career levels
- settings

Storage helpers 必須防禦式解析，能容忍 malformed save 或舊版 schema。

## Route 與現有遊戲替換

新的獨立頁面路由：

- 建議路由：`/games/wonder-academy`
- 目前 academy prototype route 可在遷移時重新導向到 `/games/wonder-academy`
- Wonder Academy 不繼承主 app layout
- GameHub 卡片以新分頁開啟，延續目前獨立遊戲頁面的行為

## Assets

內建資產必須全部原創。

資產類型：

- Starter portraits and sprites
- Starter Bond Form portraits and sprites
- Wonderling portraits, sprites, silhouettes
- Warden full art
- Region backgrounds
- Academy hub rooms
- UI icons
- Skill VFX icons
- Snack icons
- Charm icons

資產要求：

- PNG 使用 Codex GPT-Image-2 產生。
- 不使用 ImageGen API key workflow。
- 不用程式產生 SVG 角色圖。
- 不內建可識別第三方 IP 名稱或角色。
- 美術方向：cozy、rounded、painterly-cute、明亮但不要吵雜。
- 大型圖片需壓縮最佳化，避免 PWA precache 過大。

## 實作里程碑

這份規格描述完整世界；實作計畫可以拆階段，但不要縮小世界設定。

### 1. Foundation

- 將遊戲概念改成 Wonder Academy。
- 建立核心資料模型。
- 加入 title / continue。
- 加入初始夥伴選擇與暱稱。

### 2. Academy Hub

- 建立獨立全螢幕 hub。
- 加入 Team、Wonderdex、Map Atrium 外殼。

### 3. Mood Trial v2

- 用 Mood Trial actions 取代現有 battle actions。
- 加入 Skills 子選單、equipped skills、interactions、Mood states、Attune。

### 4. Chapter 1: Sparkleaf Grove

- 建立 region map nodes。
- 建立 encounter tables。
- 加入第一批 Wonderlings 與 Sparkleaf Fawn Warden。

### 5. Growth Systems

- XP、level、Bond、Bond Form progress、skill unlocks、loadouts。
- 基礎 snacks 與 charms。

### 6. Polish And Save

- save / load。
- browser smoke tests。
- mobile layout checks。
- 路由清理檢查。

### 7. Expansion Chapters

- 依同一套資料模型擴充 Tideglass Coast 之後的章節。

## 實作預設

後續規劃若無更好理由，採用以下預設：

- KAPLAY 繼續作為 title、hub、region map、Mood Trial 等 canvas 畫面的遊戲引擎。
- React 負責獨立頁面外殼、loading/error、離開路由，以及未來可能需要的 accessibility overlays。
- Wonderdex 與 Team 畫面優先做成覆蓋在獨立遊戲頁面上的 React panels；若實作時 KAPLAY scene 明顯更簡單，再局部調整。
- 預設路由是 `/games/wonder-academy`。
- 現有 academy prototype route 遷移時重新導向到 `/games/wonder-academy`。
- 第一個實作里程碑至少包含：四隻初始夥伴 portrait/sprite、一張 academy background、一張 Sparkleaf Grove map background、一張 Mood Trial background，以及第一個可玩循環所需的最小原創 Wonderling 資產組。

## 驗證策略

單元測試：

- Wonderling 物種資料驗證
- 技能效果結算
- Mood Trial 回合結算
- Attune 成功率計算
- 存檔解析與遷移
- 初始夥伴暱稱顯示 fallback

瀏覽器 smoke tests：

- 開啟 GameHub。
- 開啟獨立 Wonder Academy 路由。
- New Game。
- 選初始夥伴並輸入暱稱。
- 進入 hub。
- 開啟 Wonderdex 與 Team 畫面。
- 進入 region node。
- 完成 Mood Trial。
- 嘗試 Attune。
- 離開路由再進入，確認沒有重複 KAPLAY loop。

視覺 QA：

- desktop 截圖
- mobile 截圖
- canvas 非空檢查
- 文字不破版檢查
- 獨立路由不繼承 main app layout

建置檢查：

- `npm run lint`
- `npm run build`
- 確認遊戲 lazy loaded，主 app 首屏不 eager load 完整 RPG chunk。

## 非目標

- 初期不新增後端、Firestore schema 或雲端進度儲存。
- 專案不內建第三方 IP 角色、名稱或可識別資產。
- 不做 3D 自由大世界。
- 不做多人連線。
- 不重寫其他現有 Little Games。
