
export const config = {
  // make sure your system capability
  modelPath: "./models/model.gguf",     // Path to GGUF model 
  contextSize: 4096,                     // Context window (tokens)
  maxTokens: 512,                        // Maximum response length
  temperature: 0.7,                      // Creativity (0.0 - 1.0)
  cpuThreads: 4,                         // CPU threads for inference
  gpuLayers: 0,                          // GPU layers (0 = CPU only, -1 = all GPU)
  batchSize: 512,                        // Batch size for processing
  useMlock: false,                       // Lock model in RAM (requires more RAM)
  useMmap: true,                         // Memory map model

  booksDir: "./books",                   // Books directory
  indexDir: "./data/index",              // Index storage
  indexFile: "book-tfidf-index.json",   // TF-IDF index file
  modelsDir: "./models",                 // Models directory
# test the AI performance and adjust
  chunkSize: 500,                        // Words per chunk
  chunkOverlap: 100,                     // Overlap between chunks
  topK: 5,                               // Number of chunks to retrieve
  minLocalRelevance: 0.30,               // Threshold for local-only answer
  maxContextCharacters: 6000,            // Max context sent to model

  webSearchEnabled: true,                // Enable DuckDuckGo
  wikipediaEnabled: true,                // Enable Wikipedia
  duckDuckGoSearchMaxResults: 3,         // Max DDG results
  wikipediaSearchMaxResults: 2,          // Max Wikipedia results
  webTimeoutMs: 8000,                    // Web request timeout
  //use goolge translator to translate local into english or other
  translationEnabled: true,              // Auto-translate queries
  translationEndpoint: "https://translate.googleapis.com/translate_a/single",
  translationTimeoutMs: 5000,
// this server is not for deployment 
  host: "127.0.0.1",                     // Server host
  port: 3000,                            // Server port
  maxPromptLength: 2000,                 // Max user input length
  requestTimeoutMs: 180000,              // Max request time
// try to use 0(1) lookup 
  useQueue: true,                        // Single inference queue
  cacheIndex: true,                      // Cache index in RAM
  persistIndex: true,                    // Save index to disk
  autoReindex: false,                    // Auto-reindex on changes
  maxConcurrentRequests: 1,              // Concurrent inference limit
// conditions to run system carefully
  maxFileSizeMB: 50,                     // Max book file size
  allowedFileTypes: [".txt", ".md", ".pdf"], // Supported formats
  sanitizeOutput: true,                  // Clean model output
  rateLimit: {
    enabled: true,
    maxRequests: 60,                     // Requests per window
    windowMs: 60000,                     // Window in ms (1 minute)
  },

  logLevel: "info",                      // debug, info, warn, error
  logToFile: false,                      // Save logs to file
  logFilePath: "./data/gz-ai.log",
};

