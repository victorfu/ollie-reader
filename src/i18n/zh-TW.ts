/**
 * 繁體中文字典：所有介面文字的來源。
 * key 以「頁面.區塊.項目」命名；英文字典必須擁有完全相同的 key（由型別強制）。
 * 參數以 `{name}` 標記，由 translate() 代入。
 */
export const zhTW = {
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
} as const;

export type MessageKey = keyof typeof zhTW;
