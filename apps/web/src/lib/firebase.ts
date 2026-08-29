"use client";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type Auth,
} from "firebase/auth";

let authInstance: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  if (process.env.NEXT_PUBLIC_LOCAL_AUTH_BYPASS === "true") {
    return null;
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!apiKey || !authDomain || !projectId) {
    throw new Error("Firebase authentication is not configured.");
  }

  if (authInstance) {
    return authInstance;
  }

  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          apiKey,
          authDomain,
          projectId,
        });

  authInstance = getAuth(app);
  return authInstance;
}

export async function googleLogin() {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export { signOut };
