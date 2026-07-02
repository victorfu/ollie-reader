import type { WonderAcademyAudioSettings } from "../../../types/wonderAcademy";

export const defaultWonderAcademyAudioSettings: WonderAcademyAudioSettings = {
  musicVolume: 0.45,
  sfxVolume: 0.65,
  muted: false,
};

export const wonderAcademySfxIds = [
  "ui_select",
  "ui_confirm",
  "ui_back",
  "ui_locked",
  "node_unlock",
  "save_success",
  "save_pending",
  "attune_ready",
  "attune_success",
  "attune_fail_soft",
  "wonderdex_update",
  "snack_use",
  "bond_skill_ready",
] as const;

export type WonderAcademySfxId = (typeof wonderAcademySfxIds)[number];

export const wonderAcademyLoopIds = [
  "hub_loop",
  "region_map_loop",
  "mood_trial_loop",
  "warden_trial_loop",
] as const;

export type WonderAcademyLoopId = (typeof wonderAcademyLoopIds)[number];

export type WonderAcademyLoopSelectionInput = {
  screen: string;
  isWarden?: boolean;
};

const REGION_LOOP_SCREENS = new Set(["regions", "nodeMap", "scene"]);

export function selectWonderAcademyLoop({
  screen,
  isWarden = false,
}: WonderAcademyLoopSelectionInput): WonderAcademyLoopId {
  if (screen === "battle") {
    return isWarden ? "warden_trial_loop" : "mood_trial_loop";
  }

  if (REGION_LOOP_SCREENS.has(screen)) {
    return "region_map_loop";
  }

  return "hub_loop";
}

export const wonderAcademySfxUrls: Record<WonderAcademySfxId, string> = {
  ui_select: new URL(
    "../../../assets/games/wonder-academy/audio/ui_select.wav",
    import.meta.url,
  ).href,
  ui_confirm: new URL(
    "../../../assets/games/wonder-academy/audio/ui_confirm.wav",
    import.meta.url,
  ).href,
  ui_back: new URL(
    "../../../assets/games/wonder-academy/audio/ui_back.wav",
    import.meta.url,
  ).href,
  ui_locked: new URL(
    "../../../assets/games/wonder-academy/audio/ui_locked.wav",
    import.meta.url,
  ).href,
  node_unlock: new URL(
    "../../../assets/games/wonder-academy/audio/node_unlock.wav",
    import.meta.url,
  ).href,
  save_success: new URL(
    "../../../assets/games/wonder-academy/audio/save_success.wav",
    import.meta.url,
  ).href,
  save_pending: new URL(
    "../../../assets/games/wonder-academy/audio/save_pending.wav",
    import.meta.url,
  ).href,
  attune_ready: new URL(
    "../../../assets/games/wonder-academy/audio/attune_ready.wav",
    import.meta.url,
  ).href,
  attune_success: new URL(
    "../../../assets/games/wonder-academy/audio/attune_success.wav",
    import.meta.url,
  ).href,
  attune_fail_soft: new URL(
    "../../../assets/games/wonder-academy/audio/attune_fail_soft.wav",
    import.meta.url,
  ).href,
  wonderdex_update: new URL(
    "../../../assets/games/wonder-academy/audio/wonderdex_update.wav",
    import.meta.url,
  ).href,
  snack_use: new URL(
    "../../../assets/games/wonder-academy/audio/snack_use.wav",
    import.meta.url,
  ).href,
  bond_skill_ready: new URL(
    "../../../assets/games/wonder-academy/audio/bond_skill_ready.wav",
    import.meta.url,
  ).href,
};

export const wonderAcademyLoopUrls: Record<WonderAcademyLoopId, string> = {
  hub_loop: new URL(
    "../../../assets/games/wonder-academy/audio/hub_loop.wav",
    import.meta.url,
  ).href,
  region_map_loop: new URL(
    "../../../assets/games/wonder-academy/audio/region_map_loop.wav",
    import.meta.url,
  ).href,
  mood_trial_loop: new URL(
    "../../../assets/games/wonder-academy/audio/mood_trial_loop.wav",
    import.meta.url,
  ).href,
  warden_trial_loop: new URL(
    "../../../assets/games/wonder-academy/audio/warden_trial_loop.wav",
    import.meta.url,
  ).href,
};

type BrowserAudioElement = Pick<
  HTMLAudioElement,
  "currentTime" | "loop" | "muted" | "pause" | "play" | "preload" | "src" | "volume"
>;

type AudioFactory = (src: string) => BrowserAudioElement | null;

export type WonderAcademyAudioManager = {
  getSettings: () => WonderAcademyAudioSettings;
  setSettings: (settings?: Partial<WonderAcademyAudioSettings> | null) => WonderAcademyAudioSettings;
  playSfx: (id: WonderAcademySfxId) => void;
  startLoop: (id: WonderAcademyLoopId) => void;
  stopLoop: (id: WonderAcademyLoopId) => void;
  stopAll: () => void;
};

const clampVolume = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;

export function normalizeAudioSettings(
  settings?: Partial<WonderAcademyAudioSettings> | null,
): WonderAcademyAudioSettings {
  return {
    musicVolume: clampVolume(
      settings?.musicVolume,
      defaultWonderAcademyAudioSettings.musicVolume,
    ),
    sfxVolume: clampVolume(settings?.sfxVolume, defaultWonderAcademyAudioSettings.sfxVolume),
    muted:
      typeof settings?.muted === "boolean"
        ? settings.muted
        : defaultWonderAcademyAudioSettings.muted,
  };
}

const createBrowserAudioFactory = (): AudioFactory => {
  if (typeof Audio === "undefined") {
    return () => null;
  }

  return (src) => {
    const audio = new Audio(src);
    audio.preload = "auto";
    return audio;
  };
};

type CreateWonderAcademyAudioOptions = {
  audioFactory?: AudioFactory;
  initialSettings?: Partial<WonderAcademyAudioSettings> | null;
};

export function createWonderAcademyAudio(
  options: CreateWonderAcademyAudioOptions = {},
): WonderAcademyAudioManager {
  const audioFactory = options.audioFactory ?? createBrowserAudioFactory();
  const sfxElements = new Map<WonderAcademySfxId, BrowserAudioElement>();
  const loopElements = new Map<WonderAcademyLoopId, BrowserAudioElement>();
  let settings = normalizeAudioSettings(options.initialSettings);

  const getOrCreateSfx = (id: WonderAcademySfxId) => {
    const existing = sfxElements.get(id);

    if (existing) {
      return existing;
    }

    const audio = audioFactory(wonderAcademySfxUrls[id]);

    if (audio) {
      audio.loop = false;
      sfxElements.set(id, audio);
    }

    return audio;
  };

  const getOrCreateLoop = (id: WonderAcademyLoopId) => {
    const existing = loopElements.get(id);

    if (existing) {
      return existing;
    }

    const audio = audioFactory(wonderAcademyLoopUrls[id]);

    if (audio) {
      audio.loop = true;
      loopElements.set(id, audio);
    }

    return audio;
  };

  const applySettingsToAudio = (audio: BrowserAudioElement, volume: number) => {
    audio.volume = settings.muted ? 0 : volume;
    audio.muted = settings.muted;
  };

  return {
    getSettings: () => settings,
    setSettings: (nextSettings) => {
      settings = normalizeAudioSettings({ ...settings, ...nextSettings });

      for (const audio of sfxElements.values()) {
        applySettingsToAudio(audio, settings.sfxVolume);
      }

      for (const audio of loopElements.values()) {
        applySettingsToAudio(audio, settings.musicVolume);
      }

      return settings;
    },
    playSfx: (id) => {
      if (settings.muted) {
        return;
      }

      const audio = getOrCreateSfx(id);

      if (!audio) {
        return;
      }

      applySettingsToAudio(audio, settings.sfxVolume);
      audio.currentTime = 0;
      void audio.play().catch(() => {
        // Browser autoplay policy can still reject if callers invoke outside a gesture.
      });
    },
    startLoop: (id) => {
      if (settings.muted) {
        return;
      }

      const audio = getOrCreateLoop(id);

      if (!audio) {
        return;
      }

      applySettingsToAudio(audio, settings.musicVolume);
      void audio.play().catch(() => {
        // Callers may retry from a user gesture if autoplay policy blocks this.
      });
    },
    stopLoop: (id) => {
      const audio = loopElements.get(id);

      if (!audio) {
        return;
      }

      audio.pause();
      audio.currentTime = 0;
    },
    stopAll: () => {
      for (const audio of [...sfxElements.values(), ...loopElements.values()]) {
        audio.pause();
        audio.currentTime = 0;
      }
    },
  };
}
