# Ollie Reader

A modern English learning web application built with Vite, React, TypeScript, and Tailwind CSS.

## Tech Stack

- **Vite 7** - Next generation frontend tooling
- **React 19** - A JavaScript library for building user interfaces
- **TypeScript** - JavaScript with syntax for types
- **Tailwind CSS v4 + DaisyUI 5** - Utility-first CSS framework with component library
- **Firebase 12** - Backend-as-a-Service (Auth, Firestore, Storage)
- **Gemini AI** - AI-powered content generation
- **Framer Motion** - Production-ready motion library for React
- **Web Speech API** - Native browser speech recognition and synthesis
- **react-pdf** - PDF rendering in the browser

## Features

### 📖 PDF Reader (閱讀器)
- **Document Reading**: Smooth PDF viewing experience with `react-pdf`
- **Text Selection Toolbar**: Select text to look up words, translate, speak, or add to vocabulary
- **AI Lookup**: Floating panel for word definitions and sentence translation via Gemini AI
- **Session Caching**: In-memory PDF session caching for fast page navigation

### 📚 Smart Vocabulary Book (生詞本)
- **Flashcard Review Mode**: Interactive cards with flip animations for effective memorization
- **Smart Review**: Prioritizes words you've forgotten or haven't reviewed recently
- **Tag-based Review**: Practice all words with a specific tag
- **AI Pronunciation Coach**: Practice speaking with real-time feedback using Web Speech API
- **Visual Memory**: AI automatically assigns relevant emojis to words for better retention
- **Tag System**: Organize words with custom tags, quick tag suggestions from existing tags
- **Infinite Scroll**: Glassmorphism design with smooth infinite scroll
- **Smart Dictionary**: Auto-generated definitions, examples, phonetics via Gemini AI
- **Sentence Translations**: Integrated sentence translation book within vocabulary

### 🌍 Travel English (旅遊英文)
- **Scene-based Learning**: 13 real-world travel scenes across two groups
  - **General Singapore** (7 scenes): Airport & Flying, Hotel, Food & Hawker Centre, Getting Around, Attractions & Fun, Shopping, Asking for Help
  - **Mandai Wildlife Reserve** (6 scenes): Singapore Zoo, Night Safari, River Wonders, Bird Paradise, Rainforest Wild ASIA, and more
- **Three Learning Modes per Scene**: Phrases, Dialogues, Practice
- **TTS Playback**: Text-to-speech for all phrases and dialogue lines
- **Rich Content**: Vocabulary with Chinese translations, phonetics, emoji associations, example sentences, situational phrase tags, and full bilingual dialogues

### 🎤 Speech Practice (演講練習)
- **Topic Selection**: Choose from various topics to practice speaking
- **AI Script Generator**: Generate practice scripts based on topics via Gemini AI
- **Recording & Timer**: Synchronized timer + audio recording with start/pause/resume/stop
- **Script Reference**: Collapsible script panel during practice
- **Practice Notes**: Add notes to each practice session
- **History**: Firebase-persisted practice history with playback

### 📝 Sentence Practice (英文演講)
- **AI Translation**: Sentences parsed and translated by Gemini AI
- **Drag-to-Reorder**: Framer Motion powered sentence reordering
- **Clickable Words**: Tap any word for a quick Gemini definition
- **TTS Playback**: Listen to each sentence spoken aloud

### 📺 Show Subtitles (影集字幕)
- **Season & Episode Browser**: Navigate shows by season and episode
- **Transcript Viewer**: Read along with show transcripts
- **Text Selection Toolbar**: Same lookup, translate, speak, and vocabulary tools as the PDF reader

### 🎵 Audio Library (音訊庫)
- **Upload & Manage**: Store and organize audio learning materials via Firebase Storage
- **Playback Control**: Integrated audio player with progress tracking
- **Edit & Delete**: Modal-based management with confirmation dialogs

### 🎮 Spirit Adventure (精靈探險)
- **RPG-style Vocabulary Game**: Quiz battles using words from your vocabulary book
- **Stage Map**: Progressive stage unlocking system
- **Companion Guide**: "小星星" companion character
- **Spirit Collection**: Collect spirits and earn rewards with confetti celebrations
- **Magic Battle**: Spell-based battle mechanic
- **Achievements**: Track progress and accomplishments
- **AI Game Words**: Gemini AI generates grade-appropriate vocabulary challenges

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173/`

### Build

Build the application for production:

```bash
npm run build
```

### Preview

Preview the production build locally:

```bash
npm run preview
```

### Linting

Run ESLint to check for code issues:

```bash
npm run lint
```

## Project Structure

```
ollie-reader/
├── public/
│   ├── transcripts/         # Show subtitle transcript files
│   └── ...                  # PWA icons, manifest
├── scripts/
│   └── fetch-transcripts.mjs # Transcript fetching utility
├── src/
│   ├── assets/              # Images, fonts, etc.
│   ├── components/          # React components (by feature)
│   │   ├── AudioUploads/        # Audio library feature
│   │   ├── Auth/                # Authentication screens
│   │   ├── Game/                # Spirit Adventure game
│   │   ├── PdfReader/           # PDF viewer & lookup panel
│   │   ├── SentencePractice/    # Sentence practice feature
│   │   ├── SentenceTranslation/ # Sentence translation book
│   │   ├── Settings/            # App settings
│   │   ├── ShowSubtitles/       # Show subtitle viewer
│   │   ├── SpeechPractice/      # Speech practice feature
│   │   ├── TravelEnglish/       # Travel English scenes
│   │   ├── Vocabulary/          # Vocabulary book & flashcards
│   │   ├── common/              # Shared UI components
│   │   └── icons/               # Icon components
│   ├── contexts/            # React Context providers
│   ├── data/                # Static data (travel scenes, etc.)
│   ├── hooks/               # Custom React hooks
│   ├── services/            # Firebase & API services
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions
│   ├── App.tsx              # Main app with routes
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles with Tailwind
├── index.html               # HTML entry point
├── package.json             # Project dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── firebase.json            # Firebase hosting configuration
├── CLAUDE.md                # Guidelines for AI coding agents
└── GEMINI.md                # Gemini-specific guidelines
```

## Key Features

- ⚡️ Lightning-fast HMR with Vite
- ⚛️ React 19 with TypeScript strict mode
- 🎨 Tailwind CSS v4 + DaisyUI 5 for modern styling
- 📦 Component-based architecture with lazy code splitting
- 🔧 ESLint for code quality
- 🎯 Type-safe development with TypeScript
- 🤖 AI-powered learning features (Gemini AI)
- 📱 Responsive design for all devices
- 🔄 PWA support for offline usage
- 🔐 Firebase Authentication (email/password, Google sign-in)

## License

See [LICENSE](LICENSE) file for details.
