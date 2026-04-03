import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCwIoCN1OAF_Op3W8yuwrcOR3MsHdK47m4",
  authDomain: "mohanbalaji-track.firebaseapp.com",
  projectId: "mohanbalaji-track",
  storageBucket: "mohanbalaji-track.firebasestorage.app",
  messagingSenderId: "579258230088",
  appId: "1:579258230088:web:a8a3dfe863a0a95dd23f7d"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
