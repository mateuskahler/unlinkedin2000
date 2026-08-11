function cleanTextForTokenization(text) {
  if (!text) return '';

  // UTF-16 surrogates
  let adjustedText = typeof text.toWellFormed === 'function' 
    ? text.toWellFormed() 
    : text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g, '');

  // remove trailing indicator (handles '… more', '... more', '…more', etc.)
  adjustedText = adjustedText.replace(/(?:…|\.\.\.)\s*more$/i, '').trim();

  // normalize spaces, quotes, and unseen DOM artifacts
  adjustedText = adjustedText
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  
  return adjustedText;
}

function sendMessageWithTimeout(message, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let isSettled = false;

    const timer = setTimeout(() => {
      if (isSettled) return;
      isSettled = true;
      reject(new Error(`Message timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    chrome.runtime.sendMessage(message, (response) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);

      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}


class AsyncQueue {
  constructor() {
    this.chain = Promise.resolve();
    this.processedSet = new WeakSet(); // Track successfully processed DOM nodes
    this.maxRetries = 3;
  }

  enqueue(items, workerFn) {
    for (const item of items) {
      if (!item.outer || this.processedSet.has(item.outer)) continue;

      this.chain = this.chain.then(async () => {
        if (this.processedSet.has(item.outer)) return;

        let success = false;

        // internal retry loop
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
          try {
            await workerFn(item);
            success = true;
            this.processedSet.add(item.outer);
            break;
          } catch (err) {
            console.warn(
              `[content.js][Queue] Attempt ${attempt}/${this.maxRetries} failed for item:`,
              err.message
            );
          }
        }

        if (!success) {
          console.error(`[content.js][Queue] Giving up on item after ${this.maxRetries} attempts.`);
        }
      });
    }
  }
}