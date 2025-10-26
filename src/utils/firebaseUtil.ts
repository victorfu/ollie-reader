// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCTJXoPX-jETXzGDWiLBOsOeKbbxOwTLgw",
  authDomain: "ollie-reader.firebaseapp.com",
  projectId: "ollie-reader",
  storageBucket: "ollie-reader.firebasestorage.app",
  messagingSenderId: "661338251359",
  appId: "1:661338251359:web:be5728533245203a18fbea",
};

const firebaseApp = initializeApp(firebaseConfig);

// Initialize the Gemini Developer API backend service
const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

// Create a GenerativeModel instance
export const geminiModel = getGenerativeModel(ai, {
  model: "gemini-2.5-flash",
});
