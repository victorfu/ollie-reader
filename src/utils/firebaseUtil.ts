import { initializeApp, getApps, getApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Primary Firebase project configuration (Auth + Firestore)
const primaryConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// AI Firebase project configuration (Gemini only)
// When set, Gemini uses this separate project; otherwise falls back to primary
const aiConfig = import.meta.env.VITE_FIREBASE_AI_API_KEY
  ? {
      apiKey: import.meta.env.VITE_FIREBASE_AI_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AI_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_AI_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_AI_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_AI_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_AI_APP_ID,
    }
  : null;

const AI_APP_NAME = "dragonfly-o";

let primaryApp: FirebaseApp;
let aiApp: FirebaseApp;

// Helper to set App Check debug token in development
function setAppCheckDebugToken(token?: string): void {
  if (import.meta.env.DEV && token) {
    // @ts-expect-error app-check debug token
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = token;
  }
}

// Initialize primary Firebase app
if (!getApps().length) {
  primaryApp = initializeApp(primaryConfig);

  // Set debug token for primary app before App Check initialization
  setAppCheckDebugToken(
    import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN || "true"
  );

  // Pass your reCAPTCHA v3 site key (public key) to activate(). Make sure this
  // key is the counterpart to the secret key you set in the Firebase console.
  initializeAppCheck(primaryApp, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
} else {
  primaryApp = getApps()[0];
}

// Initialize AI Firebase app (separate project or fallback to primary)
if (aiConfig) {
  try {
    aiApp = getApp(AI_APP_NAME);
  } catch {
    aiApp = initializeApp(aiConfig, AI_APP_NAME);

    // Optional App Check for AI project (uses separate debug token if provided)
    if (import.meta.env.VITE_AI_RECAPTCHA_SITE_KEY) {
      setAppCheckDebugToken(
        import.meta.env.VITE_FIREBASE_AI_APPCHECK_DEBUG_TOKEN ||
          import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN
      );
      initializeAppCheck(aiApp, {
        provider: new ReCaptchaV3Provider(
          import.meta.env.VITE_AI_RECAPTCHA_SITE_KEY
        ),
        isTokenAutoRefreshEnabled: true,
      });
    }
  }
} else {
  // Backward compatibility: use primary app for AI
  aiApp = primaryApp;
}

// Auth and Firestore use primary app
export const auth = getAuth(primaryApp);
export const db = getFirestore(primaryApp);

// Gemini uses AI app (separate or primary)
const ai = getAI(aiApp, { backend: new GoogleAIBackend() });

// Create a GenerativeModel instance
export const geminiModel = getGenerativeModel(ai, {
  model: "gemini-3-flash-preview",
});
