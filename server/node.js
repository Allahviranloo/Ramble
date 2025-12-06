// index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); // Allows the server to accept JSON data in the body

app.get('/api/status', (req, res) => {
  res.json({ message: "Server is running successfully!" });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});