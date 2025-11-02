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

function AppContent() {
  const { user, loading, authError, signOutUser } = useAuth();
  const location = useLocation();

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

  return (
    <div className="min-h-screen bg-base-200">
      <header className="border-b border-base-300 bg-base-100 sticky top-0 z-40">
        <div className="mx-auto flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm text-base-content/70 truncate">
              {user.email}
            </div>
            <div className="flex gap-2">
              <Link
                to="/"
                className={`btn btn-sm ${
                  !isVocabularyPage && !isSettingsPage
                    ? "btn-primary"
                    : "btn-ghost"
                }`}
              >
                📚 閱讀器
              </Link>
              <Link
                to="/vocabulary"
                className={`btn btn-sm ${
                  isVocabularyPage ? "btn-primary" : "btn-ghost"
                }`}
              >
                📖 生詞本
              </Link>
              <Link
                to="/settings"
                className={`btn btn-sm ${
                  isSettingsPage ? "btn-primary" : "btn-ghost"
                }`}
              >
                ⚙️ 設定
              </Link>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
            登出
          </button>
        </div>
      </header>

      {authError && (
        <div className="mx-auto px-4">
          <div className="alert alert-error mt-4">
            <span>{authError}</span>
          </div>
        </div>
      )}

      <div className="mx-auto px-4 py-6 sm:py-8 md:py-12">
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
