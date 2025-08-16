// Firebase SDK (modular) + Anonymous Auth sign-in
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getDatabase, ref, onValue, set, update, get, child, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

// Your Firebase config (from the Firebase console)
const firebaseConfig = {
  apiKey: "AIzaSyDNKd-6bqLTJ6xm_6MWdMOlc7SEuTxoitQ",
  authDomain: "kaali-teeri-56002.firebaseapp.com",
  databaseURL: "https://kaali-teeri-56002-default-rtdb.firebaseio.com",
  projectId: "kaali-teeri-56002",
  storageBucket: "kaali-teeri-56002.firebasestorage.app",
  messagingSenderId: "730464476936",
  appId: "1:730464476936:web:c84f447e9a3d20908c96bd",
  measurementId: "G-8YLVXSMW1F"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Anonymous Auth (so DB rules can require auth != null)
export const auth = getAuth(app);
signInAnonymously(auth).catch((err) => {
  console.error("Anonymous sign-in failed:", err?.code || err);
});

// Re-export DB helpers for app.js
export { ref, onValue, set, update, get, child, serverTimestamp };
```js
// Paste your Firebase config and keep exports the same API as below.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getDatabase, ref, onValue, set, update, get, child, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_APP.firebaseapp.com",
  databaseURL: "https://YOUR_APP-default-rtdb.firebaseio.com",
  projectId: "YOUR_APP",
  storageBucket: "YOUR_APP.appspot.com",
  messagingSenderId: "YOUR_ID",
  appId: "YOUR_ID"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, onValue, set, update, get, child, serverTimestamp };