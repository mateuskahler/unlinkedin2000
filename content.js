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
  }
}

////////////////////////////////////////////////////////////////////////////////////
// Pipeline Execution

function runPipeline() {
  const foundDivs = findFeedPostDivs();
  const contentDivs = findInnerPostDivs(foundDivs);

  for (const item of contentDivs) {
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
