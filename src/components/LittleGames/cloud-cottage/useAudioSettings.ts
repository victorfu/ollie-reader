import { useCallback, useState } from "react";
import {
  applyAudioSettings,
  readAudioSettings,
  type AudioSettings,
} from "./audio";

export type AudioControls = {
  settings: AudioSettings;
  setMuted: (muted: boolean) => void;
  setSfxVolume: (volume: number) => void;
  setSpeechEnabled: (enabled: boolean) => void;
};

/** React adapter for the device-local Cloud Cottage audio preferences. */
export function useAudioSettings(): AudioControls {
  const [settings, setSettings] = useState<AudioSettings>(() =>
    applyAudioSettings(readAudioSettings()),
  );

  const update = useCallback((patch: Partial<AudioSettings>) => {
    setSettings((current) =>
      applyAudioSettings({
        ...current,
        ...patch,
      }),
    );
  }, []);

  return {
    settings,
    setMuted: useCallback((muted: boolean) => update({ muted }), [update]),
    setSfxVolume: useCallback((sfx: number) => update({ sfx }), [update]),
    setSpeechEnabled: useCallback(
      (speechEnabled: boolean) => update({ speechEnabled }),
      [update],
    ),
  };
}
