# Google Gemini Integration Guide

This project integrates **Google's Gemini API** to provide intelligent summarization of PDF documents. By leveraging the `@google/generative-ai` SDK, the application can analyze research papers and generate structured summaries, blog posts, or translations based on user-selected prompts.

## 🚀 Setup for Gemini

To use Gemini as your LLM provider, follow these steps:

1. **Get an API Key**:

   - Visit Google AI Studio.
   - Create a new API key.

2. **Configure Environment Variables**:

   - Open or create the `.env` file in the root directory.
   - Set `LLM_MODEL` to `gemini`.
   - Add your API key and desired model version.

   ```env
   LLM_MODEL="gemini"
   GEMINI_API_KEY="your_actual_api_key_here"
   GEMINI_MODEL="gemini-2.5-flash" # or gemini-1.5-pro, etc.
   ```

## 💻 Code Implementation

The integration logic is located in `server.js`.

### `GeminiLLM` Class

The `GeminiLLM` class encapsulates the interaction with the Google Generative AI SDK.

- **Initialization**: It initializes the `GoogleGenerativeAI` client using the API key from environment variables.
- **Streaming**: It uses `generateContentStream` to stream the response chunks back to the client, ensuring a responsive UI.

```javascript
class GeminiLLM {
  constructor() {
    this.model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    this.apiKey = process.env.GEMINI_API_KEY || "No key!";
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
```

## 📄 Prompt Engineering

The application uses predefined prompts stored in `prompt.json` to guide the Gemini model. These prompts are designed to:

- Summarize academic papers into tables.
- Translate abstracts.
- Explain methodologies in blog post format.

Users can also provide **custom prompts** via the UI to tailor the output to their specific needs.
