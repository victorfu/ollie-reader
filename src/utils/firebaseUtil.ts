import { initializeApp, getApps } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase project configuration (Auth + Firestore + Gemini share one app)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp;

// Helper to set App Check debug token in development
function setAppCheckDebugToken(token?: string): void {
  if (import.meta.env.DEV && token) {
    // @ts-expect-error app-check debug token
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = token;
  }
}

// Initialize Firebase app
if (!getApps().length) {
  app = initializeApp(firebaseConfig);

  // Set debug token before App Check initialization
  setAppCheckDebugToken(
    import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN || "true",
  );

  // Pass your reCAPTCHA v3 site key (public key) to activate(). Make sure this
  // key is the counterpart to the secret key you set in the Firebase console.
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
} else {
  app = getApps()[0];
}

// Auth, Firestore, and Gemini all use the same app
export const auth = getAuth(app);
export const db = getFirestore(app);

const ai = getAI(app, { backend: new GoogleAIBackend() });

// Create a GenerativeModel instance
export const geminiModel = getGenerativeModel(ai, {
  model: "gemini-2.5-flash",
});
