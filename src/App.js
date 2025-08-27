import React, { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [result, setResult] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      axios
        .get("http://localhost:8000/latest")
        .then((res) => setResult(res.data))
        .catch((err) => console.error("Error:", err));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial" }}>
      <h1>5G Cyber Attack Detection</h1>
      {result && result.attack_type !== "None" ? (
        <>
          <h2>Attack Detected: <span style={{ color: "red" }}>{result.attack_type}</span></h2>
          <p>Confidence: {result.confidence * 100}%</p>
        </>
      ) : (
        <p>Waiting for data...</p>
      )}
    </div>
  );
}

export default App;
