const firebaseConfig = {
  apiKey: "AIzaSyAnwfcKCVB35c4ReExi3KK1fH2b3hPeJSE",
  authDomain: "auraengineonline.firebaseapp.com",
  projectId: "auraengineonline",
  storageBucket: "auraengineonline.firebasestorage.app",
  messagingSenderId: "433967668454",
  appId: "1:433967688454:web:1011b44105de083d68c87",
  measurementId: "G-4C30YKMBZR"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
// Storage НЕ ИСПОЛЬЗУЕМ, только Firestore
