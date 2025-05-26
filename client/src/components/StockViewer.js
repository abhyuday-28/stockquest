import React, { useState } from "react";
import axios from "axios";
import { auth, db } from "../firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";

function StockViewer() {
  const [symbol, setSymbol] = useState("");
  const [stockData, setStockData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchStock = async () => {
    try {
      setError("");
      setMessage("");
      const res = await axios.get(`http://localhost:5000/api/stock/${symbol}`);
      setStockData(res.data);
    } catch (err) {
      setError("Failed to fetch stock data");
      setStockData(null);
    }
  };

  const addToPortfolio = async () => {
    if (!auth.currentUser) {
      setError("You must be logged in to save stocks.");
      return;
    }
    try {
      const userStocksRef = collection(db, "portfolios");
      // Optional: Prevent duplicates
      const q = query(
        userStocksRef,
        where("userId", "==", auth.currentUser.uid),
        where("symbol", "==", stockData.symbol)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setMessage("Stock already in portfolio.");
        return;
      }

      await addDoc(userStocksRef, {
        userId: auth.currentUser.uid,
        symbol: stockData.symbol,
        name: stockData.name,
        price: stockData.price,
        addedAt: new Date(),
      });
      setMessage("Stock added to portfolio!");
    } catch (err) {
      setError("Failed to add stock to portfolio");
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Enter stock symbol (e.g. AAPL)"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
      />
      <button onClick={fetchStock}>Get Stock Info</button>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      {stockData && (
        <div>
          <h2>
            {stockData.name} ({stockData.symbol})
          </h2>
          <p>Price: ${stockData.price}</p>
          <p>
            Change: {stockData.change} ({stockData.changesPercentage}%)
          </p>
          <p>Day Low: ${stockData.dayLow}</p>
          <p>Day High: ${stockData.dayHigh}</p>
          <p>Market Cap: ${stockData.marketCap.toLocaleString()}</p>
          <p>Exchange: {stockData.exchange}</p>

          <button onClick={addToPortfolio}>Add to Portfolio</button>
        </div>
      )}
    </div>
  );
}

export default StockViewer;
