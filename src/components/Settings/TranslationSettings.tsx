import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../constants/api";
import type { MessageKey } from "../../i18n/translate";
import { useLanguage } from "../../hooks/useLanguage";
import { getUserSettings, saveUserSettings } from "../../services/settingsService";
import { apiFetch } from "../../utils/apiUtil";

interface ModelCatalog {
  configured: boolean;
  models: string[];
}

export function TranslationSettings({ uid }: { uid?: string }) {
  const { t } = useLanguage();
  const [model, setModel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid) return;
    const controller = new AbortController();
    async function loadModels() {
      try {
        const settings = await getUserSettings(uid!);
        if (controller.signal.aborted) return;
        setModel(settings?.translationModel ?? null);
        setReady(true);
        const response = await apiFetch(`${API_BASE_URL}/api/openai/models`, {
          includeAuthToken: true,
          includeAppCheckToken: true,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (typeof result.configured !== "boolean" || !Array.isArray(result.models) ||
            !result.models.every((id: unknown) => typeof id === "string")) throw new Error();
        if (!controller.signal.aborted) setCatalog(result);
      } catch {
        if (!controller.signal.aborted) setLoadFailed(true);
      }
    }
    void loadModels();
    return () => controller.abort();
  }, [uid, attempt]);

  async function selectModel(value: string) {
    if (!uid) return;
    setSaving(true);
    try {
      await saveUserSettings(uid, { translationModel: value || null });
      setModel(value || null);
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  let notice: MessageKey | null = null;
  if (!uid) notice = "settings.translation.signIn";
  else if (loadFailed) notice = "settings.translation.failed";
  else if (!catalog) notice = "settings.translation.loading";
  else if (!catalog.configured) notice = "settings.translation.unconfigured";
  else if (!catalog.models.length) notice = "settings.translation.noModels";
  else if (model && !catalog.models.includes(model)) notice = "settings.translation.retired";

  return (
    <section>
      <h3 className="mb-2 text-lg font-semibold">{t("settings.translation.title")}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{t("settings.translation.scope")}</p>
      <label className="flex max-w-md flex-col gap-2 text-sm font-medium">
        {t("settings.translation.model")}
        <select className="select min-h-11 w-full border-border-hairline focus-visible:ring-2 focus-visible:ring-accent"
          disabled={!uid || !ready || saving} value={model ?? ""} onChange={(event) => selectModel(event.target.value)}>
          <option value="">Gemini</option>
          <optgroup label="OpenAI (ChatGPT)" disabled={!uid || !catalog?.configured}>
            {model && !catalog?.models.includes(model) && <option value={model} disabled>{model}</option>}
            {catalog?.models.map((id) => <option key={id} value={id}>{id}</option>)}
          </optgroup>
        </select>
      </label>
      <div className="mt-2 text-sm text-muted-foreground" role="status">
        {notice && t(notice)}
        {saveFailed && <p>{t("settings.translation.saveFailed")}</p>}
      </div>
      {loadFailed && <button type="button" className="btn btn-ghost mt-2 min-h-11"
        onClick={() => { setLoadFailed(false); setAttempt(attempt + 1); }}>
        {t("settings.translation.retry")}
      </button>}
    </section>
  );
}
