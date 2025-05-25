const express = require("express");
const cors = require("cors");
const axios = require("axios");
const NodeCache = require("node-cache");
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const API_KEY = "hLszDoGkgZ6RFV0Nr0bc5Bem32Rfj4wq";
const API_LIMIT = 250; // Financial Modeling Prep's free tier limit
const CACHE_TTL = 60 * 5; // 5 minutes cache
const stockCache = new NodeCache({ stdTTL: CACHE_TTL });

// Rate limiting tracking
let apiCallCount = 0;
let lastResetTime = Date.now();

// Helper function to check rate limits
const checkRateLimit = () => {
  const now = Date.now();
  // Reset counter every 24 hours (FMP resets daily)
  if (now - lastResetTime > 24 * 60 * 60 * 1000) {
    apiCallCount = 0;
    lastResetTime = now;
  }
  
  if (apiCallCount >= API_LIMIT) {
    throw new Error("Daily API limit reached");
  }
};

// Enhanced stock data fetcher with caching
const fetchStockData = async (symbol) => {
  const cacheKey = `stock-${symbol}`;
  const cachedData = stockCache.get(cacheKey);
  if (cachedData) return cachedData;

  checkRateLimit();
  
  const url = `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${API_KEY}`;
  try {
    const response = await axios.get(url);
    apiCallCount++;
    
    if (response.data && response.data.length > 0) {
      const stockData = {
        symbol: response.data[0].symbol,
        name: response.data[0].name,
        price: response.data[0].price,
        changesPercentage: response.data[0].changesPercentage,
        timestamp: new Date().toISOString()
      };
      
      stockCache.set(cacheKey, stockData);
      return stockData;
    }
    throw new Error("Stock not found");
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error.message);
    throw error;
  }
};

// Enhanced batch stock data fetcher
const fetchBatchStockData = async (symbols) => {
  const cacheKey = `batch-${symbols.join('-')}`;
  const cachedData = stockCache.get(cacheKey);
  if (cachedData) return cachedData;

  checkRateLimit();
  
  const url = `https://financialmodelingprep.com/api/v3/quote/${symbols.join(',')}?apikey=${API_KEY}`;
  try {
    const response = await axios.get(url);
    apiCallCount++;
    
    if (response.data && Array.isArray(response.data)) {
      const stocksData = response.data.map(stock => ({
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price,
        changesPercentage: stock.changesPercentage,
        timestamp: new Date().toISOString()
      }));
      
      stockCache.set(cacheKey, stocksData);
      return stocksData;
    }
    throw new Error("No stock data returned");
  } catch (error) {
    console.error("Batch fetch error:", error.message);
    throw error;
  }
};

// Routes
app.get("/", (req, res) => {
  res.json({
    status: "running",
    apiCallsToday: apiCallCount,
    apiLimit: API_LIMIT,
    cacheStats: stockCache.getStats()
  });
});

// Single stock endpoint
app.get("/api/stock/:symbol", async (req, res) => {
  try {
    const stockData = await fetchStockData(req.params.symbol.toUpperCase());
    res.json(stockData);
  } catch (error) {
    res.status(error.message.includes("limit") ? 429 : 500).json({
      error: error.message,
      apiCallsToday: apiCallCount,
      apiLimit: API_LIMIT
    });
  }
});

// Batch stocks endpoint
app.get("/api/stocks/:symbols", async (req, res) => {
  try {
    const symbols = req.params.symbols.toUpperCase().split(',');
    const stocksData = await fetchBatchStockData(symbols);
    res.json(stocksData);
  } catch (error) {
    res.status(error.message.includes("limit") ? 429 : 500).json({
      error: error.message,
      apiCallsToday: apiCallCount,
      apiLimit: API_LIMIT
    });
  }
});

// Historical data with caching
app.get("/api/historical/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const cacheKey = `historical-${symbol}`;
  
  try {
    const cachedData = stockCache.get(cacheKey);
    if (cachedData) return res.json(cachedData);

    checkRateLimit();
    
    const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?timeseries=30&apikey=${API_KEY}`;
    const response = await axios.get(url);
    apiCallCount++;
    
    if (response.data?.historical) {
      const historicalData = response.data.historical.map(item => ({
        date: item.date,
        price: item.close,
        volume: item.volume
      }));
      
      stockCache.set(cacheKey, historicalData);
      res.json(historicalData);
    } else {
      res.status(404).json({ error: "Historical data not found" });
    }
  } catch (error) {
    console.error("Historical data error:", error.message);
    res.status(error.message.includes("limit") ? 429 : 500).json({
      error: error.message || "Failed to fetch historical data",
      apiCallsToday: apiCallCount
    });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 API call limit: ${API_LIMIT} per day`);
});