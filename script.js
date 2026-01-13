const promptSelect = document.getElementById('prompt-select');
const customPrompt = document.getElementById('custom-prompt');
const fileInput = document.getElementById('pdf-upload');
const pdfUrlInput = document.getElementById('pdf-url-input');
const summarizeBtn = document.getElementById('summarize-btn');
const summaryOutput = document.getElementById('summary-output');
const loadingAnimation = document.getElementById('loading-animation');
const copyButtonsContainer = document.querySelector('.copy-buttons-container');
const copyRichTextBtn = document.getElementById('copy-rich-text-btn');
const copyHtmlBtn = document.getElementById('copy-html-btn');
const copyMarkdownBtn = document.getElementById('copy-markdown-btn');
const pageRangeSection = document.getElementById('page-range-section');
const startPageSelect = document.getElementById('start-page');
const endPageSelect = document.getElementById('end-page');

let rawMarkdownOutput = ''; // To store the raw Markdown for copying
let extractedPages = []; // Store extracted text per page

document.addEventListener('DOMContentLoaded', async () => {
    // Configure marked to treat underscores as literal text
    if (typeof marked !== 'undefined') {
        marked.use({
            walkTokens(token) {
                if ((token.type === 'em' || token.type === 'strong') && token.raw.startsWith('_')) {
                    token.type = 'text';
                    token.text = token.raw;
                    delete token.tokens;
                }
                if (token.type === 'del') {
                    token.type = 'text';
                    token.text = token.raw;
                    delete token.tokens;
                }
            },
            extensions: [{
                name: 'mathDelimiters',
                level: 'inline',
                start(src) { return src.match(/\\[\[\]()]/)?.index; },
                tokenizer(src, tokens) {
                    const match = /^(\\[\[\]()])/.exec(src);
                    if (match) {
                        return {
                            type: 'text',
                            raw: match[0],
                            text: match[0]
                        };
                    }
                }
            }]
        });
    }

    try {
        const response = await fetch('/prompts');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const prompts = await response.json();

        // Get a reference to the 'custom' option
        const customOption = promptSelect.querySelector('option[value="custom"]');

        prompts.forEach(prompt => {
            const option = document.createElement('option');
            option.value = prompt.value;
            option.textContent = prompt.label;
            // Insert before the custom option
            promptSelect.insertBefore(option, customOption);
        });

        // Set the default prompt selection to the first one loaded, or 'default' if it exists
        const defaultPrompt = prompts.find(p => p.id === 'default');
        if (defaultPrompt) {
            promptSelect.value = defaultPrompt.value;
        } else if (prompts.length > 0) {
            promptSelect.value = prompts[0].value;
        }

        // Show/hide custom prompt textarea based on initial selection
        if (promptSelect.value === 'custom') {
            customPrompt.style.display = 'block';
        } else {
            customPrompt.style.display = 'none';
        }

    } catch (error) {
        console.error('Failed to load prompts:', error);
        // Optionally, display an error message to the user
    }
});


promptSelect.addEventListener('change', () => {
    if (promptSelect.value === 'custom') {
        customPrompt.style.display = 'block';
    } else {
        customPrompt.style.display = 'none';
    }
});

// Function to extract text from PDF
async function extractPdfText(formData = null, jsonBody = null) {
    loadingAnimation.style.display = 'flex';
    loadingAnimation.querySelector('p').textContent = 'Extracting text...';
    summaryOutput.innerHTML = '';
    pageRangeSection.style.display = 'none';
    extractedPages = [];

    try {
        const options = { method: 'POST' };
        if (formData) {
            options.body = formData;
        } else if (jsonBody) {
            options.body = JSON.stringify(jsonBody);
            options.headers = { 'Content-Type': 'application/json' };
        }

        const response = await fetch('/extract-text', options);
        if (!response.ok) throw new Error('Failed to extract text');

        const data = await response.json();
        extractedPages = data.pages;

        // Populate page selects
        startPageSelect.innerHTML = '';
        endPageSelect.innerHTML = '';
        extractedPages.forEach((_, index) => {
            const pageNum = index + 1;
            const optionStart = new Option(pageNum, index);
            const optionEnd = new Option(pageNum, index);
            startPageSelect.add(optionStart);
            endPageSelect.add(optionEnd);
        });

        // Set defaults (Start: 1, End: Last)
        if (extractedPages.length > 0) {
            startPageSelect.value = 0;
            endPageSelect.value = extractedPages.length - 1;
            pageRangeSection.style.display = 'block';
        }

    } catch (error) {
        console.error('Extraction error:', error);
        summaryOutput.innerHTML = `<p style="color: red;">Error extracting PDF text: ${error.message}</p>`;
    } finally {
        loadingAnimation.style.display = 'none';
        loadingAnimation.querySelector('p').textContent = 'Waiting for summary...';
    }
}

// Input clear/disable logic
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        pdfUrlInput.value = ''; // Clear URL input
        pdfUrlInput.disabled = true; // Disable URL input

        const formData = new FormData();
        formData.append('pdfFile', fileInput.files[0]);
        extractPdfText(formData, null);
    } else {
        pdfUrlInput.disabled = false; // Enable URL input
        pageRangeSection.style.display = 'none';
    }
});

// Drag and drop functionality for file input
fileInput.addEventListener('dragover', (e) => {
    e.preventDefault(); // Prevent default to allow drop
    fileInput.classList.add('drag-over');
});

fileInput.addEventListener('dragleave', () => {
    fileInput.classList.remove('drag-over');
});

fileInput.addEventListener('drop', (e) => {
    e.preventDefault(); // Prevent default file handling
    fileInput.classList.remove('drag-over');

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
        fileInput.files = droppedFiles; // Assign dropped files to the input
        // Trigger change event manually if needed, or rely on form submission
        const event = new Event('change');
        fileInput.dispatchEvent(event);
    }
});


pdfUrlInput.addEventListener('change', () => {
    if (pdfUrlInput.value.trim() !== '') {
        fileInput.value = ''; // Clear file input
        fileInput.disabled = true; // Disable file input

        extractPdfText(null, { pdfUrl: pdfUrlInput.value.trim() });
    } else {
        fileInput.disabled = false; // Enable file input
        pageRangeSection.style.display = 'none';
    }
});

// Function to copy text to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy to clipboard.');
    }
}

copyRichTextBtn.addEventListener('click', async () => {
    try {
        const htmlContent = summaryOutput.innerHTML;
        const textContent = summaryOutput.innerText;
        const blobHtml = new Blob([htmlContent], { type: 'text/html' });
        const blobText = new Blob([textContent], { type: 'text/plain' });
        const data = [new ClipboardItem({
            'text/html': blobHtml,
            'text/plain': blobText
        })];
        await navigator.clipboard.write(data);
        alert('Rich text copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy rich text: ', err);
        alert('Failed to copy rich text.');
    }
});

copyHtmlBtn.addEventListener('click', () => {
    copyToClipboard(summaryOutput.innerHTML);
});

copyMarkdownBtn.addEventListener('click', () => {
    copyToClipboard(rawMarkdownOutput);
});


summarizeBtn.addEventListener('click', async () => {
    summaryOutput.innerHTML = ''; // Clear previous summary
    copyButtonsContainer.classList.remove('visible'); // Hide copy buttons
    rawMarkdownOutput = ''; // Clear previous raw markdown
    loadingAnimation.style.display = 'flex'; // Show loading animation

    let selectedPrompt = promptSelect.value;
    if (selectedPrompt === 'custom') {
        selectedPrompt = customPrompt.value;
    }

    if (extractedPages.length === 0) {
        summaryOutput.innerHTML = '<p style="color: red;">Please upload a PDF first.</p>';
        loadingAnimation.style.display = 'none';
        return;
    }

    // Get selected page range
    const startIndex = parseInt(startPageSelect.value);
    const endIndex = parseInt(endPageSelect.value);

    if (startIndex > endIndex) {
        summaryOutput.innerHTML = '<p style="color: red;">Start page cannot be greater than end page.</p>';
        loadingAnimation.style.display = 'none';
        return;
    }

    const selectedText = extractedPages.slice(startIndex, endIndex + 1).join('\n');

    try {
        const response = await fetch('/summarize', {
            method: 'POST',
            body: JSON.stringify({ text: selectedText, prompt: selectedPrompt }),
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            if (errorData && errorData.error) {
                throw new Error(errorData.error);
            }
            throw new Error(`An error occurred: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            const chunkText = decoder.decode(value, { stream: true });
            rawMarkdownOutput += chunkText; // Accumulate raw markdown
            const htmlOutput = marked.parse(rawMarkdownOutput); // Parse accumulated markdown
            summaryOutput.innerHTML = htmlOutput.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

            // Trigger MathJax rendering after content update
            if (window.MathJax) {
                MathJax.typesetPromise([summaryOutput]); // Process only the summaryOutput element
            }
        }
        copyButtonsContainer.classList.add('visible'); // Show copy buttons on success

    } catch (error) {
        summaryOutput.innerHTML = `<p style="color: red;">An error occurred: ${error.message}</p>`;
    } finally {
        loadingAnimation.style.display = 'none'; // Hide loading animation on completion/error
    }
});