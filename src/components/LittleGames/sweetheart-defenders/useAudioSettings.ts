import { useCallback, useState } from "react";
import {
  applyAudioSettings,
  readAudioSettings,
  type AudioSettings,
} from "./audio";

export type AudioControls = {
  settings: AudioSettings;
  setMuted: (muted: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
};

/**
 * 音量設定。
 *
 * audio.ts 是模組層級的單例（播放本來就是全域的事），這個 hook 只負責讓
 * React 那一層看得到目前的值，並把改動同步下去。
 */
export function useAudioSettings(): AudioControls {
  const [settings, setSettings] = useState<AudioSettings>(() => {
    const initial = readAudioSettings();
    applyAudioSettings(initial);
    return initial;
  });

  const update = useCallback((patch: Partial<AudioSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      applyAudioSettings(next);
      return next;
    });
  }, []);

  return {
    settings,
    setMuted: useCallback((muted: boolean) => update({ muted }), [update]),
    setMusicVolume: useCallback((music: number) => update({ music }), [update]),
    setSfxVolume: useCallback((sfx: number) => update({ sfx }), [update]),
  };
}
