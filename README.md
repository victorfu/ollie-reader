<div align="center">

<img src="public/icon-512x512.png" alt="Ollie Reader" width="120" height="120" />

# Ollie Reader

**An AI-powered English learning platform — read, listen, speak, and play your way to fluency.**

Read PDFs and show subtitles, build a smart vocabulary book, rehearse travel phrases and speeches, and battle through vocabulary games — all in one fast, installable web app, with an optional fully-offline desktop companion.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white&style=flat-square)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)](https://tailwindcss.com)
[![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase&logoColor=black&style=flat-square)](https://firebase.google.com)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white&style=flat-square)](https://web.dev/progressive-web-apps/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

</div>

---

## ✨ Overview

Ollie Reader is a responsive web application that turns everyday reading material into an English-learning workspace. Select any word to get an instant AI definition, save it to a spaced-repetition vocabulary book, practice pronunciation with live speech feedback, and reinforce what you learn through games. The interface follows macOS Human Interface Guidelines (translucent "glass" surfaces, hairline borders, fluid motion) and installs as a PWA for offline use.

It is designed for Chinese-speaking learners of English, so AI content (definitions, translations, examples) is bilingual.

## 🚀 Features

| | Feature | What it does |
|---|---|---|
| 📖 | **PDF Reader** (閱讀器) | Smooth `react-pdf` viewing with a text-selection toolbar — look up words, translate sentences, hear them spoken, or add them to your vocabulary. A floating AI panel returns definitions and translations via Gemini. |
| 📚 | **Smart Vocabulary Book** (生詞本) | Spaced-repetition flashcards with flip animations, auto-generated definitions / examples / phonetics, emoji memory hooks, custom tags, and an AI pronunciation coach powered by the Web Speech API. |
| 🌍 | **Travel English** (旅遊英文) | Scene-based learning across a Singapore journey (airport → flight → arrival → city & Mandai wildlife) with phrases, full bilingual dialogues, practice modes, TTS playback, and passport-style missions to track progress. |
| 🎤 | **Speech Practice** (演講練習) | Pick a topic, generate an AI practice script, then record yourself with a synchronized timer (start / pause / resume / stop). History is saved to Firebase with playback. |
| 📝 | **Sentence Practice** (英文演講) | AI-parsed, translated sentences with drag-to-reorder, tap-any-word definitions, and per-sentence TTS. |
| 📺 | **Show Subtitles** (影集字幕) | Browse shows by season and episode and read along with transcripts, using the same lookup / translate / speak / save toolbar as the reader. |
| 🎵 | **Audio Library** (音訊庫) | Upload, organize, and play audio learning materials via Firebase Storage. |
| 🎮 | **Word Adventure** (單字大冒險) | An RPG-style quiz battler that drills words from your own vocabulary book — clear stages, earn gacha tokens, unlock achievements, and spend tokens in the Popular Character Gacha. |
| 🕹️ | **Little Games** (小遊戲) | A hub of quick arcade games — Bunny Jumper, Meteor Glider, and Mushroom Adventure. |
| 🖥️ | **Desktop Companion** | An optional native macOS app that runs a local sidecar for **fully-offline** text-to-speech (Piper + Kokoro via ONNX Runtime — no cloud, no API key). See [Desktop App](#-desktop-app-optional). |

## 🛠️ Tech Stack

- **[React 19](https://react.dev)** + **[React Router 7](https://reactrouter.com)** + **[TypeScript](https://www.typescriptlang.org)** (strict)
- **[Vite 7](https://vite.dev)** build tooling with **[vite-plugin-pwa](https://vite-pwa-org.netlify.app)**
- **[Tailwind CSS v4](https://tailwindcss.com)** + **[DaisyUI 5](https://daisyui.com)** (macOS-style design system, OKLCH tokens)
- **[Framer Motion](https://www.framer.com/motion/)** for animation
- **[Firebase 12](https://firebase.google.com)** — Auth (Google sign-in), Firestore, Storage
- **[Gemini AI](https://ai.google.dev)** for content generation
- **[react-pdf](https://github.com/wojtekmaj/react-pdf)** for in-browser PDF rendering
- **Web Speech API** for recognition & synthesis
- **Desktop sidecar:** Python • PySide6 • FastAPI • PyInstaller (see [`desktop/`](desktop/))

## 🏁 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- A **Firebase** project and a **Gemini API** key (for AI features)

### Install & run

```bash
npm install        # install dependencies
npm run dev        # start the dev server at http://localhost:5173
```

Create a `.env.local` from the example and fill in your keys:

```bash
cp .env.example .env.local
```

### Scripts

```bash
npm run dev        # Vite dev server (HMR)
npm run build      # type-check (tsc -b) + production build
npm run preview    # preview the production build
npm run lint       # ESLint
```

## 🖥️ Desktop App (optional)

A native macOS companion (in [`desktop/`](desktop/)) runs a local **FastAPI sidecar** so text-to-speech works **completely offline** — Piper and Kokoro voices run on ONNX Runtime with the models bundled in, no network and no PyTorch required. It ships as a PySide6 menu-bar (tray) app.

Managed with [`uv`](https://docs.astral.sh/uv/); a root `Makefile` is the unified task runner:

```bash
make desktop-setup   # create the venv and install deps (uv)
make desktop-run     # run the PySide6 tray shell (manages the sidecar)
make desktop-test    # run the desktop test suite
make desktop-dmg     # build a signed + notarized .dmg (needs Apple credentials)
make desktop-release # publish the .dmg to GitHub Releases
```

> The packaged build is **Apple Silicon (arm64)**, code-signed and notarized. See [`desktop/README.md`](desktop/README.md) for details.

## 📁 Project Structure

```
ollie-reader/
├── public/                  # PWA icons, manifest, transcripts
├── scripts/                 # fetch-transcripts utility
├── src/
│   ├── components/          # React components, by feature
│   │   ├── AudioUploads/        # Audio library
│   │   ├── Auth/                # Authentication screens
│   │   ├── Game/                # Word Adventure
│   │   ├── LittleGames/         # Bunny Jumper, Meteor Glider, Mushroom Adventure
│   │   ├── PdfReader/           # PDF viewer & AI lookup panel
│   │   ├── SentencePractice/    # Sentence practice
│   │   ├── SentenceTranslation/ # Sentence translation book
│   │   ├── Settings/            # App settings
│   │   ├── ShowSubtitles/       # Show subtitle viewer
│   │   ├── SpeechPractice/      # Speech practice
│   │   ├── TravelEnglish/       # Travel English scenes & missions
│   │   ├── Vocabulary/          # Vocabulary book & flashcards
│   │   ├── common/              # Shared UI
│   │   └── icons/               # Icon components
│   ├── constants/           # API endpoints & config
│   ├── contexts/            # React Context providers (Auth, PDF, Speech, Settings)
│   ├── data/                # Static data (travel scenes, topics)
│   ├── hooks/               # Custom React hooks
│   ├── services/            # Firebase & API services
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utilities
│   ├── App.tsx              # Routes
│   ├── main.tsx             # Entry point
│   └── index.css            # Tailwind + design tokens & themes
├── desktop/                 # Optional macOS app: PySide6 tray + FastAPI sidecar
├── Makefile                 # Unified task runner (web + desktop)
├── vite.config.ts           # Vite + PWA configuration
├── firebase.json            # Firebase hosting
└── AGENTS.md                # Guidelines for AI coding agents (CLAUDE.md → symlink)
```

## 🎨 Highlights

- ⚡️ Lightning-fast HMR and lazy-loaded, code-split routes
- 🎨 macOS-style design system (Tailwind v4 + DaisyUI 5, OKLCH tokens, glass surfaces)
- 🌗 Light & dark themes
- 📱 Mobile-first responsive layout with PWA install / offline support
- 🤖 AI-powered learning throughout (Gemini)
- 🔊 Offline TTS option via the desktop sidecar
- 🧩 Type-safe, component-based architecture (TypeScript strict)

## 🤝 Contributing

Contributions are welcome! Please use [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `refactor:`, `chore:`) and keep changes focused. Run `npm run lint` and `npm run build` before opening a pull request. See [AGENTS.md](AGENTS.md) for the design system and code conventions.

## 📄 License

[MIT](LICENSE) © Victor Fu
