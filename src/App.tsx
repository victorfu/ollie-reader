import { lazy, Suspense, useState, useEffect, type CSSProperties } from "react";
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
  LogOut,
  AlertTriangle,
  Menu,
  X,
  PanelLeft,
} from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { PdfProvider } from "./contexts/PdfContext";
import { SpeechProvider } from "./contexts/SpeechContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ThemeToggle } from "./components/common/ThemeToggle";
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

const SIDEBAR_COLLAPSED_KEY = "ollie-sidebar-collapsed";

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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span
        className="loading loading-spinner loading-lg text-primary"
        aria-label="載入登入頁面"
      />
    </div>
  );
}

function AccountAvatar({
  initial,
  size = "md",
}: {
  initial: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-white shadow-sm ${
        size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm"
      }`}
    >
      {initial}
    </span>
  );
}

function AppContent() {
  const { user, loading, authError, signOutUser } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Warm-start backend on each route change
  useWarmServerOnRouteChange();

  // Close mobile menu on route change
  if (prevPathname !== location.pathname) {
    setPrevPathname(location.pathname);
    setIsMobileMenuOpen(false);
  }

  // Persist sidebar collapse preference
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      // localStorage not available
    }
  }, [sidebarCollapsed]);

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span
          className="loading loading-spinner loading-lg text-primary"
          aria-label="載入使用者資料"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <Suspense fallback={<AuthLoadingFallback />}>
          <AuthScreen />
        </Suspense>
      </div>
    );
  }

  const handleSignOut = () => {
    void signOutUser();
  };

  const accountLabel = user.displayName || user.email || "使用者";
  const accountEmail = user.email;
  const accountInitial = accountLabel.charAt(0).toUpperCase();
  const navItems: { to: string; label: string; icon: typeof BookOpen }[] = [
    { to: "/", label: "閱讀器", icon: BookOpen },
    { to: "/vocabulary", label: "生詞本", icon: BookMarked },
    { to: "/travel", label: "旅遊英文", icon: Globe },
    { to: "/speech-practice", label: "演講練習", icon: Mic },
    { to: "/english-speech", label: "英文演講", icon: PenLine },
    { to: "/audio-uploads", label: "音訊庫", icon: Music },
    { to: "/show", label: "影集字幕", icon: MonitorPlay },
    { to: "/game", label: "精靈探險", icon: Gamepad2 },
    { to: "/settings", label: "設定", icon: SettingsIcon },
  ];
  const currentLabel =
    navItems.find((item) => item.to === location.pathname)?.label ??
    "Ollie Reader";

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={
        {
          // Exposes the desktop sidebar width so fixed/floating elements deep in
          // the content (e.g. PDF reader FABs) can clear it at the lg breakpoint.
          "--app-sidebar-w": sidebarCollapsed ? "4rem" : "16rem",
        } as CSSProperties
      }
    >
      {/* Desktop sidebar (fixed; document keeps scrolling) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border-hairline bg-sidebar-bg backdrop-blur-xl transition-[width] duration-200 lg:flex ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Brand */}
        <div
          className={`flex h-14 items-center border-b border-border-hairline ${
            sidebarCollapsed ? "justify-center px-2" : "gap-2.5 px-4"
          }`}
        >
          <Link
            to="/"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
            title="Ollie Reader"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-sm">
              <BookOpen className="size-5" strokeWidth={2} aria-hidden="true" />
            </span>
            {!sidebarCollapsed && (
              <span className="text-base font-semibold tracking-tight">
                Ollie Reader
              </span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav
          className={`flex-1 space-y-1 overflow-y-auto scrollbar-hide ${
            sidebarCollapsed ? "p-2" : "p-3"
          }`}
        >
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center rounded-lg text-sm font-medium transition-colors duration-200 ${
                  sidebarCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2"
                } ${
                  isActive
                    ? "bg-accent-tint text-accent"
                    : "text-base-content/70 hover:bg-accent-tint hover:text-accent"
                }`}
              >
                <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Account + sign out */}
        <div
          className={`border-t border-border-hairline ${
            sidebarCollapsed ? "space-y-1 p-2" : "space-y-2 p-3"
          }`}
        >
          {sidebarCollapsed ? (
            <div className="flex justify-center py-1">
              <AccountAvatar initial={accountInitial} size="sm" />
            </div>
          ) : (
            <div className="flex items-center gap-3 px-1">
              <AccountAvatar initial={accountInitial} size="md" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {accountLabel}
                </div>
                {accountEmail && (
                  <div className="truncate text-xs text-muted-foreground">
                    {accountEmail}
                  </div>
                )}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            title="登出"
            className={`flex w-full items-center rounded-lg text-sm font-medium text-error transition-colors duration-200 hover:bg-error/10 ${
              sidebarCollapsed ? "justify-center p-2" : "gap-3 px-3 py-2"
            }`}
          >
            <LogOut className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            {!sidebarCollapsed && <span>登出</span>}
          </button>
        </div>
      </aside>

      {/* Main column (offset for the fixed sidebar on desktop) */}
      <div
        className={`flex min-h-screen flex-col transition-[padding] duration-200 ${
          sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
        }`}
      >
        {/* Toolbar */}
        <header className="toolbar sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border-hairline px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            {/* Desktop: collapse toggle */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="hidden h-9 w-9 items-center justify-center rounded-lg text-base-content/70 transition-colors hover:bg-accent-tint hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:inline-flex"
              aria-label={sidebarCollapsed ? "展開側邊欄" : "收合側邊欄"}
            >
              <PanelLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </button>

            {/* Mobile: menu toggle */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-base-content/70 transition-colors hover:bg-accent-tint hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
              aria-label="開啟選單"
            >
              <Menu className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </button>

            {/* Mobile: brand */}
            <Link
              to="/"
              className="flex items-center gap-2 lg:hidden"
              title="Ollie Reader"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white shadow-sm">
                <BookOpen className="size-4" strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold tracking-tight">
                Ollie Reader
              </span>
            </Link>

            {/* Desktop: current page title */}
            <h1 className="hidden truncate text-base font-semibold tracking-tight lg:block">
              {currentLabel}
            </h1>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>

        {/* Mobile navigation drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border-hairline bg-background/95 shadow-floating backdrop-blur-2xl animate-slide-in-left">
              {/* Drawer header */}
              <div className="flex h-14 items-center justify-between border-b border-border-hairline px-4">
                <Link
                  to="/"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2.5"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-sm">
                    <BookOpen className="size-5" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="text-base font-semibold tracking-tight">
                    Ollie Reader
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-base-content/70 transition-colors hover:bg-accent-tint hover:text-accent"
                  aria-label="關閉選單"
                >
                  <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>

              {/* Account */}
              <div className="border-b border-border-hairline p-3">
                <div className="flex items-center gap-3 rounded-lg bg-base-200/60 px-3 py-2.5">
                  <AccountAvatar initial={accountInitial} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {accountLabel}
                    </div>
                    {accountEmail && (
                      <div className="truncate text-xs text-muted-foreground">
                        {accountEmail}
                      </div>
                    )}
                  </div>
                  <ThemeToggle />
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.to;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={`mobile-${item.to}`}
                      to={item.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 active:scale-[0.98] ${
                        isActive
                          ? "bg-accent-tint text-accent"
                          : "text-base-content hover:bg-accent-tint hover:text-accent"
                      }`}
                    >
                      <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Sign out */}
              <div className="border-t border-border-hairline p-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2.5 text-sm font-medium text-error transition-colors duration-200 hover:bg-error/20 active:scale-[0.98]"
                >
                  <LogOut className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  登出
                </button>
              </div>
            </div>
          </div>
        )}

        {authError && (
          <div className="px-3 pt-4 sm:px-4 md:px-6">
            <div className="flex items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-4 py-3">
              <AlertTriangle
                className="h-5 w-5 shrink-0 text-error"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <span className="text-sm text-error">{authError}</span>
            </div>
          </div>
        )}

        {/* Scrollable content (document scroll preserved) */}
        <main className="flex-1">
          <div className="px-3 py-4 sm:px-4 md:px-6 md:py-6">
            <SettingsProvider>
              <SpeechProvider>
                <PdfProvider>
                  <Suspense fallback={<RouteLoadingFallback />}>
                    <Routes>
                      <Route path="/" element={<PdfReader />} />
                      <Route path="/vocabulary" element={<VocabularyBook />} />
                      <Route
                        path="/speech-practice"
                        element={<SpeechPractice />}
                      />
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
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
