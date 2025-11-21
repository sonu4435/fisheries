// lib/firebaseClient.js
import { initializeApp, getApps } from "firebase/app"
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth"

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
}

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const auth = getAuth(app);

// Global recaptcha verifier instance
let recaptchaVerifier = null;

export function getRecaptchaVerifier(containerId = "recaptcha-container") {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: (response) => {
        console.log("reCAPTCHA solved", response);
      },
    });
    
    // Render the recaptcha
    recaptchaVerifier.render().catch((error) => {
      console.error("reCAPTCHA render error:", error);
    });
  }
  
  return recaptchaVerifier;
}

export function clearRecaptchaVerifier() {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
}

export async function sendOtpToPhone(phone) {
  try {
    // Get or create recaptcha verifier
    const verifier = getRecaptchaVerifier();
    
    const result = await signInWithPhoneNumber(auth, phone, verifier);
    return result;
  } catch (error) {
    console.error("Error in sendOtpToPhone:", error);
    
    // Clear recaptcha on error to allow retry
    if (error.code === 'auth/internal-error' || error.code === 'auth/captcha-check-failed') {
      clearRecaptchaVerifier();
    }
    
    throw error;
  }
}