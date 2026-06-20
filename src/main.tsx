import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./utils/pdfConfig"; // Initialize PDF.js before app renders
import App from "./App.tsx";
import { AuthProvider } from "./contexts/auth";
import { reloadOnceForStaleChunk } from "./utils/lazyWithReload";
import { registerPwa } from "./utils/registerPwa";

// Vite fires this when a module preload fails (e.g. a hashed chunk removed by a
// deploy). Reload once to pick up the latest build before the user hits an
// error screen.
window.addEventListener("vite:preloadError", () => {
  reloadOnceForStaleChunk();
});

// Keep every open tab on the latest deploy: detect new builds and auto-reload.
registerPwa();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
