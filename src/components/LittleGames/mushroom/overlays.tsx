import { useState, type ReactNode } from "react";
import { type MushroomSettings } from "../lib/types";

export function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30 backdrop-blur">
      <div className="rounded-3xl bg-white/95 border border-white/60 shadow-2xl px-6 py-6 text-center max-w-md">
        {children}
      </div>
    </div>
  );
}

export function PauseOverlay({
  onResume,
  onRestart,
  onMenu,
}: {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  return (
    <Overlay>
      <h2 className="text-3xl font-bold text-emerald-800 mb-2">暫停中</h2>
      <p className="text-slate-600 mb-4 text-sm">
        休息一下，準備好了再繼續！（按 Esc 也可以繼續）
      </p>
      <div className="flex gap-3 justify-center flex-wrap">
        <button
          onClick={onResume}
          className="rounded-full bg-emerald-500 text-white px-4 py-2 font-semibold shadow hover:bg-emerald-600 transition"
        >
          ▶ 繼續
        </button>
        <button
          onClick={onRestart}
          className="rounded-full bg-slate-100 text-slate-700 px-4 py-2 font-semibold shadow hover:bg-slate-200 transition"
        >
          ↻ 重新開始本關
        </button>
        <button
          onClick={onMenu}
          className="rounded-full bg-white border border-emerald-200 px-4 py-2 font-semibold text-emerald-700 shadow"
        >
          回主選單
        </button>
      </div>
    </Overlay>
  );
}

export function SettingsOverlay({
  settings,
  onSave,
  onCancel,
}: {
  settings: MushroomSettings;
  onSave: (s: MushroomSettings) => void;
  onCancel: () => void;
}) {
  const [localSettings, setLocalSettings] =
    useState<MushroomSettings>(settings);

  const difficultyLabel = (value: number) => {
    if (value <= 0.8) return "簡單";
    if (value <= 1.1) return "普通";
    if (value <= 1.3) return "困難";
    return "地獄";
  };

  const enemyLabel = (value: number) => {
    if (value <= 1) return "正常";
    if (value <= 1.5) return "較多";
    return "超多";
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30 backdrop-blur">
      <div className="rounded-3xl bg-white/95 border border-white/60 shadow-2xl px-6 py-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-emerald-800 mb-4 text-center">
          ⚙️ 遊戲設定
        </h2>

        {/* 難度滑桿 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            遊戲難度：
            <span className="text-emerald-600 font-bold">
              {difficultyLabel(localSettings.difficultyScale)}
            </span>
          </label>
          <input
            type="range"
            min="0.7"
            max="1.5"
            step="0.1"
            value={localSettings.difficultyScale}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                difficultyScale: parseFloat(e.target.value),
              })
            }
            className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>簡單</span>
            <span>普通</span>
            <span>困難</span>
            <span>地獄</span>
          </div>
        </div>

        {/* 敵人數量 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            敵人數量：
            <span className="text-emerald-600 font-bold">
              {enemyLabel(localSettings.enemyMultiplier)}
            </span>
          </label>
          <div className="flex gap-2">
            {[1, 1.5, 2].map((val) => (
              <button
                key={val}
                onClick={() =>
                  setLocalSettings({ ...localSettings, enemyMultiplier: val })
                }
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  localSettings.enemyMultiplier === val
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {val === 1 ? "×1" : val === 1.5 ? "×1.5" : "×2"}
              </button>
            ))}
          </div>
        </div>

        {/* 道具頻率 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            道具頻率：
            <span className="text-emerald-600 font-bold">
              {(localSettings.powerupFrequency * 100).toFixed(0)}%
            </span>
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.25"
            value={localSettings.powerupFrequency}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                powerupFrequency: parseFloat(e.target.value),
              })
            }
            className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>50%</span>
            <span>100%</span>
            <span>150%</span>
            <span>200%</span>
          </div>
        </div>

        {/* 粒子特效開關 */}
        <div className="mb-6">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium text-slate-700">粒子特效</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={localSettings.enableParticles}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    enableParticles: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </div>
          </label>
          <p className="text-xs text-slate-500 mt-1">
            開啟後踩敵人和收集道具會有爆炸粒子效果
          </p>
        </div>

        {/* 按鈕 */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-full bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
          >
            取消
          </button>
          <button
            onClick={() => onSave(localSettings)}
            className="flex-1 py-2 rounded-full bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition"
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}
