import { useAuth } from "../../hooks/useAuth";

export default function AuthScreen() {
  const { signInWithGoogle, authError } = useAuth();

  const handleGoogleSignIn = () => {
    void signInWithGoogle();
  };

  return (
    <div className="w-full max-w-md">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold">登入 Ollie Reader</h2>
            <p className="text-sm text-base-content/70">
              使用 Google 帳號即可存取 Ollie Reader。
            </p>
          </div>

          {authError && (
            <div className="alert alert-error text-sm">
              <span>{authError}</span>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary w-full gap-2"
            onClick={handleGoogleSignIn}
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            使用 Google 登入
          </button>
        </div>
      </div>
    </div>
  );
}
