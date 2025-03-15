// Import Firebase Modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import firebaseConfig from './config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// const firebaseConfig = {
//     apiKey: window.VITE_FIREBASE_API_KEY,
//     authDomain: window.VITE_FIREBASE_AUTH_DOMAIN,
//     projectId: window.VITE_FIREBASE_PROJECT_ID,
//     storageBucket: window.VITE_FIREBASE_STORAGE_BUCKET,
//     messagingSenderId: window.VITE_FIREBASE_MESSAGING_SENDER_ID,
//     appId: window.VITE_FIREBASE_APP_ID
//   };
  
//   const app = initializeApp(firebaseConfig);
//   export const auth = getAuth(app);
  

// 🔹 Protect Dashboard Page
onAuthStateChanged(auth, (user) => {
  if (!user && window.location.pathname === '/dashboard.html') {
    window.location.href = "index.html"; // Redirect to Login Page
  }
});

// 🔹 Logout Function
window.logout = function() {
  signOut(auth)
    .then(() => {
      alert("Logged Out!");
      window.location.href = "index.html"; // Redirect to Login Page
    })
    .catch(error => {
      alert(error.message);
    });
}
