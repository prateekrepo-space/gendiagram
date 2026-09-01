'use strict';

const express = require('express');
const cors = require('cors');
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const S3_BUCKET = process.env.S3_BUCKET;

// ── AWS Clients (use EC2 instance profile credentials automatically) ──────────
const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });
const s3Client = new S3Client({ region: AWS_REGION });

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── System Instruction ────────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `You are a Mermaid.js diagram code generator.
Convert natural language descriptions into valid Mermaid.js diagrams.

Rules:
1. Output ONLY raw Mermaid code — no backticks, no markdown fences, no explanations.
2. Start with the correct diagram type keyword (graph TD, sequenceDiagram, classDiagram, stateDiagram-v2).
3. Ensure 100% valid Mermaid syntax.
4. Make diagrams clear, well-labelled, and informative.`;

// ── POST /api/generate ────────────────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, type } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        let fullPrompt = `Create a ${type || 'graph TD'} diagram for:\n${prompt}\n\nMake it clear and well-structured.`;

        if (type === 'sequenceDiagram') fullPrompt += "\nStart with 'sequenceDiagram'";
        else if (type === 'classDiagram') fullPrompt += "\nStart with 'classDiagram'";
        else if (type === 'stateDiagram') fullPrompt += "\nStart with 'stateDiagram-v2'";
        else fullPrompt += "\nStart with 'graph TD'";

        const command = new ConverseCommand({
            modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
            system: [{ text: SYSTEM_INSTRUCTION }],
            messages: [{ role: 'user', content: [{ text: fullPrompt }] }],
            inferenceConfig: { maxTokens: 2048, temperature: 0.3 },
        });

        const bedrockResponse = await bedrockClient.send(command);
        let text = bedrockResponse.output.message.content[0].text;

        // Strip any accidental markdown fences
        text = text.replace(/```mermaid/gi, '').replace(/```/g, '').trim();

        res.json({ mermaidCode: text });
    } catch (error) {
        console.error('Error generating diagram:', error);
        res.status(500).json({ error: 'Failed to generate diagram. Please try again.' });
    }
});

// ── POST /api/diagrams/save ───────────────────────────────────────────────────
app.post('/api/diagrams/save', async (req, res) => {
    try {
        const { prompt, type, mermaidCode, svgContent } = req.body;
        if (!prompt || !mermaidCode) {
            return res.status(400).json({ error: 'prompt and mermaidCode are required' });
        }

        // Insert diagram metadata into RDS
        const result = await pool.query(
            `INSERT INTO diagrams (prompt, type, mermaid_code)
             VALUES ($1, $2, $3) RETURNING id, created_at`,
            [prompt, type || 'graph TD', mermaidCode]
        );
        const { id, created_at } = result.rows[0];

        // Upload SVG to S3 if provided
        let s3SvgKey = null;
        if (svgContent && S3_BUCKET) {
            s3SvgKey = `diagrams/${id}.svg`;
            await s3Client.send(new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: s3SvgKey,
                Body: svgContent,
                ContentType: 'image/svg+xml',
            }));
            await pool.query(
                'UPDATE diagrams SET s3_svg_key = $1 WHERE id = $2',
                [s3SvgKey, id]
            );
        }

        res.status(201).json({ id, created_at, message: 'Diagram saved successfully' });
    } catch (error) {
        console.error('Error saving diagram:', error);
        res.status(500).json({ error: 'Failed to save diagram' });
    }
});

// ── GET /api/diagrams ─────────────────────────────────────────────────────────
app.get('/api/diagrams', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, prompt, type, created_at
             FROM diagrams
             ORDER BY created_at DESC
             LIMIT 50`
        );
        res.json({ diagrams: result.rows });
    } catch (error) {
        console.error('Error fetching diagrams:', error);
        res.status(500).json({ error: 'Failed to fetch diagrams' });
    }
});

// ── GET /api/diagrams/:id ─────────────────────────────────────────────────────
app.get('/api/diagrams/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM diagrams WHERE id = $1',
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Diagram not found' });

        const diagram = result.rows[0];

        // Generate a 1-hour presigned URL for the SVG if stored in S3
        if (diagram.s3_svg_key && S3_BUCKET) {
            diagram.svgUrl = await getSignedUrl(
                s3Client,
                new GetObjectCommand({ Bucket: S3_BUCKET, Key: diagram.s3_svg_key }),
                { expiresIn: 3600 }
            );
        }

        res.json(diagram);
    } catch (error) {
        console.error('Error fetching diagram:', error);
        res.status(500).json({ error: 'Failed to fetch diagram' });
    }
});

// ── GET / (health check) ──────────────────────────────────────────────────────
app.get('/', (req, res) => res.send('Dgen API is running'));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
