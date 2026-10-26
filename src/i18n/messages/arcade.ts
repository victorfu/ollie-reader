/**
 * "arcade.*" strings. Keep zh and en on the same keys: the en object is typed
 * against the zh keys, so a missing translation fails tsc.
 */
export const arcadeZh = {
  // Shared game chrome
  "arcade.common.backToGames": "回遊戲列表",
  "arcade.common.pause": "暫停",
  "arcade.common.paused": "暫停中",
  "arcade.common.pausedHint": "休息一下，準備好了再繼續！（按 Esc 也可以繼續）",
  "arcade.common.resume": "繼續",
  "arcade.common.restart": "重新開始",
  "arcade.common.mainMenu": "主選單",
  "arcade.common.backToMenu": "回主選單",
  "arcade.common.playAgain": "再玩一次",
  "arcade.common.startGame": "開始遊戲",
  "arcade.common.tutorialFirst": "先玩教學",
  "arcade.common.skipTutorial": "直接開始",
  "arcade.common.tutorial": "教學",
  "arcade.common.tutorialDone": "教學完成！",
  "arcade.common.score": "分數",
  "arcade.common.best": "最高分：{score}",

  // On-screen touch controls
  "arcade.controls.label": "遊戲控制",
  "arcade.controls.left": "向左",
  "arcade.controls.right": "向右",
  "arcade.controls.jump": "跳躍",

  // Games menu (/games)
  "arcade.hub.title": "小遊戲",
  "arcade.hub.subtitle": "一些瀏覽器大小的小冒險，點開即玩，免安裝。",
  "arcade.hub.inDevelopment": "開發中",
  "arcade.hub.bestStars": "最高星星 {n}",
  "arcade.hub.cloudProgress": "雲端存檔進度",
  "arcade.hub.noRecord": "尚無紀錄",
  "arcade.hub.play": "開始遊戲",
  "arcade.hub.wordAdventure.title": "單字大冒險",
  "arcade.hub.wordAdventure.blurb":
    "用生詞本的單字闖關，答對詞彙小測驗、賺扭蛋代幣抽人氣角色。",
  "arcade.hub.gacha.title": "人氣角色扭蛋機",
  "arcade.hub.gacha.blurb":
    "用「{game}」賺的代幣扭蛋，收集 {count} 個人氣角色圖鑑項目。",
  "arcade.hub.gacha.play": "開始扭蛋",
  "arcade.hub.gacha.status": "雲端圖鑑",
  "arcade.hub.gacha.collection": "查看圖鑑",
  "arcade.hub.cottage.title": "大耳狗 3D 夥伴",
  "arcade.hub.cottage.blurb":
    "立體的大耳狗就在眼前：摸摸他的頭，他會閉上眼睛、搖搖耳朵跟你撒嬌。",
  "arcade.hub.cottage.status": "打開就能玩",
  "arcade.hub.sweetheart.title": "甜心防衛隊",
  "arcade.hub.sweetheart.blurb":
    "甜點店保衛戰：把寵物放上塔位攔下偷糖果的怪物，守住櫃檯上的蛋糕。",
  "arcade.hub.sweetheart.status": "開發中 · 雲端存檔",
  "arcade.hub.mushroom.title": "森林蘑菇冒險",
  "arcade.hub.mushroom.blurb": "像馬力歐的闖關平台：踩蘑菇怪、收集硬幣、衝向旗桿。",
  "arcade.hub.meteor.title": "隕石滑翔機",
  "arcade.hub.meteor.blurb": "駕駛滑翔機穿越隕石雨，衝刺鑽過縫隙、收集燃料電池。",
  "arcade.hub.bunny.title": "兔兔跳跳",
  "arcade.hub.bunny.blurb": "在粉彩天空中不斷彈跳，收集胡蘿蔔、衝高連段分數。",

  // Bunny Jumper
  "arcade.bunny.title": "跳跳兔",
  "arcade.bunny.tagline": "跳上雲端，收集寶石！",
  "arcade.bunny.controls": "← → 或 A D 移動",
  "arcade.bunny.gap": "雲間距 / 難度",
  "arcade.bunny.gapAria": "雲間距倍率",
  "arcade.bunny.gapEasy": "較多雲 (容易)",
  "arcade.bunny.gapHard": "較少雲 (困難)",
  "arcade.bunny.newRecord": "新紀錄！",
  "arcade.bunny.gameOver": "遊戲結束",
  "arcade.bunny.newBest": "你創下新高分！",
  "arcade.bunny.yourScore": "你的分數",

  // Meteor Glider
  "arcade.meteor.tagline": "在落下的流星之間穿梭，衝刺鑽過縫隙，記得隨時補充燃料。",
  "arcade.meteor.startRun": "開始飛行",
  "arcade.meteor.playBunny": "玩跳跳兔",
  "arcade.meteor.controls":
    "操作：←/→ 或 A/D 轉向，空白鍵/Shift 衝刺。手機上點畫面左半邊或右半邊移動，點「衝刺」衝過去。",
  "arcade.meteor.tutorialDoneBody": "你學會了移動、閃避流星、補充燃料和衝刺，出發挑戰吧！",
  "arcade.meteor.pausedHint": "按「繼續」接著飛。",
  "arcade.meteor.quit": "離開",
  "arcade.meteor.step": "步驟 {step}/{total}",
  "arcade.meteor.fuel": "燃料",
  "arcade.meteor.dash": "衝刺",
  "arcade.meteor.tutorial.move": "用 ← → 或 A D 鍵左右移動滑翔機！",
  "arcade.meteor.tutorial.dodge": "流星來了！左右移動閃開它",
  "arcade.meteor.tutorial.fuel": "去吃綠色的燃料電池，補滿能量",
  "arcade.meteor.tutorial.dash": "按空白鍵（或 Shift）衝刺一下！",
  "arcade.meteor.tutorial.finale": "衝刺成功！你已經準備好了",

  // Mushroom Adventure: menus and overlays
  "arcade.mushroom.title": "森林蘑菇冒險",
  "arcade.mushroom.tagline": "可愛橫向平台闖關，踩蘑菇怪、收硬幣、衝旗桿。",
  "arcade.mushroom.controls":
    "操作：← → 移動，↑/W/空白鍵跳躍，踩怪可得分，星星無敵、羽毛二段跳、靴子加速、愛心補生命。",
  "arcade.mushroom.continue": "繼續（第 {level} 關）",
  "arcade.mushroom.fromLevel1": "從第 1 關開始",
  "arcade.mushroom.settings": "設定",
  "arcade.mushroom.chooseLevel": "選擇關卡",
  "arcade.mushroom.levelAria": "第 {level} 關",
  "arcade.mushroom.levelLockedAria": "第 {level} 關（未解鎖）",
  "arcade.mushroom.win": "全部通關！",
  "arcade.mushroom.totalScore": "總分 {score}",
  "arcade.mushroom.best": "最佳：{score}",
  "arcade.mushroom.dead": "差一點點！",
  "arcade.mushroom.deadCheer": "再試一次一定可以的！",
  "arcade.mushroom.deadScore": "這次拿到 {score} 分（第 {level} 關）",
  "arcade.mushroom.retryLevel": "從第 {level} 關再試",
  "arcade.mushroom.restartLevel": "重新開始本關",
  "arcade.mushroom.tutorialDoneBody":
    "你學會了移動、跳躍、踩蘑菇怪和吃道具，出發去冒險吧！",
  "arcade.mushroom.startLevel1": "開始第 1 關",

  // Mushroom Adventure: settings
  "arcade.mushroom.settings.title": "遊戲設定",
  "arcade.mushroom.settings.difficulty": "遊戲難度：",
  "arcade.mushroom.settings.easy": "簡單",
  "arcade.mushroom.settings.normal": "普通",
  "arcade.mushroom.settings.hard": "困難",
  "arcade.mushroom.settings.extreme": "地獄",
  "arcade.mushroom.settings.enemies": "敵人數量：",
  "arcade.mushroom.settings.enemiesNormal": "正常",
  "arcade.mushroom.settings.enemiesMore": "較多",
  "arcade.mushroom.settings.enemiesLots": "超多",
  "arcade.mushroom.settings.powerups": "道具頻率：",
  "arcade.mushroom.settings.particles": "粒子特效",
  "arcade.mushroom.settings.particlesHint": "開啟後踩敵人和收集道具會有爆炸粒子效果",
  "arcade.mushroom.settings.cancel": "取消",
  "arcade.mushroom.settings.save": "儲存",

  // Mushroom Adventure: canvas HUD and pop-up text
  "arcade.mushroom.hud.score": "分數 {score}",
  "arcade.mushroom.hud.tutorial": "教學關 · 放心練習",
  "arcade.mushroom.hud.level": "第 {level} 關 · {theme}",
  "arcade.mushroom.hud.best": "最佳 {score}",
  "arcade.mushroom.hud.combo": "連擊 ×{n}",
  "arcade.mushroom.pop.combo": "連擊 ×{n}！+{points}",
  "arcade.mushroom.pop.doorOpen": "門打開了！",
  "arcade.mushroom.pop.star": "無敵!",
  "arcade.mushroom.pop.boot": "加速!",
  "arcade.mushroom.pop.feather": "二段跳!",
  "arcade.mushroom.pop.heart": "生命+1",

  // Mushroom Adventure: tutorial signs (canvas)
  "arcade.mushroom.sign.move": "用 ← → 或 A D 鍵移動，往右走吧！",
  "arcade.mushroom.sign.jump": "按 ↑、W 或空白鍵跳上小台階！",
  "arcade.mushroom.sign.climb": "一階一階跳上平台，吃到金幣！",
  "arcade.mushroom.sign.stomp": "從上面跳下去，踩扁蘑菇怪就能開門！",
  "arcade.mushroom.sign.coin": "收集金幣可以加分！",
  "arcade.mushroom.sign.power": "吃下星星會無敵一下下，去撞撞看！",
  "arcade.mushroom.sign.goal": "碰到旗子就過關囉！",
  "arcade.mushroom.gate.stomp": "踩扁蘑菇怪才能開門",

  // Mushroom Adventure: level themes (HUD)
  "arcade.mushroom.theme.grassland": "草原",
  "arcade.mushroom.theme.forest": "森林",
  "arcade.mushroom.theme.lake": "湖畔",
  "arcade.mushroom.theme.cave": "洞穴",
  "arcade.mushroom.theme.desert": "沙漠",
  "arcade.mushroom.theme.clouds": "雲端",
  "arcade.mushroom.theme.snow": "雪地",
  "arcade.mushroom.theme.dusk": "黃昏",
  "arcade.mushroom.theme.night": "夜晚",
  "arcade.mushroom.theme.starry": "星空",
} as const;

export const arcadeEn: Record<keyof typeof arcadeZh, string> = {
  // Shared game chrome
  "arcade.common.backToGames": "Back to games",
  "arcade.common.pause": "Pause",
  "arcade.common.paused": "Paused",
  "arcade.common.pausedHint":
    "Take a little break and keep going when you’re ready! (You can also press Esc.)",
  "arcade.common.resume": "Resume",
  "arcade.common.restart": "Restart",
  "arcade.common.mainMenu": "Main menu",
  "arcade.common.backToMenu": "Back to menu",
  "arcade.common.playAgain": "Play again",
  "arcade.common.startGame": "Start game",
  "arcade.common.tutorialFirst": "Try the tutorial first",
  "arcade.common.skipTutorial": "Jump right in",
  "arcade.common.tutorial": "Tutorial",
  "arcade.common.tutorialDone": "Tutorial complete!",
  "arcade.common.score": "Score",
  "arcade.common.best": "Best: {score}",

  // On-screen touch controls
  "arcade.controls.label": "Game controls",
  "arcade.controls.left": "Left",
  "arcade.controls.right": "Right",
  "arcade.controls.jump": "Jump",

  // Games menu (/games)
  "arcade.hub.title": "Games",
  "arcade.hub.subtitle": "Little adventures right in your browser. Tap to play, nothing to install.",
  "arcade.hub.inDevelopment": "In development",
  "arcade.hub.bestStars": "Best: {n} stars",
  "arcade.hub.cloudProgress": "Progress saved online",
  "arcade.hub.noRecord": "No record yet",
  "arcade.hub.play": "Play",
  "arcade.hub.wordAdventure.title": "Word Adventure",
  "arcade.hub.wordAdventure.blurb":
    "Play through levels with words from your word book. Ace the vocabulary quizzes and earn tokens for the character gacha.",
  "arcade.hub.gacha.title": "Character Gacha Machine",
  "arcade.hub.gacha.blurb":
    "Spend the tokens you earn in “{game}” on capsules and collect all {count} popular characters.",
  "arcade.hub.gacha.play": "Get a capsule",
  "arcade.hub.gacha.status": "Collection saved online",
  "arcade.hub.gacha.collection": "View collection",
  "arcade.hub.cottage.title": "Cinnamoroll 3D Buddy",
  "arcade.hub.cottage.blurb":
    "A 3D Cinnamoroll right in front of you: pat his head and he’ll close his eyes and wiggle his ears to cuddle up to you.",
  "arcade.hub.cottage.status": "Open and play",
  "arcade.hub.sweetheart.title": "Sweetheart Defenders",
  "arcade.hub.sweetheart.blurb":
    "Save the sweet shop! Put pets on the tower spots to stop the candy-stealing monsters and protect the cake on the counter.",
  "arcade.hub.sweetheart.status": "In development · Saved online",
  "arcade.hub.mushroom.title": "Mushroom Adventure",
  "arcade.hub.mushroom.blurb":
    "A Mario-style platformer: stomp mushroom monsters, collect coins and race to the flagpole.",
  "arcade.hub.meteor.title": "Meteor Glider",
  "arcade.hub.meteor.blurb":
    "Fly your glider through a meteor shower, dash through the gaps and collect fuel cells.",
  "arcade.hub.bunny.title": "Bunny Jumper",
  "arcade.hub.bunny.blurb":
    "Bounce higher and higher through a pastel sky, collect carrots and build up your combo score.",

  // Bunny Jumper
  "arcade.bunny.title": "Bunny Jumper",
  "arcade.bunny.tagline": "Jump up to the clouds and collect gems!",
  "arcade.bunny.controls": "Use ← → or A D to move",
  "arcade.bunny.gap": "Cloud spacing / difficulty",
  "arcade.bunny.gapAria": "Cloud spacing multiplier",
  "arcade.bunny.gapEasy": "More clouds (easier)",
  "arcade.bunny.gapHard": "Fewer clouds (harder)",
  "arcade.bunny.newRecord": "New record!",
  "arcade.bunny.gameOver": "Game over",
  "arcade.bunny.newBest": "You set a new high score!",
  "arcade.bunny.yourScore": "Your score",

  // Meteor Glider
  "arcade.meteor.tagline":
    "Weave through falling meteors, dash through gaps, and keep your fuel topped up.",
  "arcade.meteor.startRun": "Start run",
  "arcade.meteor.playBunny": "Play Bunny Jumper",
  "arcade.meteor.controls":
    "Controls: ←/→ or A/D to steer, Space/Shift to dash. On a phone, tap the left or right half of the screen to move, and tap Dash to burst through.",
  "arcade.meteor.tutorialDoneBody":
    "You learned how to move, dodge meteors, refuel and dash. Off you go!",
  "arcade.meteor.pausedHint": "Press Resume to keep flying.",
  "arcade.meteor.quit": "Quit",
  "arcade.meteor.step": "Step {step}/{total}",
  "arcade.meteor.fuel": "Fuel",
  "arcade.meteor.dash": "Dash",
  "arcade.meteor.tutorial.move": "Use ← → or A D to steer your glider!",
  "arcade.meteor.tutorial.dodge": "Here comes a meteor! Move to dodge it",
  "arcade.meteor.tutorial.fuel": "Grab the green fuel cell to fill up",
  "arcade.meteor.tutorial.dash": "Press Space (or Shift) to dash!",
  "arcade.meteor.tutorial.finale": "Great dash! You’re all set",

  // Mushroom Adventure: menus and overlays
  "arcade.mushroom.title": "Mushroom Adventure",
  "arcade.mushroom.tagline":
    "A cute side-scrolling platformer: stomp mushroom monsters, grab coins and race to the flagpole.",
  "arcade.mushroom.controls":
    "Controls: ← → to move, ↑/W/Space to jump. Stomp monsters for points. Stars make you invincible, feathers give you a double jump, boots make you faster and hearts give you an extra life.",
  "arcade.mushroom.continue": "Continue (Level {level})",
  "arcade.mushroom.fromLevel1": "Start from Level 1",
  "arcade.mushroom.settings": "Settings",
  "arcade.mushroom.chooseLevel": "Choose a level",
  "arcade.mushroom.levelAria": "Level {level}",
  "arcade.mushroom.levelLockedAria": "Level {level} (locked)",
  "arcade.mushroom.win": "You beat every level!",
  "arcade.mushroom.totalScore": "Total score: {score}",
  "arcade.mushroom.best": "Best: {score}",
  "arcade.mushroom.dead": "So close!",
  "arcade.mushroom.deadCheer": "Try again. You can do it!",
  "arcade.mushroom.deadScore": "You scored {score} points this time (Level {level}).",
  "arcade.mushroom.retryLevel": "Try Level {level} again",
  "arcade.mushroom.restartLevel": "Restart this level",
  "arcade.mushroom.tutorialDoneBody":
    "You learned how to move, jump, stomp mushroom monsters and grab power-ups. Let’s go on an adventure!",
  "arcade.mushroom.startLevel1": "Start Level 1",

  // Mushroom Adventure: settings
  "arcade.mushroom.settings.title": "Game settings",
  "arcade.mushroom.settings.difficulty": "Difficulty: ",
  "arcade.mushroom.settings.easy": "Easy",
  "arcade.mushroom.settings.normal": "Normal",
  "arcade.mushroom.settings.hard": "Hard",
  "arcade.mushroom.settings.extreme": "Extreme",
  "arcade.mushroom.settings.enemies": "Enemies: ",
  "arcade.mushroom.settings.enemiesNormal": "Normal",
  "arcade.mushroom.settings.enemiesMore": "More",
  "arcade.mushroom.settings.enemiesLots": "Lots",
  "arcade.mushroom.settings.powerups": "Power-ups: ",
  "arcade.mushroom.settings.particles": "Sparkle effects",
  "arcade.mushroom.settings.particlesHint":
    "When this is on, stomping enemies and grabbing power-ups makes a burst of sparkles.",
  "arcade.mushroom.settings.cancel": "Cancel",
  "arcade.mushroom.settings.save": "Save",

  // Mushroom Adventure: canvas HUD and pop-up text
  "arcade.mushroom.hud.score": "Score {score}",
  "arcade.mushroom.hud.tutorial": "Tutorial · Practice freely",
  "arcade.mushroom.hud.level": "Level {level} · {theme}",
  "arcade.mushroom.hud.best": "Best {score}",
  "arcade.mushroom.hud.combo": "Combo ×{n}",
  "arcade.mushroom.pop.combo": "Combo ×{n}! +{points}",
  "arcade.mushroom.pop.doorOpen": "The door is open!",
  "arcade.mushroom.pop.star": "Invincible!",
  "arcade.mushroom.pop.boot": "Speed up!",
  "arcade.mushroom.pop.feather": "Double jump!",
  "arcade.mushroom.pop.heart": "+1 life",

  // Mushroom Adventure: tutorial signs (canvas)
  "arcade.mushroom.sign.move": "Use ← → or A D to move. Head right!",
  "arcade.mushroom.sign.jump": "Press ↑, W or Space to jump onto the step!",
  "arcade.mushroom.sign.climb": "Jump up the platforms to get the coins!",
  "arcade.mushroom.sign.stomp": "Jump on the mushroom monster to open the door!",
  "arcade.mushroom.sign.coin": "Collect coins for extra points!",
  "arcade.mushroom.sign.power": "Grab the star to be invincible for a bit!",
  "arcade.mushroom.sign.goal": "Touch the flag to clear the level!",
  "arcade.mushroom.gate.stomp": "Stomp the mushroom monster to open",

  // Mushroom Adventure: level themes (HUD)
  "arcade.mushroom.theme.grassland": "Grassland",
  "arcade.mushroom.theme.forest": "Forest",
  "arcade.mushroom.theme.lake": "Lakeside",
  "arcade.mushroom.theme.cave": "Cave",
  "arcade.mushroom.theme.desert": "Desert",
  "arcade.mushroom.theme.clouds": "Clouds",
  "arcade.mushroom.theme.snow": "Snowfield",
  "arcade.mushroom.theme.dusk": "Sunset",
  "arcade.mushroom.theme.night": "Night",
  "arcade.mushroom.theme.starry": "Starry Sky",
};
