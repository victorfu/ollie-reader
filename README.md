# ollie-reader

A modern website built with Vite, React, TypeScript, and Tailwind CSS.

## Tech Stack

- **Vite** - Next generation frontend tooling
- **React 19** - A JavaScript library for building user interfaces
- **TypeScript** - JavaScript with syntax for types
- **Tailwind CSS** - A utility-first CSS framework
- **Firebase** - Backend-as-a-Service (Auth, Firestore, Storage)
- **Gemini AI** - AI-powered content generation
- **Framer Motion** - Production-ready motion library for React
- **Web Speech API** - Native browser speech recognition and synthesis

## Features

### 📚 Smart Vocabulary Book (生詞本)
- **Flashcard Review Mode**: Interactive cards with flip animations for effective memorization.
- **AI Pronunciation Coach**: Practice speaking with real-time feedback using Web Speech API.
- **Visual Memory**: AI automatically assigns relevant Emojis 🍎 to words for better retention.
- **Modern UI**: Glassmorphism design, infinite scroll, and smooth transitions.
- **Smart Dictionary**: Auto-generated definitions, examples, and phonetics.

### 🎤 Speech Practice (演講練習)
- **Topic Selection**: Choose from various topics to practice speaking.
- **AI Script Generator**: Generate practice scripts based on topics.
- **Recording & Timer**: Record your speech and track time.
- **History**: Review past practice sessions.

### 🎵 Audio Library (音訊庫)
- **Upload & Manage**: Store and organize audio learning materials.
- **Playback Control**: Integrated audio player with progress tracking.

### 📖 PDF Reader
- **Document Reading**: Smooth PDF viewing experience.
- **Text Selection**: Select text to look up words or add to vocabulary.

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
├── public/          # Static assets
├── src/
│   ├── assets/      # Images, fonts, etc.
│   ├── App.tsx      # Main application component
│   ├── main.tsx     # Application entry point
│   └── index.css    # Global styles with Tailwind directives
├── index.html       # HTML entry point
├── package.json     # Project dependencies and scripts
├── tsconfig.json    # TypeScript configuration
├── vite.config.ts   # Vite configuration
├── tailwind.config.js  # Tailwind CSS configuration
└── postcss.config.js   # PostCSS configuration
```

## Features

- ⚡️ Lightning-fast HMR with Vite
- ⚛️ React 19 with TypeScript support
- 🎨 Tailwind CSS for utility-first styling
- 📦 Component-based architecture
- 🔧 ESLint for code quality
- 🎯 Type-safe development with TypeScript
- 🤖 AI-powered learning features
- 📱 Responsive design for all devices

## License

See [LICENSE](LICENSE) file for details.

