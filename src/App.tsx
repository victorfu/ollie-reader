import AuthScreen from "./components/Auth/AuthScreen";
import PdfReader from "./components/PdfReader";
import { useAuth } from "./hooks/useAuth";

function App() {
  const { user, loading, authError, signOutUser } = useAuth();

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

  return (
    <div className="min-h-screen bg-base-200">
      <header className="border-b border-base-300 bg-base-100">
        <div className="mx-auto flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-base-content/70 truncate">
            {user.email}
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
        <PdfReader />
      </div>
    </div>
  );
}

export default App;
