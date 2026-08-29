"use client";import { initializeApp,getApps } from "firebase/app";import { getAuth,GoogleAuthProvider,signInWithPopup,signOut } from "firebase/auth";
const config={apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID};
const app=getApps()[0]||initializeApp(config);export const auth=getAuth(app);export const googleProvider=new GoogleAuthProvider();export async function googleLogin(){return signInWithPopup(auth,googleProvider)}export{signOut};
