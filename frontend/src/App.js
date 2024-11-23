import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

const App = () => {
  const [address, setAddress] = useState('');
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [chartData, setChartData] = useState(null);
  const [tokenPrice, setTokenPrice] = useState(null);
  const [poolAddress, setPoolAddress] = useState(null);
  const pageSize = 10;

  // List of factory contracts
  const factoryContracts = [
    {
      name: "Herpswap",
      address: "0xD6b2ebF556817044871eF8508772De5bb5A88057",
      abi: [
        {
          constant: true,
          inputs: [
            { name: "tokenA", type: "address" },
            { name: "tokenB", type: "address" },
          ],
          name: "getPair",
          outputs: [{ name: "pair", type: "address" }],
          stateMutability: "view",
          type: "function",
        },
      ],
    },
  ];

  const referenceTokens = ["0xdAC17F958D2ee523a2206206994597C13D831ec7"]; // USDT as reference token

  useEffect(() => {
    const interval = setInterval(() => {
      if (address) {
        detectAvailablePool();
        fetchTransferEvents();
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [address]);

  const detectAvailablePool = async () => {
  setLogs((prev) => [...prev, 'Detecting available liquidity pools...']);
  const web3 = new Web3('http://37.27.107.225:7777'); // Your node

  for (const factory of factoryContracts) {
    for (const refToken of referenceTokens) {
      try {
        setLogs((prev) => [
          ...prev,
          `Querying factory: ${factory.name} for token pair (${address}, ${refToken})`,
        ]);

        const factoryContract = new web3.eth.Contract(factory.abi, factory.address);
        const poolAddr = await factoryContract.methods.getPair(address, refToken).call();

        if (poolAddr !== "0x0000000000000000000000000000000000000000") {
          setLogs((prev) => [...prev, `Pool found on ${factory.name}: ${poolAddr}`]);
          setPoolAddress(poolAddr);
          return; // Exit after finding the first pool
        }
      } catch (err) {
        setLogs((prev) => [
          ...prev,
          `Error querying ${factory.name}: ${err.message}`,
        ]);
      }
    }
  }

  setLogs((prev) => [...prev, "No valid pool detected."]);
};


  const fetchLiquidityPoolData = async (web3, poolAddr) => {
    const poolContract = new web3.eth.Contract(
      [
        {
          constant: true,
          inputs: [],
          name: 'getReserves',
          outputs: [
            { name: '_reserve0', type: 'uint112' },
            { name: '_reserve1', type: 'uint112' },
            { name: '_blockTimestampLast', type: 'uint32' },
          ],
          type: 'function',
        },
        {
          constant: true,
          inputs: [],
          name: 'token0',
          outputs: [{ name: '', type: 'address' }],
          type: 'function',
        },
        {
          constant: true,
          inputs: [],
          name: 'token1',
          outputs: [{ name: '', type: 'address' }],
          type: 'function',
        },
      ],
      poolAddr
    );

    const reserves = await poolContract.methods.getReserves().call();
    const token0 = await poolContract.methods.token0().call();
    const token1 = await poolContract.methods.token1().call();

    return {
      reserve0: Number(reserves._reserve0),
      reserve1: Number(reserves._reserve1),
      token0,
      token1,
    };
  };

  const calculatePrice = (reserve0, reserve1, targetToken, token0, token1) => {
    if (targetToken.toLowerCase() === token0.toLowerCase()) {
      return reserve1 / reserve0;
    } else if (targetToken.toLowerCase() === token1.toLowerCase()) {
      return reserve0 / reserve1;
    }
    return null;
  };

  const fetchTransferEvents = async () => {
    setError('');
    setLogs([]);

    if (!address || !poolAddress) {
      setError('Please enter a valid contract address and ensure a pool is detected.');
      return;
    }

    try {
      const web3 = new Web3('http://37.27.107.225:7777'); // Your node

      const poolData = await fetchLiquidityPoolData(web3, poolAddress);
      const price = calculatePrice(poolData.reserve0, poolData.reserve1, address, poolData.token0, poolData.token1);

      if (!price) {
        throw new Error('Failed to calculate price. Target token may not be in the pool.');
      }

      setTokenPrice(price);
      setLogs((prev) => [...prev, `Current Token Price: ${price.toFixed(6)}`]);

      const contract = new web3.eth.Contract(
        [
          {
            anonymous: false,
            inputs: [
              { indexed: true, name: 'from', type: 'address' },
              { indexed: true, name: 'to', type: 'address' },
              { indexed: false, name: 'value', type: 'uint256' },
            ],
            name: 'Transfer',
            type: 'event',
          },
        ],
        address
      );

      const latestBlock = await web3.eth.getBlockNumber();
      const fromBlock = Math.max(latestBlock - 500000, 0);

      const pastEvents = await contract.getPastEvents('Transfer', {
        fromBlock,
        toBlock: 'latest',
      });

      const buyAndSellEvents = pastEvents.map((event) => {
        const { from, to, value } = event.returnValues;
        let type = 'Unknown';

        if (to.toLowerCase() === poolAddress.toLowerCase()) {
          type = 'Sell';
        } else if (from.toLowerCase() === poolAddress.toLowerCase()) {
          type = 'Buy';
        }

        return {
          from,
          to,
          value: BigInt(value).toString(),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp: new Date().toISOString(),
          type,
        };
      });

      setLogs((prev) => [...prev, `Filtered ${buyAndSellEvents.length} Buy/Sell events.`]);

      setEvents((prev) => {
        const allEvents = [...buyAndSellEvents, ...prev];
        const uniqueEvents = Array.from(new Set(allEvents.map((e) => e.transactionHash)))
          .map((hash) => allEvents.find((e) => e.transactionHash === hash));
        return uniqueEvents.slice(0, 1000); // Keep latest 1000 transactions
      });

      const chartLabels = buyAndSellEvents.map((e) => e.timestamp);
      const chartValues = buyAndSellEvents.map((e) => parseFloat(e.value));

      setChartData({
        labels: chartLabels,
        datasets: [
          {
            label: 'Transaction Values',
            data: chartValues,
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 2,
            fill: false,
          },
        ],
      });
    } catch (err) {
      setError(`Error occurred: ${err.message}`);
      setLogs((prev) => [...prev, `Error occurred: ${err.message}`]);
    }
  };

  const paginatedEvents = events.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Taraxa Live Chart Debugger</h1>

      <div>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter Contract Address"
          style={{ width: '300px', marginRight: '10px', padding: '5px' }}
        />
        <button onClick={fetchTransferEvents} style={{ padding: '5px 10px' }}>
          Fetch Data
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div>
        <h3>Logs:</h3>
        <ul>
          {logs.map((log, index) => (
            <li key={index}>{log}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3>Transfer Events:</h3>
        <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Value</th>
              <th>Price/Token</th>
              <th>Timestamp</th>
              <th>Transaction Hash</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEvents.map((event, index) => (
              <tr
                key={index}
                style={{
                  backgroundColor: event.type === 'Sell' ? 'red' : event.type === 'Buy' ? 'green' : 'white',
                  color: 'white',
                }}
              >
                <td>{event.from}</td>
                <td>{event.to}</td>
                <td>{event.value}</td>
                <td>${tokenPrice ? tokenPrice.toFixed(6) : 'N/A'}</td>
                <td>{event.timestamp}</td>
                <td>{event.transactionHash}</td>
                <td>{event.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span style={{ margin: '0 10px' }}>Page {currentPage}</span>
          <button
            onClick={() =>
              setCurrentPage((prev) =>
                prev * pageSize < events.length ? prev + 1 : prev
              )
            }
            disabled={currentPage * pageSize >= events.length}
          >
            Next
          </button>
        </div>
      </div>

      <div>
        <h3>Transaction Chart:</h3>
        {chartData ? (
          <Line data={chartData} />
        ) : (
          <p>No chart data available.</p>
        )}
      </div>
    </div>
  );
};

export default App;
