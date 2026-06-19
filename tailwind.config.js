/** @type {import('tailwindcss').Config} */
// Tailwind v4 + DaisyUI v5. Design tokens, theme colours, the `dark` variant and
// custom utilities are all defined in `src/index.css` (via `@theme`, `@plugin
// "daisyui/theme"` and `@custom-variant`). This file only declares content sources.
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
};
