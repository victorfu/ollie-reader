import { BookOpen } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

export default function AuthScreen() {
  const { signInWithGoogle, authError } = useAuth();

  const handleGoogleSignIn = () => {
    void signInWithGoogle();
  };

  return (
    <div className="w-full max-w-md px-4">
      {/* Glass card with macOS HIG styling */}
      <div className="glass rounded-2xl">
        <div className="space-y-8 p-8">
          {/* Header */}
          <div className="space-y-4 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white shadow-elevated">
              <BookOpen className="size-7" strokeWidth={2} aria-hidden="true" />
            </span>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-base-content">
                Ollie Reader
              </h1>
              <p className="text-base text-muted-foreground">
                上傳 PDF 文件，選取文字即可朗讀或翻譯
              </p>
            </div>
          </div>

          {/* Error alert */}
          {authError && (
            <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3">
              <p className="text-sm text-error">{authError}</p>
            </div>
          )}

          {/* Sign in button - macOS secondary button style */}
          <button
            type="button"
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-border-hairline bg-base-100 px-4 text-sm font-medium text-base-content shadow-soft transition-all duration-200 hover:bg-base-200 active:scale-[0.98] active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
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

          {/* Footer hint */}
          <p className="text-center text-xs text-muted-foreground">
            使用 Google 帳號登入即可開始使用
          </p>
        </div>
      </div>
    </div>
  );
}
