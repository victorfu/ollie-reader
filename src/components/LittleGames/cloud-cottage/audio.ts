export type SfxId =
  | "eat"
  | "bubble"
  | "heart"
  | "play"
  | "lullaby"
  | "select";

export type AudioSettings = {
  /** 0–1. */
  sfx: number;
  /** Controls generated game sounds. Speech has its own switch. */
  muted: boolean;
  /** Whether Cloud Cottage may ask SpeechContext to read a phrase aloud. */
  speechEnabled: boolean;
};

/**
 * Cloud Cottage opens in a separate tab, so it must never make an unexpected
 * sound. The remembered volume stays useful once the player explicitly
 * unmutes it; speech remains a separate choice for the English-learning part.
 */
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  sfx: 0.65,
  muted: true,
  speechEnabled: true,
};

export const AUDIO_SETTINGS_KEY = "ollie-cloud-cottage-audio-v1";

type ToneStep = {
  /** Seconds after the effect begins. */
  offset: number;
  duration: number;
  frequency: number;
  endFrequency?: number;
  type: OscillatorType;
  /** Relative peak before the player's SFX volume is applied. */
  gain: number;
};

/** Small, deterministic recipes keep the effects light and require no files. */
const SOUND_PATTERNS: Record<SfxId, readonly ToneStep[]> = {
  eat: [
    {
      offset: 0,
      duration: 0.11,
      frequency: 260,
      endFrequency: 210,
      type: "triangle",
      gain: 0.16,
    },
    {
      offset: 0.12,
      duration: 0.12,
      frequency: 300,
      endFrequency: 225,
      type: "triangle",
      gain: 0.13,
    },
  ],
  bubble: [
    {
      offset: 0,
      duration: 0.2,
      frequency: 380,
      endFrequency: 760,
      type: "sine",
      gain: 0.1,
    },
    {
      offset: 0.1,
      duration: 0.18,
      frequency: 520,
      endFrequency: 940,
      type: "sine",
      gain: 0.08,
    },
  ],
  heart: [
    {
      offset: 0,
      duration: 0.2,
      frequency: 523.25,
      type: "sine",
      gain: 0.11,
    },
    {
      offset: 0.14,
      duration: 0.3,
      frequency: 659.25,
      type: "sine",
      gain: 0.13,
    },
  ],
  play: [
    {
      offset: 0,
      duration: 0.17,
      frequency: 392,
      type: "triangle",
      gain: 0.1,
    },
    {
      offset: 0.12,
      duration: 0.17,
      frequency: 523.25,
      type: "triangle",
      gain: 0.11,
    },
    {
      offset: 0.24,
      duration: 0.24,
      frequency: 659.25,
      type: "triangle",
      gain: 0.12,
    },
  ],
  lullaby: [
    {
      offset: 0,
      duration: 0.55,
      frequency: 523.25,
      type: "sine",
      gain: 0.065,
    },
    {
      offset: 0.42,
      duration: 0.55,
      frequency: 659.25,
      type: "sine",
      gain: 0.06,
    },
    {
      offset: 0.84,
      duration: 0.8,
      frequency: 587.33,
      endFrequency: 523.25,
      type: "sine",
      gain: 0.055,
    },
  ],
  select: [
    {
      offset: 0,
      duration: 0.1,
      frequency: 620,
      endFrequency: 760,
      type: "sine",
      gain: 0.075,
    },
  ],
};

const SFX_THROTTLE_MS: Partial<Record<SfxId, number>> = {
  eat: 80,
  bubble: 80,
  heart: 100,
  lullaby: 800,
  select: 50,
};

const MIN_GAIN = 0.0001;
const ATTACK_SECONDS = 0.018;

let settings: AudioSettings = DEFAULT_AUDIO_SETTINGS;
let audioContext: AudioContext | null = null;
const lastPlayedAt = new Map<SfxId, number>();

export function normalizeAudioSettings(raw: unknown): AudioSettings {
  if (typeof raw !== "object" || raw === null) {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }

  const record = raw as Record<string, unknown>;
  return {
    sfx: clampVolume(record.sfx, DEFAULT_AUDIO_SETTINGS.sfx),
    muted:
      typeof record.muted === "boolean"
        ? record.muted
        : DEFAULT_AUDIO_SETTINGS.muted,
    speechEnabled:
      typeof record.speechEnabled === "boolean"
        ? record.speechEnabled
        : DEFAULT_AUDIO_SETTINGS.speechEnabled,
  };
}

export function readAudioSettings(): AudioSettings {
  if (typeof window === "undefined") return { ...DEFAULT_AUDIO_SETTINGS };

  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_KEY);
    return raw
      ? normalizeAudioSettings(JSON.parse(raw))
      : { ...DEFAULT_AUDIO_SETTINGS };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

/** Applies the settings for this tab and persists them on this device. */
export function applyAudioSettings(next: AudioSettings): AudioSettings {
  settings = normalizeAudioSettings(next);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Storage can be disabled. The current tab still keeps the setting.
    }
  }

  return settings;
}

/**
 * Plays one short, gentle effect. Unsupported or blocked WebAudio silently
 * degrades so a sound can never interrupt care interactions.
 */
export function playSfx(id: SfxId): void {
  if (settings.muted || settings.sfx <= 0) return;

  const throttle = SFX_THROTTLE_MS[id];
  const now = Date.now();
  if (throttle && now - (lastPlayedAt.get(id) ?? 0) < throttle) return;
  lastPlayedAt.set(id, now);

  const context = getAudioContext();
  if (!context) return;

  const schedule = () => schedulePattern(context, SOUND_PATTERNS[id]);
  if (context.state === "suspended") {
    void context.resume().then(schedule).catch(() => {
      // The browser may still require a direct user gesture. Drop this sound.
    });
    return;
  }

  schedule();
}

export const playEatSound = (): void => playSfx("eat");
export const playBubbleSound = (): void => playSfx("bubble");
export const playHeartSound = (): void => playSfx("heart");
export const playToySound = (): void => playSfx("play");
export const playLullabySound = (): void => playSfx("lullaby");
export const playSelectSound = (): void => playSfx("select");

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioContext?.state === "closed") audioContext = null;
  if (audioContext) return audioContext;

  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;

  if (!AudioContextConstructor) return null;

  try {
    audioContext = new AudioContextConstructor();
    return audioContext;
  } catch {
    return null;
  }
}

function schedulePattern(
  context: AudioContext,
  pattern: readonly ToneStep[],
): void {
  try {
    const startsAt = context.currentTime + 0.01;

    for (const step of pattern) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = startsAt + step.offset;
      const stop = start + step.duration;
      const peak = Math.max(MIN_GAIN, step.gain * settings.sfx);

      oscillator.type = step.type;
      oscillator.frequency.setValueAtTime(step.frequency, start);
      if (step.endFrequency !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(
          step.endFrequency,
          stop,
        );
      }

      gain.gain.setValueAtTime(MIN_GAIN, start);
      gain.gain.exponentialRampToValueAtTime(
        peak,
        Math.min(stop, start + ATTACK_SECONDS),
      );
      gain.gain.exponentialRampToValueAtTime(MIN_GAIN, stop);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.addEventListener(
        "ended",
        () => {
          oscillator.disconnect();
          gain.disconnect();
        },
        { once: true },
      );
      oscillator.start(start);
      oscillator.stop(stop + 0.01);
    }
  } catch {
    // Closing a tab can invalidate the context between lookup and scheduling.
  }
}

function clampVolume(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}
