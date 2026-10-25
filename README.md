<div align="center">

<img src="public/icon-512x512.png" alt="Ollie Reader" width="120" height="120" />

# Ollie Reader

**An AI-assisted English-learning workspace for reading, listening, speaking, practice, and games.**

Read PDFs and show transcripts, listen to podcasts with AI-generated English transcripts, build a vocabulary and sentence book, practise saved words with generated spelling homework, rehearse speeches, practise school papers, and reinforce vocabulary through browser games. A standalone Next.js API and an optional macOS companion provide Edge TTS, URL fetching, podcast resolution, and other backend features; PDF text is extracted in the browser.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white&style=flat-square)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)](https://tailwindcss.com)
[![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase&logoColor=black&style=flat-square)](https://firebase.google.com)
[![Supabase](https://img.shields.io/badge/Supabase-2-3FCF8E?logo=supabase&logoColor=white&style=flat-square)](https://supabase.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white&style=flat-square)](https://nextjs.org)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white&style=flat-square)](https://web.dev/progressive-web-apps/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

</div>

---

## Overview

Ollie Reader is a responsive web app for Chinese-speaking English learners. Its main workspace requires Google sign-in and an allow-listed account. It combines a PDF learning workspace with bilingual Gemini assistance, a vocabulary and sentence book, word-practice homework, speech and sentence practice, exam practice, show transcripts, podcasts with AI transcripts, audio uploads, and games.

The UI follows macOS Human Interface Guidelines adapted for the web: a collapsible desktop source list, mobile drawer navigation, hairline borders, restrained translucent surfaces, light/dark themes, and touch-friendly controls. The app can be installed as a PWA. Built assets are precached, while exam images, Google Fonts, and bundled transcripts use targeted runtime caches; cloud-backed features still require their services.

## Features

| Feature | What it does |
|---|---|
| **PDF Reader** (閱讀器) | Opens local or remote PDFs with `react-pdf`; supports word or range selection, bilingual lookup, translation, TTS, and saving words or translated sentences. Page text comes from the PDF.js text layer in the browser. OIKID booking records can load lesson PDFs through the desktop sidecar or the standalone server when either has OIKID credentials. |
| **Smart Vocabulary Book** (生詞本) | One newest-first feed of saved words and translated sentences, filterable by all/words/sentences, with search across both. Words store bilingual AI definitions and examples, tags, flashcards, and pronunciation practice through the Web Speech API. Smart review prioritises unseen, older, remembered, and forgotten items; it is not an SM-2-style spaced-repetition scheduler. Words on the bundled CEFR list show their level (A1–C2) as a badge; other words show an estimate (≈B1) once one has been made while generating a Word Practice homework. |
| **Word Practice** (單字練習) | Ollie generates a homework on demand from the vocabulary book: 5–20 words (default 10), chosen missed-first, then by level A1→C2, then oldest saved first; an optional starting CEFR level skips listed words below it that were never missed, and learned words never return. Six steps, all in English, five with typed answers (Learn is read-and-listen): Learn, Spell It (look–listen–cover–write–check, three correct per word), Fill in the Blank, What's the Word? (definition to word), Write a Sentence (Gemini feedback in simple English), and an auto-graded Spelling Test where the word, a sentence, and the word are read aloud (correct means learned; wrong means practised first next time). Progress saves to Firestore after every answer, and finished homework is kept in a history with scores. |
| **English Speech** (英文演講) | Splits and translates pasted text with Gemini, organises reusable speech collections, supports drag-to-reorder sentences, per-word lookup, and sentence/all-speech playback. |
| **Speech Practice** (演講練習) | Generates topic scripts, records timed practice with pause/resume controls, and keeps history with playback. Metadata and scripts live in Firestore; private recording files live in Supabase Storage. |
| **Audio Library** (音訊庫) | Uploads and organises MP3, WAV, M4A, WebM, OGG, AAC, and MP4 learning audio. Firestore stores metadata and private Supabase Storage serves short-lived signed playback URLs. |
| **Podcast Listening** (Podcast 聽力) | Accepts Apple Podcasts show links with episode selection, or resolves an episode link to its exact RSS enclosure and plays it in the app, with seek, ±10 seconds, and 0.75–1.5× speed. Can generate an English transcript with Gemini (episodes up to 30 minutes / 80 MiB), save it per episode in Firestore, and highlight and seek by approximate timestamps. |
| **Show Subtitles** (影集字幕) | Reads the bundled *Gabby's Dollhouse* transcripts across seasons 1–10 and 12 with the same lookup, translate, speak, and save workflow used by the reader. |
| **Basic Academic Competency Test** (基本學力測驗) | Chinese, mathematics, and English papers with section/full-paper sessions, immediate feedback, wrong-answer retry, local best-score tracking, and random mixed-subject papers. |
| **Word Adventure & Gacha** | Runs vocabulary quiz stages and boss battles from the learner's word pool, with achievements and cloud-synced tokens used by the Popular Character Gacha collection. |
| **Little Games** (小遊戲) | The game hub opens each game in its own browser tab: Word Adventure, Popular Character Gacha, Cinnamoroll 3D Companion (大耳狗 3D 夥伴; pet his head and he reacts, in development, no save data), Sweetheart Defenders (tower defence, in development, cloud save), Mushroom Adventure, Meteor Glider, and Bunny Jumper. |
| **Settings** (設定) | Theme, speech mode (system voices or Edge TTS), speech rate, compute backend (`auto`/`local`/`cloud`), the gacha empty-capsule rate, a device-only "show all gacha entries" view, and game progress reset. |
| **Desktop Companion** | Adds a loopback FastAPI service and PySide6 menu-bar app. Piper and Kokoro run offline. Edge TTS, OIKID, and remote URL fetching still need network access. |

## Tech stack

- **React 19**, **React Router 7**, and strict **TypeScript 5.9**
- **Vite 7** with **vite-plugin-pwa** and lazy route-level code splitting
- **Tailwind CSS 4**, **DaisyUI 5**, OKLCH design tokens, **Framer Motion**, and **lucide-react** icons
- **Firebase 12** for Google Auth, the `allowedUsers/{email}` access check, Firestore, App Check, and Firebase AI Logic
- **Gemini 3.5 Flash-Lite** through `firebase/ai` and `GoogleAIBackend` for text features and podcast audio transcription; the frontend does not read a standalone Gemini API key
- **Supabase 2** for private audio/recording object storage, authenticated with Firebase ID tokens and protected by Storage RLS
- **react-pdf** for browser PDF rendering and text extraction (the only PDF text source)
- **Web Speech API**, **MediaRecorder**, IndexedDB, and local storage for browser-native speech, recording, and device-local caches/preferences
- **Vitest** for Web (jsdom) and server (Node) tests; **Playwright** for the podcast browser smoke test
- **Server:** Next.js 16 on Node.js 24 (deployed to Vercel), vendored `msedge-tts`, `firebase-admin`, FFmpeg (`ffmpeg-static`), and `music-metadata`
- **Desktop:** Python, PySide6, FastAPI, Piper, Kokoro ONNX, Edge TTS, and PyInstaller

## Getting started

### Prerequisites

- **Node.js `^20.19.0` or `>=22.12.0`** and npm for the Web app (the requirement imposed by the current Vite version); **Node.js 24** for `server/`
- A Firebase project configured for Google Auth, Firestore, App Check with reCAPTCHA v3, and Firebase AI Logic
- An `allowedUsers/{email}` Firestore document for each authorised account, backed by matching Firestore Security Rules
- A Supabase project with a private `ollie-reader` Storage bucket, Firebase Third-Party Auth, and RLS policies matching the Firebase user ID
- For backend TTS/URL/OIKID/Podcast features, the standalone [`server/`](server/README.md) API (or, except for Podcasts, the optional desktop sidecar)

Firestore rules and Supabase policies/schema are deployment infrastructure; the repository does not contain the complete deployed rules. Podcast transcripts need the owner-scoped rules in [`server/podcast-firestore-rules.fragment`](server/podcast-firestore-rules.fragment) merged into the deployed Firestore rules. Word Practice likewise needs [`word-practice-firestore-rules.fragment`](word-practice-firestore-rules.fragment) merged in, which covers `users/{uid}/wordHomeworks/{homeworkId}` and `users/{uid}/wordPractice/state`. The standalone Next.js API in [`server/`](server/README.md) provides Edge TTS, URL fetching, OIKID bookings, version checks, Podcast resolution, and Podcast audio preparation.

### Install and run

```bash
npm install
cp .env.development.example .env.development
npm run dev
```

`npm run dev` starts the Vite development server at `http://localhost:5173` and the API server in `server/` at `http://localhost:3000` together (run `npm run setup:server` once first). Use `npm run dev:web` or `npm run dev:server` to start only one of them. Most backend features need the API server; see [Compute and speech modes](#compute-and-speech-modes).

Frontend environment files are separated by Vite mode:

| Command | Environment file | Template |
|---|---|---|
| `npm run dev` | `.env.development` | `.env.development.example` |
| `npm run build` | `.env.production` | `.env.production.example` |
| `npm run preview` | Uses the already-built `dist/` bundle | Rebuild to change its environment |

For a local production build, copy `.env.production.example` to `.env.production`
and fill in the production Firebase, Supabase and deployed API values before
running `npm run build`. Both Firebase Hosting workflows generate `.env.production`
from GitHub Actions repository variables. Their PR previews also use production mode.

Actual environment files are ignored by Git; only the examples are committed.
`.env.example` is a combined variable reference; prefer the mode-specific templates.
Keep environment-specific settings out of shared `.env` and `.env.local` files,
which Vite loads in both modes. Mode-specific files override those shared values;
optional `.env.development.local` / `.env.production.local` files override the
corresponding mode files, and exported shell/CI variables take highest priority.
Keep `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` empty in production. These are frontend
build-time settings: restart Vite or rebuild after editing them. The independent
Next.js service continues to use `server/.env.local`.

### Environment variables

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase web app API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase app configuration value |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase web app ID |
| `VITE_RECAPTCHA_SITE_KEY` | Public reCAPTCHA v3 key used by Firebase App Check |
| `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` | Optional development-only App Check debug token |
| `VITE_GEMINI_CLIENT_RPM_BUDGET` | Effective client-side Gemini RPM budget; defaults to `4` |
| `VITE_API_BASE_URL` | Own server API; defaults to `http://localhost:3000` in development and `https://server-one-xi-16.vercel.app` in production |
| `VITE_PODCAST_API_BASE_URL` | Optional Podcast API override; defaults to `http://localhost:3000` in development and `VITE_API_BASE_URL` in production |
| `VITE_ETTS_API_BASE_URL` | Edge TTS cloud API base URL; falls back to `VITE_API_BASE_URL` when unset. Use `http://localhost:3000` for local server development. |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public/publishable Supabase key; never use a service-role or secret key in the frontend |

There is no `VITE_GEMINI_API_KEY`: Gemini is initialised through the configured Firebase app and protected by App Check.

Gemini requests, including podcast transcription, are serialized through one global
client queue. Set `VITE_GEMINI_CLIENT_RPM_BUDGET` from the active model's AI Studio
RPM limit after reserving capacity for other active clients. An unset or invalid
value uses a conservative 4 RPM fallback (15 seconds between request starts). This
is a Vite build-time variable, so restart the development server or rebuild the
deployment after changing it.
Same-origin tabs coordinate through Web Locks and shared browser state. Structured
minute/capacity 429 responses receive bounded retries; daily exhaustion opens a
circuit breaker until the next US Pacific midnight instead of being resent.
Podcast transcription jobs never retry automatically, to avoid repeating expensive
audio requests.

### npm scripts

```bash
npm run dev               # Vite (HMR) + server/ API together
npm run dev:web           # Vite development server only
npm run dev:server        # server/ API only
npm run setup:server      # Install server/ dependencies (npm ci)
npm run build             # Type-check with tsc, then build for production
npm run preview           # Preview the production build
npm run lint              # Run ESLint
npm run test              # Run the Vitest suite once
npm run fetch-transcripts # Refresh bundled show transcripts
npm run build-cefr        # Rebuild src/data/cefr/cefrLevels.json (needs network access)
```

The `dev*` and `setup:server` scripts run on Windows, macOS, and Linux without `make`. The root `Makefile` exposes equivalent Web targets (`make install`, `make dev`, `make web-dev`, `make build`, `make lint`, `make web-test`, and `make preview`), server targets (`make server-setup`, `server-dev`, `server-build`, `server-start`, `server-lint`, and `server-test`), aggregate setup/test targets, the exam-image crop utility, and all desktop workflows. Run `make help` for the complete list.

## Compute and speech modes

PDF text always comes from the browser: `react-pdf` renders each page with its PDF.js text layer, which also supplies the text for page actions. Reader settings separate two concerns:

- **Speech:** the browser's system voices or backend AI speech.
- **Compute location:** `auto` uses the desktop sidecar when it is available and otherwise the cloud API; `local` requires the sidecar; `cloud` skips local detection.

Compute location applies to Edge TTS, URL fetching, and OIKID booking records. Podcasts always use the server API, and Supabase Storage is accessed directly from the browser.

The Web app supports system speech and Edge TTS. Edge requires network access and works through either the desktop sidecar or the standalone Next.js API. Edge cloud requests use `VITE_ETTS_API_BASE_URL`; other cloud features continue using `VITE_API_BASE_URL`. In `auto` mode, a reachable desktop sidecar is preferred; `local` requires desktop, and `cloud` uses the configured cloud endpoint. Legacy engine preferences are treated as Edge TTS and saved as Edge on the next settings update; the system/API speech mode is preserved. The Web app no longer calls the Piper or Kokoro endpoints, which remain available in the desktop sidecar.

For local server development, run `npm run setup:server` once; `npm run dev` then starts the server alongside Vite. The development template sets `VITE_API_BASE_URL`, `VITE_ETTS_API_BASE_URL`, and `VITE_PODCAST_API_BASE_URL` to `http://localhost:3000`. Use the deployed HTTPS API base in `.env.production`. `fetch-url` streams downloads up to 50 MiB. See the [server guide](server/README.md) for API contracts, server-only OIKID/Firebase configuration, validation, and Vercel deployment settings.

If an older local environment still points `VITE_API_BASE_URL` at Cloud Run, update `.env.development` to `http://localhost:3000` and `.env.production` to the current Vercel backend (`https://server-one-xi-16.vercel.app`). Restart Vite after changing environment files; production values require a rebuild. A generic endpoint `404 Not Found` means the backend route is missing, not that the requested resource (for example a Podcast) is missing.

## Podcasts

Open **Podcast 聽力** (`/podcasts`) after signing in. Paste an Apple Podcasts show or episode sharing link and click **載入 Podcast**. A show link lists the playable public RSS episodes: choose one explicitly, then click **播放**. An episode link containing `?i=` loads only that exact episode. Playback does not start automatically. The page provides pause, a seek slider, ±10-second buttons, and 0.75× / 1× / 1.25× / 1.5× speed. Leaving the page releases the audio element and aborts pending resolution. No audio or listening history is persisted.

Below the player, **產生英文字幕** creates an English transcript:

- `POST /api/podcasts/audio` re-resolves the episode by its RSS GUID, downloads at most 80 MiB / 30 minutes, and compresses the full audio with FFmpeg to mono 16 kHz WebM/Opus (capped at 4 MiB).
- The browser sends that audio inline to Gemini through Firebase AI Logic, using the same request queue and App Check setup as other AI features.
- Completed transcripts are saved at `users/{uid}/podcastTranscripts/{id}`, keyed by podcast ID, RSS GUID, model, and schema version, and reused without another model call. A Firestore lease prevents the same episode from being generated twice at once across tabs and devices.
- Valid approximate timestamps enable active-sentence highlighting and click-to-seek; if timing is unreliable, the full text is shown without timestamps.
- Generation runs only while the page is open; closing the browser does not continue the job.

Deploy the `server/` podcast routes and merge [the Firestore rules fragment](server/podcast-firestore-rules.fragment) before using these features in the hosted frontend. See the [resolver contract and limits](server/README.md#post-apipodcastsresolve) and [transcription setup, architecture and troubleshooting](server/PODCAST-TRANSCRIPTION.md).

Start the services in separate terminals (Node.js 24 for the server):

```bash
npm ci --prefix server
npm run dev --prefix server
```

```bash
npm ci
npm run dev
```

Existing Firebase frontend configuration is still required for app sign-in. Podcasts use `VITE_PODCAST_API_BASE_URL` when set; otherwise development defaults to `http://localhost:3000` and production uses `VITE_API_BASE_URL`. This prevents a legacy cloud URL in local settings from intercepting the Podcast routes. The desktop compute-mode setting does not affect Podcasts.

Primary live test link: [Storytime: Sweeter than Honey](https://podcasts.apple.com/tw/podcast/storytime-sweeter-than-honey/id1567336024?i=1000539350317).

A repeatable live browser smoke test for playback is also available:

```bash
npx playwright install chromium  # if no matching browser is installed
node scripts/podcast-browser-smoke.mjs
```

The script mounts the actual Podcast page in a Playwright-only HTML harness, calls the real API, and tests the real remote audio. It checks playback, pause, skip, slider seeking, speed, cleanup, 375/768/1440px layouts, 44px touch targets, and light/dark screenshots in `/tmp/ollie-podcast-smoke`. It does not log into Firebase or generate transcripts; app routing/authentication and transcription have separate component tests. `PODCAST_WEB_URL`, `PODCAST_CHROMIUM_PATH`, and `PODCAST_SCREENSHOTS` optionally override the frontend origin, browser executable, and screenshot directory. For a nonstandard Vite port, add its exact origin to the server's `OLLIE_CORS_ORIGINS`.

## Desktop companion

[`desktop/`](desktop/) is a separate Python project managed by [uv](https://docs.astral.sh/uv/). It provides a macOS menu-bar shell plus a loopback FastAPI sidecar for remote URL proxying, OIKID booking records, and three TTS endpoints:

- Piper and Kokoro: offline WAV synthesis using bundled/downloaded models
- Edge TTS: network-only MP3 synthesis without a user API key

From the repository root:

```bash
make desktop-setup       # Create desktop/.venv and install default dependencies
make desktop-models      # Download and verify Piper/Kokoro models
make desktop-serve       # Run only the sidecar at http://127.0.0.1:8765
make desktop-run         # Run the PySide6 menu-bar app
make desktop-test        # Run the desktop pytest suite
make desktop-package     # Build desktop/dist/ollie-reader.app with PyInstaller
make desktop-verify      # Scan the app bundle for secrets
make desktop-dmg         # Build, sign, notarise, staple, and checksum a DMG
make desktop-release     # Rebuild and publish a desktop-v<version> GitHub Release
```

The official release workflow currently targets macOS 12+ on Apple Silicon. See [desktop/README.md](desktop/README.md) for the API contract, model lifecycle, configuration, packaging, signing, notarisation, and current limitations.

## Project structure

```text
ollie-reader/
├── .github/workflows/            # Firebase Hosting preview and live deploys
├── docs/superpowers/             # Design specs and implementation plans
├── public/
│   ├── exams/                    # Question PDFs and runtime-cached figures
│   └── transcripts/              # Bundled show transcript JSON
├── scripts/                      # Transcript, exam-image, game-asset, and podcast smoke-test utilities
├── src/
│   ├── assets/                   # Game artwork/audio
│   ├── components/
│   │   ├── AudioUploads/         # Audio library
│   │   ├── Auth/                 # Google sign-in UI
│   │   ├── ExamPractice/         # Subject papers, quizzes, and results
│   │   ├── Game/                 # Word Adventure
│   │   ├── LittleGames/          # Game hub, Gacha, 3D Cinnamoroll companion, and browser games
│   │   ├── PdfReader/            # PDF viewer, selection, lookup panels, and OIKID bookings
│   │   ├── Podcasts/             # Podcast player and AI transcripts
│   │   ├── SentencePractice/     # English speech collections
│   │   ├── SentenceTranslation/  # Translated-sentence rows and details in the vocabulary book
│   │   ├── Settings/             # Theme, speech, compute, and game settings
│   │   ├── ShowSubtitles/        # Season/episode transcript reader
│   │   ├── SpeechPractice/       # Script generation and recordings
│   │   ├── Vocabulary/           # Vocabulary book and review
│   │   ├── WordPractice/         # Generated homework, six steps, and history
│   │   ├── common/               # Shared UI primitives
│   │   └── icons/                # Custom icon components
│   ├── constants/                # API paths and static constants
│   ├── contexts/                 # Auth, PDF, Settings, Speech, and Theme state
│   ├── data/                     # Exam data and CEFR levels (cefr/cefrLevels.json)
│   ├── hooks/                    # Feature and state hooks
│   ├── services/                 # Firebase, Gemini, Supabase, backend, and domain services
│   ├── types/                    # Shared TypeScript models
│   ├── utils/                    # Firebase/Supabase clients and utilities
│   ├── App.tsx                   # Auth boundary, responsive shell, and routes
│   ├── main.tsx                  # Application entry point
│   └── index.css                 # Tailwind, DaisyUI themes, and design tokens
├── server/                       # Standalone Next.js API (Edge TTS, URL fetch, OIKID, Podcasts)
├── desktop/                      # Optional PySide6 + FastAPI macOS companion
├── tests/                        # Additional data/utility tests
├── word-practice-firestore-rules.fragment  # Firestore rules to merge for Word Practice
├── Makefile                      # Unified Web, server, and desktop task runner
├── vite.config.ts                # Vite, Vitest, and PWA configuration
└── firebase.json                 # Firebase Hosting SPA/cache configuration
```

## Testing and deployment

Run the Web quality checks before submitting changes:

```bash
npm run lint
npm run test
npm run build
```

For server changes, also run `npm run lint --prefix server`, `npm test --prefix server`, and `npm run build --prefix server` (or `make server-lint`, `make server-test`, and `make server-build`). For desktop changes, run `make desktop-test`. `make test` runs both Web and desktop suites (not the server suite).

The production build is served from `dist/`. `firebase.json` configures an SPA rewrite to `index.html`, immutable caching for hashed assets, and no-cache headers for the service worker and HTML entry point. GitHub Actions builds Firebase Hosting preview channels for pull requests and deploys the `master` branch to the live channel. The `server/` API is deployed separately as its own Vercel project (Root Directory `server`, Node.js 24); see the [server guide](server/README.md#frontend-and-vercel).

## Contributing

Contributions are welcome. Use focused [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `refactor:`, `chore:`), do not commit secrets, and follow the design and code conventions in [AGENTS.md](AGENTS.md).

## Acknowledgements

The CEFR levels shown in the vocabulary book and used by Word Practice come from two open word lists, compiled into [`src/data/cefr/cefrLevels.json`](src/data/cefr/cefrLevels.json) by `npm run build-cefr`:

- A1–B2: The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies.
- C1/C2: Octanove Vocabulary Profile (CC BY-SA 4.0)

The CEFR-J Wordlist may be used for research and commercial purposes provided the source is credited as above. Because `cefrLevels.json` contains data derived from the Octanove Vocabulary Profile, that file is released under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) rather than the MIT license below. See [`src/data/cefr/README.md`](src/data/cefr/README.md) for sources, versions, and how the file is built.

## License

[MIT](LICENSE) © Victor Fu. The bundled CEFR word list (`src/data/cefr/cefrLevels.json`) is the exception noted under [Acknowledgements](#acknowledgements).
