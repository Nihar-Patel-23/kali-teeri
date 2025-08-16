// firebase.js (CDN modules + anonymous auth)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getDatabase, ref, onValue, set, update, get, child, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDNKd-6bqLTJ6xm_6MWdMOlc7SeUTxoitQ",
  authDomain: "kaali-teeri-56002.firebaseapp.com",
  databaseURL: "https://kaali-teeri-56002-default-rtdb.firebaseio.com",
  projectId: "kaali-teeri-56002",
  storageBucket: "kaali-teeri-56002.appspot.com", // <- typical value; use what Firebase shows
  messagingSenderId: "730464476936",
  appId: "1:730464476936:web:c04f447e9a3d20908c96bd",
  measurementId: "G-8YLVXSMW1F"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// sign in anonymously so rules with `auth != null` work
export const auth = getAuth(app);
signInAnonymously(auth).catch(e => console.error("Anon auth failed:", e));

// re-export DB helpers because app.js imports them from here
export { ref, onValue, set, update, get, child, serverTimestamp };

