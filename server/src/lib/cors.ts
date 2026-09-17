const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://ollie-reader.web.app",
  "https://ollie-reader.firebaseapp.com",
];

function allowedOrigins(): Set<string> {
  const extra = (process.env.OLLIE_CORS_ORIGINS || "")
    .split(",").map((origin) => origin.trim()).filter(Boolean);
  for (const origin of extra) {
    const url = new URL(origin);
    if (origin.includes("*") || !["http:", "https:"].includes(url.protocol) || url.origin !== origin) {
      throw new Error("OLLIE_CORS_ORIGINS 必須是完整 origin，不可包含路徑或 wildcard");
    }
  }
  return new Set([...DEFAULT_ORIGINS, ...extra]);
}

export function corsHeaders(request: Request): { headers: Headers; allowed: boolean } {
  const origins = allowedOrigins();
  const origin = request.headers.get("origin");
  const allowed = !origin || origins.has(origin);
  const headers = new Headers({ "Vary": "Origin", "Cache-Control": "no-store" });
  if (origin && allowed) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Expose-Headers", "Content-Disposition");
  }
  return { headers, allowed };
}
