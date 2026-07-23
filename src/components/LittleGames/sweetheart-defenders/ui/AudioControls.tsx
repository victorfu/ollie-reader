import type { AudioControls as Controls } from "../useAudioSettings";

/**
 * 聲音開關。
 *
 * 刻意用「有沒有聲音」而不是「靜不靜音」來描述：預設是靜音，所以按鈕大部分
 * 時候顯示的是關閉狀態，用否定詞的否定（「取消靜音」）對小孩太繞。亮起來
 * 代表「現在有聲音」，符合直覺。
 */
export function MuteButton({ settings, setMuted }: Controls) {
  const soundOn = !settings.muted;

  return (
    <button
      type="button"
      onClick={() => setMuted(soundOn)}
      aria-pressed={soundOn}
      aria-label={soundOn ? "關閉聲音" : "開啟聲音"}
      className={`min-h-11 rounded-[8px] border px-3 text-sm font-semibold shadow-sm transition ${
        soundOn
          ? "border-[#ff6f9f] bg-[#ff6f9f] text-white"
          : "border-black/5 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {soundOn ? "🔊" : "🔇"}
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
  const soundOn = !settings.muted;

  return (
    <section className="mt-3 w-full max-w-xl rounded-[14px] border border-black/5 bg-white/85 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-800">聲音</h2>
          {!soundOn && (
            <p className="mt-0.5 text-xs text-slate-500">
              預設是靜音的，點右邊就會有音樂和音效。
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMuted(soundOn)}
          aria-pressed={soundOn}
          className={`min-h-11 shrink-0 rounded-[10px] border px-4 text-sm font-semibold shadow-sm transition ${
            soundOn
              ? "border-[#ff6f9f] bg-[#ff6f9f] text-white"
              : "border-[#ff6f9f]/40 bg-white text-[#d94f7d] hover:bg-rose-50"
          }`}
        >
          {soundOn ? "🔊 有聲音" : "🔇 打開聲音"}
        </button>
      </div>

      {soundOn && (
        <div className="mt-2 space-y-2">
          <VolumeSlider
            label="音樂"
            value={settings.music}
            onChange={setMusicVolume}
          />
          <VolumeSlider label="音效" value={settings.sfx} onChange={setSfxVolume} />
        </div>
      )}
    </section>
  );
}

function VolumeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-8 shrink-0 font-medium text-slate-600">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 flex-1 cursor-pointer accent-[#ff6f9f]"
      />
      <span className="w-9 shrink-0 text-right tabular-nums text-slate-500">
        {Math.round(value * 100)}%
      </span>
    </label>
  );
}
