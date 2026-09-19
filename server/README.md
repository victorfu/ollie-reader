# Ollie Reader API

Standalone Next.js 16.3.5 App Router service, running on Node.js 24. It provides version, PDF extraction, URL fetching, OIKID booking records, and Edge speech synthesis. PDF extraction uses Mozilla PDF.js; no Python process is needed. Edge uses `msedge-tts` 2.0.7; each request owns its connection and completed MP3 audio is collected in memory before the response is sent.

## Development

```bash
cd server
npm ci
cp .env.example .env.local
npm run dev
```

The API listens at `http://localhost:3000`. For production locally, use `npm run build` followed by `npm start`. Run `npm test` and `npm run lint` for isolated server checks. Equivalent root Makefile targets are `server-setup`, `server-dev`, `server-build`, `server-start`, `server-test`, and `server-lint`.

The server has its own dependencies and lockfile. The root Vite build, tests and lint remain independent. Only OIKID requires a Firebase ID token and server-side account configuration. No desktop app or user AI API key is needed.

## General endpoints

All errors return `{ "detail": "..." }`; all responses use `Cache-Control: no-store`. Browser origins use the same allowlist as Edge. GET preflights permit `Authorization` and `Content-Type`; PDF POST preflights permit `Content-Type`. Clients can read the download metadata headers across origins.

### GET /api/version

Returns `{ "version": "1.0.1" }`. Set `API_VERSION` to override it. This is a lightweight liveness/version response for the existing warm-server caller; it does not check OIKID or other upstream services.

### POST /api/pdf/extract

Upload `multipart/form-data` with a `file` field containing a `.pdf` file. Returns:

```json
{
  "status": "success",
  "filename": "sample.pdf",
  "total_pages": 1,
  "pages": [{ "page_number": 1, "text": "Hello", "text_length": 5 }]
}
```

Page numbers start at one and empty pages remain in the response. `text_length` counts Unicode code points, matching Python's `len`. PDF.js replaces PyMuPDF: the JSON contract is preserved, but text ordering, spacing and line breaks can differ. There is no OCR; image-only pages return empty text.

Limits: 4 MiB per PDF, 64 KiB multipart overhead, 500 pages, approximately 4 MiB serialized output, and a 25-second parsing deadline (30-second function duration). Invalid/empty/encrypted PDFs return `400`, missing `file` returns `422`, size/page limits return `413`, and parsing timeout returns `504`. These explicit errors differ from the old backend's generic `500` for parsing failures. MIME type is not used to reject an otherwise valid PDF filename, matching the previous contract. Uploaded filenames are never used as filesystem paths.

`next.config.ts` traces the PDF worker, fonts, CMaps, WASM and canvas dependencies for deployment. Run the server from this directory, as in the commands above.

### GET /api/fetch-url

Parameters: required `url`; `follow_redirects=true`; `max_redirects=10` (1–30); `timeout=30` seconds (1–120). Returns raw bytes and `Content-Type`, `Content-Length`, `Content-Disposition`, `X-Final-URL`, `X-Redirect-Count`, `X-File-Extension`. Missing extensions and `.php` paths use common MIME-to-extension mappings (PDF, HTML, text, JSON, JPEG, PNG, GIF, EPUB). An upstream `Content-Disposition` takes precedence.

Only public HTTP(S) destinations without embedded credentials are accepted; socket DNS resolution and every redirect enforce this boundary. Internal addresses are not supported. The download is buffered and limited to 4 MiB. Timeout covers the entire redirect/download operation and returns `408`; invalid query parameters return `422`; upstream HTTP errors retain their status; excessive redirects and connection failures return `500`. `follow_redirects=false` returns the redirect response body with status `200`, matching the Python route's response wrapper. Downloaded HTML is sandboxed and MIME sniffing is disabled.

The old Python route passed a shared HTTP client that did not apply all per-request redirect/timeout options. This implementation honors the supplied options. It intentionally does not reproduce that discrepancy or unlimited buffering.

### GET /api/oikid/booking-records

Requires `Authorization: Bearer <Firebase ID token>`. Missing credentials return `401`; invalid/expired/wrong-project tokens return `403`. Firebase Admin verifies the signature, expiry, issuer and audience using `FIREBASE_PROJECT_ID` and Google's public certificates. Token verification does not access Firestore/Storage and needs no service-account private key; revocation checks are not enabled, matching the previous backend.

Configure `OIKID_USERNAME` and `OIKID_PASSWORD` in `.env.local` or deployment secrets. Every request creates its own cookie jar, logs into the configured shared OIKID account, then requests page `P=1`. A Firebase login authorizes access to this shared account; it does not select a per-user OIKID account. The response retains `Token` and `Data`, with each row containing `id`, `Level`, `ClassVersion`, `CoursesName`, `ClassTime`, `TeacherName`, and `OpenName`.

Missing server configuration returns `500`; upstream login/network/JSON failures return `502`. Individual upstream requests have a 30-second timeout and the overall operation a 90-second deadline. No credentials, session cookies, booking tokens or booking data are logged.

### Deployment limits and frontend routing

Vercel documents a [4.5 MB request/response payload limit](https://vercel.com/docs/functions/limitations). The 4 MiB application limit leaves room for framing; larger PDFs/downloads require a different upload/download architecture or the existing desktop/Python backend. The new server is not an unlimited-size replacement for the old backend.

After deploying and configuring the server, set the frontend's `VITE_API_BASE_URL` to its base URL to route the four general cloud endpoints here. `VITE_ETTS_API_BASE_URL` remains an independent speech override. For local development use `http://localhost:3000`. Rebuild the frontend after changing these build-time variables. Frontend development settings point to port 3000; production defaults and the GitHub Actions API variable point to `https://server-one-xi-16.vercel.app`. Deploy the new server routes and configure its server-only environment before rebuilding/deploying Web. Updating these settings does not itself deploy either service.

## POST /api/etts

Send `Content-Type: application/json`:

```json
{ "text": "Hello, Ollie Reader!", "speed": 1, "voice": "en-US-AriaNeural" }
```

| Field | Behaviour |
| --- | --- |
| `text` | Required nonblank plain text, at most 5,000 Unicode characters. Markup is escaped and read literally; invalid XML control characters are rejected. |
| `speed` | Optional finite number, defaults to `1`. Values at or below zero use `1`. Matches desktop's percentage conversion with ties-to-even rounding and `-50%` to `+100%` clamp. |
| `voice` | Optional Edge ShortName string or `null`. Blank values use `EDGE_TTS_VOICE`, then `en-US-AriaNeural`. Names are syntax-checked; availability is determined by the upstream service. |

Success returns `200`, `Content-Type: audio/mpeg`, `Content-Disposition: attachment; filename="speech.mp3"`, and `Cache-Control: no-store`. Audio uses 24 kHz, 48 kbit/s mono MP3. The server does not persist audio; the frontend's existing audio cache continues to work.

Errors return `{ "detail": "..." }`:

| Status | Meaning |
| --- | --- |
| `400` | Malformed JSON, incorrect Content-Type or invalid input |
| `403` | Browser origin or CORS preflight not allowed |
| `413` | Text exceeds 5,000 characters or JSON body exceeds 64 KiB |
| `499` | Request cancellation received by the server |
| `500` | Invalid server configuration or unexpected internal failure |
| `502` | Upstream rejection, interrupted/empty audio, or audio exceeding the 4 MiB buffer limit |
| `504` | Synthesis exceeds 25 seconds |

Failures never return partial audio. The route's Vercel maximum duration is 30 seconds. Connections, audio streams, listeners and timers are cleaned up on completion, failure, timeout and observed request cancellation. `vercel.json` enables [Vercel request cancellation](https://vercel.com/docs/functions/functions-api-reference#cancel-requests) for this route. No automatic engine fallback occurs.

```bash
curl --fail-with-body http://localhost:3000/api/etts \
  -H 'Content-Type: application/json' \
  -d '{"text":"Hello, Ollie Reader!","speed":1}' \
  --output /tmp/ollie-speech.mp3
```

## Environment and browser access

| Variable | Default / purpose |
| --- | --- |
| `EDGE_TTS_VOICE` | `en-US-AriaNeural`; choose another Edge ShortName to override |
| `OLLIE_CORS_ORIGINS` | Comma-separated additional complete origins, without paths, trailing slashes or wildcards |
| `API_VERSION` | `1.0.1`; value returned by `/api/version` |
| `FIREBASE_PROJECT_ID` | Firebase project whose client ID tokens may access OIKID |
| `OIKID_USERNAME`, `OIKID_PASSWORD` | Shared OIKID account, server-only secrets |

Default allowed origins are `http://localhost:5173`, `http://127.0.0.1:5173`, `https://ollie-reader.web.app` and `https://ollie-reader.firebaseapp.com`. `OPTIONS` supports JSON `POST` preflights. Add an exact Firebase preview origin here when testing a preview channel. Direct clients without an Origin header are accepted. This endpoint is intentionally unauthenticated; CORS controls browser access, not authorization of non-browser clients.

## Frontend and Vercel

1. Import this repository into a separate Vercel project, select the Next.js preset, set **Root Directory** to `server`, and use **Node.js 24.x**. Use `npm ci` for installation and `npm run build` for the build.
2. Configure the server environment variables above as needed. Deploy the API and verify the curl example against its HTTPS URL.
3. Set `VITE_ETTS_API_BASE_URL=https://server-one-xi-16.vercel.app` in the frontend's root `.env.production` (base URL only, without `/api/etts`). Add the same value as the GitHub Actions repository variable `VITE_ETTS_API_BASE_URL`; both Firebase Hosting workflows write `.env.production` for the Vite build. For local development, root `.env.development` uses `http://localhost:3000`. Rebuild/deploy the frontend for this build-time setting to take effect.
4. In Ollie Reader, select AI speech (Edge TTS) and compute mode `cloud`. Speak an uncached short phrase, verify a successful `/api/etts` request to the configured host and listen to the audio. Repeat in `auto` without desktop, then in `local` with desktop running.

If the new frontend variable is empty, Edge cloud requests continue using `VITE_API_BASE_URL`. The general compute base can point at this server once its OIKID environment and deployment have been verified; see the general-endpoint routing instructions above. The Web app's API speech uses only Edge TTS.

Edge TTS uses Microsoft's network service through a community package, just like desktop. An upstream `403` is surfaced as `502` with an update hint. Network availability must be smoke-tested from the actual Vercel deployment; unit tests mock the upstream service. Runtime errors are logged by status and safe message without input text or audio.
