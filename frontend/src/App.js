import React, { useState, useEffect } from "react";
import Web3 from "web3";
import { Chart, registerables } from "chart.js";
import {
  CandlestickController,
  CandlestickElement,
} from "chartjs-chart-financial";
import "chartjs-adapter-date-fns";

Chart.register(...registerables, CandlestickController, CandlestickElement);

const App = () => {
  const [lpAddress, setLpAddress] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [candlestickData, setCandlestickData] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  const nodeUrl = "http://46.4.138.103:7777";

  const abi = [
    {
      anonymous: false,
      inputs: [
        { indexed: true, internalType: "address", name: "from", type: "address" },
        { indexed: true, internalType: "address", name: "to", type: "address" },
        { indexed: false, internalType: "uint256", name: "value", type: "uint256" },
      ],
      name: "Transfer",
      type: "event",
    },
  ];

  const fetchTransactions = async () => {
    if (!lpAddress) {
      setErrorMessage("Please enter a valid LP address.");
      return;
    }

    setErrorMessage("");
    setTransactions([]);

    try {
      const web3 = new Web3(nodeUrl);
      const contract = new web3.eth.Contract(abi, lpAddress);

      const events = await contract.getPastEvents("Transfer", {
        fromBlock: "earliest",
        toBlock: "latest",
      });

      const processedTransactions = events
        .filter(
          (event) =>
            event.returnValues.from.toLowerCase() === lpAddress.toLowerCase() ||
            event.returnValues.to.toLowerCase() === lpAddress.toLowerCase()
        )
        .map((event) => {
          const { from, to, value } = event.returnValues;
          const direction =
            to.toLowerCase() === lpAddress.toLowerCase() ? "Buy" : "Sell";
          return {
            from,
            to,
            value: parseFloat(web3.utils.fromWei(value, "ether")),
            direction,
            transactionHash: event.transactionHash,
            timestamp: event.blockNumber, // Replace with actual timestamp if available
          };
        });

      setTransactions(processedTransactions);
      generateCandlestickData(processedTransactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setErrorMessage("Failed to fetch transactions. Check the LP address or ABI.");
    }
  };

  const generateCandlestickData = (transactions) => {
    const groupedByTime = {};

    transactions.forEach((tx) => {
      const timestamp = Math.floor(Date.now() / 60000) * 60000; // Round to the nearest minute
      const value = tx.value;

      if (!groupedByTime[timestamp]) {
        groupedByTime[timestamp] = {
          open: value,
          high: value,
          low: value,
          close: value,
        };
      } else {
        groupedByTime[timestamp].high = Math.max(
          groupedByTime[timestamp].high,
          value
        );
        groupedByTime[timestamp].low = Math.min(
          groupedByTime[timestamp].low,
          value
        );
        groupedByTime[timestamp].close = value;
      }
    });

    const candlestick = Object.entries(groupedByTime).map(([timestamp, ohlc]) => ({
      x: parseInt(timestamp, 10),
      o: ohlc.open,
      h: ohlc.high,
      l: ohlc.low,
      c: ohlc.close,
    }));

    setCandlestickData(candlestick);
  };

  const renderChart = () => {
    const ctx = document.getElementById("candlestickChart").getContext("2d");

    new Chart(ctx, {
      type: "candlestick",
      data: {
        datasets: [
          {
            label: "Liquidity Pool",
            data: candlestickData,
            borderColor: "#00ff00",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: {
            type: "time",
            time: {
              unit: "minute",
            },
            title: {
              display: true,
              text: "Time",
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Value (TARA)",
            },
          },
        },
      },
    });
  };

  useEffect(() => {
    if (candlestickData.length > 0) {
      renderChart();
    }
  }, [candlestickData]);

  const handleInputChange = (event) => {
    setLpAddress(event.target.value);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Liquidity Pool Transactions</h1>
      <div>
        <input
          type="text"
          placeholder="Enter LP Address"
          value={lpAddress}
          onChange={handleInputChange}
          style={{ width: "400px", marginRight: "10px" }}
        />
        <button onClick={fetchTransactions}>Fetch Transactions</button>
      </div>
      {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
      <canvas id="candlestickChart" width="800" height="400" style={{ marginTop: "20px" }} />
      {transactions.length > 0 ? (
        <table border="1" cellPadding="10" style={{ marginTop: "20px", width: "100%" }}>
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Value (TARA)</th>
              <th>Direction</th>
              <th>Transaction Hash</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, index) => (
              <tr
                key={index}
                style={{
                  backgroundColor: tx.direction === "Buy" ? "#d4fcdc" : "#fcd4d4",
                }}
              >
                <td>{tx.from}</td>
                <td>{tx.to}</td>
                <td>{tx.value}</td>
                <td>{tx.direction}</td>
                <td>
                  <a
                    href={`https://tara.to/tx/${tx.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tx.transactionHash}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No transactions found involving this LP address.</p>
      )}
    </div>
  );
};

export default App;
