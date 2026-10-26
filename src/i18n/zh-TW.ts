import { readerZh } from "./messages/reader";
import { practiceZh } from "./messages/practice";
import { listeningZh } from "./messages/listening";
import { examsZh } from "./messages/exams";
import { gachaZh } from "./messages/gacha";
import { defendersZh } from "./messages/defenders";
import { adventureZh } from "./messages/adventure";
import { arcadeZh } from "./messages/arcade";

/**
 * 繁體中文字典：所有介面文字的來源。
 * key 以「頁面.區塊.項目」命名；英文字典必須擁有完全相同的 key（由型別強制）。
 * 參數以 `{name}` 標記，由 translate() 代入。
 */
export const zhTW = {
  "common.confirm": "確認",
  "common.cancel": "取消",
  "common.close": "關閉",
  "common.processing": "處理中…",
  "common.retry": "重試",
  "common.user": "使用者",

  "loading.page": "載入頁面中",
  "loading.login": "載入登入頁面",
  "loading.user": "載入使用者資料",

  "nav.reader": "閱讀器",
  "nav.vocabulary": "生詞本",
  "nav.wordPractice": "單字練習",
  "nav.speech": "演講",
  "nav.podcasts": "Podcast 聽力",
  "nav.show": "影集字幕",
  "nav.exams": "基本學力測驗",
  "nav.games": "小遊戲",
  "nav.settings": "設定",
  "nav.signOut": "登出",
  "nav.more": "更多",
  "nav.moveToMore": "移到更多",
  "nav.moveOutOfMore": "移出更多",
  "nav.moveToMoreLabel": "把「{label}」移到更多",
  "nav.moveOutOfMoreLabel": "把「{label}」移出更多",
  "nav.expandSidebar": "展開側邊欄",
  "nav.collapseSidebar": "收合側邊欄",
  "nav.openMenu": "開啟選單",
  "nav.closeMenu": "關閉選單",

  "speechHub.label": "演講分類",
  "speechHub.write": "英文演講",
  "speechHub.practice": "演講練習",
  "speechHub.audio": "音訊庫",

  "theme.switchToLight": "切換至淺色模式",
  "theme.switchToDark": "切換至深色模式",
  "theme.lightMode": "淺色模式",
  "theme.darkMode": "深色模式",

  "speak.play": "播放發音",
  "speak.stop": "停止播放",
  "speak.playText": "播放：{text}",
  "cefr.estimated": "CEFR 估計 {level}",
  "tokens.title": "扭蛋代幣",
  "tokens.balanceLabel": "扭蛋代幣 {n}",

  "error.reloading": "正在載入最新版本",
  "error.title": "發生錯誤",
  "error.description": "應用程式發生未預期的錯誤，請重新整理頁面或點擊下方按鈕重試。",
  "error.details": "錯誤詳情",
  "error.reload": "重新整理頁面",

  "auth.tagline": "上傳 PDF 文件，選取文字即可朗讀或翻譯",
  "auth.signInWithGoogle": "使用 Google 登入",
  "auth.hint": "使用 Google 帳號登入即可開始使用",
  "auth.error.popupClosed": "登入視窗已關閉",
  "auth.error.cancelled": "登入已取消",
  "auth.error.popupBlocked": "瀏覽器封鎖了彈出視窗",
  "auth.error.differentCredential": "此帳號已使用其他登入方式註冊",
  "auth.error.tooManyRequests": "嘗試次數過多，請稍後再試",
  "auth.error.network": "網路連線異常",
  "auth.error.signOutFailed": "登出失敗，請稍後再試",
  "auth.error.unknown": "發生未知錯誤，請稍後再試",
  "auth.error.notAllowed": "此帳號無權限存取。請聯絡管理員。",
  "auth.error.denied": "此帳號無權限存取。",
  "auth.error.offline": "目前離線，已使用這台裝置上次的登入狀態。",
  "auth.error.unverified": "暫時無法驗證帳號權限，部分雲端功能可能無法使用。",

  "settings.title": "設定",
  "settings.category.appearance": "外觀",
  "settings.category.audio": "語音",
  "settings.category.advanced": "進階",
  "settings.category.game": "遊戲",

  "settings.theme.title": "外觀主題",
  "settings.theme.description": "選擇介面的明暗模式",
  "settings.theme.light": "淺色",
  "settings.theme.dark": "深色",
  "settings.theme.system": "系統",

  "settings.language.title": "介面語言",
  "settings.language.description":
    "選擇介面顯示的語言。「English＋中文提示」以英文為主，點一下有底線的字就能看中文。",
  "settings.language.zh": "繁體中文",
  "settings.language.en": "English",
  "settings.language.enHint": "English＋中文提示",

  "settings.tts.title": "語音模式選擇",
  "settings.tts.description": "選擇文字轉語音的服務",
  "settings.tts.browser": "系統語音",
  "settings.tts.browserDesc": "使用瀏覽器內建的語音引擎（推薦）",
  "settings.tts.api": "AI 語音（Edge TTS）",
  "settings.tts.apiDesc": "微軟神經語音；需連網，可透過桌面 App 或雲端服務使用",
  "settings.rate.title": "語速設定",
  "settings.rate.description": "調整播放速度",
  "settings.rate.slow": "慢",
  "settings.rate.fast": "快",

  "settings.compute.title": "運算後端",
  "settings.compute.description": "選擇 AI 語音、網址抓檔與課程紀錄要走本機桌面 App、自動，或只用雲端",
  "settings.compute.auto": "自動",
  "settings.compute.autoDesc": "偵測到本機桌面 App 就用本機，否則用雲端（推薦）",
  "settings.compute.local": "只用本機",
  "settings.compute.localDesc": "強制使用本機桌面 App；未啟動時會顯示錯誤，不退雲端",
  "settings.compute.cloud": "只用雲端",
  "settings.compute.cloudDesc": "永遠使用雲端服務，不偵測本機",
  "settings.compute.current": "目前使用：{backend}",
  "settings.compute.usingLocal": "本機 sidecar",
  "settings.compute.usingCloud": "雲端",
  "settings.compute.unreachable": "（本機未連線）",
  "settings.compute.detecting": "偵測中…",
  "settings.compute.redetect": "重新偵測",

  "settings.game.title": "遊戲設定",
  "settings.game.description": "管理遊戲偏好與進度",
  "settings.game.missRate": "空膠囊機率",
  "settings.game.missRateDesc": "儲存在這台裝置，下一次轉動扭蛋機把手時套用。",
  "settings.game.missRateMin": "0%（必得角色）",
  "settings.game.missRateMax": "100%（必定為空）",
  "settings.game.showAll": "開啟全部扭蛋圖鑑",
  "settings.game.showAllDesc": "可查看所有角色圖片，不會更改抽取紀錄或實際收集進度。此設定只儲存在這台裝置。",
  "settings.game.reset": "重置遊戲進度",
  "settings.game.resetDesc": "清除所有關卡進度、等級和扭蛋代幣（生詞本不受影響）",
  "settings.game.resetButton": "重置",
  "settings.game.resetDone": "遊戲進度已重置",
  "settings.game.resetConfirmTitle": "確定要重置遊戲進度？",
  "settings.game.resetConfirmMessage": "這將清除所有關卡進度、等級和扭蛋代幣。此操作無法復原，但生詞本不會受到影響。",
  "settings.saving": "儲存中…",
  "settings.saved": "設定已儲存",

  ...readerZh,
  ...practiceZh,
  ...listeningZh,
  ...examsZh,
  ...gachaZh,
  ...defendersZh,
  ...adventureZh,
  ...arcadeZh,
} as const;

export type MessageKey = keyof typeof zhTW;
