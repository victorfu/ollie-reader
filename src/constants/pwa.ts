/**
 * Service worker 的 navigateFallback 例外清單。
 *
 * PWA 的 SPA fallback 會把「所有」導航請求都回 index.html——包括新分頁
 * 開啟 /exams/ 下的題目卷 PDF/JPG。這些是真實靜態檔,必須放行到網路,
 * 否則部署版點「題目卷/解析卷」只會看到 app 外殼。
 * vite.config.ts 與測試共用此清單;workbox 是用 url.pathname + url.search
 * (百分比編碼後) 來比對。
 */
export const NAVIGATE_FALLBACK_DENYLIST: RegExp[] = [/^\/exams\//];
