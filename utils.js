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
    this.retryMap = new WeakMap();
    this.maxRetries = 3;
  }

  enqueue(items, workerFn) {
    for (const item of items) {
      const attempts = this.retryMap.get(item.outer) || 0;

      if (attempts >= this.maxRetries) continue;

      this.retryMap.set(item.outer, attempts + 1);

      this.chain = this.chain
        .then(async () => {
          await workerFn(item);
          this.retryMap.set(item.outer, this.maxRetries);
        })
        .catch((err) => {
          console.error(`[content.js][Queue Error] Attempt ${attempts + 1} failed:`, err);
        });
    }
  }
}