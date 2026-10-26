import { useState } from "react";
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  Volume2,
  Eye,
  SlidersHorizontal,
  Gamepad2,
} from "lucide-react";
import { useSettings } from "../../hooks/useSettings";
import { useGachaMissRate } from "../../hooks/useGachaMissRate";
import { useShowAllGachaEntries } from "../../hooks/useShowAllGachaEntries";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { resetGameProgress } from "../../services/gameProgressService";
import { ConfirmModal } from "../common/ConfirmModal";
import { GlassCard } from "../common/GlassCard";
import { Toast } from "../common/Toast";
import { LanguagePicker } from "../common/LanguagePicker";
import { T } from "../common/T";
import type { TTSMode, ComputeMode } from "../../types/pdf";
import type { MessageKey } from "../../i18n/translate";
import { getComputeStatusSync, refreshComputeBase, type ComputeStatus } from "../../services/localBackend";

const THEME_OPTIONS = [
  { id: "light", label: "settings.theme.light", icon: Sun },
  { id: "dark", label: "settings.theme.dark", icon: Moon },
  { id: "system", label: "settings.theme.system", icon: Monitor },
] as const;


const CATEGORIES = [
  { id: "appearance", label: "settings.category.appearance", icon: Palette },
  { id: "audio", label: "settings.category.audio", icon: Volume2 },
  { id: "advanced", label: "settings.category.advanced", icon: SlidersHorizontal },
  { id: "game", label: "settings.category.game", icon: Gamepad2 },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

export const Settings = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const { showAllGachaEntries, updateShowAllGachaEntries } =
    useShowAllGachaEntries();
  const { gachaMissRatePercent, updateGachaMissRatePercent } =
    useGachaMissRate();
  const {
    ttsMode,
    speechRate,
    loading,
    error,
    updateTtsMode,
    updateSpeechRate,
    computeMode,
    updateComputeMode,
  } = useSettings();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [computeStatus, setComputeStatus] = useState<ComputeStatus>(getComputeStatusSync);
  const [redetecting, setRedetecting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("appearance");

  const handleTtsModeChange = async (mode: TTSMode) => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      await updateTtsMode(mode);
      setSaveSuccess(true);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSpeechRateChange = async (rate: number) => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      await updateSpeechRate(rate);
      setSaveSuccess(true);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleComputeModeChange = async (mode: ComputeMode) => {
    if (redetecting) return;
    updateComputeMode(mode);
    if (mode !== "cloud") {
      setRedetecting(true);
      await refreshComputeBase();
      setRedetecting(false);
    }
    setComputeStatus(getComputeStatusSync());
  };

  const handleRedetect = async () => {
    if (redetecting) return;
    setRedetecting(true);
    await refreshComputeBase();
    setRedetecting(false);
    setComputeStatus(getComputeStatusSync());
  };

  const handleResetGameProgress = async () => {
    if (!user) return;

    setResetting(true);
    try {
      await resetGameProgress(user.uid);
      setShowResetModal(false);
      setResetSuccess(true);
    } catch (err) {
      console.error("Failed to reset game progress:", err);
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl">
        <GlassCard>
          <div className="flex justify-center p-10">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="lg:flex lg:items-start lg:gap-6">
        {/* Category navigation (sidebar on desktop, segmented control on mobile) */}
        <aside className="lg:sticky lg:top-[4.5rem] lg:w-56 lg:shrink-0">
          {/* Mobile: page heading */}
          <h1 className="mb-3 text-2xl font-semibold tracking-tight lg:hidden">
            ⚙️ <T k="settings.title" variant="stacked" />
          </h1>

          {/* Mobile: horizontally scrollable segmented nav */}
          <div className="overflow-x-auto scrollbar-hide pb-1 lg:hidden">
            <div className="inline-flex gap-1 rounded-lg border border-border-hairline bg-background/75 p-0.5 shadow-soft">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const active = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    aria-pressed={active}
                    className={`inline-flex min-h-9 shrink-0 items-center py-1 gap-1.5 rounded-md px-3 text-sm font-medium transition-all active:scale-[0.98] ${
                      active
                        ? "bg-accent text-white shadow-soft"
                        : "text-muted-foreground hover:bg-accent-tint hover:text-accent"
                    }`}
                  >
                    <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    <T k={cat.label} variant="stacked" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop: vertical sidebar nav */}
          <GlassCard className="hidden overflow-hidden lg:block">
            <div className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              <T k="settings.title" variant="stacked" />
            </div>
            <nav className="space-y-1 p-2 pt-1">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const active = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg text-left px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                      active
                        ? "bg-accent-tint text-accent"
                        : "text-base-content/70 hover:bg-accent-tint hover:text-accent"
                    }`}
                  >
                    <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <T k={cat.label} variant="stacked" />
                  </button>
                );
              })}
            </nav>
          </GlassCard>
        </aside>

        {/* Detail panel for the active category */}
        <div className="mt-4 min-w-0 flex-1 lg:mt-0">
          <GlassCard>
            <div className="p-5 sm:p-6">
              {error && (
                <div className="alert alert-error mb-4">
                  <span>{error}</span>
                </div>
              )}

              {/* Appearance / Theme */}
              {activeCategory === "appearance" && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    <T k="settings.theme.title" variant="stacked" />
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    <T k="settings.theme.description" />
                  </p>

                  <div className="inline-flex gap-1 rounded-lg bg-base-200 p-1">
                    {THEME_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const active = theme === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setTheme(opt.id)}
                          aria-pressed={active}
                          className={`inline-flex min-h-9 items-center gap-2 rounded-md px-4 py-1 text-sm font-medium transition-colors active:scale-[0.98] ${
                            active
                              ? "bg-base-100 text-accent shadow-soft"
                              : "text-muted-foreground hover:text-base-content"
                          }`}
                        >
                          <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                          <T k={opt.label} variant="stacked" />
                        </button>
                      );
                    })}
                  </div>

                  <h3 className="text-lg font-semibold mb-3 mt-8">
                    <T k="settings.language.title" variant="stacked" />
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    <T k="settings.language.description" />
                  </p>

                  <LanguagePicker />
                </div>
              )}

              {/* Audio: TTS mode + speech rate */}
              {activeCategory === "audio" && (
                <div className="space-y-6">
                  {/* TTS Mode Selection */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">
                      <T k="settings.tts.title" variant="stacked" />
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      <T k="settings.tts.description" />
                    </p>

                    <div className="space-y-3">
                      <label className="flex items-start gap-3 p-4 border border-border-hairline rounded-lg cursor-pointer hover:bg-base-200/60 transition-colors">
                        <input
                          type="radio"
                          name="ttsMode"
                          className="radio radio-primary mt-1"
                          checked={ttsMode === "browser"}
                          onChange={() => handleTtsModeChange("browser")}
                          disabled={saving}
                        />
                        <div className="flex-1">
                          <div className="font-medium">
                            <T k="settings.tts.browser" variant="stacked" />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <T k="settings.tts.browserDesc" />
                          </div>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-4 border border-border-hairline rounded-lg cursor-pointer hover:bg-base-200/60 transition-colors">
                        <input
                          type="radio"
                          name="ttsMode"
                          className="radio radio-primary mt-1"
                          checked={ttsMode === "api"}
                          onChange={() => handleTtsModeChange("api")}
                          disabled={saving}
                        />
                        <div className="flex-1">
                          <div className="font-medium">
                            <T k="settings.tts.api" variant="stacked" />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <T k="settings.tts.apiDesc" />
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="divider"></div>

                  {/* Speech Rate Setting */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">
                      <T k="settings.rate.title" variant="stacked" />
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      <T k="settings.rate.description" />
                    </p>

                    <div className="p-4 border border-border-hairline rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="text-sm whitespace-nowrap">
                          <T k="settings.rate.slow" variant="stacked" />
                        </span>
                        <input
                          type="range"
                          min={0.5}
                          max={2}
                          step={0.1}
                          value={speechRate}
                          onChange={(e) =>
                            handleSpeechRateChange(Number(e.target.value))
                          }
                          className="range range-primary flex-1"
                          disabled={saving}
                        />
                        <span className="text-sm whitespace-nowrap">
                          <T k="settings.rate.fast" variant="stacked" />
                        </span>
                        <span className="badge badge-primary min-w-[4rem] justify-center">
                          {speechRate.toFixed(1)}x
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced: compute backend */}
              {activeCategory === "advanced" && (
                <div className="space-y-6">
                  {/* 運算後端 / 連線模式 */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">
                      <T k="settings.compute.title" variant="stacked" />
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      <T k="settings.compute.description" />
                    </p>

                    <div className="space-y-3">
                      {(
                        [
                          { id: "auto", name: "settings.compute.auto", desc: "settings.compute.autoDesc" },
                          { id: "local", name: "settings.compute.local", desc: "settings.compute.localDesc" },
                          { id: "cloud", name: "settings.compute.cloud", desc: "settings.compute.cloudDesc" },
                        ] as { id: ComputeMode; name: MessageKey; desc: MessageKey }[]
                      ).map((opt) => (
                        <label
                          key={opt.id}
                          className="flex items-start gap-3 p-4 border border-border-hairline rounded-lg cursor-pointer hover:bg-base-200/60 transition-colors"
                        >
                          <input
                            type="radio"
                            name="computeMode"
                            className="radio radio-primary mt-1"
                            checked={computeMode === opt.id}
                            onChange={() => handleComputeModeChange(opt.id)}
                            disabled={redetecting}
                          />
                          <div className="flex-1">
                            <div className="font-medium">
                              <T k={opt.name} variant="stacked" />
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <T k={opt.desc} />
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>

                    {computeMode !== "cloud" && (
                      <div className="mt-3 flex items-center gap-3 border-l-2 border-border-hairline pl-4">
                        <span className="text-sm text-base-content/70">
                          <T
                            k="settings.compute.current"
                            params={{
                              backend: t(
                                computeStatus.usingLocal
                                  ? "settings.compute.usingLocal"
                                  : "settings.compute.usingCloud",
                              ),
                            }}
                          />
                          {computeMode === "local" && computeStatus.localReachable === false ? (
                            <T k="settings.compute.unreachable" />
                          ) : null}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={handleRedetect}
                          disabled={redetecting}
                        >
                          <T
                            k={redetecting ? "settings.compute.detecting" : "settings.compute.redetect"}
                            variant="stacked"
                          />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Game Settings */}
              {activeCategory === "game" && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    🎮 <T k="settings.game.title" variant="stacked" />
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    <T k="settings.game.description" />
                  </p>

                  <div className="space-y-4">
                    <div className="rounded-[10px] border border-border-hairline bg-background/45 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-accent">
                            <SlidersHorizontal
                              className="size-5"
                              strokeWidth={1.8}
                              aria-hidden="true"
                            />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium">
                              <T k="settings.game.missRate" variant="stacked" />
                            </span>
                            <span
                              id="gacha-miss-rate-description"
                              className="mt-1 block text-sm leading-5 text-muted-foreground"
                            >
                              <T k="settings.game.missRateDesc" />
                            </span>
                          </span>
                        </div>
                        <output
                          htmlFor="settings-gacha-miss-rate"
                          className="shrink-0 rounded-full bg-accent-tint px-2.5 py-1 text-sm font-black tabular-nums text-accent"
                        >
                          {gachaMissRatePercent}%
                        </output>
                      </div>
                      <input
                        id="settings-gacha-miss-rate"
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={gachaMissRatePercent}
                        onChange={(event) =>
                          updateGachaMissRatePercent(Number(event.target.value))
                        }
                        className="range range-primary mt-4 w-full"
                        aria-label={t("settings.game.missRate")}
                        aria-describedby="gacha-miss-rate-description"
                        aria-valuetext={`${gachaMissRatePercent}%`}
                      />
                      <div className="mt-2 flex justify-between text-[11px] font-medium text-muted-foreground">
                        <span>
                          <T k="settings.game.missRateMin" />
                        </span>
                        <span>
                          <T k="settings.game.missRateMax" />
                        </span>
                      </div>
                    </div>

                    <label className="flex min-h-20 cursor-pointer items-center justify-between gap-4 rounded-[10px] border border-border-hairline bg-background/45 p-4 transition-colors hover:bg-accent-tint">
                      <span className="flex min-w-0 items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-accent">
                          <Eye
                            className="size-5"
                            strokeWidth={1.8}
                            aria-hidden="true"
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium">
                            <T k="settings.game.showAll" variant="stacked" />
                          </span>
                          <span
                            id="show-all-gacha-description"
                            className="mt-1 block text-sm leading-5 text-muted-foreground"
                          >
                            <T k="settings.game.showAllDesc" />
                          </span>
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        className="toggle toggle-sm toggle-accent shrink-0"
                        checked={showAllGachaEntries}
                        onChange={(event) =>
                          updateShowAllGachaEntries(event.target.checked)
                        }
                        aria-describedby="show-all-gacha-description"
                      />
                    </label>

                    <div className="p-4 border border-error/30 rounded-lg bg-error/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-error">
                            <T k="settings.game.reset" variant="stacked" />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <T k="settings.game.resetDesc" />
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-error btn-outline"
                          onClick={() => setShowResetModal(true)}
                          disabled={!user}
                        >
                          <T k="settings.game.resetButton" variant="stacked" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Save feedback as fixed overlay so it never shifts the page layout */}
      {saving ? (
        <div
          role="status"
          aria-live="polite"
          className="toast toast-top toast-center z-50 pointer-events-none"
        >
          <div className="flex items-center gap-3 rounded-xl border border-border-hairline bg-background/80 px-4 py-3 shadow-floating backdrop-blur-md">
            <span className="loading loading-spinner loading-sm" />
            <span className="text-sm font-medium">
              <T k="settings.saving" variant="stacked" />
            </span>
          </div>
        </div>
      ) : saveSuccess ? (
        <Toast
          message={<>✓ <T k="settings.saved" variant="stacked" /></>}
          onClose={() => setSaveSuccess(false)}
        />
      ) : resetSuccess ? (
        <Toast
          message={<T k="settings.game.resetDone" variant="stacked" />}
          onClose={() => setResetSuccess(false)}
        />
      ) : null}

      <ConfirmModal
        isOpen={showResetModal}
        title={<T k="settings.game.resetConfirmTitle" variant="stacked" />}
        message={<T k="settings.game.resetConfirmMessage" />}
        confirmText={<T k="settings.game.resetButton" variant="stacked" />}
        confirmVariant="error"
        isLoading={resetting}
        onConfirm={handleResetGameProgress}
        onCancel={() => setShowResetModal(false)}
      />
    </div>
  );
};
