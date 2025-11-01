import { initializeApp, getApps } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCTJXoPX-jETXzGDWiLBOsOeKbbxOwTLgw",
  authDomain: "ollie-reader.firebaseapp.com",
  projectId: "ollie-reader",
  storageBucket: "ollie-reader.firebasestorage.app",
  messagingSenderId: "661338251359",
  appId: "1:661338251359:web:be5728533245203a18fbea",
};
let firebaseApp: FirebaseApp;

if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);

  if (import.meta.env.DEV) {
    console.log("Enabling Firebase App Check debug mode");
    // @ts-expect-error app-check debug token
    self.FIREBASE_APPCHECK_DEBUG_TOKEN =
      import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN || true;
  }

  // Pass your reCAPTCHA v3 site key (public key) to activate(). Make sure this
  // key is the counterpart to the secret key you set in the Firebase console.
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(
      "6LeIcfcrAAAAADXSRFIyoJFyVwlPbw-xRfgQgcQR",
    ),
    isTokenAutoRefreshEnabled: true,
  });
} else {
  firebaseApp = getApps()[0];
}

export const auth = getAuth(firebaseApp);

export const db = getFirestore(firebaseApp);

// Initialize the Gemini Developer API backend service
const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

// Create a GenerativeModel instance
export const geminiModel = getGenerativeModel(ai, {
  model: "gemini-2.5-flash",
});
