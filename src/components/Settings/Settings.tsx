import { useState } from "react";
import { useSettings } from "../../hooks/useSettings";
import { useAuth } from "../../hooks/useAuth";
import { resetGameProgress } from "../../services/gameProgressService";
import { ConfirmModal } from "../common/ConfirmModal";
import type { TTSMode, TTSEngine, ReadingMode, TextParsingMode } from "../../types/pdf";

export const Settings = () => {
  const { user } = useAuth();
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
  } = useSettings();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleTtsModeChange = async (mode: TTSMode) => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      await updateTtsMode(mode);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
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
      setTimeout(() => setSaveSuccess(false), 3000);
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
      setTimeout(() => setSaveSuccess(false), 3000);
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
      setTimeout(() => setSaveSuccess(false), 3000);
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
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleResetGameProgress = async () => {
    if (!user) return;

    setResetting(true);
    try {
      await resetGameProgress(user.uid);
      setShowResetModal(false);
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to reset game progress:", err);
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex justify-center">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4">⚙️ 設定</h2>

          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="alert alert-success mb-4">
              <span>✓ 設定已儲存</span>
            </div>
          )}

          {resetSuccess && (
            <div className="alert alert-success mb-4">
              <span>遊戲進度已重置</span>
            </div>
          )}

          <div className="space-y-6">
            {/* TTS Mode Selection */}
            <div>
              <h3 className="text-lg font-semibold mb-3">語音模式選擇</h3>
              <p className="text-sm text-base-content/70 mb-4">
                選擇文字轉語音的服務
              </p>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-4 border border-base-300 rounded-lg cursor-pointer hover:bg-base-200 transition-colors">
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
                    <div className="text-sm text-base-content/60">
                      使用瀏覽器內建的語音引擎（推薦）
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 border border-base-300 rounded-lg cursor-pointer hover:bg-base-200 transition-colors">
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
                    <div className="text-sm text-base-content/60">
                      使用 AI 語音合成服務，聲音更自然
                    </div>
                  </div>
                </label>
              </div>

              {/* AI 引擎子選單（僅在 API 模式顯示） */}
              {ttsMode === "api" && (
                <div className="mt-3 space-y-3 border-l-2 border-base-300 pl-4">
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
                    ] as { id: TTSEngine; name: string; desc: string }[]
                  ).map((eng) => (
                    <label
                      key={eng.id}
                      className="flex items-start gap-3 p-3 border border-base-300 rounded-lg cursor-pointer hover:bg-base-200 transition-colors"
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
                        <div className="text-sm text-base-content/60">
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
              <p className="text-sm text-base-content/70 mb-4">
                調整播放速度
              </p>

              <div className="p-4 border border-base-300 rounded-lg">
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

            {/* Divider */}
            <div className="divider"></div>

            {/* Reading Mode Selection */}
            <div>
              <h3 className="text-lg font-semibold mb-3">閱讀模式</h3>
              <p className="text-sm text-base-content/70 mb-4">
                選擇點擊文字時的查詢方式
              </p>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-4 border border-base-300 rounded-lg cursor-pointer hover:bg-base-200 transition-colors">
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
                    <div className="text-sm text-base-content/60">
                      點擊單字即可查詢（推薦）
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 border border-base-300 rounded-lg cursor-pointer hover:bg-base-200 transition-colors">
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
                    <div className="text-sm text-base-content/60">
                      選取文字範圍後查詢，適合查詢片語或句子
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Divider */}
            <div className="divider"></div>

            {/* PDF Text Parsing Mode */}
            <div>
              <h3 className="text-lg font-semibold mb-3">PDF 文字解析</h3>
              <p className="text-sm text-base-content/70 mb-4">
                選擇如何從 PDF 擷取文字
              </p>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-4 border border-base-300 rounded-lg cursor-pointer hover:bg-base-200 transition-colors">
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
                    <div className="text-sm text-base-content/60">
                      上傳 PDF 至伺服器解析（較準確）
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 border border-base-300 rounded-lg cursor-pointer hover:bg-base-200 transition-colors">
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
                    <div className="text-sm text-base-content/60">
                      直接在瀏覽器中使用 react-pdf 解析（較快，不需上傳）
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {saving && (
              <div className="mt-4 flex items-center gap-2 text-sm text-base-content/70">
                <span className="loading loading-spinner loading-sm" />
                <span>儲存中...</span>
              </div>
            )}

            {/* Divider */}
            <div className="divider"></div>

            {/* Game Settings */}
            <div>
              <h3 className="text-lg font-semibold mb-3">🎮 遊戲設定</h3>
              <p className="text-sm text-base-content/70 mb-4">
                管理遊戲進度
              </p>

              <div className="p-4 border border-error/30 rounded-lg bg-error/5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-error">重置遊戲進度</div>
                    <div className="text-sm text-base-content/60">
                      清除所有關卡進度、等級和收集的精靈（生詞本不受影響）
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
        </div>
      </div>

      <ConfirmModal
        isOpen={showResetModal}
        title="確定要重置遊戲進度？"
        message="這將清除所有關卡進度、等級和收集的精靈。此操作無法復原，但生詞本不會受到影響。"
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
