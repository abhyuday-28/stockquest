import React, { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import axios from "axios";
import "./Wallet.css";

function Wallet() {
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [action, setAction] = useState("deposit");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [totalInvested, setTotalInvested] = useState(0);
  const [currentValue, setCurrentValue] = useState(0);
  const [profitLoss, setProfitLoss] = useState(0);
  const [loadingPrices, setLoadingPrices] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const walletRef = doc(db, "wallets", user.uid);
        const walletSnap = await getDoc(walletRef);

        if (walletSnap.exists()) {
          setBalance(walletSnap.data().balance || 0);
        } else {
          await setDoc(walletRef, {
            balance: 10000,
            currency: "USD",
            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp(),
          });
          setBalance(10000);
        }

        // Load portfolio
        const portfolioRef = collection(db, "portfolios");
        const q = query(portfolioRef, where("uid", "==", user.uid));
        const querySnapshot = await getDocs(q);

        let invested = 0;
        const symbols = [];
        const portfolioData = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          portfolioData.push(data);
          symbols.push(data.symbol);
          invested += data.shares * data.avgPrice;
        });

        setTotalInvested(invested);

        if (symbols.length > 0) {
          setLoadingPrices(true);
          const pricePromises = symbols.map((symbol) =>
            axios
              .get(`http://localhost:5000/api/stock/${symbol}`)
              .then((res) => res.data?.price || 0)
              .catch(() => 0)
          );

          const prices = await Promise.all(pricePromises);

          let currentVal = 0;
          portfolioData.forEach((stock, i) => {
            currentVal += stock.shares * prices[i];
          });

          setCurrentValue(currentVal);
          setProfitLoss(currentVal - invested);
          setLoadingPrices(false);
        } else {
          setCurrentValue(0);
          setProfitLoss(0);
        }
      } catch (error) {
        console.error("Error loading wallet:", error);
        setError("Failed to load wallet data");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleTransaction = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error("Please enter a valid positive amount");
      }

      const user = auth.currentUser;
      if (!user) throw new Error("You must be logged in");

      const walletRef = doc(db, "wallets", user.uid);
      const walletHistoryRef = collection(db, "walletHistory");

      await runTransaction(db, async (transaction) => {
        const walletSnap = await transaction.get(walletRef);
        let currentBalance = 10000;

        if (walletSnap.exists()) {
          currentBalance = walletSnap.data().balance || 0;
        } else {
          transaction.set(walletRef, {
            balance: currentBalance,
            currency: "USD",
            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp(),
          });
        }

        const newBalance =
          action === "deposit"
            ? currentBalance + amountNum
            : currentBalance - amountNum;

        if (action === "withdraw" && newBalance < 0) {
          throw new Error("Insufficient funds for withdrawal");
        }

        transaction.update(walletRef, {
          balance: newBalance,
          lastUpdated: serverTimestamp(),
        });

        await addDoc(walletHistoryRef, {
          uid: user.uid,
          type: action,
          amount: amountNum,
          description: `${action} from wallet`,
          timestamp: serverTimestamp(),
          newBalance: newBalance,
        });

        setBalance(newBalance);
        setAmount("");
        setSuccess(
          `Successfully ${action === "deposit" ? "deposited" : "withdrew"} $${amountNum.toFixed(2)}`
        );
        setTimeout(() => setSuccess(""), 3000);
      });
    } catch (error) {
      console.error("Transaction error:", error);
      setError(
        error.message.includes("Insufficient")
          ? "Insufficient funds for withdrawal"
          : error.message
      );
    }
  };

  const profitLossPercentage =
    totalInvested > 0 ? ((profitLoss / totalInvested) * 100).toFixed(2) : 0;

  if (loading) return <div className="loading">Loading wallet...</div>;

  return (
    <div className="wallet-container">
      <h2>Your Wallet</h2>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="wallet-grid">
        <div className="wallet-box balance-box">
          <div className="box-header">Available Balance</div>
          <div className="box-value">${balance.toFixed(2)}</div>
        </div>

        <div className="wallet-box invested-box">
          <div className="box-header">Total Invested</div>
          <div className="box-value">${totalInvested.toFixed(2)}</div>
        </div>

        <div className="wallet-box value-box">
          <div className="box-header">Current Value</div>
          <div className="box-value">
            {loadingPrices ? "Loading..." : `$${currentValue.toFixed(2)}`}
          </div>
        </div>

        <div className={`wallet-box ${profitLoss >= 0 ? "profit-box" : "loss-box"}`}>
          <div className="box-header">Profit/Loss</div>
          <div className="box-value">
            {loadingPrices
              ? "Loading..."
              : `$${Math.abs(profitLoss).toFixed(2)} (${profitLossPercentage}%)`}
          </div>
        </div>
      </div>

      <div className="transaction-form-box">
        <h3>Wallet Transactions</h3>
        <div className="action-toggle">
          <button
            className={`toggle-btn ${action === "deposit" ? "active" : ""}`}
            onClick={() => setAction("deposit")}
          >
            <i className="fas fa-plus-circle"></i> Deposit
          </button>
          <button
            className={`toggle-btn ${action === "withdraw" ? "active" : ""}`}
            onClick={() => setAction("withdraw")}
          >
            <i className="fas fa-minus-circle"></i> Withdraw
          </button>
        </div>
        <form onSubmit={handleTransaction}>
          <div className="input-group">
            <span className="input-icon">$</span>
            <input
              type="number"
              placeholder={`Enter amount to ${action}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0.01"
              step="0.01"
              required
            />
          </div>
          <button
            type="submit"
            className={`submit-btn ${action === "deposit" ? "deposit" : "withdraw"}`}
          >
            {action === "deposit" ? (
              <>
                <i className="fas fa-arrow-down"></i> Add Funds
              </>
            ) : (
              <>
                <i className="fas fa-arrow-up"></i> Withdraw Funds
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Wallet;
