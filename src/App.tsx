import { Suspense, useState, useEffect, useRef, type CSSProperties } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  BookOpen,
  BookMarked,
  Globe,
  Mic,
  PenLine,
  Music,
  MonitorPlay,
  ClipboardCheck,
  Joystick,
  Settings as SettingsIcon,
  LogOut,
  AlertTriangle,
  Menu,
  X,
  PanelLeft,
  ChevronsUpDown,
} from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { PdfProvider } from "./contexts/PdfContext";
import { SpeechProvider } from "./contexts/SpeechContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ThemeToggle } from "./components/common/ThemeToggle";
import { useWarmServerOnRouteChange } from "./hooks/useWarmServer";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { lazyWithReload } from "./utils/lazyWithReload";

// Lazy load route components for code splitting. lazyWithReload recovers from
// stale-chunk errors (old hashed chunks gone after a deploy) by reloading once.
const AuthScreen = lazyWithReload(() => import("./components/Auth/AuthScreen"));
const PdfReader = lazyWithReload(() => import("./components/PdfReader"));
const VocabularyBook = lazyWithReload(() =>
  import("./components/Vocabulary/VocabularyBook").then((module) => ({
    default: module.VocabularyBook,
  })),
);
const Settings = lazyWithReload(() =>
  import("./components/Settings/Settings").then((module) => ({
    default: module.Settings,
  })),
);
const SpeechPractice = lazyWithReload(
  () => import("./components/SpeechPractice/SpeechPractice"),
);
const SentencePractice = lazyWithReload(
  () => import("./components/SentencePractice/SentencePractice"),
);
const AudioUploads = lazyWithReload(
  () => import("./components/AudioUploads/AudioUploads"),
);
const SpiritAdventure = lazyWithReload(
  () => import("./components/Game/SpiritAdventure"),
);
const ShowSubtitlesPage = lazyWithReload(() =>
  import("./components/ShowSubtitles/ShowSubtitlesPage").then((module) => ({
    default: module.ShowSubtitlesPage,
  })),
);
const TravelEnglishPage = lazyWithReload(() =>
  import("./components/TravelEnglish/TravelEnglishPage").then((module) => ({
    default: module.TravelEnglishPage,
  })),
);
const ExamPracticePage = lazyWithReload(
  () => import("./components/ExamPractice/ExamPracticePage"),
);
const LittleGamesHub = lazyWithReload(
  () => import("./components/LittleGames/GameHub"),
);
const BunnyJumper = lazyWithReload(
  () => import("./components/LittleGames/BunnyJumper"),
);
const MeteorGlider = lazyWithReload(
  () => import("./components/LittleGames/MeteorGlider"),
);
const MushroomAdventure = lazyWithReload(
  () => import("./components/LittleGames/MushroomAdventure"),
);
const WonderAcademyGame = lazyWithReload(
  () => import("./components/LittleGames/wonder-academy/WonderAcademyCollector"),
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

// Avatar-triggered account menu: keeps Settings + Sign out tucked away instead
// of exposing them directly in the sidebar. Closes on outside click / Escape.
function AccountMenu({
  initial,
  label,
  email,
  collapsed = false,
  onSignOut,
}: {
  initial: string;
  label: string;
  email?: string | null;
  collapsed?: boolean;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        className={`flex w-full items-center rounded-lg text-left transition-colors duration-200 hover:bg-accent-tint ${
          collapsed ? "justify-center p-1" : "gap-2.5 px-2 py-1.5"
        }`}
      >
        <AccountAvatar initial={initial} size={collapsed ? "sm" : "md"} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {label}
              </span>
              {email && (
                <span className="block truncate text-xs text-muted-foreground">
                  {email}
                </span>
              )}
            </span>
            <ChevronsUpDown
              className="size-4 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute bottom-full z-50 mb-2 overflow-hidden rounded-xl border border-border-hairline bg-background/90 p-1 shadow-floating backdrop-blur-xl ${
            collapsed ? "left-0 w-56" : "inset-x-0"
          }`}
        >
          <div className="border-b border-border-hairline px-3 py-2">
            <div className="truncate text-sm font-semibold">{label}</div>
            {email && (
              <div className="truncate text-xs text-muted-foreground">
                {email}
              </div>
            )}
          </div>
          <Link
            to="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-base-content/80 transition-colors hover:bg-accent-tint hover:text-accent"
          >
            <SettingsIcon
              className="size-4 shrink-0"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span>設定</span>
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-error transition-colors hover:bg-error/10"
          >
            <LogOut
              className="size-4 shrink-0"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span>登出</span>
          </button>
        </div>
      )}
    </div>
  );
}

function AppContent() {
  const { user, loading, authError, signOutUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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

  const normalizedPathname = location.pathname.replace(/\/+$/, "") || "/";
  const isStandaloneWonderAcademy =
    normalizedPathname === "/games/wonder-academy";
  const isLegacyMonsterAcademy =
    normalizedPathname === "/games/monster-academy";

  if (isLegacyMonsterAcademy) {
    return <Navigate to="/games/wonder-academy" replace />;
  }

  if (isStandaloneWonderAcademy) {
    return (
      <SettingsProvider>
        <SpeechProvider>
          <PdfProvider>
            <Suspense fallback={<RouteLoadingFallback />}>
              <WonderAcademyGame onExit={() => navigate("/games")} />
            </Suspense>
          </PdfProvider>
        </SpeechProvider>
      </SettingsProvider>
    );
  }

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
    { to: "/english-speech", label: "英文演講", icon: PenLine },
    { to: "/speech-practice", label: "演講練習", icon: Mic },
    { to: "/audio-uploads", label: "音訊庫", icon: Music },
    { to: "/show", label: "影集字幕", icon: MonitorPlay },
    { to: "/exams", label: "考卷練習", icon: ClipboardCheck },
    { to: "/games", label: "小遊戲", icon: Joystick },
  ];
  const currentLabel =
    navItems.find((item) => item.to === location.pathname)?.label ??
    (location.pathname === "/settings" ? "設定" : "Ollie Reader");

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={
        {
          // Exposes the desktop sidebar width so fixed/floating elements deep in
          // the content (e.g. PDF reader FABs) can clear it at the lg breakpoint.
          "--app-sidebar-w": sidebarCollapsed ? "4rem" : "14rem",
        } as CSSProperties
      }
    >
      {/* Desktop sidebar (fixed; document keeps scrolling) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border-hairline bg-sidebar-bg backdrop-blur-xl transition-[width] duration-200 lg:flex ${
          sidebarCollapsed ? "w-16" : "w-56"
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

        {/* Account menu */}
        <div
          className={`border-t border-border-hairline ${
            sidebarCollapsed ? "p-2" : "p-3"
          }`}
        >
          <AccountMenu
            initial={accountInitial}
            label={accountLabel}
            email={accountEmail}
            collapsed={sidebarCollapsed}
            onSignOut={handleSignOut}
          />
        </div>
      </aside>

      {/* Main column (offset for the fixed sidebar on desktop) */}
      <div
        className={`flex min-h-screen flex-col transition-[padding] duration-200 ${
          sidebarCollapsed ? "lg:pl-16" : "lg:pl-56"
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
            <Link
              to="/settings"
              aria-label="設定"
              title="設定"
              aria-current={location.pathname === "/settings" ? "page" : undefined}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-200 hover:bg-accent-tint hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] ${
                location.pathname === "/settings"
                  ? "bg-accent-tint text-accent"
                  : "text-base-content/70"
              }`}
            >
              <SettingsIcon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </Link>
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

              {/* Account menu */}
              <div className="space-y-1 border-b border-border-hairline p-3">
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
                <Link
                  to="/settings"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-base-content transition-colors duration-200 hover:bg-accent-tint hover:text-accent active:scale-[0.98]"
                >
                  <SettingsIcon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span>設定</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-error transition-colors duration-200 hover:bg-error/10 active:scale-[0.98]"
                >
                  <LogOut className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span>登出</span>
                </button>
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
                      <Route path="/exams" element={<ExamPracticePage />} />
                      <Route path="/games" element={<LittleGamesHub />} />
                      <Route
                        path="/games/spirit"
                        element={<SpiritAdventure />}
                      />
                      <Route
                        path="/games/bunny"
                        element={<BunnyJumper onExit={() => navigate("/games")} />}
                      />
                      <Route
                        path="/games/meteor"
                        element={
                          <MeteorGlider
                            onExit={() => navigate("/games")}
                            onPlayBunny={() => navigate("/games/bunny")}
                          />
                        }
                      />
                      <Route
                        path="/games/mushroom"
                        element={
                          <MushroomAdventure onExit={() => navigate("/games")} />
                        }
                      />
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
