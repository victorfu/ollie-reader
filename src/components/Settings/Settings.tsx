import { useState } from "react";
import { useSettings } from "../../hooks/useSettings";
import type { TranslationApiType } from "../../types/settings";
import type { TTSMode } from "../../types/pdf";

export const Settings = () => {
  const {
    translationApi,
    ttsMode,
    loading,
    error,
    updateTranslationApi,
    updateTtsMode,
  } = useSettings();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleApiChange = async (api: TranslationApiType) => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      await updateTranslationApi(api);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

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

          <div className="space-y-6">
            {/* Translation API Selection */}
            <div>
              <h3 className="text-lg font-semibold mb-3">翻譯 API 選擇</h3>
              <p className="text-sm text-base-content/70 mb-4">
                選擇用於文字翻譯的 API 服務
              </p>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-4 border border-base-300 rounded-lg cursor-pointer hover:bg-base-200 transition-colors">
                  <input
                    type="radio"
                    name="translationApi"
                    className="radio radio-primary mt-1"
                    checked={translationApi === "TRANSLATE_API_URL"}
                    onChange={() => handleApiChange("TRANSLATE_API_URL")}
                    disabled={saving}
                  />
                  <div className="flex-1">
                    <div className="font-medium">標準翻譯 API</div>
                    <div className="text-sm text-base-content/60">
                      使用預設的翻譯服務 (推薦)
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 border border-base-300 rounded-lg cursor-pointer hover:bg-base-200 transition-colors">
                  <input
                    type="radio"
                    name="translationApi"
                    className="radio radio-primary mt-1"
                    checked={translationApi === "ARGOS_TRANSLATE_API_URL"}
                    onChange={() => handleApiChange("ARGOS_TRANSLATE_API_URL")}
                    disabled={saving}
                  />
                  <div className="flex-1">
                    <div className="font-medium">Argos 翻譯 API</div>
                    <div className="text-sm text-base-content/60">
                      使用 Argos 開源翻譯引擎
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 border border-base-300 rounded-lg cursor-pointer hover:bg-base-200 transition-colors">
                  <input
                    type="radio"
                    name="translationApi"
                    className="radio radio-primary mt-1"
                    checked={translationApi === "FIREBASE_AI"}
                    onChange={() => handleApiChange("FIREBASE_AI")}
                    disabled={saving}
                  />
                  <div className="flex-1">
                    <div className="font-medium">🤖 AI 智慧翻譯</div>
                    <div className="text-sm text-base-content/60">
                      使用 AI 翻譯，用小朋友容易懂的方式解釋 (推薦給小學生)
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Divider */}
            <div className="divider"></div>

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

            {saving && (
              <div className="mt-4 flex items-center gap-2 text-sm text-base-content/70">
                <span className="loading loading-spinner loading-sm" />
                <span>儲存中...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
