function cleanTextForTokenization(text) {
  if (!text) return '';

  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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