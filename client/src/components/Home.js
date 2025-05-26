import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import * as THREE from "three";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./Home.css";

function Home() {
  const [stockSymbol, setStockSymbol] = useState("");
  const [stockData, setStockData] = useState(null);
  const [showChart, setShowChart] = useState(false);
  const navigate = useNavigate();

  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const animationIdRef = useRef(null);
  const cameraRef = useRef(null);

  const handleInputChange = (e) => setStockSymbol(e.target.value.toUpperCase());

  const handleViewDetails = async () => {
    try {
      const response = await axios.get(
        `http://localhost:5000/api/stock/${stockSymbol}`
      );
      if (response.data) {
        setStockData(response.data);
        setShowChart(true);
      } else {
        setStockData(null);
        setShowChart(false);
      }
    } catch (error) {
      console.error("Error fetching stock data:", error);
      setStockData(null);
      setShowChart(false);
    }
  };

  const generateChartData = () => {
    const price = stockData?.price || 100;
    return Array.from({ length: 10 }, (_, i) => ({
      name: `Day ${i + 1}`,
      price: price + Math.random() * 10 - 5,
    }));
  };

  const addToPortfolio = () => {
    if (!stockData) return;
    navigate(`/portfolio?symbol=${stockData.symbol}`);
  };

  const startThreeAnimation = () => {
    stopThreeAnimation();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / 400,
      0.1,
      1000
    );
    camera.position.z = 5;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, 400);
    mountRef.current.innerHTML = "";
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const starGeometry = new THREE.BufferGeometry();
    const starCount = 1000;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 100;
      positions[i3 + 1] = (Math.random() - 0.5) * 100;
      positions[i3 + 2] = -Math.random() * 200;
    }

    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );

    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.7,
      transparent: true,
      opacity: 0.8,
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const animate = () => {
      const positions = starGeometry.attributes.position.array;
      for (let i = 2; i < positions.length; i += 3) {
        positions[i] += 0.5;
        if (positions[i] > 5) {
          positions[i] = -200 + Math.random() * 5;
        }
      }
      starGeometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      animationIdRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  const stopThreeAnimation = () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    if (
      rendererRef.current &&
      mountRef.current?.contains(rendererRef.current.domElement)
    ) {
      mountRef.current.removeChild(rendererRef.current.domElement);
    }
    rendererRef.current = null;
  };

  useEffect(() => {
    if (!showChart) {
      startThreeAnimation();
      const handleResize = () => {
        if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
        const width = mountRef.current.clientWidth;
        const height = 400;
        rendererRef.current.setSize(width, height);
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
      };

      window.addEventListener("resize", handleResize);
      return () => {
        stopThreeAnimation();
        window.removeEventListener("resize", handleResize);
      };
    } else {
      stopThreeAnimation();
    }
  }, [showChart]);

 return (
  <div className="home-container">
    <h1 className="home-title">Welcome to StockQuest</h1>

    <div className="search-container">
      <input
        type="text"
        placeholder="Enter stock symbol (e.g., AAPL)"
        value={stockSymbol}
        onChange={handleInputChange}
        className="search-input"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleViewDetails();
        }}
      />
      <button onClick={handleViewDetails} className="search-btn">
        View Details
      </button>
    </div>

    <div className="content-row">
      {!showChart && (
        <div ref={mountRef} className="three-background" />
      )}

      {showChart && stockData && (
        <>
          {/* Chart Section (70%) */}
          <div className="three-background" style={{ flex: 7 }}>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={generateChartData()}>
                  <CartesianGrid stroke="#ccc" />
                  <XAxis dataKey="name" />
                  <YAxis domain={["auto", "auto"]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#00bcd4"
                    strokeWidth={3}
                    dot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stock Data Section (30%) */}
          <div className="stock-data-container" style={{ flex: 3 }}>
            <div className="stock-card">
              <h2>
                {stockData.name} ({stockData.symbol})
              </h2>
              <p><strong>Price:</strong> ${stockData.price}</p>
              <p><strong>Change:</strong> {stockData.change} ({stockData.changesPercentage}%)</p>
              <p>
                <strong>Market Cap:</strong>{" "}
                {isNaN(Number(stockData.marketCap))
                  ? "N/A"
                  : `$${Number(stockData.marketCap).toLocaleString()}`}
              </p>


            </div>

            <button onClick={addToPortfolio} className="add-btn">
              Add to Portfolio
            </button>
          </div>
        </>
      )}
    </div>
  </div>
);
}
export default Home;
