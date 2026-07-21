import { useState } from "react";
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  Volume2,
  BookOpen,
  Eye,
  SlidersHorizontal,
  Gamepad2,
} from "lucide-react";
import { useSettings } from "../../hooks/useSettings";
import { useGachaMissRate } from "../../hooks/useGachaMissRate";
import { useShowAllGachaEntries } from "../../hooks/useShowAllGachaEntries";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { resetGameProgress } from "../../services/gameProgressService";
import { ConfirmModal } from "../common/ConfirmModal";
import { GlassCard } from "../common/GlassCard";
import { Toast } from "../common/Toast";
import type { TTSMode, TTSEngine, ReadingMode, TextParsingMode, ComputeMode } from "../../types/pdf";
import { getComputeStatusSync, refreshComputeBase, type ComputeStatus } from "../../services/localBackend";

const THEME_OPTIONS = [
  { id: "light", label: "淺色", icon: Sun },
  { id: "dark", label: "深色", icon: Moon },
  { id: "system", label: "系統", icon: Monitor },
] as const;

const CATEGORIES = [
  { id: "appearance", label: "外觀", icon: Palette },
  { id: "audio", label: "語音", icon: Volume2 },
  { id: "reading", label: "閱讀", icon: BookOpen },
  { id: "advanced", label: "進階", icon: SlidersHorizontal },
  { id: "game", label: "遊戲", icon: Gamepad2 },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

export const Settings = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { showAllGachaEntries, updateShowAllGachaEntries } =
    useShowAllGachaEntries();
  const { gachaMissRatePercent, updateGachaMissRatePercent } =
    useGachaMissRate();
  const {
    ttsMode,
    ttsEngine,
    speechRate,
    readingMode,
    textParsingMode,
    loading,
    error,
    updateTtsMode,
    updateTtsEngine,
    updateSpeechRate,
    updateReadingMode,
    updateTextParsingMode,
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

  const handleTtsEngineChange = async (engine: TTSEngine) => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      await updateTtsEngine(engine);
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

  const handleReadingModeChange = async (mode: ReadingMode) => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      await updateReadingMode(mode);
      setSaveSuccess(true);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleTextParsingModeChange = async (mode: TextParsingMode) => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      await updateTextParsingMode(mode);
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
            ⚙️ 設定
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
                    className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-all active:scale-[0.98] ${
                      active
                        ? "bg-accent text-white shadow-soft"
                        : "text-muted-foreground hover:bg-accent-tint hover:text-accent"
                    }`}
                  >
                    <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop: vertical sidebar nav */}
          <GlassCard className="hidden overflow-hidden lg:block">
            <div className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              設定
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
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                      active
                        ? "bg-accent-tint text-accent"
                        : "text-base-content/70 hover:bg-accent-tint hover:text-accent"
                    }`}
                  >
                    <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span className="truncate">{cat.label}</span>
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
                  <h3 className="text-lg font-semibold mb-3">外觀主題</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    選擇介面的明暗模式
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
                          className={`inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors active:scale-[0.98] ${
                            active
                              ? "bg-base-100 text-accent shadow-soft"
                              : "text-muted-foreground hover:text-base-content"
                          }`}
                        >
                          <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Audio: TTS mode + speech rate */}
              {activeCategory === "audio" && (
                <div className="space-y-6">
                  {/* TTS Mode Selection */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">語音模式選擇</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      選擇文字轉語音的服務
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
                          <div className="font-medium">系統語音</div>
                          <div className="text-sm text-muted-foreground">
                            使用瀏覽器內建的語音引擎（推薦）
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
                          <div className="font-medium">AI 語音</div>
                          <div className="text-sm text-muted-foreground">
                            使用 AI 語音合成服務，聲音更自然
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* AI 引擎子選單（僅在 API 模式顯示） */}
                    {ttsMode === "api" && (
                      <div className="mt-3 space-y-3 border-l-2 border-border-hairline pl-4">
                        <p className="text-sm text-base-content/70">選擇 AI 語音引擎</p>
                        {(
                          [
                            {
                              id: "piper",
                              name: "Piper",
                              desc: "本地模型，速度快、免費、隱私（預設）",
                            },
                            {
                              id: "kokoro",
                              name: "Kokoro",
                              desc: "高品質神經語音；需後端本地啟用，未啟用會失敗",
                            },
                            {
                              id: "chatterbox",
                              name: "Chatterbox Turbo",
                              desc: "高品質英文 AI 語音；較吃效能，需後端本地啟用，未啟用會失敗",
                            },
                          ] as { id: TTSEngine; name: string; desc: string }[]
                        ).map((eng) => (
                          <label
                            key={eng.id}
                            className="flex items-start gap-3 p-3 border border-border-hairline rounded-lg cursor-pointer hover:bg-base-200/60 transition-colors"
                          >
                            <input
                              type="radio"
                              name="ttsEngine"
                              className="radio radio-primary radio-sm mt-1"
                              checked={ttsEngine === eng.id}
                              onChange={() => handleTtsEngineChange(eng.id)}
                              disabled={saving}
                            />
                            <div className="flex-1">
                              <div className="font-medium">{eng.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {eng.desc}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="divider"></div>

                  {/* Speech Rate Setting */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">語速設定</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      調整播放速度
                    </p>

                    <div className="p-4 border border-border-hairline rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="text-sm whitespace-nowrap">慢</span>
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
                        <span className="text-sm whitespace-nowrap">快</span>
                        <span className="badge badge-primary min-w-[4rem] justify-center">
                          {speechRate.toFixed(1)}x
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reading Mode Selection */}
              {activeCategory === "reading" && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">閱讀模式</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    選擇點擊文字時的查詢方式
                  </p>

                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-4 border border-border-hairline rounded-lg cursor-pointer hover:bg-base-200/60 transition-colors">
                      <input
                        type="radio"
                        name="readingMode"
                        className="radio radio-primary mt-1"
                        checked={readingMode === "word"}
                        onChange={() => handleReadingModeChange("word")}
                        disabled={saving}
                      />
                      <div className="flex-1">
                        <div className="font-medium">單字模式</div>
                        <div className="text-sm text-muted-foreground">
                          點擊單字即可查詢（推薦）
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 border border-border-hairline rounded-lg cursor-pointer hover:bg-base-200/60 transition-colors">
                      <input
                        type="radio"
                        name="readingMode"
                        className="radio radio-primary mt-1"
                        checked={readingMode === "selection"}
                        onChange={() => handleReadingModeChange("selection")}
                        disabled={saving}
                      />
                      <div className="flex-1">
                        <div className="font-medium">選取模式</div>
                        <div className="text-sm text-muted-foreground">
                          選取文字範圍後查詢，適合查詢片語或句子
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Advanced: PDF parsing + compute backend */}
              {activeCategory === "advanced" && (
                <div className="space-y-6">
                  {/* PDF Text Parsing Mode */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">PDF 文字解析</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      選擇如何從 PDF 擷取文字
                    </p>

                    <div className="space-y-3">
                      <label className="flex items-start gap-3 p-4 border border-border-hairline rounded-lg cursor-pointer hover:bg-base-200/60 transition-colors">
                        <input
                          type="radio"
                          name="textParsingMode"
                          className="radio radio-primary mt-1"
                          checked={textParsingMode === "backend"}
                          onChange={() => handleTextParsingModeChange("backend")}
                          disabled={saving}
                        />
                        <div className="flex-1">
                          <div className="font-medium">後端解析</div>
                          <div className="text-sm text-muted-foreground">
                            上傳 PDF 至伺服器解析（較準確）
                          </div>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-4 border border-border-hairline rounded-lg cursor-pointer hover:bg-base-200/60 transition-colors">
                        <input
                          type="radio"
                          name="textParsingMode"
                          className="radio radio-primary mt-1"
                          checked={textParsingMode === "frontend"}
                          onChange={() => handleTextParsingModeChange("frontend")}
                          disabled={saving}
                        />
                        <div className="flex-1">
                          <div className="font-medium">前端解析</div>
                          <div className="text-sm text-muted-foreground">
                            直接在瀏覽器中使用 react-pdf 解析（較快，不需上傳）
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="divider"></div>

                  {/* 運算後端 / 連線模式 */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">運算後端</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      選擇 PDF 解析與 AI 語音要走本機桌面 App、自動，或只用雲端
                    </p>

                    <div className="space-y-3">
                      {(
                        [
                          { id: "auto", name: "自動", desc: "偵測到本機桌面 App 就用本機，否則用雲端（推薦）" },
                          { id: "local", name: "只用本機", desc: "強制使用本機桌面 App；未啟動時會顯示錯誤，不退雲端" },
                          { id: "cloud", name: "只用雲端", desc: "永遠使用雲端服務，不偵測本機" },
                        ] as { id: ComputeMode; name: string; desc: string }[]
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
                            <div className="font-medium">{opt.name}</div>
                            <div className="text-sm text-muted-foreground">{opt.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>

                    {computeMode !== "cloud" && (
                      <div className="mt-3 flex items-center gap-3 border-l-2 border-border-hairline pl-4">
                        <span className="text-sm text-base-content/70">
                          目前使用：
                          {computeStatus.usingLocal ? "本機 sidecar" : "雲端"}
                          {computeMode === "local" && computeStatus.localReachable === false
                            ? "（本機未連線）"
                            : ""}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={handleRedetect}
                          disabled={redetecting}
                        >
                          {redetecting ? "偵測中…" : "重新偵測"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Game Settings */}
              {activeCategory === "game" && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">🎮 遊戲設定</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    管理遊戲偏好與進度
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
                            <span className="block font-medium">空膠囊機率</span>
                            <span
                              id="gacha-miss-rate-description"
                              className="mt-1 block text-sm leading-5 text-muted-foreground"
                            >
                              儲存在這台裝置，下一次轉動扭蛋機把手時套用。
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
                        aria-label="空膠囊機率"
                        aria-describedby="gacha-miss-rate-description"
                        aria-valuetext={`${gachaMissRatePercent}%`}
                      />
                      <div className="mt-2 flex justify-between text-[11px] font-medium text-muted-foreground">
                        <span>0%（必得角色）</span>
                        <span>100%（必定為空）</span>
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
                            開啟全部扭蛋圖鑑
                          </span>
                          <span
                            id="show-all-gacha-description"
                            className="mt-1 block text-sm leading-5 text-muted-foreground"
                          >
                            可查看所有角色圖片，不會更改抽取紀錄或實際收集進度。此設定只儲存在這台裝置。
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
                          <div className="font-medium text-error">重置遊戲進度</div>
                          <div className="text-sm text-muted-foreground">
                            清除所有關卡進度、等級和扭蛋代幣（生詞本不受影響）
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-error btn-outline"
                          onClick={() => setShowResetModal(true)}
                          disabled={!user}
                        >
                          重置
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
            <span className="text-sm font-medium">儲存中...</span>
          </div>
        </div>
      ) : saveSuccess ? (
        <Toast message="✓ 設定已儲存" onClose={() => setSaveSuccess(false)} />
      ) : resetSuccess ? (
        <Toast message="遊戲進度已重置" onClose={() => setResetSuccess(false)} />
      ) : null}

      <ConfirmModal
        isOpen={showResetModal}
        title="確定要重置遊戲進度？"
        message="這將清除所有關卡進度、等級和扭蛋代幣。此操作無法復原，但生詞本不會受到影響。"
        confirmText="重置"
        cancelText="取消"
        confirmVariant="error"
        isLoading={resetting}
        onConfirm={handleResetGameProgress}
        onCancel={() => setShowResetModal(false)}
      />
    </div>
  );
};
