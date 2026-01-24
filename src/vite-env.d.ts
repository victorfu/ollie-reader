/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Primary Firebase project (Auth + Firestore)
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_RECAPTCHA_SITE_KEY: string;
  readonly VITE_FIREBASE_APPCHECK_DEBUG_TOKEN?: string;

  // AI Firebase project (optional - for multi-project setup)
  readonly VITE_FIREBASE_AI_API_KEY?: string;
  readonly VITE_FIREBASE_AI_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_AI_PROJECT_ID?: string;
  readonly VITE_FIREBASE_AI_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_AI_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_AI_APP_ID?: string;
  readonly VITE_AI_RECAPTCHA_SITE_KEY?: string;
  readonly VITE_FIREBASE_AI_APPCHECK_DEBUG_TOKEN?: string;

  // Backend API
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
