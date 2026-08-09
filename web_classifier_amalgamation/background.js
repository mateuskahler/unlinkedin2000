async function handleClassificationRequest(text) {

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