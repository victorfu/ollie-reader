# English Podcast transcription (Firebase AI Logic)

The existing Podcasts page offers **產生英文字幕** below the existing player.
`gemini-3.5-flash-lite` processes the complete audio through the app's existing
Firebase AI Logic `GoogleAIBackend`, Firebase app and App Check configuration.
No separate Gemini API key, Google GenAI SDK, Gemini Files API, or Firestore
Admin private credential is used. Existing text AI features are unchanged.

## Configuration

- Keep the frontend's existing Firebase, App Check and Firestore configuration.
  Enable the existing model in Firebase AI Logic as for the other AI features.
- The existing backend `FIREBASE_PROJECT_ID` verifies Firebase ID tokens.
  The audio route checks `allowedUsers/{email}` with the user's token through
  Firestore REST and existing rules; this needs no service-account credential.
  The existing App Check token is forwarded only to Firestore, so enforced
  Firestore App Check also works. It is never sent to RSS/audio hosts.
- Merge [the rules fragment](podcast-firestore-rules.fragment) into the actual
  deployed Firestore rules, inside `/databases/{database}/documents`. The repo
  does not contain the complete deployed rules. Restrict these collections to
  the authorized owner, and remove any overlapping public/cross-user grants.
  Firestore grants access if **any** matching rule allows it. If the previous
  server-only fragment was deployed, replace it with the current client rules.
- Run `npm ci` in `server/`; the approved `ffmpeg-static` install script provides
  the platform-specific binary. Next's tracing includes it in the audio route.
  Deploy from a clean install on the target OS, not a copied Windows node_modules.
  The host must permit spawning FFmpeg and support a **150-second** function.
- Set `VITE_PODCAST_API_BASE_URL` to that server, or use its existing default.
  Local development uses port 3000. Add custom browser origins to
  `OLLIE_CORS_ORIGINS`, then rebuild the frontend if its URL changed.

## Audio acquisition and limits

`POST /api/podcasts/audio` accepts `{ sourceUrl, guid }` plus the current user's
Firebase bearer token. It reuses the Apple/RSS resolver and matches the GUID;
client audio URLs are never trusted. Every download/redirect uses the existing
public-address-only socket DNS dispatcher, preventing private IP and DNS-rebinding
access. The route accepts verified users in the existing `allowedUsers` list.

The server downloads **at most 80 MiB / 30 minutes**, verifies MIME and actual
duration with `music-metadata`, then compresses the **entire** first audio track
with FFmpeg to mono 16 kHz WebM/Opus. Short episodes use up to 32 kbps; longer
episodes reduce bitrate (about 15 kbps at 30 minutes) to fit the response. This
is lossy speech preparation and can affect recognition accuracy. The original
audio still plays unchanged. No trimming, silence removal or speed change is
used; output duration must match within two seconds. Unsupported formats,
inconsistent duration or oversized output fail without returning partial audio.

The prepared binary is capped at **4 MiB**, below Vercel's 4.5 MB HTTP limit.
Its base64 representation plus prompt/schema fits comfortably under Firebase
AI Logic's **20 MB total inline-request limit**. The frontend sends this audio
as `inlineData` through `generateGeminiContent`; no arbitrary RSS URL is passed
to `GoogleAIBackend`, and no browser cross-origin download from the RSS host is
needed. Current verified source formats are MP3, MP4/M4A, AAC, OGG, WAV and FLAC.

Download timeout is 45 seconds, conversion timeout is 60 seconds, and the overall
server media deadline is 130 seconds. FFmpeg runs without a shell, external
network protocols, metadata copying or additional media tracks. Temporary input
and output files are removed after process exit, including failures/cancellation.
The response uses `Cache-Control: no-store`. Media is never saved in Firestore.
Per-instance CPU protection permits one active preparation per user, at least
60 seconds between starts, and four simultaneous preparations overall. It is
not a distributed quota system; Firebase AI Logic quotas/App Check and the
existing frontend coordination continue to protect model calls.

## Gemini, timestamps and persistence

`geminiClient.ts` now accepts the SDK's multimodal `GenerateContentRequest` in
addition to existing text input. Audio calls use the **same request queue and
cross-tab gate**, with shared provider-error observation and cooldowns. Only
Podcast jobs disable automatic retries, avoiding repeated expensive requests.
For retryable short-term 429s, only that Podcast job fails; other model requests
remain queued behind the shared short cooldown, without opening an unknown breaker.
Other actions retain their current retry policy. No second Gemini quota system
or alternate STT provider was introduced.

The request uses supported JSON schema output and requires a successful `STOP`
finish reason. Missing text, malformed JSON and truncated/blocked responses are
not saved. Full text remains selectable. Valid approximate utterance timestamps
enable highlighting and seeking through the existing player. Invalid, missing,
negative, nonfinite, reversed, overlapping, unordered or out-of-duration timing
disables timing for the entire transcript while preserving all text. The only
tolerance is a two-second rounding overrun. No guessed/interpolated alignment
is added. `audioTimestamp` is not exposed by the installed Firebase SDK and is
not passed; timing is requested in the prompt and marked approximate in the UI.

Completed transcripts use `users/{uid}/podcastTranscripts/{id}` through the
existing frontend Firestore `db`. The safe ID is SHA-256 of the JSON tuple
`[podcastId, guid, model, schemaVersion]`, preserving the previous cache identity.
The whole validated document must fit 750,000 serialized UTF-8 bytes. A cache hit
does not download audio or call Gemini. Failures never overwrite completed data.

Client Firestore transactions claim a ten-minute lease at
`users/{uid}/podcastTranscriptJobs/{id}`, preventing simultaneous same-episode
generation across tabs/devices for normal clients. Lease creation and failed-job
cooldowns use Firestore `serverTimestamp()` plus a fixed duration. Expiry decisions
read a resolved server timestamp from `users/{uid}/podcastTranscriptClock/current`
(one write/read per expiry check); browser wall clocks never determine expiry.
The rules require both timestamp fields to equal `request.time`. Deploy the updated
rules fragment, including the clock document match, with this version. Clock-read
failures stop new claims; completed-cache reads need no clock probe. Legacy leases
created using browser `expiresAt` values are conservatively migrated to a full
server-timed ten-minute lease while preserving the existing owner token.
Completed writes atomically
save the transcript and remove the lease. Failed jobs allow an explicit retry
after 30 seconds; cancellation waits two minutes because provider work may
continue after the caller aborts. Abandoned browser jobs expire after ten minutes.
These owner-writable leases coordinate clients; they are not tamper-proof billing
quotas. Use Firebase AI Logic's configured quotas and App Check for abuse control.

The total client generation deadline is eight minutes including queue wait and
audio preparation. Switching episodes/unmounting cancels the active frontend
operation; stale responses cannot appear under another episode. Already-completed
provider results can still be saved. **Closing the browser does not run a durable
background transcription job.** Returning polls existing active leases with
cache reads only, and expired jobs require an explicit retry. Cancelling a model
request cannot guarantee cancellation of provider usage/charges.

## Troubleshooting and testing

- **CORS:** RSS media is fetched by the backend. API CORS requires the exact web
  origin and `Authorization` in the audio route's preflight.
- **401/403:** check login, verified email, `FIREBASE_PROJECT_ID`, `allowedUsers`,
  and Firestore rules. No Admin secret should be added to fix client rules.
- **Firestore permission-denied:** deploy the current owner-scoped fragment;
  the earlier server-only deny rules do not permit this client-based design.
- **413:** source or complete compressed output exceeds its limit. No partial
  result is used; choose a shorter supported episode.
- **429:** existing Gemini quota/cooldown messages apply; no automatic audio
  retry occurs. Audio preparation 429 means wait at least a minute.
- **Timeout:** check for a saved transcript first. Keep the page open during
  generation; abandoned leases eventually expire. On the server, verify FFmpeg
  installation and execution limits.
- **Malformed/incomplete transcription:** rejected without replacing cache.
  A general-purpose model can still mishear/omit speech; manually compare the
  beginning, middle and ending of important recordings.

Run `npm run build`, `npm test`, `npm run lint` at the root and in `server/`.
Frontend tests mock Firebase model calls and Firestore, and verify shared queue
use, cache reuse, failure handling and navigation. Server conversion tests run
the bundled FFmpeg on short synthetic audio; no paid model calls are made.

Real public-media smoke test, including complete compressed audio verification:

```powershell
cd server
$env:RUN_PODCAST_AUDIO_SMOKE = '1'
npx vitest run src/lib/podcastAudio.live.test.ts
Remove-Item Env:RUN_PODCAST_AUDIO_SMOKE
```

For live transcription, run the frontend/server, sign into the existing app,
paste [Lingokids — Storytime: Sweeter than Honey](https://podcasts.apple.com/tw/podcast/storytime-sweeter-than-honey/id1567336024?i=1000539350317),
play and generate. Compare beginning/middle/ending, click timed sentences, switch
episodes during a request, then refresh/reopen and confirm cache reuse without
another model call. This requires the existing authorized Firebase/App Check
session; it does not require a new Gemini key.

References: [Firebase audio input](https://firebase.google.com/docs/ai-logic/analyze-audio),
[input requirements](https://firebase.google.com/docs/ai-logic/input-file-requirements).
