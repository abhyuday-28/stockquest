import React, { useEffect, useState } from "react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  orderBy,
  writeBatch
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import "./History.css";

function History() {
  const [trades, setTrades] = useState([]);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrades, setSelectedTrades] = useState([]);
  const [selectedWalletTransactions, setSelectedWalletTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("trades");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Trade History
        const tradesQuery = query(
          collection(db, "tradeHistory"),
          where("uid", "==", user.uid),
          orderBy("timestamp", "desc")
        );
        
        const unsubscribeTrades = onSnapshot(tradesQuery, (snapshot) => {
          const tradesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().timestamp?.toDate() || new Date()
          }));
          setTrades(tradesData);
        });

        // Wallet History
        const walletQuery = query(
          collection(db, "walletHistory"),
          where("uid", "==", user.uid),
          orderBy("timestamp", "desc")
        );
        
        const unsubscribeWallet = onSnapshot(walletQuery, (snapshot) => {
          const walletData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().timestamp?.toDate() || new Date()
          }));
          setWalletTransactions(walletData);
          setLoading(false);
        });

        return () => {
          unsubscribeTrades();
          unsubscribeWallet();
        };
      } catch (error) {
        console.error("Error loading history:", error);
        setError("Failed to load history data");
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const toggleSelectTrade = (tradeId) => {
    setSelectedTrades(prev =>
      prev.includes(tradeId)
        ? prev.filter(id => id !== tradeId)
        : [...prev, tradeId]
    );
  };

  const toggleSelectWalletTransaction = (txId) => {
    setSelectedWalletTransactions(prev =>
      prev.includes(txId)
        ? prev.filter(id => id !== txId)
        : [...prev, txId]
    );
  };

  const deleteSelected = async () => {
  const user = auth.currentUser;
  if (!user) {
    setError("You must be logged in to delete history.");
    return;
  }

  const collectionName = activeTab === "trades" ? "tradeHistory" : "walletHistory";
  const selectedItems = activeTab === "trades" ? selectedTrades : selectedWalletTransactions;

  if (!selectedItems.length || !window.confirm(`Delete ${selectedItems.length} selected items?`)) {
    return;
  }

  try {
    const batch = writeBatch(db);
    selectedItems.forEach(itemId => {
      const docRef = doc(db, collectionName, itemId);
      batch.delete(docRef);
    });

    await batch.commit();

    if (activeTab === "trades") {
      setTrades(prev => prev.filter(trade => !selectedItems.includes(trade.id)));
      setSelectedTrades([]);
    } else {
      setWalletTransactions(prev => prev.filter(tx => !selectedItems.includes(tx.id)));
      setSelectedWalletTransactions([]);
    }

    setError(""); // clear any previous error
  } catch (error) {
    console.error("Error deleting items:", error);
    setError("Failed to delete items. Please try again.");
  }
};


  if (loading) return <div className="loading">Loading history...</div>;

  return (
    <div className="history-container">
      <div className="history-header">
        <div className="history-tabs">
          <button
            className={`tab-button ${activeTab === "trades" ? "active" : ""}`}
            onClick={() => setActiveTab("trades")}
          >
            Trade History
          </button>
          <button
            className={`tab-button ${activeTab === "wallet" ? "active" : ""}`}
            onClick={() => setActiveTab("wallet")}
          >
            Wallet History
          </button>
        </div>
        
        {(selectedTrades.length > 0 || selectedWalletTransactions.length > 0) && (
          <button 
            onClick={deleteSelected}
            className="delete-selected-btn"
          >
            <i className="fas fa-trash-alt"></i> Delete Selected (
            {activeTab === "trades" ? selectedTrades.length : selectedWalletTransactions.length})
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {activeTab === "trades" ? (
        <>
          {trades.length === 0 ? (
            <div className="empty-history">
              <i className="fas fa-exchange-alt"></i>
              <p>No trades recorded yet</p>
            </div>
          ) : (
            <div className="history-table-container">
              <table className="history-table">
                <thead>
                  <tr>
                    <th className="select-column"></th>
                    <th>Date & Time</th>
                    <th>Symbol</th>
                    <th>Type</th>
                    <th>Shares</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr key={trade.id} className={selectedTrades.includes(trade.id) ? "selected" : ""}>
                      <td className="select-cell">
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            checked={selectedTrades.includes(trade.id)}
                            onChange={() => toggleSelectTrade(trade.id)}
                          />
                          <span className="checkmark"></span>
                        </label>
                      </td>
                      <td>{trade.date.toLocaleString()}</td>
                      <td className="symbol-cell">{trade.symbol}</td>
                      <td>
                        <span className={`trade-type-badge ${trade.type}`}>
                          {trade.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="shares-cell">{trade.shares?.toFixed(2) || '0.00'}</td>
                      <td className="price-cell">${trade.price?.toFixed(2) || '0.00'}</td>
                      <td className="total-cell">
                        ${((trade.shares || 0) * (trade.price || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          {walletTransactions.length === 0 ? (
            <div className="empty-history">
              <i className="fas fa-wallet"></i>
              <p>No wallet transactions yet</p>
            </div>
          ) : (
            <div className="history-table-container">
              <table className="history-table">
                <thead>
                  <tr>
                    <th className="select-column"></th>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {walletTransactions.map((tx) => (
                    <tr key={tx.id} className={selectedWalletTransactions.includes(tx.id) ? "selected" : ""}>
                      <td className="select-cell">
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            checked={selectedWalletTransactions.includes(tx.id)}
                            onChange={() => toggleSelectWalletTransaction(tx.id)}
                          />
                          <span className="checkmark"></span>
                        </label>
                      </td>
                      <td>{tx.date.toLocaleString()}</td>
                      <td>
                        <span className={`wallet-type-badge ${tx.type}`}>
                          {tx.type.toUpperCase()}
                        </span>
                      </td>
                      <td className={`amount-cell ${tx.type}`}>
                        {tx.type === 'deposit' ? '+' : '-'}${tx.amount?.toFixed(2) || '0.00'}
                      </td>
                      <td className="description-cell">{tx.description || 'Wallet transaction'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default History;