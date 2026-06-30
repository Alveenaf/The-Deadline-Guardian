import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc,
  updateDoc
} from "firebase/firestore";

// Config parsed from firebase-applet-config.json
const firebaseConfig = {
  projectId: "ambient-chimera-6n56p",
  appId: "1:549149911253:web:97f39020f1003b2fba1a5c",
  apiKey: "AIzaSyBmNzrz19NpmXs4YGE_FUNxAeVgZnG5BzQ",
  authDomain: "ambient-chimera-6n56p.firebaseapp.com",
  databaseId: "ai-studio-thedeadlineguard-dc341e73-ee24-4ef5-9480-5d02d161c6c9", // Firestore custom database ID
  storageBucket: "ambient-chimera-6n56p.firebasestorage.app",
  messagingSenderId: "549149911253"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth & Firestore
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.databaseId);

export const googleProvider = new GoogleAuthProvider();

export { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  updateDoc
};
