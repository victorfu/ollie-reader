import { useState, type ReactNode } from "react";
import { type MushroomSettings } from "../lib/types";
import { T } from "../../common/T";
import type { MessageKey } from "../../../i18n/translate";

// 兒童友善的大按鈕（≥44px 觸擊目標 + focus ring）
export const BTN_PRIMARY =
  "rounded-full bg-emerald-500 text-white min-h-11 px-6 py-2.5 text-lg font-semibold shadow hover:bg-emerald-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.98]";
export const BTN_SECONDARY =
  "rounded-full bg-slate-100 text-slate-700 min-h-11 px-6 py-2.5 text-lg font-semibold shadow hover:bg-slate-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.98]";
export const BTN_OUTLINE =
  "rounded-full bg-white border border-emerald-200 text-emerald-700 min-h-11 px-6 py-2.5 text-lg font-semibold shadow transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.98]";

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
      <h2 className="text-4xl font-bold text-emerald-800 mb-2">
        <T k="arcade.common.paused" variant="stacked" />
      </h2>
      <p className="text-slate-600 mb-5 text-base">
        <T k="arcade.common.pausedHint" />
      </p>
      <div className="flex gap-3 justify-center flex-wrap">
        <button onClick={onResume} className={BTN_PRIMARY}>
          ▶ <T k="arcade.common.resume" variant="stacked" />
        </button>
        <button onClick={onRestart} className={BTN_SECONDARY}>
          ↻ <T k="arcade.mushroom.restartLevel" variant="stacked" />
        </button>
        <button onClick={onMenu} className={BTN_OUTLINE}>
          <T k="arcade.common.backToMenu" variant="stacked" />
        </button>
      </div>
    </Overlay>
  );
}

export function TutorialCompleteOverlay({
  onStart,
  onMenu,
}: {
  onStart: () => void;
  onMenu: () => void;
}) {
  return (
    <Overlay>
      <h2 className="text-4xl font-bold text-emerald-800 mb-2">
        🎉 <T k="arcade.common.tutorialDone" variant="stacked" />
      </h2>
      <p className="text-slate-700 mb-5 text-base">
        <T k="arcade.mushroom.tutorialDoneBody" />
      </p>
      <div className="flex gap-3 justify-center flex-wrap">
        <button onClick={onStart} className={BTN_PRIMARY}>
          <T k="arcade.mushroom.startLevel1" variant="stacked" />
        </button>
        <button onClick={onMenu} className={BTN_OUTLINE}>
          <T k="arcade.common.backToMenu" variant="stacked" />
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

  const difficultyLabel = (value: number): MessageKey => {
    if (value <= 0.8) return "arcade.mushroom.settings.easy";
    if (value <= 1.1) return "arcade.mushroom.settings.normal";
    if (value <= 1.3) return "arcade.mushroom.settings.hard";
    return "arcade.mushroom.settings.extreme";
  };

  const enemyLabel = (value: number): MessageKey => {
    if (value <= 1) return "arcade.mushroom.settings.enemiesNormal";
    if (value <= 1.5) return "arcade.mushroom.settings.enemiesMore";
    return "arcade.mushroom.settings.enemiesLots";
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30 backdrop-blur">
      <div className="rounded-3xl bg-white/95 border border-white/60 shadow-2xl px-6 py-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-emerald-800 mb-4 text-center">
          ⚙️ <T k="arcade.mushroom.settings.title" variant="stacked" />
        </h2>

        {/* 難度滑桿 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <T k="arcade.mushroom.settings.difficulty" />
            <span className="text-emerald-600 font-bold">
              <T k={difficultyLabel(localSettings.difficultyScale)} />
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
            <span>
              <T k="arcade.mushroom.settings.easy" />
            </span>
            <span>
              <T k="arcade.mushroom.settings.normal" />
            </span>
            <span>
              <T k="arcade.mushroom.settings.hard" />
            </span>
            <span>
              <T k="arcade.mushroom.settings.extreme" />
            </span>
          </div>
        </div>

        {/* 敵人數量 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <T k="arcade.mushroom.settings.enemies" />
            <span className="text-emerald-600 font-bold">
              <T k={enemyLabel(localSettings.enemyMultiplier)} />
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
            <T k="arcade.mushroom.settings.powerups" />
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
            <span className="text-sm font-medium text-slate-700">
              <T k="arcade.mushroom.settings.particles" />
            </span>
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
            <T k="arcade.mushroom.settings.particlesHint" />
          </p>
        </div>

        {/* 按鈕 */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 min-h-11 py-2.5 rounded-full bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <T k="arcade.mushroom.settings.cancel" variant="stacked" />
          </button>
          <button
            onClick={() => onSave(localSettings)}
            className="flex-1 min-h-11 py-2.5 rounded-full bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <T k="arcade.mushroom.settings.save" variant="stacked" />
          </button>
        </div>
      </div>
    </div>
  );
}
