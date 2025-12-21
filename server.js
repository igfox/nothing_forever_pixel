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

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({
                error: 'GEMINI_API_KEY not configured. Please add it to your .env file.'
            });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${process.env.GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 2000, // Increased for longer scenes (15-20 exchanges)
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Gemini API error:', response.status, errorData);
            return res.status(response.status).json({
                error: `Gemini API error: ${response.status}`,
                details: errorData
            });
        }

        const data = await response.json();

        // Convert Gemini response format to match Claude format for frontend compatibility
        const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log('=== GEMINI RESPONSE ===');
        console.log('Full response:', JSON.stringify(data, null, 2));
        console.log('Extracted text:', geminiText);
        console.log('=====================');

        const convertedResponse = {
            content: [{
                text: geminiText
            }]
        };

        res.json(convertedResponse);

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🎬 Pixels Forever server running on http://localhost:${PORT}`);
    console.log(`📺 Open http://localhost:${PORT}/script.html in your browser`);
});
