# Repository Guidelines

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
