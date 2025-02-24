const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = 9999;

// Use environment variable for the database URL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Read from ENV variable
    ssl: {
        rejectUnauthorized: false // Required if connecting to a cloud provider
    }
});
// Middleware to parse JSON requests with large payloads
app.use(express.json({ limit: '5mb' })); // Adjust limit as needed
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Serve static files from 'static' directory
app.use(express.static(path.join(__dirname, 'static')));

// Route to test database connection
app.get('/db-test', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as current_time');
        res.json({ success: true, currentTime: result.rows[0].current_time });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// POST endpoint for processing large text input
app.post('/process', (req, res) => {
    console.log("got process")
    if (!req.body || !req.body.data) {
        return res.status(400).json({ error: "Missing 'data' field in request body" });
    }

    const inputText = req.body.data;

    // Example processing: counting words and lines
    const wordCount = inputText.split(/\s+/).filter(Boolean).length;
    const lineCount = inputText.split(/\r?\n/).length;

    res.json({
        message: "Processed successfully",
        wordCount,
        lineCount,
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
