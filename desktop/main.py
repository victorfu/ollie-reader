"""ollie-reader desktop 進入點。

無旗標 → 啟動 PySide6 殼（Task 13 之前殼尚未實作，會提示）。
--serve  → 啟動本機 API sidecar（uvicorn）。
"""

import argparse


def main():
    parser = argparse.ArgumentParser(prog="ollie-reader")
    parser.add_argument("--serve", action="store_true", help="run the local API sidecar")
    parser.add_argument("--port", type=int, default=None, help="sidecar port")
    args, _ = parser.parse_known_args()

    if args.serve:
        import uvicorn

        from server.config import DEFAULT_PORT, HOST

        uvicorn.run(
            "server.app:app",
            host=HOST,
            port=args.port or DEFAULT_PORT,
            log_level="info",
        )
    else:
        try:
            from shell.app import run_shell
        except ImportError:
            print("PySide6 殼尚未實作（見 plan Task 13）。請用 --serve 啟動 sidecar。")
            return
        run_shell()


if __name__ == "__main__":
    main()
