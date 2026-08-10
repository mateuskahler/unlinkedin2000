// Configure Offline Environment paths
import * as transformers from './transformers.min.js';

transformers.env.allowRemoteModels = false;
transformers.env.allowLocalModels = true;
transformers.env.useBrowserCache = false;
transformers.env.localModelPath = chrome.runtime.getURL('web_classifier_amalgamation/models/');
transformers.env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('web_classifier_amalgamation/');
transformers.env.localModelPath = chrome.runtime.getURL('web_classifier_amalgamation/models/');

console.log('[offscreen.js] ML Environment configured. Model path:', transformers.env.localModelPath);


// Singleton Promise Model Cache (aka: don't reload the model multiple times)
let modelPromise = null;

async function load_model() {
    if (!modelPromise) {
        console.log(`Loading Xenova/DeBERTa-v3-xsmall-mnli-fever-anli-ling-binary...`);

        modelPromise = transformers.pipeline(
            'zero-shot-classification',
            'Xenova/DeBERTa-v3-xsmall-mnli-fever-anli-ling-binary',
            {
                local_files_only: true,
                dtype: 'q8'
            }
        );

        console.log("Model loaded.");
    }
    return modelPromise;
}

/**
 * load_labels -> Object { candidateLabels, reproveLabelsIndexes }
 */
function load_labels() {
    return {
        candidateLabels: [
            "artificial intelligence, machine learning, or neural networks",
            "coding agents, LLMs, or AI-powered tools and services",
            "personal life, hobbies, family, or general conversation",
            "health, medicine, healthcare, personal sports or fitness topics",
            "entertainment, movies, music, dance, television series or pop culture",
        ],
        reproveLabelsIndexes: [0, 1] // Indexes of labels considered as "reproved"
    };
}

// 5. Run inference on the text and return structured results
async function handleInferenceRequest(text) {
    const classifier = await load_model();
    const { candidateLabels, reproveLabelsIndexes } = load_labels();
    const output = await classifier(text, candidateLabels);

    // Guard: Ensure classifier output returns expected properties
    if (!output || !Array.isArray(output.labels) || !Array.isArray(output.scores)) {
        throw new Error('Invalid or malformed output from classification pipeline');
    }

    // Transformers.js zero-shot output sorts labels and scores in descending order of confidence
    const topLabel = output.labels[0];
    const topScore = output.scores[0];

    const topLabelIndex = candidateLabels.indexOf(topLabel);

    const isReproved = reproveLabelsIndexes.includes(topLabelIndex);
    const classificationDecision = isReproved ? 'REPROVED' : 'APPROVED';

    return {
        status: 'SUCCESS',
        data: {
            decision: classificationDecision,
            topLabel: topLabel,
            topScore: topScore,
            labels: output.labels,
            scores: output.scores,
            evaluatedText: text
        }
    };
}

///////////////////////////////////////////////////////////////////////////////////
// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target === 'offscreen' && message.action === 'RUN_INFERENCE') {

        handleInferenceRequest(message.text)
            .then((response) => sendResponse(response))
            .catch((error) => {
                console.error('[offscreen.js] Inference error:', error);
                sendResponse({ status: 'ERROR', error: error.message });
            });

        return true; // Keeps channel open for async response
    }
});
