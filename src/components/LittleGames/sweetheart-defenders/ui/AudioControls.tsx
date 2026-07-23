import type { AudioControls as Controls } from "../useAudioSettings";

/** HUD 上的靜音鍵：戰鬥中只需要一鍵切換，不用整組滑桿。 */
export function MuteButton({ settings, setMuted }: Controls) {
  return (
    <button
      type="button"
      onClick={() => setMuted(!settings.muted)}
      aria-pressed={settings.muted}
      aria-label={settings.muted ? "開啟音效" : "關閉音效"}
      className="min-h-11 rounded-[8px] border border-black/5 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
    >
      {settings.muted ? "🔇" : "🔊"}
    </button>
  );
}

/** 路線頁的音量設定。 */
export function AudioSettingsPanel({
  settings,
  setMuted,
  setMusicVolume,
  setSfxVolume,
}: Controls) {
  return (
    <section className="mt-3 w-full max-w-xl rounded-[14px] border border-black/5 bg-white/85 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-800">音量</h2>
        <button
          type="button"
          onClick={() => setMuted(!settings.muted)}
          aria-pressed={settings.muted}
          className={`min-h-11 rounded-[10px] border px-3 text-sm font-semibold shadow-sm transition ${
            settings.muted
              ? "border-[#ff6f9f] bg-[#ff6f9f] text-white"
              : "border-black/5 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {settings.muted ? "🔇 已靜音" : "🔊 有聲音"}
        </button>
      </div>

      <div className="mt-2 space-y-2">
        <VolumeSlider
          label="音樂"
          value={settings.music}
          disabled={settings.muted}
          onChange={setMusicVolume}
        />
        <VolumeSlider
          label="音效"
          value={settings.sfx}
          disabled={settings.muted}
          onChange={setSfxVolume}
        />
      </div>
    </section>
  );
}

function VolumeSlider({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label
      className={`flex items-center gap-3 text-xs ${
        disabled ? "opacity-45" : ""
      }`}
    >
      <span className="w-8 shrink-0 font-medium text-slate-600">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 flex-1 cursor-pointer accent-[#ff6f9f]"
      />
      <span className="w-9 shrink-0 text-right tabular-nums text-slate-500">
        {Math.round(value * 100)}%
      </span>
    </label>
  );
}
