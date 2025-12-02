# Repository Guidelines for Agents

This document is intended for AI coding agents to understand the project's architecture, patterns, and current state.

<last_updated>2025-12-02T04:54:21.323Z</last_updated>

## Project Overview
**Ollie Reader** is a modern web application built with React 19, TypeScript, and Vite, designed for English learning (PDF reading, vocabulary building, speech practice, games). It uses Firebase for backend services (Auth, Firestore, Storage) and Gemini AI for content generation.

## Key Architectural Patterns

### 1. State Management
- **Context API**: Used for global state like Authentication (`AuthContext`), PDF state (`PdfContext`), Speech settings (`SpeechContext`), and App Settings (`SettingsContext`).
- **Custom Hooks**: Logic is encapsulated in `src/hooks/`.
  - `useVocabulary`: Manages vocabulary CRUD, pagination, review modes, and AI generation.
  - `useSpeechState`: Abstraction over `SpeechContext`.
  - `usePronunciation`: Wrapper around Web Speech API for speech recognition.
  - `useAudioUploads`: Manages audio file uploads and playback state.
  - `useChat`: Manages AI chat sessions with PDF context.
  - `useAdventure`, `useMagicBattle`: Game state management.

### 2. UI/UX Patterns
- **Styling**: Tailwind CSS with DaisyUI components.
- **Animations**: `framer-motion` is used for layout transitions (e.g., list reordering, modal entry) and micro-interactions (e.g., confetti).
- **Components**:
  - Functional components with strict TypeScript typing.
  - **Glassmorphism**: Used in cards and overlays (backdrop-blur).
  - **Infinite Scroll**: Implemented in `VocabularyBook` using IntersectionObserver. *Note: Do not use global loading state for single-item updates to avoid full re-renders.*

### 3. Services Layer (`src/services/`)
- **aiService.ts**: Centralized Gemini AI interactions (word details, translations, chat sessions, game words).
- **vocabularyService.ts**: Firestore CRUD for vocabulary, review selection (smart/tag-based), tag management.
- **audioUploadService.ts**, **audioStorageService.ts**: Audio file management.
- **speechPracticeService.ts**, **sentencePracticeService.ts**: Practice session data.
- **gameService.ts**, **gameProgressService.ts**: Game data and progress tracking.

### 4. Utilities (`src/utils/`)
- **logger.ts**: Centralized logging utility; auto-disables debug logs in production.
- **textUtils.ts**: Text manipulation functions (e.g., `cleanText` for pronunciation matching).
- **firebaseUtil.ts**: Firebase initialization and Gemini AI model setup.
- **arrayUtils.ts**: Array helpers (e.g., `shuffleArray`).

### 5. Feature Implementation Details

#### Vocabulary System (`src/components/Vocabulary/`)
- **Data Model**: `VocabularyWord` includes `emoji`, `phonetic`, `definitions`, `tags`, `reviewCount`, `forgotCount`, `rememberedCount`.
- **AI Integration**: Gemini AI generates definitions, examples, phonetics, and selects relevant Emojis via `aiService.ts`.
- **Review Modes** (`ReviewMode` type):
  - `smart`: Priority-based selection (forgotten words, not recently reviewed).
  - `tag`: All words with a specific tag.
- **Tag System**: 
  - Tags stored as array on each word.
  - `getUserTags()` fetches all unique tags efficiently (direct Firestore query).
  - Tag suggestions shown when editing (filters existing tags).
- **Flashcard Mode** (`FlashcardMode.tsx`):
  - Full-screen review interface with large word display.
  - **Pronunciation Coach**: Uses Web Speech API to verify spoken words.
  - **Visual Feedback**: Confetti animation on correct pronunciation.
  - **Auto-play**: Speaks all words sequentially.
- **List View** (`VocabularyBook.tsx`):
  - **VocabularyCard**: Compact design with hover effects, emoji, play button.
  - **Infinite Scroll**: Uses IntersectionObserver for efficient pagination.
  - **Word Detail Modal**: Edit tags (with suggestions), difficulty, view definitions.

#### Audio System (`src/components/AudioUploads/`)
- **Playback**: Custom audio player controls.
- **State Handling**: Separates `activeId` (player visible) from `isPlaying` (audio running).
- **Event Propagation**: `stopPropagation` on player controls to prevent bubbling.

#### Game System (`src/components/Game/`)
- **Spirit Adventure**: RPG-style vocabulary game with battles.
- **AI Word Generation**: Uses `generateGameWords()` from `aiService.ts`.

## Project Structure & Module Organization
```
src/
├── components/          # React UI components
│   ├── AudioUploads/    # Audio library feature
│   ├── Auth/            # Authentication screens
│   ├── Game/            # Vocabulary games
│   ├── PdfReader/       # PDF viewer & chat
│   ├── SentencePractice/ # Sentence practice
│   ├── Settings/        # App settings
│   ├── SpeechPractice/  # Speech practice
│   ├── Vocabulary/      # Vocabulary book, flashcards, review
│   ├── common/          # Shared UI (Toast, ConfirmModal, etc.)
│   └── icons/           # Icon components
├── contexts/            # React Context providers
├── hooks/               # Custom React hooks
├── services/            # Firebase & API services
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
├── App.tsx              # Main app component
├── main.tsx             # Entry point
└── index.css            # Global styles
```

## Build, Test, and Development Commands
- `npm install` installs dependencies; run it anytime `package.json` changes.
- `npm run dev` starts the Vite dev server with hot reloading at `http://localhost:5173/`.
- `npm run build` type-checks (`tsc -b`) and compiles the production bundle.
- `npm run preview` serves the latest build for smoke-testing before deploying.
- `npm run lint` runs ESLint using `eslint.config.js`; keep a clean lint pass before opening a PR.

## Coding Style & Naming Conventions
- Follow TypeScript strictness; define interfaces/types in `src/types/` and import rather than inlining large shapes.
- Prefer functional React components. Component files are `PascalCase.tsx`; hooks use the `useName.ts` pattern. Shared utilities stay `camelCase.ts`.
- Use Tailwind utility classes in JSX; avoid ad-hoc inline styles unless absolutely necessary.
- ESLint enforces React hooks rules and general style. Format imports and spacing to satisfy the linter; default indentation is two spaces.
- Use `logger` from `src/utils/logger.ts` instead of direct `console.log` calls.

## Performance Considerations
- **Avoid global loading state for item updates**: When updating/deleting single items, don't set global `loading` state as it triggers full page re-renders.
- **Use IntersectionObserver**: For infinite scroll instead of scroll event listeners.
- **Memoize expensive computations**: Use `useMemo` for computed values like word groupings.
- **Efficient tag queries**: `getUserTags()` queries Firestore directly without loading full word objects.

## Testing Guidelines
- Automated tests are not yet scaffolded. When adding them, adopt Vitest + React Testing Library to align with the Vite toolchain.
- Co-locate specs as `ComponentName.test.tsx` next to the component or in `src/__tests__/`. Mock Firebase services via the modular SDK to keep tests deterministic.
- Target high-risk flows first: document rendering, authentication, Firestore reads, and Gemini AI integration. Always run `npm run lint` and the full test suite locally before pushing.

## Commit & Pull Request Guidelines
- Match the existing Conventional Commit style: `feat: …`, `fix: …`, `refactor: …`, etc., using imperative, 72-character summaries when possible.
- Each commit should remain focused on one logical change; include TypeScript fixes with the feature or bug they support.
- For PRs, add a concise summary, link the related issue, and attach UI screenshots or screen recordings for visible changes.
- Confirm Firebase configuration updates in `firebase.json` and document new environment variables in the PR description. Request review from a maintainer before merging.

## Configuration & Environment
- Runtime secrets must be provided via Vite environment variables (`.env.local`) prefixed with `VITE_` (e.g., `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN`). Never commit private keys.
- Update `firebaseUtil.ts` if Firebase projects change, and coordinate App Check keys with the Firebase Console.
- Tailwind, PostCSS, and Vite configs live at the repo root; keep changes incremental and justified in PR descriptions.
