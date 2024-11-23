import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import Web3 from 'web3';

const NODE_URL = 'http://37.27.107.225:7777'; // Replace with your node's RPC URL
const web3 = new Web3(new Web3.providers.HttpProvider(NODE_URL));

// Replace with your contract ABI and address
const CONTRACT_ADDRESS = '0x063F255689b00A877F6be55109b3ECA24e266809';
const ABI = [
  {
    constant: true,
    inputs: [],
    name: 'getHistoricalData',
    outputs: [
      { name: 'timestamps', type: 'uint256[]' },
      { name: 'prices', type: 'uint256[]' },
    ],
    type: 'function',
  },
];

function Chart() {
  const [chartData, setChartData] = useState(null);
  const [error, setError] = useState(null);

  const fetchChartData = async () => {
    try {
      const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
      const { timestamps, prices } = await contract.methods.getHistoricalData().call();

      // Format data for the chart
      const formattedData = timestamps.map((timestamp, index) => ({
        x: new Date(timestamp * 1000), // Convert UNIX timestamp to JS Date
        y: prices[index] / 1e18, // Adjust price format (if needed)
      }));

      setChartData(formattedData);
    } catch (err) {
      console.error('Error fetching chart data:', err);
      setError('Failed to fetch chart data.');
    }
  };

  useEffect(() => {
    fetchChartData();
  }, []);

  if (error) {
    return <p className="error">{error}</p>;
  }

  if (!chartData) {
    return <p>Loading chart...</p>;
  }

  return (
    <div>
      <h2>Price Chart</h2>
      <Line
        data={{
          datasets: [
            {
              label: 'Price over Time',
              data: chartData,
              borderColor: 'rgba(75,192,192,1)',
              backgroundColor: 'rgba(75,192,192,0.2)',
              fill: true,
            },
          ],
        }}
        options={{
          scales: {
            x: {
              type: 'time',
              time: { unit: 'day' },
            },
            y: {
              title: { display: true, text: 'Price' },
            },
          },
        }}
      />
    </div>
  );
}

export default Chart;
