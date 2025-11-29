import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./utils/pdfConfig"; // Initialize PDF.js before app renders
import App from "./App.tsx";
import { AuthProvider } from "./contexts/auth";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
