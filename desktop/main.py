"""ollie-reader desktop 進入點。

無旗標 → 啟動 PySide6 殼。
--serve  → 啟動本機 API sidecar（uvicorn）；若 port 上已有活的 sidecar 則直接退出。
"""

import argparse


def main():
    parser = argparse.ArgumentParser(prog="ollie-reader")
    parser.add_argument("--serve", action="store_true", help="run the local API sidecar")
    parser.add_argument("--port", type=int, default=None, help="sidecar port")
    args, _ = parser.parse_known_args()

    if args.serve:
        import uvicorn

        from server import instance
        from server.config import DEFAULT_PORT, HOST

        port = args.port or DEFAULT_PORT
        if instance.sidecar_alive(port):
            # 已有活的 sidecar（開機自啟或另一個殼開的）→ 正常退出（exit 0），
            # 不搶 port。LaunchAgent KeepAlive=False，不會被誤判 crash。
            print(f"ollie-reader sidecar 已在 port {port} 執行，不重複啟動。")
            return

        try:
            instance.write_pid_file(port)
        except OSError as exc:
            print(f"無法寫入 sidecar PID 檔（{exc}），照常啟動。")
        instance.install_signal_cleanup(port)
        try:
            uvicorn.run(
                "server.app:app",
                host=HOST,
                port=port,
                log_level="info",
            )
        finally:
            # finally 涵蓋正常 return 與例外；signal 路徑（SIGTERM/SIGINT）則由
            # install_signal_cleanup 的 handler 處理 —— uvicorn 優雅關閉後會還原
            # 預設 handler 並重放訊號，所以清檔動作要搶在重放之前完成。
            instance.remove_pid_file(port)
    else:
        try:
            from shell.app import run_shell
        except ImportError:
            print("PySide6 殼尚未實作（見 plan Task 13）。請用 --serve 啟動 sidecar。")
            return
        run_shell()


if __name__ == "__main__":
    main()
