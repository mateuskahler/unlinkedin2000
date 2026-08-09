const OFFSCREEN_DOCUMENT_PATH = 'web_classifier_amalgamation/offscreen.html';

// Checks if the offscreen document is already created and active
async function ensureOffscreenDocumentCreated() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
  });

  if (existingContexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ['WORKERS'],
      justification: 'Offline machine learning model execution'
    });
  }
}

async function handleClassificationRequest(text) {
  await ensureOffscreenDocumentCreated();

  return new Promise((resolve) => {
    // Placeholder 
    resolve({
      status: 'APPROVED',
    });
  });
}

// Listen for messages (hopefully coming from content.js)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'CLASSIFY_POST') {
    return false;
  }

  handleClassificationRequest(message.text)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ status: 'ERROR', error: error.message }));

  return true; // Keeps the message channel open for async sendResponse
});