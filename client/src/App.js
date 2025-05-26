// src/App.js
import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import History from "./components/History";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Navbar from "./components/Navbar";
import Login from "./components/Login";
import Signup from "./components/Signup";
import StockViewer from "./components/StockViewer";
import Portfolio from "./components/Portfolio";
import Home from './components/Home';
import Wallet from './components/Wallet'; 
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [showSignup, setShowSignup] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    signOut(auth);
  };

  if (!user) {
    return (
      <div className="auth-container">
        {showSignup ? <Signup /> : <Login />}
        <button
          onClick={() => setShowSignup(!showSignup)}
          className="toggle-auth-btn"
        >
          {showSignup ? "Have an account? Login" : "No account? Signup"}
        </button>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Navbar userEmail={user.email} onLogout={handleLogout} />
        <main>
          <Routes>
            <Route path="/history" element={<History />} />
            <Route path="/" element={<Home />} />
            <Route path="/" element={<StockViewer />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/portfolio" element={<Portfolio />} />
            {/* Redirect any unknown routes to home */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
