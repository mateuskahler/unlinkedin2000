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

// "precision"
const AI_PRECISION_PATTERNS = [
    // 1. Explicit Core Acronyms & Terms (Word-bounded)
    /\b(genai|gen-ai|llm|llms|aagi|rag|gpts|vlm|vlms|mcp)\b/i,
    /\b(generative ai|artificial intelligence|machine learning|deep learning|neural network|neural nets)\b/i,

    // 2. Exact Company & Lab Names (Unambiguous)
    /\b(openai|anthropic|mistral ai|deepmind|cohere|stability ai|midjourney|runwayml|eleutherai|together ai|perplexity ai|groq|scale ai)\b/i,

    // 3. Model Families & Products
    /\b(chatgpt|gpt-3|gpt-3\.5|gpt-4|gpt-4o|gpt-4o-mini|gpt-5|sora)\b/i,
    /\b(claude 2|claude 3|claude 3\.5|claude sonnet|claude opus|claude haiku)\b/i,
    /\b(gemini 1\.5|gemini pro|gemini ultra|gemini flash|bard)\b/i,
    /\b(llama 2|llama 3|llama 3\.1|llama 3\.2|llama 3\.3|codellama)\b/i,
    /\b(mistral 7b|mixtral|codestral|phi-3|phi-4|qwen|deepseek)\b/i,
    /\b(github copilot|copilot\+|devin ai|cursor editor|cursor ide)\b/i,
    /\b(dall-e|stable diffusion|whisper ai)\b/i,

    // 4. AI Concepts & Frameworks (Avoiding generic tech words)
    /\b(prompt engineering|prompt engineer|system prompt|few-shot|zero-shot|chain-of-thought)\b/i,
    /\b(vector database|vector db|chromadb|pinecone|qdrant|weaviate)\b/i,
    /\b(langchain|langgraph|llama-index|llaindex|autogen|crewai|vllm|ollama|lm studio)\b/i,
    /\b(transformer architecture|attention mechanism|fine-tuning|rlhf|dpo|lora|qlora|quantization|gguf)\b/i,

    // 5. Contextual AI Compound Terms
    /\b(ai agent|ai agents|coding agent|autonomous agent|agentic workflow|agentic ai)\b/i,
    /\b(ai model|ai models|language model|large language model|slm|small language model|multimodal model)\b/i,
    /\b(ai startup|ai feature|ai assistant|ai copilot|ai tool|ai tools|ai safety|ai governance|ai ethics|ai regulation|ai act)\b/i
];

function isHighConfidenceAIPost(text) {
    if (!text || typeof text !== 'string') return false;

    return AI_PRECISION_PATTERNS.some((pattern) => pattern.test(text));
}

async function handleInferenceRequest(text) {
    if (isHighConfidenceAIPost(text)) {
        console.log('[offscreen.js] Fast-path AI regex matched. Skipping ML model.');
        return {
            status: 'SUCCESS',
            data: {
                decision: 'REPROVED',
                reason: 'REGEX_MATCH',
                labels: [],
                scores: [],
                evaluatedText: text
            }
        };
    }

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
            reason: 'MODEL_INFERENCE',
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
