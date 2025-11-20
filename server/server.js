require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Gemini Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_INSTRUCTION = `
You are a Mermaid.js code generator.
Convert natural language into valid Mermaid.js diagrams.

Rules:
1. Output ONLY raw Mermaid code - no backticks, no markdown, no explanations
2. Start with the diagram type (sequenceDiagram, graph TD, classDiagram, or stateDiagram)
3. Ensure 100% valid syntax
4. Make diagrams clear and informative
5. Use proper Mermaid syntax for all elements
`;

// Routes
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, type } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
            systemInstruction: SYSTEM_INSTRUCTION
        });

        let fullPrompt = `Create a ${type || 'graph TD'} for: ${prompt}\n\nMake it clear and well-structured.`;

        // Add specific type instructions
        if (type === 'sequenceDiagram') {
            fullPrompt += "\nStart with 'sequenceDiagram'";
        } else if (type === 'classDiagram') {
            fullPrompt += "\nStart with 'classDiagram'";
        } else if (type === 'stateDiagram') {
            fullPrompt += "\nStart with 'stateDiagram'";
        } else {
            fullPrompt += "\nStart with 'graph TD'";
        }

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        let text = response.text();

        // Cleanup
        text = text.replace(/```mermaid/g, '').replace(/```/g, '').trim();

        res.json({ mermaidCode: text });

    } catch (error) {
        console.error('Error generating diagram:', error);
        res.status(500).json({ error: 'Failed to generate diagram' });
    }
});

// Download endpoint with proper Content-Disposition headers
app.post('/api/download', (req, res) => {
    try {
        const { content, filename, mimeType } = req.body;

        if (!content || !filename) {
            return res.status(400).json({ error: 'Content and filename are required' });
        }

        // Set headers to force download with correct filename
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', mimeType || 'application/octet-stream');
        res.setHeader('Content-Length', Buffer.byteLength(content));
        res.setHeader('Cache-Control', 'no-cache');

        res.send(content);
    } catch (error) {
        console.error('Error in download:', error);
        res.status(500).json({ error: 'Download failed' });
    }
});

app.get('/', (req, res) => {
    res.send('AI Diagram Maker API is running');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
