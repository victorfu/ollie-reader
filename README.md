<div align="center">

<img src="public/icon-512x512.png" alt="Ollie Reader" width="120" height="120" />

# Ollie Reader

**An AI-assisted English-learning workspace for reading, listening, speaking, practice, and games.**

Read PDFs and show transcripts, build a vocabulary book, rehearse travel English and speeches, practise school papers, and reinforce vocabulary through browser games. An optional macOS companion adds local PDF extraction and desktop TTS engines.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white&style=flat-square)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)](https://tailwindcss.com)
[![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase&logoColor=black&style=flat-square)](https://firebase.google.com)
[![Supabase](https://img.shields.io/badge/Supabase-2-3FCF8E?logo=supabase&logoColor=white&style=flat-square)](https://supabase.com)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white&style=flat-square)](https://web.dev/progressive-web-apps/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

</div>

---

## Overview

Ollie Reader is a responsive, authentication-gated web app for Chinese-speaking English learners. It combines a PDF learning workspace with bilingual Gemini assistance, vocabulary review, speech and sentence practice, travel scenarios, exam practice, transcripts, audio uploads, and games.

The UI follows macOS Human Interface Guidelines adapted for the web: a collapsible desktop source list, mobile drawer navigation, hairline borders, restrained translucent surfaces, light/dark themes, and touch-friendly controls. The app can be installed as a PWA. Built assets are precached, while exam images, Google Fonts, and bundled transcripts use targeted runtime caches; cloud-backed features still require their services.

## Features

| Feature | What it does |
|---|---|
| **PDF Reader** (閱讀器) | Opens local or remote PDFs with `react-pdf`; supports word or range selection, bilingual lookup, translation, TTS, and saving words. Text can be parsed in the browser or by a compatible backend. When the desktop companion has OIKID credentials, booking records can also be used to load lesson PDFs. |
| **Smart Vocabulary Book** (生詞本) | Stores bilingual AI definitions and examples, tags, search, flashcards, and pronunciation practice through the Web Speech API. Smart review prioritises unseen, older, remembered, and forgotten items; it is not an SM-2-style spaced-repetition scheduler. |
| **Travel English** (旅遊英文) | A 12-topic Singapore journey with vocabulary, useful phrases, bilingual dialogues, TTS, passport-style missions, and synced progress. |
| **Speech Practice** (演講練習) | Generates topic scripts, records timed practice with pause/resume controls, and keeps history with playback. Metadata and scripts live in Firestore; private recording files live in Supabase Storage. |
| **English Speech** (英文演講) | Splits and translates pasted text with Gemini, organises reusable speech collections, supports drag-to-reorder sentences, per-word lookup, and sentence/all-speech playback. |
| **Show Subtitles** (影集字幕) | Reads the bundled *Gabby's Dollhouse* transcripts across nine seasons with the same lookup, translate, speak, and save workflow used by the reader. |
| **Exam Practice** (考卷練習) | Chinese, mathematics, and English papers with section/full-paper sessions, immediate feedback, wrong-answer retry, local best-score tracking, and random mixed-subject papers. |
| **Audio Library** (音訊庫) | Uploads and organises MP3, WAV, M4A, WebM, OGG, AAC, and MP4 learning audio. Firestore stores metadata and private Supabase Storage serves short-lived signed playback URLs. |
| **Word Adventure & Gacha** | Runs vocabulary quiz stages and boss battles from the learner's word pool, with achievements and cloud-synced tokens used by the Popular Character Gacha collection. |
| **Little Games** (小遊戲) | Includes Sweetheart Defenders (in development, cloud save), Mushroom Adventure, Meteor Glider, and Bunny Jumper, alongside the Word Adventure and Gacha entries in the game hub. |
| **Desktop Companion** | Adds a loopback FastAPI service and PySide6 menu-bar app. Piper and Kokoro run offline; PDF extraction is local. Edge TTS, OIKID, and remote URL fetching still need network access. |

## Tech stack

- **React 19**, **React Router 7**, and strict **TypeScript 5.9**
- **Vite 7** with **vite-plugin-pwa** and lazy route-level code splitting
- **Tailwind CSS 4**, **DaisyUI 5**, OKLCH design tokens, and **Framer Motion**
- **Firebase 12** for Google Auth, the `allowedUsers/{email}` access check, Firestore, App Check, and Firebase AI Logic
- **Gemini 3.5 Flash-Lite** through `firebase/ai` and `GoogleAIBackend`; the frontend does not read a standalone Gemini API key
- **Supabase 2** for private audio/recording object storage, authenticated with Firebase ID tokens and protected by Storage RLS
- **react-pdf** for browser PDF rendering and text extraction
- **Web Speech API**, **MediaRecorder**, IndexedDB, and local storage for browser-native speech, recording, and device-local caches/preferences
- **Desktop:** Python, PySide6, FastAPI, PyMuPDF, Piper, Kokoro ONNX, Edge TTS, and PyInstaller

## Getting started

### Prerequisites

- **Node.js `^20.19.0` or `>=22.12.0`** and npm (the requirement imposed by the current Vite version)
- A Firebase project configured for Google Auth, Firestore, App Check with reCAPTCHA v3, and Firebase AI Logic
- An `allowedUsers/{email}` Firestore document for each authorised account, backed by matching Firestore Security Rules
- A Supabase project with a private `ollie-reader` Storage bucket, Firebase Third-Party Auth, and RLS policies matching the Firebase user ID
- For backend PDF/TTS/URL/OIKID modes, either a compatible cloud API or the optional desktop sidecar

Firestore rules, Supabase policies/schema, and the cloud API implementation are deployment infrastructure and are not included in this repository.

### Install and run

```bash
npm install
cp .env.example .env.local
npm run dev
```

The Vite development server runs at `http://localhost:5173`.

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
| `VITE_API_BASE_URL` | Compatible cloud compute API; defaults to `http://localhost:8080` |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public/publishable Supabase key; never use a service-role or secret key in the frontend |

There is no `VITE_GEMINI_API_KEY`: Gemini is initialised through the configured Firebase app and protected by App Check.

Gemini requests are serialized through one global client queue. The queue uses
the Firebase Remote Config parameter `gemini_client_rpm_budget` as its effective
per-client RPM budget and spaces request start times accordingly. Configure this
value from the active model's AI Studio RPM limit after reserving capacity for
other active clients. Until Remote Config is available, the app uses a
conservative 4 RPM fallback (15 seconds between request starts).
Same-origin tabs coordinate through Web Locks and shared browser state. Structured
minute/capacity 429 responses receive bounded retries; daily exhaustion opens a
circuit breaker until the next US Pacific midnight instead of being resent.

### npm scripts

```bash
npm run dev               # Vite development server with HMR
npm run build             # Type-check with tsc, then build for production
npm run preview           # Preview the production build
npm run lint              # Run ESLint
npm run test              # Run the Vitest suite once
npm run fetch-transcripts # Refresh bundled show transcripts
```

The root `Makefile` exposes equivalent Web targets (`make install`, `make dev`, `make build`, `make lint`, `make web-test`, and `make preview`), aggregate setup/test targets, the exam-image crop utility, and all desktop workflows. Run `make help` for the complete list.

## Compute and speech modes

Reader settings separate three concerns:

- **PDF text parsing:** browser-side `react-pdf` extraction or backend extraction.
- **Speech:** the browser's system voices or backend AI speech.
- **Compute location:** `auto` uses the desktop sidecar when it is available and otherwise the cloud API; `local` requires the sidecar; `cloud` skips local detection.

The Web settings currently expose Piper, Kokoro, and Edge as backend TTS engines. Edge is available only through the desktop sidecar and requires network access.

## Desktop companion

[`desktop/`](desktop/) is a separate Python project managed by [uv](https://docs.astral.sh/uv/). It provides a macOS menu-bar shell plus a loopback FastAPI sidecar for local PDF extraction, remote URL proxying, OIKID booking records, and three TTS endpoints:

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
├── public/
│   ├── exams/                    # Question PDFs and runtime-cached figures
│   └── transcripts/              # Bundled show transcript JSON
├── scripts/                      # Transcript, exam-image, and game-audio utilities
├── src/
│   ├── assets/                   # Travel and game artwork/audio
│   ├── components/
│   │   ├── AudioUploads/         # Audio library
│   │   ├── Auth/                 # Google sign-in UI
│   │   ├── ExamPractice/         # Subject papers, quizzes, and results
│   │   ├── Game/                 # Word Adventure
│   │   ├── LittleGames/          # Gacha and browser games
│   │   ├── PdfReader/            # PDF viewer, selection, and lookup panels
│   │   ├── SentencePractice/     # English speech collections
│   │   ├── ShowSubtitles/        # Season/episode transcript reader
│   │   ├── SpeechPractice/       # Script generation and recordings
│   │   ├── TravelEnglish/        # Topics, phrases, and missions
│   │   ├── Vocabulary/           # Vocabulary book and review
│   │   └── common/               # Shared UI primitives
│   ├── constants/                # API paths and static constants
│   ├── contexts/                 # Auth, PDF, Settings, Speech, and Theme state
│   ├── data/                     # Exam data and travel scenes/topics
│   ├── hooks/                    # Feature and state hooks
│   ├── services/                 # Firebase, AI, Supabase, backend, and domain services
│   ├── types/                    # Shared TypeScript models
│   ├── utils/                    # Firebase/Supabase clients and utilities
│   ├── App.tsx                   # Auth boundary, responsive shell, and routes
│   ├── main.tsx                  # Application entry point
│   └── index.css                 # Tailwind, DaisyUI themes, and design tokens
├── desktop/                      # Optional PySide6 + FastAPI macOS companion
├── tests/                        # Additional data/utility tests
├── Makefile                      # Unified Web and desktop task runner
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

For desktop changes, also run `make desktop-test`. `make test` runs both Web and desktop suites.

The production build is served from `dist/`. `firebase.json` configures an SPA rewrite to `index.html`, immutable caching for hashed assets, and no-cache headers for the service worker and HTML entry point. GitHub Actions builds Firebase Hosting preview channels for pull requests and deploys the `master` branch to the live channel.

## Contributing

Contributions are welcome. Use focused [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `refactor:`, `chore:`), do not commit secrets, and follow the design and code conventions in [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE) © Victor Fu
