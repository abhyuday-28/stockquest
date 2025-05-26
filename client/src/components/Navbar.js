// src/components/Navbar.js
import React from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";

function Navbar({ userEmail, onLogout }) {
  return (
    <header className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar-logo">
        <Link to="/" aria-label="Go to homepage">StockQuest</Link>
      </div>

      <ul className="navbar-links">
        <li><Link to="/">Home</Link></li>
        <li><Link to="/portfolio">Portfolio</Link></li>
        <li><Link to="/history">History</Link></li>
        <li><Link to="/wallet">Wallet</Link></li>
      </ul>

      <div className="navbar-user">
        <span>{userEmail}</span>
        <button onClick={onLogout} className="logout-btn" aria-label="Logout">
          Logout
        </button>
      </div>
    </header>
  );
}

export default Navbar;
