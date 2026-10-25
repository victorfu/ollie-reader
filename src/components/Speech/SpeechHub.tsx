import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/english-speech", label: "✍️ 英文演講" },
  { to: "/speech-practice", label: "🎤 演講練習" },
  { to: "/audio-uploads", label: "🎵 音訊庫" },
];

/** 「演講」入口：上方切換英文演講 / 演講練習 / 音訊庫，下方顯示對應頁面。 */
export function SpeechHub() {
  return (
    <>
      <nav aria-label="演講分類" className="mx-auto mb-4 flex max-w-4xl">
        <div className="inline-flex gap-1 rounded-lg bg-base-200 p-1">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `btn btn-sm border-0 ${
                  isActive ? "bg-base-100 shadow-soft" : "btn-ghost bg-transparent"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Outlet />
    </>
  );
}
