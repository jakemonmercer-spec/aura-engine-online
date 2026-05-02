// firebase-config.js
// Используем COMPAT-версию (без import, только глобальные переменные)

const firebaseConfig = {
  apiKey: "AIzaSyAnwfcKCVB35c4ReExi3KK1fH2b3hPeJSE",
  authDomain: "auraengineonline.firebaseapp.com",
  projectId: "auraengineonline",
  storageBucket: "auraengineonline.firebasestorage.app",
  messagingSenderId: "433967668454",
  appId: "1:433967688454:web:1011b44105de083d68c87",
  measurementId: "G-4C30YKMBZR"
};

// Инициализация Firebase (глобальные объекты firebase, firebase.firestore)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

console.log("✅ Firebase подключён, db и storage доступны");
