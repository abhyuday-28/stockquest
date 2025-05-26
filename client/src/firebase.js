import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "firebase/auth";
import {
  initializeFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  increment,
  serverTimestamp,
  runTransaction,
  persistentLocalCache,
  persistentMultipleTabManager,
  enableMultiTabIndexedDbPersistence
} from "firebase/firestore";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAyce-QVJqivv6NTSE5poQ6qKbsIoofZVU",
  authDomain: "stockquest-11acc.firebaseapp.com",
  projectId: "stockquest-11acc",
  storageBucket: "stockquest-11acc.appspot.com",
  messagingSenderId: "190112338520",
  appId: "1:190112338520:web:4ef2c720dc2a5dbe58b02d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with robust configuration
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Initialize Auth
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Error handling utility
const getFriendlyAuthError = (code) => {
  const errorMap = {
    'auth/popup-closed-by-user': "You closed the sign-in window",
    'auth/network-request-failed': "Network error occurred",
    'auth/user-disabled': "This account is disabled",
    'auth/cancelled-popup-request': "Sign-in process cancelled",
    'auth/popup-blocked': "Popup blocked by browser - allow popups and try again",
    'auth/operation-not-supported': "This operation isn't supported",
    'auth/internal-error': "Internal error - try again later"
  };
  return errorMap[code] || "Sign-in failed. Please try again";
};

// Initialize persistence with error recovery
const initializePersistence = async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    try {
      await enableMultiTabIndexedDbPersistence(db);
    } catch (persistenceError) {
      console.warn("Multi-tab persistence error:", persistenceError);
      // Clear cache if persistence fails
      if (persistenceError.code === 'failed-precondition') {
        console.log("Clearing Firestore cache...");
        await clearIndexedDbPersistence(db);
      }
    }
  } catch (error) {
    console.warn("Persistence initialization warning:", error);
  }
};

// Google Sign-In with robust error handling
const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const walletRef = doc(db, "wallets", result.user.uid);
    
    // Use defensive programming for wallet creation
    try {
      await setDoc(walletRef, {
        balance: 10000,
        currency: "USD",
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      }, { merge: true });
    } catch (walletError) {
      console.warn("Wallet creation warning:", walletError);
      // Continue even if wallet creation fails
    }

    return result.user;
  } catch (error) {
    console.error("Google sign-in failed:", error);
    throw new Error(getFriendlyAuthError(error.code));
  }
};

// Auth observer with error boundary
const initAuthStateObserver = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    try {
      callback(user);
    } catch (observerError) {
      console.error("Auth observer error:", observerError);
      callback(null);
    }
  });
};

// Helper to clear persistence (if needed)
const clearIndexedDbPersistence = async (db) => {
  try {
    await db.clearPersistence();
    console.log("Firestore persistence cleared successfully");
  } catch (clearError) {
    console.error("Failed to clear persistence:", clearError);
  }
};

// Initialize the app
(async () => {
  try {
    await initializePersistence();
  } catch (initError) {
    console.error("Initialization error:", initError);
  }
})();

export {
  auth,
  db,
  googleProvider,
  signInWithGoogle,
  initAuthStateObserver,
  increment,
  serverTimestamp,
  runTransaction,
  doc,
  getDoc,
  setDoc,
  getFriendlyAuthError
};