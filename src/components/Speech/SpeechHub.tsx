import { NavLink, Outlet } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import type { MessageKey } from "../../i18n/translate";
import { T } from "../common/T";

const tabs: { to: string; emoji: string; labelKey: MessageKey }[] = [
  { to: "/english-speech", emoji: "✍️", labelKey: "speechHub.write" },
  { to: "/speech-practice", emoji: "🎤", labelKey: "speechHub.practice" },
  { to: "/audio-uploads", emoji: "🎵", labelKey: "speechHub.audio" },
];

/** 「演講」入口：上方切換英文演講 / 演講練習 / 音訊庫，下方顯示對應頁面。 */
export function SpeechHub() {
  const { t } = useLanguage();
  return (
    <>
      <nav aria-label={t("speechHub.label")} className="mx-auto mb-4 flex max-w-4xl">
        <div className="inline-flex gap-1 rounded-lg bg-base-200 p-1">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `btn btn-sm h-auto min-h-8 border-0 py-1 ${
                  isActive ? "bg-base-100 shadow-soft" : "btn-ghost bg-transparent"
                }`
              }
            >
              {tab.emoji} <T k={tab.labelKey} variant="stacked" />
            </NavLink>
          ))}
        </div>
      </nav>
      <Outlet />
    </>
  );
}
