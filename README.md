# Paper Summary Web App

This is a simple web application that allows you to upload a research paper in PDF format and get a summary of its content using Google's Gemini Pro API.

## Features

- Upload a PDF file.
- Extracts text from the PDF.
- Generates a summary using the Gemini Pro API.
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

3. **Add your Gemini API Key:**

   - Create a new file named `.env` in the root of the project directory.
   - Copy the content from `.env.example` into `.env`.
   - In the `.env` file, replace `"YOUR_API_KEY"` with your actual Gemini API key. You can obtain a key from [Google AI Studio](https://aistudio.google.com/).

     ```batch
     GEMINI_API_KEY="YOUR_API_KEY"
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
   node server.js 9000
   ```

2. **Open the application in your browser:**

   Navigate to [http://localhost:3000](http://localhost:3000).

Now you can upload a PDF file and get its summary.
