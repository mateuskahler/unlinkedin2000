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
    chrome.runtime.sendMessage(
      { target: 'offscreen', action: 'RUN_INFERENCE', text: text },
      (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          console.error('[background.js] Messaging error with offscreen document:', lastError.message);
          resolve({ status: 'ERROR', error: lastError.message });
          return;
        }

        if (!response || response.status !== 'SUCCESS') {
          const errorMessage = response ? response.error : 'No response from offscreen pipeline';
          resolve({ status: 'ERROR', error: errorMessage });
          return;
        }

        /** Response structure from offscreen.js:      
        status: 'SUCCESS' || 'ERROR',
        data: {
            decision: 'APPROVED' || 'REPROVED',
            reason: 'MODEL_INFERENCE' || 'REGEX_MATCH',
            labels: output.labels,
            scores: output.scores,
            evaluatedText: text
        }
        */

        console.log('[background.js] Received evaluated text:', response.data.evaluatedText);
        console.log('[background.js] Classification Decision:', response.data.decision);
        console.log('[background.js] Classification Reason:', response.data.reason);
        console.log('[background.js] Received Labels:', response.data.labels);
        console.log('[background.js] Received Scores:', response.data.scores);

        resolve({
          status: 'SUCCESS',
          decision: response.data.decision,
          outputs: response.data
        });
      }
    );
  });
}

// Listen for messages coming from content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen' && message.action === 'CLASSIFY_POST') {
    handleClassificationRequest(message.text)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ status: 'ERROR', error: err.message }));

    return true; // Keeps channel open for async sendResponse
  }
});
