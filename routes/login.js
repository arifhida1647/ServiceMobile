const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBR1mhSW0Mz6_-7Q2N48j3WN75jVIOXV_4",
  authDomain: "ta-mobile-afc3d.firebaseapp.com",
  projectId: "ta-mobile-afc3d",
  storageBucket: "ta-mobile-afc3d.appspot.com",
  messagingSenderId: "1097896477881",
  appId: "1:1097896477881:web:e76d0e8c4532a6e0a6c768",
  measurementId: "G-82S4119HG8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();

// Fungsi untuk login dengan email dan password
async function loginUserWithEmailAndPassword(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('Login berhasil!', user);
    return "berhasil";
  } catch (error) {
    console.error('Login gagal:', error);
    throw error;
  }
}

module.exports = { loginUserWithEmailAndPassword };
