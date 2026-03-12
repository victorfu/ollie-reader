import { lazy, Suspense, useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import {
  BookOpen,
  BookMarked,
  Globe,
  Mic,
  PenLine,
  Music,
  MonitorPlay,
  Gamepad2,
  Settings as SettingsIcon,
  ChevronDown,
  LogOut,
  AlertTriangle,
} from "lucide-react";
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
const ShowSubtitlesPage = lazy(() =>
  import("./components/ShowSubtitles/ShowSubtitlesPage").then((module) => ({
    default: module.ShowSubtitlesPage,
  })),
);
const TravelEnglishPage = lazy(() =>
  import("./components/TravelEnglish/TravelEnglishPage").then((module) => ({
    default: module.TravelEnglishPage,
  })),
);

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
  const [prevPathname, setPrevPathname] = useState(location.pathname);

  // Warm-start backend on each route change
  useWarmServerOnRouteChange();

  // Close mobile menu on route change
  if (prevPathname !== location.pathname) {
    setPrevPathname(location.pathname);
    setIsMobileMenuOpen(false);
  }

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
  const isEnglishSpeechPage = location.pathname === "/english-speech";
  const isAudioUploadsPage = location.pathname === "/audio-uploads";
  const isGamePage = location.pathname === "/game";
  const isShowPage = location.pathname === "/show";
  const isTravelPage = location.pathname === "/travel";
  const accountLabel = user.displayName || user.email || "使用者";
  const accountEmail = user.email;
  const accountInitial = accountLabel.charAt(0).toUpperCase();
  const navItems = [
    {
      to: "/",
      label: "閱讀器",
      icon: <BookOpen className="size-4" strokeWidth={1.75} />,
      mobileIcon: <BookOpen className="size-5" strokeWidth={1.75} />,
      isActive: isReaderPage,
    },
    {
      to: "/vocabulary",
      label: "生詞本",
      icon: <BookMarked className="size-4" strokeWidth={1.75} />,
      mobileIcon: <BookMarked className="size-5" strokeWidth={1.75} />,
      isActive: isVocabularyPage,
    },
    {
      to: "/travel",
      label: "旅遊英文",
      icon: <Globe className="size-4" strokeWidth={1.75} />,
      mobileIcon: <Globe className="size-5" strokeWidth={1.75} />,
      isActive: isTravelPage,
    },
    {
      to: "/speech-practice",
      label: "演講練習",
      icon: <Mic className="size-4" strokeWidth={1.75} />,
      mobileIcon: <Mic className="size-5" strokeWidth={1.75} />,
      isActive: isSpeechPracticePage,
    },
    {
      to: "/english-speech",
      label: "英文演講",
      icon: <PenLine className="size-4" strokeWidth={1.75} />,
      mobileIcon: <PenLine className="size-5" strokeWidth={1.75} />,
      isActive: isEnglishSpeechPage,
    },
    {
      to: "/audio-uploads",
      label: "音訊庫",
      icon: <Music className="size-4" strokeWidth={1.75} />,
      mobileIcon: <Music className="size-5" strokeWidth={1.75} />,
      isActive: isAudioUploadsPage,
    },
    {
      to: "/show",
      label: "影集字幕",
      icon: <MonitorPlay className="size-4" strokeWidth={1.75} />,
      mobileIcon: <MonitorPlay className="size-5" strokeWidth={1.75} />,
      isActive: isShowPage,
    },
    {
      to: "/game",
      label: "精靈探險",
      icon: <Gamepad2 className="size-4" strokeWidth={1.75} />,
      mobileIcon: <Gamepad2 className="size-5" strokeWidth={1.75} />,
      isActive: isGamePage,
    },
    {
      to: "/settings",
      label: "設定",
      icon: <SettingsIcon className="size-4" strokeWidth={1.75} />,
      mobileIcon: <SettingsIcon className="size-5" strokeWidth={1.75} />,
      isActive: isSettingsPage,
    },
  ];

  return (
    <div className="min-h-screen bg-base-200">
      <header className="border-b border-black/5 dark:border-white/10 bg-base-100/95 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto flex items-center justify-between gap-3 px-4 h-14">
          {/* Left: App Title + Navigation */}
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent whitespace-nowrap">
              Ollie Reader
            </h1>
            <nav className="hidden md:flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 h-9 px-2 xl:px-3 rounded-lg text-sm font-medium transition-all duration-normal shrink-0 ${
                    item.isActive
                      ? "bg-primary/15 text-primary"
                      : "text-base-content/70 hover:bg-black/5 dark:hover:bg-white/5 hover:text-base-content"
                  }`}
                  title={item.label}
                  aria-current={item.isActive ? "page" : undefined}
                >
                  {item.icon}
                  <span className="hidden xl:inline">{item.label}</span>
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
              className="btn btn-ghost btn-sm gap-2 px-3 hover:bg-black/5 dark:hover:bg-white/5"
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
              <ChevronDown className="h-4 w-4 text-base-content/70" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content mt-2 w-56 rounded-xl bg-base-100/95 backdrop-blur-xl border border-black/5 dark:border-white/10 p-2 shadow-lg"
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
                  <LogOut className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                </button>
              </li>
            </ul>
          </div>

          {/* Mobile: Avatar button that opens bottom drawer */}
          <button
            type="button"
            className="md:hidden btn btn-ghost btn-xs gap-1 px-2 hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => setIsMobileMenuOpen(true)}
            title="選單"
          >
            <div className="avatar placeholder">
              <div className="bg-primary text-primary-content rounded-full w-7 h-7 text-xs flex items-center justify-center">
                {accountInitial}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-base-content/70" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Mobile Top Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute top-0 left-0 right-0 bg-base-100/95 backdrop-blur-xl rounded-b-2xl shadow-lg max-h-[85vh] overflow-y-auto animate-slide-down">
            <div className="px-4 pt-4 pb-3">
              {/* User info */}
              <div className="flex items-center gap-3 p-3 bg-base-200/50 rounded-xl mb-3">
                <div className="avatar placeholder">
                  <div className="bg-primary text-primary-content rounded-full w-11 h-11 text-base flex items-center justify-center">
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
              <div className="mb-3">
                <div className="text-xs font-medium text-base-content/50 px-3 mb-2">
                  導覽
                </div>
                <div className="flex flex-col gap-1">
                  {navItems.map((item) => (
                    <Link
                      key={`mobile-nav-${item.to}`}
                      to={item.to}
                      className={`flex items-center gap-3 h-11 px-3 rounded-lg transition-all duration-normal active:scale-[0.98] ${
                        item.isActive
                          ? "bg-primary/15 text-primary"
                          : "text-base-content hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <span className="w-6 flex justify-center">{item.mobileIcon}</span>
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Sign out button */}
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-medium border border-error/30 text-error bg-error/10 hover:bg-error/20 active:scale-[0.98] transition-all duration-normal"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleSignOut();
                }}
              >
                <LogOut className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                登出
              </button>
            </div>
            {/* Handle bar at bottom */}
            <div className="sticky bottom-0 bg-base-100 pt-2 pb-3 flex justify-center rounded-b-2xl">
              <div className="w-10 h-1 bg-base-300 rounded-full" />
            </div>
          </div>
        </div>
      )}

      {authError && (
        <div className="mx-auto px-4">
          <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 mt-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-error shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span className="text-sm text-error">{authError}</span>
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
                    path="/english-speech"
                    element={<SentencePractice />}
                  />
                  <Route path="/audio-uploads" element={<AudioUploads />} />
                  <Route path="/show" element={<ShowSubtitlesPage />} />
                  <Route path="/game" element={<SpiritAdventure />} />
                  <Route path="/travel" element={<TravelEnglishPage />} />
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
