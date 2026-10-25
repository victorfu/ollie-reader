# Ollie Reader API

Standalone Next.js 16.3.5 App Router service, running on Node.js 24. It provides version, URL fetching, OIKID booking records, and Edge speech synthesis. PDF text is extracted in the browser with PDF.js, so the server has no PDF endpoint. Edge uses a vendored copy of `msedge-tts` in `src/lib/msedge-tts` (2.1.0 plus the upstream Sec-MS-GEC v2 fix); each request owns its connection and completed MP3 audio is collected in memory before the response is sent.

## Development

```bash
cd server
npm ci
cp .env.example .env.local
npm run dev
```

The API listens at `http://localhost:3000`. For production locally, use `npm run build` followed by `npm start`. Run `npm test` and `npm run lint` for isolated server checks. Equivalent root Makefile targets are `server-setup`, `server-dev`, `server-build`, `server-start`, `server-test`, and `server-lint`.

After building, run `npm run test:runtime` to check the production booking route with Node's `require(esm)` support disabled. This starts a loopback server on port 3012 (`SMOKE_PORT` can override it), checks booking/version preflights and missing/invalid Firebase tokens, then stops the server. No OIKID request is made. `next.config.ts` bundles `firebase-admin`, `jwks-rsa` and `jose` together because jwks-rsa's CommonJS import of ESM-only jose otherwise fails in deployment runtimes that disable `require(esm)`.

The server has its own dependencies and lockfile. The root Vite build, tests and lint remain independent. OIKID requires Firebase ID tokens and server configuration. No desktop app is needed.

## General endpoints

All errors return `{ "detail": "..." }`; all responses use `Cache-Control: no-store`. Browser origins use the same allowlist as Edge. GET preflights permit `Authorization`, `Content-Type` and the warm-server caller's `Cache-Control`; POST preflights permit `Content-Type`. Clients can read the download metadata headers across origins.

### GET /api/version

Returns `{ "version": "1.0.1" }`. Set `API_VERSION` to override it. This is a lightweight liveness/version response for the existing warm-server caller; it does not check OIKID or other upstream services.

### GET /api/fetch-url

Parameters: required `url`; `follow_redirects=true`; `max_redirects=10` (1–30); `timeout=30` seconds (1–120). Streams the raw bytes with `Content-Type`, `Content-Disposition`, `X-Final-URL`, `X-Redirect-Count`, `X-File-Extension`, plus the upstream `Content-Length` when the body was not content-encoded. Missing extensions and `.php` paths use common MIME-to-extension mappings (PDF, HTML, text, JSON, JPEG, PNG, GIF, EPUB). An upstream `Content-Disposition` takes precedence.

Only public HTTP(S) destinations without embedded credentials are accepted; socket DNS resolution and every redirect enforce this boundary. Internal addresses are not supported. The download is streamed and limited to 50 MiB: a larger declared `Content-Length` returns `413` up front, and an undeclared overflow aborts the stream. Timeout covers the entire redirect/download operation and returns `408`; invalid query parameters return `422`; upstream HTTP errors retain their status; excessive redirects and connection failures return `500`. `follow_redirects=false` returns the redirect response body with status `200`, matching the Python route's response wrapper. Downloaded HTML is sandboxed and MIME sniffing is disabled.

The old Python route passed a shared HTTP client that did not apply all per-request redirect/timeout options. This implementation honors the supplied options. It intentionally does not reproduce that discrepancy or unlimited buffering.

### GET /api/oikid/booking-records

Requires `Authorization: Bearer <Firebase ID token>`. Missing credentials return `401`; invalid/expired/wrong-project tokens return `403`. Firebase Admin verifies the signature, expiry, issuer and audience using `FIREBASE_PROJECT_ID` and Google's public certificates. Token verification does not access Firestore/Storage and needs no service-account private key; revocation checks are not enabled, matching the previous backend.

Configure `OIKID_USERNAME` and `OIKID_PASSWORD` in `.env.local` or deployment secrets. Every request creates its own cookie jar, logs into the configured shared OIKID account, then requests page `P=1`. A Firebase login authorizes access to this shared account; it does not select a per-user OIKID account. The response retains `Token` and `Data`, with each row containing `id`, `Level`, `ClassVersion`, `CoursesName`, `ClassTime`, `TeacherName`, and `OpenName`.

Missing server configuration returns `500`; upstream login/network/JSON failures return `502`. Individual upstream requests have a 30-second timeout and the overall operation a 90-second deadline. No credentials, session cookies, booking tokens or booking data are logged.

### Deployment limits and frontend routing

Vercel documents a [4.5 MB request/response payload limit](https://vercel.com/docs/functions/limitations). Streamed responses are exempt from it, which is why `fetch-url` streams; buffered responses and request bodies stay within it.

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
| `PODCAST_AUDIO_SECRET` | At least 32 random characters; signs Podcast caption audio links. Unset disables `/api/podcasts/audio` |

Default allowed origins are `http://localhost:5173`, `http://127.0.0.1:5173`, `https://ollie-reader.web.app` and `https://ollie-reader.firebaseapp.com`. `OPTIONS` supports JSON `POST` preflights. Add an exact Firebase preview origin here when testing a preview channel. Direct clients without an Origin header are accepted. This endpoint is intentionally unauthenticated; CORS controls browser access, not authorization of non-browser clients.

## Frontend and Vercel

1. Import this repository into a separate Vercel project, select the Next.js preset, set **Root Directory** to `server`, and use **Node.js 24.x**. Use `npm ci` for installation and `npm run build` for the build.
2. Configure the server environment variables above as needed. Deploy the API and verify the curl example against its HTTPS URL.
3. Set `VITE_ETTS_API_BASE_URL=https://server-one-xi-16.vercel.app` in the frontend's root `.env.production` (base URL only, without `/api/etts`). Add the same value as the GitHub Actions repository variable `VITE_ETTS_API_BASE_URL`; both Firebase Hosting workflows write `.env.production` for the Vite build. For local development, root `.env.development` uses `http://localhost:3000`. Rebuild/deploy the frontend for this build-time setting to take effect.
4. In Ollie Reader, select AI speech (Edge TTS) and compute mode `cloud`. Speak an uncached short phrase, verify a successful `/api/etts` request to the configured host and listen to the audio. Repeat in `auto` without desktop, then in `local` with desktop running.

If the new frontend variable is empty, Edge cloud requests continue using `VITE_API_BASE_URL`. The general compute base can point at this server once its OIKID environment and deployment have been verified; see the general-endpoint routing instructions above. The Web app's API speech uses only Edge TTS.

Edge TTS uses Microsoft's network service through a community package, just like desktop. An upstream `403` is surfaced as `502` with an update hint. Network availability must be smoke-tested from the actual Vercel deployment; unit tests mock the upstream service. Runtime errors are logged by status and safe message without input text or audio.

## POST /api/podcasts/resolve

Accepts JSON `{ "url": "https://podcasts.apple.com/tw/podcast/storytime-sweeter-than-honey/id1567336024?i=1000539350317" }`.
Returns `title`, `podcastTitle`, nullable `artworkUrl` and `durationSeconds`, `audioUrl`, `sourceUrl`, `podcastId`, `episodeId`, the RSS `guid`, and `captionAudioUrl` (a signed `/api/podcasts/audio` path, or `null` when `PODCAST_AUDIO_SECRET` is unset).

The entry URL must be HTTPS on exactly `podcasts.apple.com`, use a country/show path, and may contain one numeric episode `i` parameter. Duplicate, empty, or nonnumeric `i` parameters are rejected. Apple’s public episode page currently exposes `serialized-server-data`: the resolver requires an offer whose `contentId` **and** `showOffer.adamId` match the requested episode/show, then obtains its actual RSS GUID and feed URL. Repeated identical offers are deduplicated; conflicting offers fail. This avoids treating the Apple numeric ID as the RSS GUID. Only one RSS item with that exact GUID is accepted; title/date guesses and latest-episode fallback are deliberately unsupported.

This strategy was checked against the requested Lingokids episode: direct iTunes episode Lookup returned no results, but the Apple page maps episode `1000539350317` to GUID `41de79d7-ab9c-4035-a1af-aee96c385002`. The live RSS contains that GUID once, with title `Storytime: Sweeter than Honey`, duration 382 seconds, and an MP3 enclosure. Apple page markup is not a versioned public API; if its structure changes or a feed removes an old episode, resolution fails explicitly and the adapter may need updating.

Security/limits: 4 KiB request, 2 MiB Apple metadata, 4 MiB RSS, a shared 20-second upstream deadline, and at most three redirects per fetch. All backend connections use the existing public-address-only socket DNS dispatcher (including redirects), preventing DNS rebinding to private addresses. Apple page redirects stay on Apple Podcasts; RSS uses public HTTPS on the standard port. RSS DTD/entity declarations are rejected. Feed descriptions/HTML are never rendered. The API follows the existing public metadata endpoint CORS policy; it does not require a Firebase token. The frontend route remains inside the app's authentication boundary.

No audio is downloaded or proxied by this route. The browser streams the HTTPS enclosure directly and handles hosting redirects; availability, codec support, and seek ranges remain dependent on the browser and audio host. Playback errors are surfaced in the player. Supported enclosure MIME types include MP3, M4A/MP4, AAC, OGG, WAV, and WebM; browser support varies. Sources requiring HTTP, subscriptions, signed-in cookies, or private networking are unsupported.

Errors use `{ "detail": "..." }`: `400` invalid input, `404` requested GUID absent from RSS, `413` size limit, `422` ambiguous identity/unsupported source, `502` unavailable or malformed upstream, `504` deadline, `499` observed client cancellation. No API key, Firestore collection, or Supabase bucket is needed.


For a show URL without `i`, the same endpoint returns `{ kind: "show", podcastTitle, sourceUrl, episodes, unavailableCount }`. Show metadata must match the requested `adamId` exactly (related-show recommendations are ignored). The public RSS supplies the episode choices; no episode is selected automatically. Every choice includes its exact GUID and validated enclosure. Its `episodeId` is `null` because Apple numeric IDs cannot be inferred from RSS GUIDs. Items with missing/duplicate GUIDs or unsupported/unsafe enclosures are excluded and counted in `unavailableCount`. No subscription or background synchronization is added.

## GET /api/podcasts/audio

Relays one verified RSS enclosure with CORS so the web player's optional English live captions can read the audio through Web Audio. Browsers cannot capture cross-origin media whose host omits CORS headers (for example Libsyn); hosts that already allow CORS are read directly and never reach this route.

Media elements cannot send a Firebase token, so the credential is the link itself: `url`, `expires` and an HMAC-SHA256 `signature` minted by the resolver with `PODCAST_AUDIO_SECRET`. Links last 12 hours and bind the exact enclosure URL; any change returns `403`. Without the secret the route returns `503`.

Each response is a single `206` slice of at most 4 MiB: an open or larger `Range` is clamped, and the media element requests the next range itself, so no invocation streams a whole episode. Suffix and multi-range requests return `416`, and an upstream `416` is passed through. Upstream redirects (up to eight) go through the same public-address-only socket dispatcher as other fetches. Only a byte-exact `206` answer with an audio (or octet-stream) type and no content encoding is relayed; anything else returns `502`. The upstream deadline is 60 seconds.
