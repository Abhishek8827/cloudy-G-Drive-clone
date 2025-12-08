// src/components/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, serverTimestamp } from "firebase/firestore";
import { getStorage, ref as storageRef } from "firebase/storage";

const firebaseConfig = {
  apiKey: "FIREBASE_API",
  authDomain: "DOMAIN",
  projectId: "DRIVE_ID",
  storageBucket: "BUCKET_ID",
  messagingSenderId: "MESSAGE ID",
  appId: "APP_ID",
};

const app = initializeApp(firebaseConfig);

// Auth
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Firestore
const db = getFirestore(app);

// Storage
const storage = getStorage(app);

export {
  app,
  auth,
  provider,
  signInWithPopup,
  signOut,
  db,
  storage,
  serverTimestamp,
  storageRef,
};
