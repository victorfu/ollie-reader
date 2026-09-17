# Ollie Reader ETTS API

Standalone Next.js 16.3.5 App Router service, running on Node.js 24. It uses `msedge-tts` 2.0.7 to provide the desktop companion's Edge speech synthesis contract. Each request owns its connection; completed MP3 audio is collected in memory before the response is sent.

## Development

```bash
cd server
npm ci
cp .env.example .env.local
npm run dev
```

The API listens at `http://localhost:3000`. For production locally, use `npm run build` followed by `npm start`. Run `npm test` and `npm run lint` for isolated server checks. Equivalent root Makefile targets are `server-setup`, `server-dev`, `server-build`, `server-start`, `server-test`, and `server-lint`.

The server has its own dependencies and lockfile. The root Vite build, tests and lint remain independent. No Python process, desktop app, database, Firebase token or user API key is required for this endpoint.

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

Default allowed origins are `http://localhost:5173`, `http://127.0.0.1:5173`, `https://ollie-reader.web.app` and `https://ollie-reader.firebaseapp.com`. `OPTIONS` supports JSON `POST` preflights. Add an exact Firebase preview origin here when testing a preview channel. Direct clients without an Origin header are accepted. This endpoint is intentionally unauthenticated; CORS controls browser access, not authorization of non-browser clients.

## Frontend and Vercel

1. Import this repository into a separate Vercel project, select the Next.js preset, set **Root Directory** to `server`, and use **Node.js 24.x**. Use `npm ci` for installation and `npm run build` for the build.
2. Configure the server environment variables above as needed. Deploy the API and verify the curl example against its HTTPS URL.
3. Set `VITE_ETTS_API_BASE_URL=https://<your-api-domain>` in the frontend's root `.env.production` (base URL only, without `/api/etts`). Add the same value as the GitHub Actions repository variable `VITE_ETTS_API_BASE_URL`; both Firebase Hosting workflows write `.env.production` for the Vite build. For local development, root `.env.development` uses `http://localhost:3000`. Rebuild/deploy the frontend for this build-time setting to take effect.
4. In Ollie Reader, select AI speech (Edge TTS) and compute mode `cloud`. Speak an uncached short phrase, verify a successful `/api/etts` request to the configured host and listen to the audio. Repeat in `auto` without desktop, then in `local` with desktop running.

If the new frontend variable is empty, Edge cloud requests continue using `VITE_API_BASE_URL`. Keep that existing variable pointed at the general compute backend for PDF, URL fetching, OIKID and other APIs. The Web app's API speech uses only Edge TTS. This service implements only `/api/etts` and its preflight.

Edge TTS uses Microsoft's network service through a community package, just like desktop. An upstream `403` is surfaced as `502` with an update hint. Network availability must be smoke-tested from the actual Vercel deployment; unit tests mock the upstream service. Runtime errors are logged by status and safe message without input text or audio.
