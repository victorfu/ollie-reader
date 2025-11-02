import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import AuthScreen from "./components/Auth/AuthScreen";
import PdfReader from "./components/PdfReader";
import { VocabularyBook } from "./components/Vocabulary/VocabularyBook";
import { Settings } from "./components/Settings/Settings";
import { useAuth } from "./hooks/useAuth";
import { PdfProvider } from "./contexts/PdfContext";
import { SpeechProvider } from "./contexts/SpeechContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { useWarmServerOnRouteChange } from "./hooks/useWarmServer";

function AppContent() {
  const { user, loading, authError, signOutUser } = useAuth();
  const location = useLocation();

  // Warm-start backend on each route change
  useWarmServerOnRouteChange();

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span
          className="loading loading-spinner loading-lg text-primary"
          aria-label="載入使用者資料"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center px-4 py-12">
        <AuthScreen />
      </div>
    );
  }

  const handleSignOut = () => {
    void signOutUser();
  };

  const isVocabularyPage = location.pathname === "/vocabulary";
  const isSettingsPage = location.pathname === "/settings";
  const accountLabel = user.displayName || user.email || "使用者";
  const accountEmail = user.email;
  const accountInitial = accountLabel.charAt(0).toUpperCase();
  const navItems = [
    {
      to: "/",
      label: "閱讀器",
      icon: "📚",
      isActive: !isVocabularyPage && !isSettingsPage,
    },
    {
      to: "/vocabulary",
      label: "生詞本",
      icon: "📖",
      isActive: isVocabularyPage,
    },
    {
      to: "/settings",
      label: "設定",
      icon: "⚙️",
      isActive: isSettingsPage,
    },
  ];

  return (
    <div className="min-h-screen bg-base-200">
      <header className="border-b border-base-300 bg-base-100 sticky top-0 z-40">
        <div className="mx-auto flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
          {/* Left: App Title + Navigation */}
          <div className="flex flex-1 items-center gap-2 sm:gap-3 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent whitespace-nowrap">
              📚 Ollie Reader
            </h1>
            <nav className="hidden md:flex items-center gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`btn btn-sm ${
                    item.isActive ? "btn-primary" : "btn-ghost"
                  }`}
                  title={item.label}
                  aria-current={item.isActive ? "page" : undefined}
                >
                  <span className="hidden lg:inline">
                    {item.icon} {item.label}
                  </span>
                  <span className="lg:hidden">{item.icon}</span>
                </Link>
              ))}
            </nav>
          </div>

          {/* Right: Account Menu */}
          <div className="dropdown dropdown-end">
            <button
              type="button"
              tabIndex={0}
              className="btn btn-ghost btn-xs sm:btn-sm gap-2 px-2 sm:px-3"
              title="帳號選單"
            >
              <div className="avatar placeholder">
                <div className="bg-primary text-primary-content rounded-full w-6 h-6 text-xs flex items-center justify-center">
                  {accountInitial}
                </div>
              </div>
              <div className="hidden sm:flex flex-col items-start leading-tight max-w-[12rem]">
                <span className="text-xs font-semibold truncate">
                  {accountLabel}
                </span>
                {accountEmail && (
                  <span className="text-[0.65rem] text-base-content/60 truncate">
                    {accountEmail}
                  </span>
                )}
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-base-content/70"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.25 9.75L12 13.5l3.75-3.75"
                />
              </svg>
            </button>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content mt-2 w-56 rounded-box bg-base-100 p-2 shadow"
            >
              <li className="menu-title px-3 text-xs text-base-content/60 md:hidden">
                快速導覽
              </li>
              {navItems.map((item) => (
                <li
                  key={`mobile-${item.to}`}
                  className={`md:hidden ${item.isActive ? "active" : ""}`}
                >
                  <Link to={item.to} className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
              <li className="menu-title px-3 text-xs text-base-content/60">
                登入帳號
              </li>
              <li className="px-3">
                <div className="text-sm font-semibold truncate">
                  {accountLabel}
                </div>
                {accountEmail && (
                  <div className="text-xs text-base-content/60 truncate">
                    {accountEmail}
                  </div>
                )}
              </li>
              <li>
                <button
                  type="button"
                  className="flex items-center justify-between gap-2 text-error"
                  onClick={handleSignOut}
                >
                  <span>登出</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </header>

      {authError && (
        <div className="mx-auto px-4">
          <div className="alert alert-error mt-4">
            <span>{authError}</span>
          </div>
        </div>
      )}

      <div className="mx-auto px-2 py-2 sm:px-4 sm:py-4 md:py-6">
        <SettingsProvider>
          <SpeechProvider>
            <PdfProvider>
              <Routes>
                <Route path="/" element={<PdfReader />} />
                <Route path="/vocabulary" element={<VocabularyBook />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </PdfProvider>
          </SpeechProvider>
        </SettingsProvider>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
