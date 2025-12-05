// src/components/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, serverTimestamp } from "firebase/firestore";
import { getStorage, ref as storageRef } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBZHtlpel5zdBEz8PMzSA2Aqp0szpfqnfw",
  authDomain: "drive-76237.firebaseapp.com",
  projectId: "drive-76237",
  storageBucket: "drive-76237.firebasestorage.app",
  messagingSenderId: "416031778110",
  appId: "1:416031778110:web:416f0a30cb73a6eeb9b86f",
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