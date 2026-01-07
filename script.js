const promptSelect = document.getElementById('prompt-select');
const customPrompt = document.getElementById('custom-prompt');
const fileInput = document.getElementById('pdf-upload');
const pdfUrlInput = document.getElementById('pdf-url-input');
const summarizeBtn = document.getElementById('summarize-btn');
const summaryOutput = document.getElementById('summary-output');
const loadingAnimation = document.getElementById('loading-animation');
const copyButtonsContainer = document.querySelector('.copy-buttons-container');
const copyHtmlBtn = document.getElementById('copy-html-btn');
const copyMarkdownBtn = document.getElementById('copy-markdown-btn');

let rawMarkdownOutput = ''; // To store the raw Markdown for copying

document.addEventListener('DOMContentLoaded', async () => {
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

// Input clear/disable logic
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        pdfUrlInput.value = ''; // Clear URL input
        pdfUrlInput.disabled = true; // Disable URL input
    } else {
        pdfUrlInput.disabled = false; // Enable URL input
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


pdfUrlInput.addEventListener('input', () => {
    if (pdfUrlInput.value.trim() !== '') {
        fileInput.value = ''; // Clear file input
        fileInput.disabled = true; // Disable file input
    } else {
        fileInput.disabled = false; // Enable file input
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

    let requestBody;
    let headers = {};
    let fetchUrl;

    if (fileInput.files.length > 0) {
        // File upload
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('pdfFile', file);
        formData.append('prompt', selectedPrompt);
        requestBody = formData;
        fetchUrl = '/summarize-file'; // New endpoint for file uploads
    } else if (pdfUrlInput.value.trim() !== '') {
        // URL submission
        const pdfUrl = pdfUrlInput.value.trim();
        requestBody = JSON.stringify({ pdfUrl: pdfUrl, prompt: selectedPrompt });
        headers['Content-Type'] = 'application/json';
        fetchUrl = '/summarize-url'; // New endpoint for URL submissions
    } else {
        summaryOutput.innerHTML = '<p style="color: red;">Please select a PDF file or enter a PDF URL.</p>';
        loadingAnimation.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(fetchUrl, { // Use the determined fetchUrl
            method: 'POST',
            body: requestBody,
            headers: headers,
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
            summaryOutput.innerHTML = marked.parse(rawMarkdownOutput); // Parse accumulated markdown

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