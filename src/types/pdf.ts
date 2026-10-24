export type ReadingMode = "word" | "selection";

export type TTSMode = "browser" | "api";

// Web 的 API 語音固定使用 Edge TTS，可透過桌面服務或雲端呼叫。
export type TTSEngine = "edge";

// 運算後端連線模式（per-device，存 localStorage，不同步 Firestore）
export type ComputeMode = "auto" | "local" | "cloud";

/** 生詞本面板呈現方式：浮動視窗，或停靠在閱讀區右側。 */
export type VocabularyPanelMode = "floating" | "docked";
