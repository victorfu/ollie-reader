import { Component, type ReactNode, type ErrorInfo } from "react";
import { logger } from "../../utils/logger";
import { isChunkLoadError } from "../../utils/chunkErrors";
import { reloadOnceForStaleChunk } from "../../utils/lazyWithReload";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isStaleChunk: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isStaleChunk: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isStaleChunk: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (isChunkLoadError(error)) {
      // Stale chunk after a deploy: reload once to fetch the latest build.
      // If we've already reloaded and it still fails, surface the real error.
      if (!reloadOnceForStaleChunk()) {
        this.setState({ isStaleChunk: false });
      }
      return;
    }
    logger.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, isStaleChunk: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.state.isStaleChunk) {
        // A reload is in flight; show a neutral loading state, not the error
        // card, so the recovery is invisible to the user.
        return (
          <div className="min-h-screen bg-background flex items-center justify-center">
            <span
              className="loading loading-spinner loading-lg text-primary"
              aria-label="正在載入最新版本"
            />
          </div>
        );
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="card bg-base-100 border border-border-hairline shadow-elevated max-w-md w-full">
            <div className="card-body text-center">
              <div className="text-6xl mb-4">😵</div>
              <h2 className="text-2xl font-semibold tracking-tight mb-2">發生錯誤</h2>
              <p className="text-muted-foreground mb-4">
                應用程式發生未預期的錯誤，請重新整理頁面或點擊下方按鈕重試。
              </p>
              {this.state.error && (
                <details className="text-left mb-4">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    錯誤詳情
                  </summary>
                  <pre className="mt-2 p-2 bg-base-200 rounded text-xs overflow-auto max-h-32">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
              <div className="card-actions justify-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={this.handleReset}
                >
                  重試
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => window.location.reload()}
                >
                  重新整理頁面
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
