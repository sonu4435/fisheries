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
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0]
const auth = getAuth(app)

export function getRecaptchaVerifier(containerId = "recaptcha-container") {
  // Clear any existing verifier first
  const existingVerifier = window.recaptchaVerifier
  if (existingVerifier) {
    existingVerifier.clear()
  }

  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
  })

  window.recaptchaVerifier = verifier
  return verifier
}

export function clearRecaptchaVerifier() {
  if (window.recaptchaVerifier) {
    window.recaptchaVerifier.clear()
    window.recaptchaVerifier = null
  }
}

export async function sendOtpToPhone(phone) {
  try {
    const verifier = getRecaptchaVerifier()
    const result = await signInWithPhoneNumber(auth, phone, verifier)
    return result
  } catch (error) {
    console.error("Firebase OTP Error:", error)
    clearRecaptchaVerifier()
    throw error
  }
}