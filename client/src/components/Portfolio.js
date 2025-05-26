import React, { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  writeBatch,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import axios from "axios";
import "./Portfolio.css";

function Portfolio() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const [portfolio, setPortfolio] = useState([]);
  const [stockData, setStockData] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [tradeSymbol, setTradeSymbol] = useState(queryParams.get("symbol") || "");
  const [tradeShares, setTradeShares] = useState("");
  const [tradeType, setTradeType] = useState("buy");
  const [tradeError, setTradeError] = useState(null);

  const portfolioCollection = collection(db, "portfolios");
  const historyCollection = collection(db, "tradeHistory");

  useEffect(() => {
    console.log("Setting up auth state listener");
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        console.log("No user signed in");
        setLoading(false);
        setPortfolio([]);
        return;
      }

      console.log("User authenticated:", user.uid);
      const portfolioQuery = query(portfolioCollection, where("uid", "==", user.uid));

      try {
        console.log("Setting up portfolio snapshot listener");
        const unsubscribePortfolio = onSnapshot(
          portfolioQuery,
          (querySnapshot) => {
            console.log("Portfolio snapshot received");
            const userPortfolio = [];
            querySnapshot.forEach((doc) => {
              console.log("Document:", doc.id, doc.data());
              userPortfolio.push({ id: doc.id, ...doc.data() });
            });
            setPortfolio(userPortfolio);
            setLoading(false);
          },
          (error) => {
            console.error("Portfolio snapshot error:", error);
            setLoading(false);
          }
        );

        return () => {
          console.log("Cleaning up portfolio listener");
          unsubscribePortfolio();
        };
      } catch (error) {
        console.error("Error setting up portfolio listener:", error);
        setLoading(false);
      }
    });

    return () => {
      console.log("Cleaning up auth listener");
      unsubscribeAuth();
    };
  }, []);

  // Fetch current stock prices
  const fetchStockPrices = async (symbols) => {
    const priceMap = {};
    for (let symbol of symbols) {
      try {
        const res = await axios.get(`http://localhost:5000/api/stock/${symbol}`);
        console.log(`Fetched price for ${symbol}:`, res.data);
        if (res.data?.symbol && res.data.price) {
          priceMap[symbol] = res.data;
        }
      } catch (error) {
        console.error(`Failed to fetch data for ${symbol}`, error);
      }
    }
    return priceMap;
  };

  // Update stock prices when portfolio changes
  useEffect(() => {
    if (portfolio.length === 0) {
      setStockData({});
      return;
    }
    const symbols = portfolio.map((p) => p.symbol);
    console.log("Fetching prices for symbols:", symbols);
    setLoadingPrices(true);
    fetchStockPrices(symbols).then((prices) => {
      console.log("Fetched stock prices:", prices);
      setStockData(prices);
      setLoadingPrices(false);
    });
  }, [portfolio]);

  // Calculate total portfolio value
  const totalValue = useMemo(() => {
    let total = 0;
    for (const stock of portfolio) {
      const price = parseFloat(stockData[stock.symbol]?.price) || 0;
      const shares = parseFloat(stock.shares) || 0;
      total += shares * price;
    }
    return total.toFixed(2);
  }, [portfolio, stockData]);

  // Handle buy/sell trades
  const handleTrade = async (e) => {
  e.preventDefault();
  setTradeError(null);

  const symbol = tradeSymbol.trim().toUpperCase();
  const sharesNum = parseFloat(tradeShares);
  const user = auth.currentUser;

  if (!user) {
    setTradeError("You must be logged in to trade");
    return;
  }

  if (!symbol || isNaN(sharesNum) || sharesNum <= 0) {
    setTradeError("Invalid input - please check symbol and shares");
    return;
  }

  try {
    console.log("Starting trade process...");

    // Fetch current stock price once here
    console.log("Fetching stock price for:", symbol);
    const priceRes = await axios.get(`http://localhost:5000/api/stock/${symbol}`);
    if (!priceRes.data?.price) {
      setTradeError("Invalid stock symbol or API error");
      return;
    }
    const currentPrice = priceRes.data.price;
    console.log("Current price:", currentPrice);

    let walletBalance = 0;
    const totalCost = sharesNum * currentPrice;

    // For buy orders, check wallet balance
    if (tradeType === "buy") {
      console.log("Checking wallet balance...");
      const walletRef = doc(db, "wallets", user.uid);
      const walletSnap = await getDoc(walletRef);
      walletBalance = walletSnap.exists() ? walletSnap.data().balance : 0;
      console.log("Wallet balance:", walletBalance);

      if (totalCost > walletBalance) {
        setTradeError(
          `Insufficient funds. Needed: $${totalCost.toFixed(
            2
          )}, Available: $${walletBalance.toFixed(2)}`
        );
        return;
      }
    }

    // Prepare batch operation
    console.log("Preparing batch operation...");
    const batch = writeBatch(db);

    const existing = portfolio.find((p) => p.symbol === symbol);

    // Add trade history record (common for both buy and sell)
    const historyDoc = doc(historyCollection);
    batch.set(historyDoc, {
      uid: user.uid,
      symbol,
      type: tradeType,
      shares: sharesNum,
      price: currentPrice,
      timestamp: serverTimestamp(),
      clientTimestamp: new Date().toISOString(),
    });

    if (tradeType === "buy") {
      console.log("Processing buy order...");
      if (existing) {
        const stockRef = doc(db, "portfolios", existing.id);
        batch.update(stockRef, {
          shares: increment(sharesNum),
          lastUpdated: serverTimestamp(),
          // Optionally update avgPrice here if you want to average cost
        });
      } else {
        // If stock doesn't exist in portfolio, create new doc
        const newStockDoc = doc(portfolioCollection);
        batch.set(newStockDoc, {
          uid: user.uid,
          symbol,
          shares: sharesNum,
          avgPrice: currentPrice,
          lastUpdated: serverTimestamp(),
        });
      }

      // Deduct wallet balance for buy
      const walletRef = doc(db, "wallets", user.uid);
      batch.update(walletRef, {
        balance: increment(-totalCost),
      });

    } else {
      // SELL
      console.log("Processing sell order...");
      if (!existing || existing.shares < sharesNum) {
        setTradeError("Not enough shares to sell");
        return;
      }

      const stockRef = doc(db, "portfolios", existing.id);
      if (existing.shares === sharesNum) {
        batch.delete(stockRef);
      } else {
        batch.update(stockRef, {
          shares: increment(-sharesNum),
          lastUpdated: serverTimestamp(),
        });
      }

      // Calculate profit/loss based on avgPrice
      const profitLoss = (currentPrice - (existing.avgPrice || currentPrice)) * sharesNum;

      // Update wallet - add sale proceeds and track realized P/L
      const walletRef = doc(db, "wallets", user.uid);
      batch.update(walletRef, {
        balance: increment(sharesNum * currentPrice), // Credit wallet with sale proceeds
        realizedPL: increment(profitLoss), // Update realized profit/loss
      });

      // Update trade history with extra info on sell
      batch.set(historyDoc, {
        uid: user.uid,
        symbol,
        type: tradeType,
        shares: sharesNum,
        price: currentPrice,
        avgCost: existing.avgPrice || currentPrice,
        profitLoss: profitLoss,
        timestamp: serverTimestamp(),
        clientTimestamp: new Date().toISOString(),
      });
    }

    // Commit batch
    console.log("Committing batch...");
    await batch.commit();
    console.log("Trade completed successfully!");

    setTradeSymbol("");
    setTradeShares("");
  } catch (error) {
    console.error("Trade failed with error:", error);
    let errorMessage = "Trade failed. Please try again.";

    if (error.code === "permission-denied") {
      errorMessage = "Permission denied. Check Firestore rules.";
    } else if (error.code === "resource-exhausted") {
      errorMessage = "Too many requests. Please wait and try again.";
    } else if (error.message.includes("Network Error")) {
      errorMessage = "Network error. Check your connection.";
    }

    setTradeError(errorMessage);
  }
};


  if (loading) {
    console.log("Rendering loading state");
    return <div className="portfolio-loading">Loading portfolio...</div>;
  }

  console.log("Rendering portfolio with", portfolio.length, "items");

  return (
    <div className="portfolio-container">
      <div className="portfolio-header">
        <h2>Your Portfolio</h2>
        <p>Total Value: ${totalValue}</p>
      </div>

      {loadingPrices ? (
        <div className="portfolio-loading">Loading stock prices...</div>
      ) : portfolio.length === 0 ? (
        <p className="empty-portfolio">No stocks in your portfolio yet.</p>
      ) : (
        <table className="portfolio-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Shares</th>
              <th>Current Price</th>
              <th>Value</th>
              <th>Avg Cost</th>
              <th>P/L</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.map((stock) => {
              const priceData = stockData[stock.symbol] || {};
              const currentPrice = parseFloat(priceData.price) || 0;
              const value = stock.shares * currentPrice;
              const cost = stock.shares * (stock.avgPrice || currentPrice);
              const profitLoss = value - cost;
              const profitLossPercent = cost ? (profitLoss / cost) * 100 : 0;

              return (
                <tr key={stock.id}>
                  <td>{stock.symbol}</td>
                  <td>{stock.shares.toFixed(2)}</td>
                  <td>${currentPrice.toFixed(2)}</td>
                  <td>${value.toFixed(2)}</td>
                  <td>${(stock.avgPrice || currentPrice).toFixed(2)}</td>
                  <td className={profitLoss >= 0 ? "positive" : "negative"}>
                    ${profitLoss.toFixed(2)} ({profitLossPercent.toFixed(2)}%)
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="trade-section">
        <h3>Trade Stocks</h3>
        {tradeError && <div className="trade-error">{tradeError}</div>}
        <form onSubmit={handleTrade} className="trade-form">
          <input
            type="text"
            placeholder="Symbol (e.g. AAPL)"
            value={tradeSymbol}
            onChange={(e) => setTradeSymbol(e.target.value)}
            required
          />
          <input
            type="number"
            placeholder="Shares"
            value={tradeShares}
            onChange={(e) => setTradeShares(e.target.value)}
            required
            min="0.01"
            step="0.01"
          />
          <select value={tradeType} onChange={(e) => setTradeType(e.target.value)}>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
          <button type="submit" className="trade-button">
            {tradeType === "buy" ? "Buy" : "Sell"} Stock
          </button>
        </form>
      </div>
    </div>
  );
}

export default Portfolio;
