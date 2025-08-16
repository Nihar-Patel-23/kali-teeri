// Import the functions you need
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue } from "firebase/database";
import { getAuth, signInAnonymously } from "firebase/auth";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDNKd-6bqLTJ6xm_6MWdMOlc7SeUTxoitQ",
  authDomain: "kaali-teeri-56002.firebaseapp.com",
  databaseURL: "https://kaali-teeri-56002-default-rtdb.firebaseio.com",
  projectId: "kaali-teeri-56002",
  storageBucket: "kaali-teeri-56002.firebasestorage.app",  // 👈 This might be wrong, should be "firebasestorage.googleapis.com"
  messagingSenderId: "730464476936",
  appId: "1:730464476936:web:c04f447e9a3d20908c96bd",
  measurementId: "G-8YLVXSMW1F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Database
const db = getDatabase(app);

// Authentication
const auth = getAuth(app);
signInAnonymously(auth)
  .then(() => console.log("Signed in anonymously"))
  .catch((error) => console.error("Auth error:", error));

// Export what the rest of your app needs
export { db, ref, set, get, onValue, auth };
