import { useState } from "react";
import { useSettings } from "../../hooks/useSettings";
import { useAuth } from "../../hooks/useAuth";
import { resetGameProgress } from "../../services/gameProgressService";
import { ConfirmModal } from "../common/ConfirmModal";
import type { TTSMode } from "../../types/pdf";

export const Settings = () => {
  const { user } = useAuth();
  const {
    ttsMode,
    speechRate,
    loading,
    error,
    updateTtsMode,
    updateSpeechRate,
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
              <span>✓ 遊戲進度已重設</span>
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
                      使用瀏覽器內建的語音引擎 (推薦)
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
                      使用 AI 語音合成服務，音質更自然
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Divider */}
            <div className="divider"></div>

            {/* Speech Rate Setting */}
            <div>
              <h3 className="text-lg font-semibold mb-3">語速設定</h3>
              <p className="text-sm text-base-content/70 mb-4">
                調整語音播放的速度
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
                管理精靈冒險遊戲的進度
              </p>

              <div className="p-4 border border-error/30 rounded-lg bg-error/5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-error">重設遊戲進度</div>
                    <div className="text-sm text-base-content/60">
                      清除所有關卡進度、等級和已收集的精靈（不影響單字本）
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-error btn-outline"
                    onClick={() => setShowResetModal(true)}
                    disabled={!user}
                  >
                    重設進度
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showResetModal}
        title="確定要重設遊戲進度嗎？"
        message="這將會清除所有關卡進度、等級和已收集的精靈。此操作無法復原，但不會影響你的單字本。"
        confirmText="確定重設"
        cancelText="取消"
        confirmVariant="error"
        isLoading={resetting}
        onConfirm={handleResetGameProgress}
        onCancel={() => setShowResetModal(false)}
      />
    </div>
  );
};
