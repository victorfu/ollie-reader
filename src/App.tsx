import { lazy, Suspense, useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { PdfProvider } from "./contexts/PdfContext";
import { SpeechProvider } from "./contexts/SpeechContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { useWarmServerOnRouteChange } from "./hooks/useWarmServer";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

// Lazy load route components for code splitting
const AuthScreen = lazy(() => import("./components/Auth/AuthScreen"));
const PdfReader = lazy(() => import("./components/PdfReader"));
const VocabularyBook = lazy(() =>
  import("./components/Vocabulary/VocabularyBook").then((module) => ({
    default: module.VocabularyBook,
  })),
);
const Settings = lazy(() =>
  import("./components/Settings/Settings").then((module) => ({
    default: module.Settings,
  })),
);
const SpeechPractice = lazy(
  () => import("./components/SpeechPractice/SpeechPractice"),
);
const SentencePractice = lazy(
  () => import("./components/SentencePractice/SentencePractice"),
);
const AudioUploads = lazy(
  () => import("./components/AudioUploads/AudioUploads"),
);
const SpiritAdventure = lazy(() => import("./components/Game/SpiritAdventure"));

// Loading fallback component
function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <span
        className="loading loading-spinner loading-lg text-primary"
        aria-label="載入頁面中"
      />
    </div>
  );
}

// Auth loading fallback component
function AuthLoadingFallback() {
  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center">
      <span
        className="loading loading-spinner loading-lg text-primary"
        aria-label="載入登入頁面"
      />
    </div>
  );
}

function AppContent() {
  const { user, loading, authError, signOutUser } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Warm-start backend on each route change
  useWarmServerOnRouteChange();

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

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
        <Suspense fallback={<AuthLoadingFallback />}>
          <AuthScreen />
        </Suspense>
      </div>
    );
  }

  const handleSignOut = () => {
    void signOutUser();
  };

  const isReaderPage = location.pathname === "/";
  const isVocabularyPage = location.pathname === "/vocabulary";
  const isSettingsPage = location.pathname === "/settings";
  const isSpeechPracticePage = location.pathname === "/speech-practice";
  const isSentencePracticePage = location.pathname === "/sentence-practice";
  const isAudioUploadsPage = location.pathname === "/audio-uploads";
  const isGamePage = location.pathname === "/game";
  const accountLabel = user.displayName || user.email || "使用者";
  const accountEmail = user.email;
  const accountInitial = accountLabel.charAt(0).toUpperCase();
  const navItems = [
    {
      to: "/",
      label: "閱讀器",
      icon: "📚",
      isActive: isReaderPage,
    },
    {
      to: "/vocabulary",
      label: "生詞本",
      icon: "📖",
      isActive: isVocabularyPage,
    },
    {
      to: "/speech-practice",
      label: "演講練習",
      icon: "🎤",
      isActive: isSpeechPracticePage,
    },
    {
      to: "/sentence-practice",
      label: "句子練習",
      icon: "✍️",
      isActive: isSentencePracticePage,
    },
    {
      to: "/audio-uploads",
      label: "音訊庫",
      icon: "🎵",
      isActive: isAudioUploadsPage,
    },
    {
      to: "/game",
      label: "精靈探險",
      icon: "🎮",
      isActive: isGamePage,
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
          {/* Desktop: Dropdown */}
          <div className="hidden md:block dropdown dropdown-end">
            <button
              type="button"
              tabIndex={0}
              className="btn btn-ghost btn-sm gap-2 px-3"
              title="帳號選單"
            >
              <div className="avatar placeholder">
                <div className="bg-primary text-primary-content rounded-full w-6 h-6 text-xs flex items-center justify-center">
                  {accountInitial}
                </div>
              </div>
              <div className="flex flex-col items-start leading-tight max-w-[12rem]">
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

          {/* Mobile: Avatar button that opens bottom drawer */}
          <button
            type="button"
            className="md:hidden btn btn-ghost btn-xs gap-1 px-2"
            onClick={() => setIsMobileMenuOpen(true)}
            title="選單"
          >
            <div className="avatar placeholder">
              <div className="bg-primary text-primary-content rounded-full w-7 h-7 text-xs flex items-center justify-center">
                {accountInitial}
              </div>
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
        </div>
      </header>

      {/* Mobile Top Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute top-0 left-0 right-0 bg-base-100 rounded-b-3xl shadow-xl max-h-[85vh] overflow-y-auto animate-slide-down">
            <div className="px-4 pt-4 pb-3">
              {/* User info */}
              <div className="flex items-center gap-3 p-4 bg-base-200/50 rounded-2xl mb-4">
                <div className="avatar placeholder">
                  <div className="bg-primary text-primary-content rounded-full w-12 h-12 text-lg flex items-center justify-center">
                    {accountInitial}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{accountLabel}</div>
                  {accountEmail && (
                    <div className="text-sm text-base-content/60 truncate">
                      {accountEmail}
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation */}
              <div className="mb-4">
                <div className="text-xs font-semibold text-base-content/50 uppercase tracking-wider px-2 mb-2">
                  導覽
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {navItems.map((item) => (
                    <Link
                      key={`mobile-nav-${item.to}`}
                      to={item.to}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${
                        item.isActive
                          ? "bg-primary/10 text-primary"
                          : "bg-base-200/50 hover:bg-base-200"
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <span className="text-2xl">{item.icon}</span>
                      <span className="text-xs font-medium">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Sign out button */}
              <button
                type="button"
                className="w-full btn btn-outline btn-error gap-2"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleSignOut();
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
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
                登出
              </button>
            </div>
            {/* Handle bar at bottom */}
            <div className="sticky bottom-0 bg-base-100 pt-2 pb-3 flex justify-center rounded-b-3xl">
              <div className="w-10 h-1 bg-base-300 rounded-full" />
            </div>
          </div>
        </div>
      )}

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
              <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                  <Route path="/" element={<PdfReader />} />
                  <Route path="/vocabulary" element={<VocabularyBook />} />
                  <Route path="/speech-practice" element={<SpeechPractice />} />
                  <Route
                    path="/sentence-practice"
                    element={<SentencePractice />}
                  />
                  <Route path="/audio-uploads" element={<AudioUploads />} />
                  <Route path="/game" element={<SpiritAdventure />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Suspense>
            </PdfProvider>
          </SpeechProvider>
        </SettingsProvider>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
