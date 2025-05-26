// src/components/PriceChart.js
import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import axios from "axios";

function PriceChart({ symbol }) {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    if (!symbol) return;

    const fetchPriceData = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/history/${symbol}`);
        const data = res.data.map(entry => ({
          date: entry.date,
          price: entry.price,
        }));
        setChartData(data);
      } catch (err) {
        console.error("Failed to fetch chart data:", err);
      }
    };

    fetchPriceData();
  }, [symbol]);

  return (
    <div style={{ padding: "1rem", background: "#f8f9fa", borderRadius: "16px", boxShadow: "0 0 12px rgba(0,0,0,0.1)" }}>
      <h3 style={{ marginBottom: "1rem", color: "#333" }}>{symbol} Price Chart (Last 30 Days)</h3>
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4facfe" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#00f2fe" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#555" />
          <YAxis stroke="#555" />
          <Tooltip contentStyle={{ backgroundColor: "#333", border: "none", color: "#fff" }} />
          <Legend />
          <Area type="monotone" dataKey="price" stroke="#4facfe" fillOpacity={1} fill="url(#colorPrice)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default PriceChart;
