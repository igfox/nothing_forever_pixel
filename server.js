const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

app.post('/api/generate-scene', async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(500).json({
                error: 'ANTHROPIC_API_KEY not configured. Please add it to your .env file.'
            });
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Claude API error:', response.status, errorData);
            return res.status(response.status).json({
                error: `Claude API error: ${response.status}`,
                details: errorData
            });
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🎬 Nothing Forever server running on http://localhost:${PORT}`);
    console.log(`📺 Open http://localhost:${PORT}/script.html in your browser`);
});
