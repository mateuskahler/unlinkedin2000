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
  // TODO: search for inner content
  const innerContentElements = [];

  outerDivs.forEach((outerDiv) => {
    innerContentElements.push({
      outer: outerDiv,
      inner: null
    });
  });

  return innerContentElements;
}

////////////////////////////////////////////////////////////////////////////////////
// Visual feedback

function applyTransformation(item) {
  const { outer, inner } = item;
  if (outer) {
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
