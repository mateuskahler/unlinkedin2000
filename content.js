// Scoped & Debounced Pipeline

const PROCESSED_ATTR = 'data-unlink2000-processed';


////////////////////////////////////////////////////////////////////////////////////
// Posts Selection

function findFeedPostDivs() {
  const matchingDivs = [];
  const unprocessedSpans = document.querySelectorAll(`span:not([${PROCESSED_ATTR}])`);

  unprocessedSpans.forEach((span) => {
    span.setAttribute(PROCESSED_ATTR, 'true');

    const text = span.textContent ? span.textContent.trim().toLowerCase() : '';

    if (text === 'feed post') {
      const postDiv = span.closest('div[componentkey]') || span.closest('div.feed-shared-update-v2');

      if (postDiv && !matchingDivs.includes(postDiv)) {
        matchingDivs.push(postDiv);
      }
    }
  });

  return matchingDivs;
}

function findInnerPostDivs(outerDivs) {
  const innerContentElements = [];

  outerDivs.forEach((outerDiv) => {
    const allKeyElements = outerDiv.querySelectorAll('[componentkey]');
    let firstMatch = null;

    for (const element of allKeyElements) {
      const key = (element.getAttribute('componentkey') || '').toLowerCase();

      if ((key.includes('feed') || key.includes('translatable-commentary')) && key.includes('comment')) {
        firstMatch = element;
        break;
      }
    }

    if (firstMatch) {
      innerContentElements.push({
        outer: outerDiv,
        inner: firstMatch
      });
    }
  });

  return innerContentElements;
}

function extractInnerContentText(elements) {
  return elements.map(({ outer, inner }) => {
    const rawText = inner.textContent || '';
    const cleanedText = rawText.replace(/\s+/g, ' ').trim();

    let finalText = '';
    if (cleanedText) {
      finalText = cleanTextForTokenization(cleanedText);
    }

    return { outer, inner, text: finalText };
  });
}

////////////////////////////////////////////////////////////////////////////////////
// Visual feedback

function applyTransformation_Loading(item) {
  const { outer, inner } = item;
  if (outer) {
    outer.style.border = '1px solid blue';
    outer.style.boxSizing = 'border-box';
    outer.style.padding = '4px';
  }
}

function applyTransformation_Approved(item) {
  const { outer, inner } = item;
  if (outer) {
    outer.style.border = '1px solid green';
    outer.style.boxSizing = 'border-box';
    outer.style.padding = '4px';
  }
}

function applyTransformation_Reproved(item) {
  const { outer } = item;
  if (!outer) return;

  outer.style.border = '1px solid red';
  outer.style.boxSizing = 'border-box';
  outer.style.padding = '4px';

  if (outer.parentNode && outer.parentNode.classList.contains('classifier-accordion-wrapper')) {
    return;
  }

  // wrapper element to occupy outer's slot in the DOM
  const wrapper = document.createElement('div');
  wrapper.className = 'classifier-accordion-wrapper';

  outer.parentNode.insertBefore(wrapper, outer);
  wrapper.appendChild(outer);
  outer.style.display = 'none';

  const banner = document.createElement('div');
  banner.className = 'classifier-hidden-banner';
  banner.style.cssText = `
    padding: 10px 14px;
    background-color: #f3f2ef;
    border: 1px dashed #cccccc;
    border-radius: 8px;
    margin: 8px 0;
    font-size: 12px;
    color: #666;
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;
  banner.innerHTML = `
    <span>🛡️ <strong>Post hidden by Unlinkedin2000</strong></span>
    <span style="font-size: 11px; text-decoration: underline;">Click to reveal</span>
  `;

  // add 'toggle' click handler
  banner.addEventListener('click', () => {
    const isHidden = outer.style.display === 'none';
    outer.style.display = isHidden ? '' : 'none';

    banner.querySelector('span:last-child').textContent = isHidden
      ? 'Click to hide'
      : 'Click to reveal';
  });

  // insert banner above outer inside the wrapper
  wrapper.insertBefore(banner, outer);
}

////////////////////////////////////////////////////////////////////////////////////
// Classification

async function classifySinglePost(item) {
  if (!document.body.contains(item.outer)) {
    console.log('[content.js] Skipping element detached from DOM');
    return;
  }

  if (!item.text) return;
  console.log(`[content.js] classifying: ${item.text}`);

  let response;
  try {
    response = await sendMessageWithTimeout({
      action: 'CLASSIFY_POST',
      text: item.text
    });
  } catch (error) {
    console.error('[content.js] Messaging error:', error);
    throw error;
  }

  if (!response || response.status !== 'SUCCESS') {
    console.warn('[content.js] Error from background service worker:', response ? response.error : 'No response');
    throw new Error(response ? response.error : 'No response from background worker');
  }

  console.log(`[content.js] received status: ${response.status}`);

  if (response.decision === 'APPROVED') {
    applyTransformation_Approved(item);
  }
  else {
    applyTransformation_Reproved(item);
  }
}

////////////////////////////////////////////////////////////////////////////////////
// Pipeline Execution

const classification_queue = new AsyncQueue();
let debounceTimer = null;

function runPipeline() {
  const foundDivs = findFeedPostDivs();
  const contentDivs = findInnerPostDivs(foundDivs);
  const contentDivsWithText = extractInnerContentText(contentDivs);

  for (const item of contentDivsWithText) {
    applyTransformation_Loading(item);
    classification_queue.enqueue([item], classifySinglePost);
  }
}

runPipeline();

const observer = new MutationObserver((mutations) => {
  let hasNewNodes = false;

  for (const m of mutations) {
    if (m.addedNodes.length > 0) {
      hasNewNodes = true;
      break;
    }
  }

  if (!hasNewNodes) return;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    requestAnimationFrame(() => runPipeline());
  }, 75);
});

observer.observe(document.body, { childList: true, subtree: true });
