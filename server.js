require('dotenv').config();

const express = require('express');
const path = require('path');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const net = require('net');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const app = express();
let predefinedPrompts = []; // Array to store prompts from prompt.json

app.use(express.static(__dirname)); // Serve static files from the current directory
app.use(express.json()); // Middleware to parse JSON bodies


// --- Summarization Helper Function ---
async function performSummarization(pdfContent, userPrompt, res) {
    // Add error listener to prevent crash on response stream error
    res.on('error', (err) => {
        console.error('Response stream error:', err);
    });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'No key available';
    const SELECTED_MODEL = process.env.LLM_MODEL || 'gemini-2.5-flash';
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const llm = genAI.getGenerativeModel({ model: SELECTED_MODEL });

    try {
        console.log("Extracting text from PDF document...")

        const pdfDocument = new PDFParse(pdfContent);
        const pdfData = await pdfDocument.getText();
        const text = pdfData.pages.map(p => p.text).join('\n');

        if (!text.trim()) {
            return res.status(400).json({ error: 'Could not extract text from the PDF.' });
        }

        console.log("Requesting task to Gemini...")

        const defaultPrompt = `Please summarize the following text in a table format, including the problem, contribution, proposed method, experimental results, and conclusion. If any of these sections are not present, please indicate 'N/A'. Please use a concise, outline format for the sentences.:\n\n${text}`;
        const prompt = userPrompt ? `${userPrompt}:\n\n${text}` : defaultPrompt;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const result = await llm.generateContentStream(prompt);

        for await (const chunk of result.stream) {
            const chunkText = chunk.text?.();
            if (res.writable && chunkText) {
                res.write(chunkText);
            }
        }

        if (res.writable) {
            res.end();
        }
    } catch (error) {
        console.error('Error:', error);
        if (!res.headersSent && res.writable) {
            res.status(500).json({ error: 'An error occurred during summarization.' });
        } else if (res.writable) {
            res.end();
        }
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// New endpoint to serve predefined prompts
app.get('/prompts', (req, res) => {
    res.json(predefinedPrompts);
});

// Route for file uploads
app.post('/summarize-file', upload.single('pdfFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No PDF file provided.' });
    }
    const pdfContent = { data: req.file.buffer };
    const userPrompt = req.body.prompt;
    await performSummarization(pdfContent, userPrompt, res);
});

// Route for URL submissions
app.post('/summarize-url', async (req, res) => {
    const pdfUrl = req.body.pdfUrl;
    if (!pdfUrl) {
        return res.status(400).json({ error: 'No PDF URL provided.' });
    }
    const pdfContent = { url: pdfUrl };
    const userPrompt = req.body.prompt;
    await performSummarization(pdfContent, userPrompt, res);
});


// Function to check if a port is in use (exclusive check)
function checkPort(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.unref();
        server.on('error', () => {
            // Error means port is in use (by us or another app)
            resolve(true);
        });
        server.listen({ port, exclusive: true }, () => {
            // Successfully listened, means port is free
            server.close(() => {
                resolve(false);
            });
        });
    });
}

// Function to find the first available port
async function findAvailablePort(startPort) {
    let port = startPort;

    while (true) {
        const isInUse = await checkPort(port);
        if (!isInUse) {
            return port;
        }
        console.log(`Port ${port} is in use (shared or exclusive), trying ${port + 1}...`);
        port++;
    }
}

// Main function to start the application
async function startApp() {
    let targetPort;
    const specifiedPortArg = process.argv[2]; // Assuming port is the 3rd argument (node server.js <port>)

    if (specifiedPortArg && !isNaN(specifiedPortArg)) {
        targetPort = parseInt(specifiedPortArg, 10);
        console.log(`Attempting to start server on specified port: ${targetPort}`);
    } else {
        console.log('No port specified, finding an available port starting from 8988...');
        targetPort = await findAvailablePort(8988);
    }

    try {
        const data = await fs.readFile(path.join(__dirname, 'prompt.json'), 'utf8');
        predefinedPrompts = JSON.parse(data);
        console.log('Prompts loaded successfully from prompt.json');
    } catch (error) {
        console.error('Failed to load prompts from prompt.json:', error);
        // Optionally, handle error more gracefully, e.g., by using default prompts
    }

    const server = app.listen(targetPort, () => {
        console.log(`Server listening at http://localhost:${targetPort}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Error: Port ${targetPort} is already in use.`);
            if (specifiedPortArg) {
                console.error('Please choose a different port or omit the port argument to let the server find one.');
            } else {
                console.error('The default port finding mechanism failed to find a free port. This is unexpected.');
            }
            process.exit(1);
        } else {
            console.error('Server error:', err);
            process.exit(1);
        }
    });
}

startApp();