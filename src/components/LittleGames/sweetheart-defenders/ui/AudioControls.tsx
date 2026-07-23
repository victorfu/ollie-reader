import { useEffect, useRef, useState } from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import type { AudioControls as Controls } from "../useAudioSettings";

type Props = Controls & {
  /** 彈出面板要往哪一邊長。戰鬥 HUD 在右上角，往左下開才不會被裁掉。 */
  align?: "left" | "right";
};

/**
 * 聲音控制：一顆按鈕，音量藏在彈出面板裡。
 *
 * 之前是一整段固定的設定區塊，光為了兩條很少動的滑桿就吃掉一整列版面。
 * 圖示用 lucide 而不是 emoji——emoji 的字形在不同作業系統長得不一樣，
 * 大小和基線也對不齊旁邊的按鈕。
 */
export function AudioButton({
  settings,
  setMuted,
  setMusicVolume,
  setSfxVolume,
  align = "right",
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const soundOn = !settings.muted;
  const Icon = !soundOn ? VolumeX : settings.music + settings.sfx > 0.8 ? Volume2 : Volume1;

  // 點面板外面或按 Esc 就收起來。
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={soundOn ? "聲音設定（目前有聲音）" : "聲音設定（目前靜音）"}
        className={`flex min-h-11 items-center justify-center rounded-[10px] border px-3 shadow-sm transition ${
          soundOn
            ? "border-[#ff6f9f] bg-[#ff6f9f] text-white"
            : "border-black/5 bg-white text-slate-500 hover:bg-slate-50"
        }`}
      >
        <Icon size={18} strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div
          className={`absolute top-[calc(100%+8px)] z-40 w-60 rounded-[14px] border border-black/5 bg-white/95 p-3 shadow-xl backdrop-blur-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <button
            type="button"
            onClick={() => setMuted(soundOn)}
            aria-pressed={soundOn}
            className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] border px-3 text-sm font-semibold shadow-sm transition ${
              soundOn
                ? "border-[#ff6f9f] bg-[#ff6f9f] text-white"
                : "border-[#ff6f9f]/40 bg-white text-[#d94f7d] hover:bg-rose-50"
            }`}
          >
            {soundOn ? (
              <Volume2 size={16} strokeWidth={2} aria-hidden="true" />
            ) : (
              <VolumeX size={16} strokeWidth={2} aria-hidden="true" />
            )}
            {soundOn ? "有聲音" : "打開聲音"}
          </button>

          {soundOn ? (
            <div className="mt-3 space-y-2">
              <VolumeSlider
                label="音樂"
                value={settings.music}
                onChange={setMusicVolume}
              />
              <VolumeSlider
                label="音效"
                value={settings.sfx}
                onChange={setSfxVolume}
              />
            </div>
          ) : (
            <p className="mt-2 text-xs leading-snug text-slate-500">
              預設是靜音的，打開就會有音樂和音效。
            </p>
          )}
        </div>
      )}
    </div>
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
    <label className="flex items-center gap-2 text-xs">
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
