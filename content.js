// Scoped & Debounced Pipeline

const PROCESSED_ATTR = 'data-unlink2000-processed';

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

function applyTransformation(item) {
  const { outer, inner } = item;
  if (outer && inner) {
    inner.style.border = '3px solid red';
    inner.style.boxSizing = 'border-box';
    inner.style.padding = '4px';

    outer.style.border = '3px solid green';
    outer.style.boxSizing = 'border-box';
    outer.style.padding = '4px';

    console.log('Transformed Post:', item.text);
  }
}

////////////////////////////////////////////////////////////////////////////////////
// Pipeline Execution

function runPipeline() {
  const foundDivs = findFeedPostDivs();
  const contentDivs = findInnerPostDivs(foundDivs);
  const contentDivsWithText = extractInnerContentText(contentDivs);

  for (const item of contentDivsWithText) {
    applyTransformation(item);
  }
}

runPipeline();

let debounceTimer = null;

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
