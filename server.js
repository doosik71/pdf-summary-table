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


// --- LLM Classes ---

class OpenAILLM {
    constructor() {
        this.baseUrl = process.env.OPENAI_URL || "http://127.0.0.1:1234";
        this.modelName = process.env.OPENAI_MODEL || "gpt-4o";
        this.apiKey = process.env.OPENAI_API_KEY || "lm-studio";

        if (!this.apiKey || !this.baseUrl) {
            throw new Error('OpenAI credentials (OPENAI_API_KEY, OPENAI_URL) are missing.');
        }
    }

    async generateResponse(prompt, res) {
        const url = this.baseUrl + "/v1/chat/completions";
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.modelName,
                messages: [
                    { role: "system", content: "You are a helpful assistant." },
                    { role: "user", content: prompt }
                ],
                stream: true
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        const decoder = new TextDecoder();
        let buffer = '';

        for await (const chunk of response.body) {
            const chunkText = decoder.decode(chunk, { stream: true });
            buffer += chunkText;
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data: ')) {
                    const data = trimmed.slice(6);
                    if (data === '[DONE]') continue;
                    try {
                        const json = JSON.parse(data);
                        const content = json.choices[0]?.delta?.content;
                        if (content && res.writable) {
                            res.write(content);
                        }
                    } catch (e) {
                        console.error('Error parsing OpenAI JSON:', e);
                    }
                }
            }
        }
    }
}

class OllamaLLM {
    constructor() {
        this.model = process.env.OLLAMA_MODEL || "gpt-oss";
        this.baseUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
        this.numCtx = parseInt(process.env.OLLAMA_CTX) || 32000;

        if (!this.model || !this.baseUrl) {
            throw new Error('Ollama credentials (OLLAMA_MODEL, OLLAMA_URL) are missing.');
        }
    }

    async generateResponse(prompt, res) {
        const baseUrl = this.baseUrl.replace(/\/$/, '');
        const response = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: "system", content: "You are a helpful assistant." },
                    { role: "user", content: prompt }
                ],
                stream: true,
                options: {
                    num_ctx: this.numCtx
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
        }

        const decoder = new TextDecoder();
        let buffer = '';

        for await (const chunk of response.body) {
            const chunkText = decoder.decode(chunk, { stream: true });
            buffer += chunkText;
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                    const json = JSON.parse(trimmed);
                    const content = json.message?.content;
                    if (content && res.writable) {
                        res.write(content);
                    }
                } catch (e) {
                    console.error('Error parsing Ollama JSON:', e);
                }
            }
        }
    }
}

class GeminiLLM {
    constructor() {
        this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        this.apiKey = process.env.GEMINI_API_KEY || 'No key!';
    }

    async generateResponse(prompt, res) {
        const genAI = new GoogleGenerativeAI(this.apiKey);
        const llm = genAI.getGenerativeModel({ model: this.model });
        const result = await llm.generateContentStream(prompt);

        for await (const chunk of result.stream) {
            const chunkText = chunk.text?.();
            if (res.writable && chunkText) {
                res.write(chunkText);
            }
        }
    }
}

// --- Summarization Helper Function ---
async function generateSummary(text, userPrompt, res) {
    // Add error listener to prevent crash on response stream error
    res.on('error', (err) => {
        console.error('Response stream error:', err);
    });

    const SELECTED_MODEL = process.env.LLM_MODEL || 'gemini';

    try {
        // Text is provided directly
        const defaultPrompt = `Please summarize the following text in a table format, including the problem, contribution, proposed method, experimental results, and conclusion. If any of these sections are not present, please indicate 'N/A'. Please use a concise, outline format for the sentences.:\n\n${text}`;
        const prompt = userPrompt ? `${userPrompt}:\n\n${text}` : defaultPrompt;

        console.log(`Requesting task to LLM (${SELECTED_MODEL})...`)
        console.log(`Length of request = ${prompt.length} characters.`)

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        let llm;

        if (SELECTED_MODEL.toLowerCase() === 'ollama') {
            llm = new OllamaLLM();
        } else if (SELECTED_MODEL.toLowerCase() === 'openai') {
            llm = new OpenAILLM();
        } else {
            llm = new GeminiLLM();
        }

        await llm.generateResponse(prompt, res);

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

// Route for extracting text from PDF (File or URL)
app.post('/extract-text', upload.single('pdfFile'), async (req, res) => {
    try {
        let pdfContent;
        if (req.file) {
            pdfContent = { data: req.file.buffer };
        } else if (req.body.pdfUrl) {
            pdfContent = { url: req.body.pdfUrl };
        } else {
            return res.status(400).json({ error: 'No PDF provided.' });
        }

        console.log("Extracting text from PDF document...");
        const pdfDocument = new PDFParse(pdfContent);
        const pdfData = await pdfDocument.getText();

        // Return pages as an array of strings
        const pages = pdfData.pages.map(p => p.text);
        res.json({ pages: pages });

    } catch (error) {
        console.error('Extraction Error:', error);
        res.status(500).json({ error: 'Failed to extract text from PDF.' });
    }
});

// Route for summarization (accepts text directly)
app.post('/summarize', async (req, res) => {
    const { text, prompt } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'No text provided for summarization.' });
    }
    await generateSummary(text, prompt, res);
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

    return new Promise((resolve, reject) => {
        const server = app.listen(targetPort, () => {
            console.log(`Server listening at http://localhost:${targetPort}`);
            resolve(targetPort);
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
    });
}

if (require.main === module) {
    startApp();
}

module.exports = { startApp };