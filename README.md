# PDF Summary Web App

This is a simple web application that allows you to upload a research paper in PDF format and get a summary of its content using Large Language Models (Gemini, OpenAI, Ollama).

## Features

- Upload a PDF file.
- Extracts text from the PDF.
- Generates a summary using Gemini, OpenAI, or Ollama.
- Displays the summary on the web page.

## Prerequisites

- [Node.js](https://nodejs.org/) (which includes npm) installed on your system.

## Setup

1. **Clone the repository or download the files.**

2. **Install dependencies:**

   Open your terminal in the project directory and run:

   ```bash
   npm install
   ```

3. **Configure Environment Variables:**

   - Create a new file named `.env` in the root of the project directory.
   - Copy the content from `.env.example` into `.env`.
   - Configure the variables based on your preferred LLM provider.

   **Gemini (Default)**

   ```env
   LLM_MODEL="gemini"
   GEMINI_API_KEY="YOUR_API_KEY"
   GEMINI_MODEL="gemini-2.5-flash"
   ```

   **OpenAI / LM Studio**

   ```env
   LLM_MODEL="openai"
   OPENAI_API_KEY="YOUR_API_KEY" # or "lm-studio" for local
   OPENAI_MODEL="gpt-4o"
   OPENAI_URL="http://127.0.0.1:1234"
   ```

   **Ollama**

   ```env
   LLM_MODEL="ollama"
   OLLAMA_MODEL="gpt-oss"
   OLLAMA_URL="http://127.0.0.1:11434"
   OLLAMA_CTX="32000"
   ```

## Running the Application

1. **Start the server:**

   You can use the provided batch file to start the server. This will also ensure all dependencies are installed first.

   ```bash
   start_server.bat
   ```

   Alternatively, you can manually run:

   ```bash
   npm install
   node server.js 8988
   ```

2. **Open the application in your browser:**

   Navigate to [http://localhost:8988](http://localhost:8988).

Now you can upload a PDF file and get its summary.
