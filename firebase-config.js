import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAA4j72822tDB92kRfzqYfZzw4zTcYFLO0",
  authDomain: "cha-casa-nova-7c90e.firebaseapp.com",
  projectId: "cha-casa-nova-7c90e",
  storageBucket: "cha-casa-nova-7c90e.firebasestorage.app",
  messagingSenderId: "123142626745",
  appId: "1:123142626745:web:c3d58c1683c7810351ea68",
  measurementId: "G-X86E14F9W4"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const ADMIN_UID = "r8nildXd45ZkSPQwATATgPkWTZQ2";
