const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000', // React frontend
    methods: ['GET', 'POST'],
  },
});

app.use(cors());

// Route to fetch transaction data for a specific address
app.get('/api/transactions/:address', async (req, res) => {
  const { address } = req.params;

  try {
    const response = await axios.get(
      `http://95.217.198.167/api/v2/addresses/${address}/transactions`,
      {
        params: { filter: 'to' }, // Add the filter as a query parameter
        headers: {
          accept: 'application/json', // Set the required header
        },
      }
    );

    res.json(response.data); // Send the fetched data to the frontend
  } catch (error) {
    console.error('Error fetching data from Taraxa API:', {
      message: error.message,
      stack: error.stack,
      response: error.response ? error.response.data : 'No response data',
    });
    res.status(500).json({ error: 'Failed to fetch data from Taraxa API' });
  }
});

// WebSocket connection for real-time updates
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });

  // Real-time data simulation (Replace with actual live updates)
  setInterval(async () => {
    try {
      const liveData = { message: 'Simulated real-time data' }; // Replace with real data if needed
      socket.emit('liveData', liveData);
    } catch (err) {
      console.error('Error fetching live data', err);
    }
  }, 5000); // Update every 5 seconds
});

server.listen(5000, () => {
  console.log('Backend server running on port 5000');
});
