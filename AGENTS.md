# Repository Guidelines for Agents

This document is intended for AI coding agents to understand the project's architecture, patterns, and current state.

<last_updated>2025-11-29T11:43:23.771Z</last_updated>

## Project Overview
**Ollie Reader** is a modern web application built with React 19, TypeScript, and Vite, designed for English learning (PDF reading, vocabulary building, speech practice). It uses Firebase for backend services (Auth, Firestore, Storage) and Gemini AI for content generation.

## Key Architectural Patterns

### 1. State Management
- **Context API**: Used for global state like Authentication (`AuthContext`), PDF state (`PdfContext`), Speech settings (`SpeechContext`), and App Settings (`SettingsContext`).
- **Custom Hooks**: Logic is encapsulated in `src/hooks/`.
  - `useVocabulary`: Manages vocabulary CRUD, pagination, and AI generation.
  - `useSpeechState`: Abstraction over `SpeechContext`.
  - `usePronunciation`: Wrapper around Web Speech API for speech recognition.
  - `useAudioUploads`: Manages audio file uploads and playback state.

### 2. UI/UX Patterns
- **Styling**: Tailwind CSS with DaisyUI components.
- **Animations**: `framer-motion` is used for layout transitions (e.g., list reordering, modal entry) and micro-interactions (e.g., confetti).
- **Components**:
  - Functional components with strict TypeScript typing.
  - **Glassmorphism**: Used in cards and overlays (backdrop-blur).
  - **Infinite Scroll**: Implemented in `VocabularyBook` using scroll event listeners. *Note: Do not use global loading state for pagination to avoid full re-renders.*

### 3. Feature Implementation Details

#### Vocabulary System (`src/components/Vocabulary/`)
- **Data Model**: `VocabularyWord` includes `emoji` (visual cue), `phonetic`, `definitions`, and `reviewCount`.
- **AI Integration**: Gemini AI generates definitions, examples, phonetics, and selects relevant Emojis upon word addition.
- **Flashcard Mode**:
  - Full-screen review interface.
  - **Pronunciation Coach**: Uses Web Speech API (`SpeechRecognition`) to verify spoken words against the target word (fuzzy matching).
  - **Visual Feedback**: Confetti animation (`canvas-confetti`) on success.
- **List View**:
  - **VocabularyCard**: Compact design with hover effects, direct play button, and emoji display.
  - **Infinite Scroll**: Automatically loads more items when scrolling to the bottom.

#### Audio System (`src/components/AudioUploads/`)
- **Playback**: Custom audio player controls.
- **State Handling**: Separates `activeId` (player visible) from `isPlaying` (audio running) to allow UI interaction (like seeking) without hiding the player.
- **Event Propagation**: `stopPropagation` is crucial on player controls to prevent bubbling to parent containers.

## Project Structure & Module Organization
- `src/` holds the TypeScript application. Use `components/` for UI building blocks, `hooks/` for reusable state logic, `contexts/` for providers, `services/` for Firebase and network calls, `utils/` for shared helpers, and `constants/` for configuration tokens.
- Keep assets like icons and sample documents in `src/assets/`; static files that must ship untouched belong in `public/`. Production builds emit to `dist/`.
- Vite entry points live in `index.html`, `main.tsx`, and `App.tsx`. Tailwind configuration is centralized in `tailwind.config.js` and consumed via `index.css`.

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
