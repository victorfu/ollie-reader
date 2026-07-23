import attuneFailSoft from "../../../assets/games/sweetheart-defenders/audio/attune_fail_soft.m4a";
import attuneReady from "../../../assets/games/sweetheart-defenders/audio/attune_ready.m4a";
import attuneSuccess from "../../../assets/games/sweetheart-defenders/audio/attune_success.m4a";
import bondSkillReady from "../../../assets/games/sweetheart-defenders/audio/bond_skill_ready.m4a";
import hubLoop from "../../../assets/games/sweetheart-defenders/audio/hub_loop.m4a";
import nodeUnlock from "../../../assets/games/sweetheart-defenders/audio/node_unlock.m4a";
import regionMapLoop from "../../../assets/games/sweetheart-defenders/audio/region_map_loop.m4a";
import uiBack from "../../../assets/games/sweetheart-defenders/audio/ui_back.m4a";
import uiConfirm from "../../../assets/games/sweetheart-defenders/audio/ui_confirm.m4a";
import uiLocked from "../../../assets/games/sweetheart-defenders/audio/ui_locked.m4a";
import uiSelect from "../../../assets/games/sweetheart-defenders/audio/ui_select.m4a";
import wardenTrialLoop from "../../../assets/games/sweetheart-defenders/audio/warden_trial_loop.m4a";
import wonderdexUpdate from "../../../assets/games/sweetheart-defenders/audio/wonderdex_update.m4a";

export type SfxId =
  | "select"
  | "place"
  | "upgrade"
  | "sell"
  | "denied"
  | "waveStart"
  | "bossWarn"
  | "cakeLost"
  | "cleared"
  | "lost"
  | "unlock";

export type MusicId = "menu" | "battle" | "boss";

export type AudioSettings = {
  /** 0–1 */
  music: number;
  /** 0–1 */
  sfx: number;
  muted: boolean;
};

/**
 * 預設是靜音的。
 *
 * 這個遊戲會在瀏覽器分頁裡被打開，突然冒出音樂很擾人（在學校、在別人旁邊、
 * 或只是想安靜玩）。音量值照樣留著，所以按下開關就是正常大小聲，不用再調。
 */
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  music: 0.4,
  sfx: 0.7,
  muted: true,
};

/**
 * 音量設定只存在這台裝置，不進雲端存檔——在平板上按靜音，不該讓爸爸的筆電
 * 也跟著沒聲音。
 */
const SETTINGS_KEY = "ollie-sweetheart-defenders-audio-v1";

const SFX_SOURCE: Record<SfxId, string> = {
  select: uiSelect,
  place: uiConfirm,
  upgrade: attuneSuccess,
  sell: uiBack,
  denied: uiLocked,
  waveStart: bondSkillReady,
  bossWarn: nodeUnlock,
  cakeLost: attuneFailSoft,
  cleared: attuneReady,
  lost: attuneFailSoft,
  unlock: wonderdexUpdate,
};

/** 同一個音效的最短間隔，避免一次漏好幾塊蛋糕時疊成一團噪音。 */
const SFX_THROTTLE_MS: Partial<Record<SfxId, number>> = {
  cakeLost: 220,
  select: 60,
};

const MUSIC_SOURCE: Record<MusicId, string> = {
  menu: hubLoop,
  battle: regionMapLoop,
  boss: wardenTrialLoop,
};

const FADE_STEP_MS = 40;
const FADE_MS = 500;

let settings: AudioSettings = DEFAULT_AUDIO_SETTINGS;
let currentMusicId: MusicId | null = null;
let musicElement: HTMLAudioElement | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
const lastPlayedAt = new Map<SfxId, number>();
/** 瀏覽器要等使用者互動過才准播音樂；擋下來的話先記著，等第一次互動再補播。 */
let pendingMusic: MusicId | null = null;
let unlockListenerAttached = false;

export function readAudioSettings(): AudioSettings {
  if (typeof window === "undefined") return DEFAULT_AUDIO_SETTINGS;

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_AUDIO_SETTINGS;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

export function normalizeSettings(raw: unknown): AudioSettings {
  if (typeof raw !== "object" || raw === null) return DEFAULT_AUDIO_SETTINGS;
  const record = raw as Record<string, unknown>;

  return {
    music: clampVolume(record.music, DEFAULT_AUDIO_SETTINGS.music),
    sfx: clampVolume(record.sfx, DEFAULT_AUDIO_SETTINGS.sfx),
    // 明確存成 false 代表玩家自己開過聲音，那要留住；缺欄位或亂七八糟的值
    // 才回預設（靜音）。
    muted:
      typeof record.muted === "boolean"
        ? record.muted
        : DEFAULT_AUDIO_SETTINGS.muted,
  };
}

export function applyAudioSettings(next: AudioSettings): void {
  settings = next;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // 無痕模式：這一場照樣有聲音，只是設定不會留下來。
    }
  }

  if (next.muted) {
    musicElement?.pause();
    return;
  }

  // 靜音時根本沒開始放，所以解除靜音要從頭把曲子接起來。
  if (!currentMusicId) return;
  if (!musicElement || musicElement.paused || !musicElement.src) {
    startTrack(currentMusicId);
  } else {
    musicElement.volume = next.music;
  }
}

export function playSfx(id: SfxId): void {
  if (settings.muted || settings.sfx <= 0) return;
  if (typeof Audio === "undefined") return;

  const throttle = SFX_THROTTLE_MS[id];
  if (throttle) {
    const now = Date.now();
    if (now - (lastPlayedAt.get(id) ?? 0) < throttle) return;
    lastPlayedAt.set(id, now);
  }

  try {
    // 每次都開一個新的元素，同一個音效才能重疊播放。
    const audio = new Audio(SFX_SOURCE[id]);
    audio.volume = settings.sfx;
    void audio.play().catch(() => {
      // 還沒互動過就被擋下來；音效不像音樂需要補播，直接放掉。
    });
  } catch {
    // 音訊不可用時不該讓遊戲爆掉。
  }
}

export function playMusic(id: MusicId | null): void {
  if (typeof Audio === "undefined") return;
  if (id === currentMusicId) return;

  currentMusicId = id;

  if (id === null) {
    fadeTo(0, () => {
      musicElement?.pause();
    });
    return;
  }

  // 靜音時連載都不要載——背景音樂是整包資源裡最大的，預設靜音的人不該
  // 為了他不會聽到的東西付下載成本。
  if (settings.muted) return;

  // 已經在放別的曲子就先淡出，換曲不會啪一聲。
  if (musicElement && !musicElement.paused) {
    fadeTo(0, () => startTrack(id));
  } else {
    startTrack(id);
  }
}

function startTrack(id: MusicId): void {
  if (!musicElement) {
    musicElement = new Audio();
    musicElement.loop = true;
  }

  if (musicElement.src !== MUSIC_SOURCE[id]) {
    musicElement.src = MUSIC_SOURCE[id];
  }
  musicElement.volume = 0;

  void musicElement
    .play()
    .then(() => fadeTo(settings.music))
    .catch(() => queueUnlock(id));
}

export function stopMusic(): void {
  playMusic(null);
}

function fadeTo(target: number, onDone?: () => void): void {
  if (!musicElement) {
    onDone?.();
    return;
  }

  if (fadeTimer) clearInterval(fadeTimer);
  const element = musicElement;
  const step = ((target - element.volume) * FADE_STEP_MS) / FADE_MS;

  fadeTimer = setInterval(() => {
    const next = element.volume + step;
    const done = step >= 0 ? next >= target : next <= target;

    element.volume = clamp01(done ? target : next);
    if (!done) return;

    if (fadeTimer) clearInterval(fadeTimer);
    fadeTimer = null;
    onDone?.();
  }, FADE_STEP_MS);
}

/** 自動播放被擋下來時，掛一次性的互動監聽，等使用者一碰畫面就補播。 */
function queueUnlock(id: MusicId | null): void {
  pendingMusic = id;
  if (unlockListenerAttached || typeof window === "undefined") return;

  unlockListenerAttached = true;
  const resume = () => {
    window.removeEventListener("pointerdown", resume);
    window.removeEventListener("keydown", resume);
    unlockListenerAttached = false;

    const queued = pendingMusic;
    pendingMusic = null;
    if (queued) {
      currentMusicId = null;
      playMusic(queued);
    }
  };

  window.addEventListener("pointerdown", resume, { once: true });
  window.addEventListener("keydown", resume, { once: true });
}

function clampVolume(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return clamp01(value);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
