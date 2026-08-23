import express from "express";
import fs from "fs";
import path from "path";
import https from "https";
import { execFile } from "child_process";
import { fileURLToPath } from "url";
import { config } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const LLAMA_EXECUTABLE = path.join(__dirname, "llama", "main.exe");

let bookIndex = [];
let indexData = { chunks: [], docFreq: {}, N: 0 };
let generationQueue = Promise.resolve();
const startTime = Date.now();

function log(...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [GZ_AI]`, ...args);
}

function httpsGetJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Invalid JSON response: ${err.message}`));
        }
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    });
    req.on("error", (err) => {
      reject(new Error(`Network error: ${err.message}`));
    });
  });
}

async function createDirectories() {
  const dirs = [
    path.join(__dirname, config.booksDir),
    path.join(__dirname, config.indexDir),
    path.dirname(path.resolve(__dirname, config.modelPath)),
  ];
  for (const dir of dirs) {
    try {
      await fs.promises.mkdir(dir, { recursive: true });
      log(`Directory ready: ${dir}`);
    } catch (err) {
      log(`WARNING: Could not create directory ${dir}: ${err.message}`);
    }
  }
}

async function checkModel() {
  const modelPath = path.resolve(__dirname, config.modelPath);
  if (!fs.existsSync(modelPath)) {
    log(`ERROR: Model file not found at ${modelPath}`);
    return false;
  }
  const modelStats = fs.statSync(modelPath);
  log(`Model file found: ${(modelStats.size / 1024 / 1024).toFixed(2)} MB`);
  if (!fs.existsSync(LLAMA_EXECUTABLE)) {
    log(`ERROR: llama.cpp executable not found at ${LLAMA_EXECUTABLE}`);
    return false;
  }
  log(`llama.cpp executable found: ${LLAMA_EXECUTABLE}`);
  return true;
}

async function generateResponse(englishQuestion, context) {
  const modelReady = await checkModel();
  if (!modelReady) {
    throw new Error("GGUF model or llama.cpp executable not found. Check the logs for details.");
  }

  const modelPath = path.resolve(__dirname, config.modelPath);
  const systemPrompt = `You are GZ_AI, a local retrieval-augmented AI assistant. Answer using the supplied context.
Rules:
1. Prefer information from the supplied context.
2. Do not invent facts.
3. If context is insufficient, say so.
4. Give concise and useful answers.
5. Mention sources when available.`;

  const prompt = `System: ${systemPrompt}

Context: ${context}

Question: ${englishQuestion}

Answer:`;

  const tempPromptFile = path.join(__dirname, "temp_prompt.txt");
  await fs.promises.writeFile(tempPromptFile, prompt, "utf-8");

  const args = [
    "-m", modelPath,
    "-f", tempPromptFile,
    "-n", String(config.maxTokens),
    "--temp", String(config.temperature),
    "-t", String(config.cpuThreads),
    "-c", String(config.contextSize),
  ];

  log(`Generating response with context size ${config.contextSize}, max tokens ${config.maxTokens}`);

  return new Promise((resolve, reject) => {
    const run = generationQueue.then(() => {
      return new Promise((innerResolve, innerReject) => {
        execFile(LLAMA_EXECUTABLE, args, {
          timeout: 180000,
          maxBuffer: 10 * 1024 * 1024,
          windowsHide: true
        }, (err, stdout, stderr) => {
          fs.promises.unlink(tempPromptFile).catch(() => {});
          if (err) {
            log(`llama.cpp error: ${err.message}`);
            if (stderr) log(`stderr: ${stderr}`);
            if (stdout) log(`stdout: ${stdout.substring(0, 500)}`);
            innerReject(new Error(`Failed to generate response: ${err.message}`));
            return;
          }
          let output = stdout.trim();
          const answerMarker = "Answer:";
          const answerIndex = output.lastIndexOf(answerMarker);
          if (answerIndex !== -1) {
            output = output.substring(answerIndex + answerMarker.length).trim();
          }
          const lines = output.split("\n");
          const cleanedLines = lines.filter((line) => {
            const trimmed = line.trim();
            return !trimmed.startsWith("llama_") &&
                   !trimmed.startsWith("main:") &&
                   !trimmed.startsWith("Log") &&
                   !trimmed.startsWith("sampling") &&
                   !trimmed.startsWith("generate:") &&
                   !trimmed.startsWith("system_info") &&
                   !trimmed.startsWith("llm_") &&
                   !trimmed.startsWith("srv") &&
                   trimmed.length > 0;
          });
          const cleanedAnswer = cleanedLines.join("\n").trim();
          log(`Answer generated (${cleanedAnswer.length} chars)`);
          innerResolve(cleanedAnswer || "No answer generated. Please try again.");
        });
      });
    });
    generationQueue = run.then(() => {}, () => {});
    run.then(resolve).catch(reject);
  });
}

async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".txt" || ext === ".md") {
    return await fs.promises.readFile(filePath, "utf-8");
  }
  log(`Skipping unsupported file: ${path.basename(filePath)}`);
  return null;
}

function createChunks(text, source) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const chunks = [];
  let start = 0;
  let chunkId = 0;
  while (start < words.length) {
    const end = Math.min(start + config.chunkSize, words.length);
    const chunkWords = words.slice(start, end);
    chunks.push({
      text: chunkWords.join(" "),
      source: source,
      chunkId: chunkId++,
    });
    if (end === words.length) break;
    start = Math.max(0, end - config.chunkOverlap);
  }
  return chunks;
}

function tokenize(text) {
  return String(text).toLowerCase().match(/[a-z0-9]+/g) || [];
}

function buildTfidfIndex(chunks) {
  const docFreq = {};
  for (const chunk of chunks) {
    const tokens = tokenize(chunk.text);
    const termFreq = {};
    for (const token of tokens) {
      termFreq[token] = (termFreq[token] || 0) + 1;
    }
    chunk.termFreq = termFreq;
  }
  for (const chunk of chunks) {
    for (const token of Object.keys(chunk.termFreq)) {
      docFreq[token] = (docFreq[token] || 0) + 1;
    }
  }
  const N = chunks.length;
  for (const chunk of chunks) {
    let norm = 0;
    for (const token of Object.keys(chunk.termFreq)) {
      const df = docFreq[token] || 0;
      const idf = Math.log((N + 1) / (df + 1)) + 1;
      const tfidf = chunk.termFreq[token] * idf;
      norm += tfidf * tfidf;
    }
    chunk.norm = Math.sqrt(norm) || 1;
  }
  return {
    chunks: chunks.map((c) => ({
      text: c.text,
      source: c.source,
      chunkId: c.chunkId,
      termFreq: c.termFreq,
      norm: c.norm,
    })),
    docFreq,
    N,
  };
}

async function loadBooksAndIndex() {
  const indexFilePath = path.join(__dirname, config.indexDir, config.indexFile);
  try {
    const raw = await fs.promises.readFile(indexFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.chunks) && parsed.chunks.length > 0 && parsed.docFreq && parsed.N > 0) {
      indexData = parsed;
      bookIndex = parsed.chunks;
      log(`Loaded existing index with ${bookIndex.length} chunks`);
      return;
    }
  } catch {
    log("No valid index found. Building from books directory...");
  }

  const booksDir = path.join(__dirname, config.booksDir);
  let files = [];
  try {
    files = await fs.promises.readdir(booksDir);
  } catch {
    log("Books directory not found or empty");
    indexData = { chunks: [], docFreq: {}, N: 0 };
    bookIndex = [];
    return;
  }

  const supportedExts = [".txt", ".md"];
  const chunks = [];

  for (const file of files) {
    const filePath = path.join(booksDir, file);
    const ext = path.extname(file).toLowerCase();
    if (!supportedExts.includes(ext)) {
      log(`Skipping unsupported file: ${file}`);
      continue;
    }
    try {
      const text = await extractTextFromFile(filePath);
      if (!text || text.trim().length === 0) {
        log(`Empty file skipped: ${file}`);
        continue;
      }
      const fileChunks = createChunks(text, file);
      chunks.push(...fileChunks);
      log(`Indexed ${file}: ${fileChunks.length} chunks`);
    } catch (err) {
      log(`Error processing ${file}: ${err.message}`);
    }
  }

  if (chunks.length > 0) {
    indexData = buildTfidfIndex(chunks);
    bookIndex = indexData.chunks;
    try {
      await fs.promises.writeFile(indexFilePath, JSON.stringify(indexData, null, 2));
      log(`Saved index with ${bookIndex.length} chunks`);
    } catch (err) {
      log(`Could not save index: ${err.message}`);
    }
  } else {
    indexData = { chunks: [], docFreq: {}, N: 0 };
    bookIndex = [];
    log("No books found to index");
  }
}

async function searchBooks(query, topK = config.topK) {
  if (bookIndex.length === 0 || indexData.N === 0) {
    log("No books indexed, returning empty results");
    return [];
  }
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const queryTf = {};
  for (const token of tokens) {
    queryTf[token] = (queryTf[token] || 0) + 1;
  }
  const queryVec = {};
  let queryNorm = 0;
  for (const token of Object.keys(queryTf)) {
    const df = indexData.docFreq[token] || 0;
    const idf = Math.log((indexData.N + 1) / (df + 1)) + 1;
    const weight = queryTf[token] * idf;
    queryVec[token] = weight;
    queryNorm += weight * weight;
  }
  queryNorm = Math.sqrt(queryNorm) || 1;

  const results = [];
  for (const chunk of bookIndex) {
    let dot = 0;
    for (const token of Object.keys(queryVec)) {
      const tf = chunk.termFreq[token] || 0;
      if (tf === 0) continue;
      const df = indexData.docFreq[token] || 0;
      const idf = Math.log((indexData.N + 1) / (df + 1)) + 1;
      dot += queryVec[token] * tf * idf;
    }
    const score = dot / (queryNorm * chunk.norm);
    if (score > 0) {
      results.push({ text: chunk.text, source: chunk.source, score });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, topK);
}

async function translateToEnglish(text) {
  if (!config.translationEnabled) {
    log("Translation disabled, using original query");
    return text;
  }
  try {
    const url = `${config.translationEndpoint}&q=${encodeURIComponent(text)}`;
    const data = await httpsGetJson(url, 5000);
    if (data && data[0] && Array.isArray(data[0])) {
      const translated = data[0].map((seg) => seg[0]).join("");
      if (translated && translated.trim().length > 0) {
        log(`Translated: "${text}" -> "${translated}"`);
        return translated;
      }
    }
    return text;
  } catch (err) {
    log(`Translation failed: ${err.message}. Using original query.`);
    return text;
  }
}

async function searchDuckDuckGo(query) {
  if (!config.webSearchEnabled) {
    log("DuckDuckGo search disabled");
    return [];
  }
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const data = await httpsGetJson(url, 5000);
    const results = [];
    if (data.AbstractText) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || "",
        snippet: data.AbstractText,
      });
    }
    const related = data.RelatedTopics || [];
    for (const topic of related) {
      if (topic.Text) {
        results.push({
          title: topic.Name || topic.FirstURL || query,
          url: topic.FirstURL || "",
          snippet: topic.Text,
        });
      } else if (topic.Topics) {
        for (const subtopic of topic.Topics) {
          if (subtopic.Text) {
            results.push({
              title: subtopic.Name || subtopic.FirstURL || query,
              url: subtopic.FirstURL || "",
              snippet: subtopic.Text,
            });
          }
        }
      }
      if (results.length >= config.duckDuckGoSearchMaxResults) break;
    }
    log(`DuckDuckGo returned ${results.length} results`);
    return results.slice(0, config.duckDuckGoSearchMaxResults);
  } catch (err) {
    log(`DuckDuckGo search failed: ${err.message}`);
    return [];
  }
}

async function searchWikipedia(query) {
  if (!config.wikipediaEnabled) {
    log("Wikipedia search disabled");
    return [];
  }
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=2`;
    const searchData = await httpsGetJson(searchUrl, 5000);
    const searchResults = (searchData && searchData.query && searchData.query.search) || [];
    const results = [];
    for (const item of searchResults) {
      const title = item.title;
      const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(title)}&format=json`;
      const extractData = await httpsGetJson(extractUrl, 5000);
      const pages = (extractData && extractData.query && extractData.query.pages) || {};
      const page = Object.values(pages)[0] || {};
      results.push({
        title: title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        text: page.extract || item.snippet || "",
      });
    }
    log(`Wikipedia returned ${results.length} results`);
    return results.slice(0, config.wikipediaSearchMaxResults);
  } catch (err) {
    log(`Wikipedia search failed: ${err.message}`);
    return [];
  }
}

async function buildContext(query) {
  const contextParts = [];
  const sources = [];

  log(`Searching books for: "${query}"`);
  const localResults = await searchBooks(query, config.topK);
  const localMaxScore = localResults.length > 0 ? Math.max(...localResults.map((r) => r.score)) : 0;
  log(`Best local relevance: ${localMaxScore.toFixed(3)} (threshold: ${config.minLocalRelevance})`);

  if (localResults.length > 0 && localMaxScore >= config.minLocalRelevance) {
    log("Using LOCAL BOOKS only (relevance sufficient)");
    for (const r of localResults) {
      contextParts.push(`SOURCE: LOCAL BOOK\nBOOK: ${r.source}\nRELEVANCE: ${r.score.toFixed(2)}\nCONTENT:\n${r.text}`);
      sources.push({ type: "book", name: r.source, score: r.score });
    }
  } else {
    log("Local relevance insufficient, falling back to web sources");
    if (localResults.length > 0) {
      log(`Including ${localResults.length} weak local results`);
      for (const r of localResults) {
        contextParts.push(`SOURCE: LOCAL BOOK (weak match)\nBOOK: ${r.source}\nRELEVANCE: ${r.score.toFixed(2)}\nCONTENT:\n${r.text}`);
        sources.push({ type: "book", name: r.source, score: r.score });
      }
    }
    const ddgResults = await searchDuckDuckGo(query);
    for (const r of ddgResults) {
      contextParts.push(`SOURCE: DUCKDUCKGO\nTITLE: ${r.title}\nURL: ${r.url}\nCONTENT:\n${r.snippet}`);
      sources.push({ type: "web", name: r.title, url: r.url });
    }
    const wikiResults = await searchWikipedia(query);
    for (const r of wikiResults) {
      contextParts.push(`SOURCE: WIKIPEDIA\nARTICLE: ${r.title}\nURL: ${r.url}\nCONTENT:\n${r.text}`);
      sources.push({ type: "wikipedia", name: r.title, url: r.url });
    }
  }

  let combined = contextParts.join("\n\n");
  if (combined.length > config.maxContextCharacters) {
    log(`Truncating context from ${combined.length} to ${config.maxContextCharacters} chars`);
    combined = combined.substring(0, config.maxContextCharacters) + "\n...[truncated]";
  }
  log(`Context built: ${combined.length} chars, ${sources.length} sources`);
  return { context: combined, sources };
}

async function initialize() {
  log("=== GZ_AI Initialization ===");
  log(`Node.js version: ${process.version}`);
  log(`Platform: ${process.platform} ${process.arch}`);
  log(`Current directory: ${__dirname}`);

  await createDirectories();
  const modelReady = await checkModel();
  if (!modelReady) {
    log("WARNING: Model or executable not found. Server will start but /api/chat will fail.");
    log("Please ensure:");
    log("  1. models/model.gguf exists");
    log("  2. llama/main.exe exists (download from llama.cpp releases)");
  }
  await loadBooksAndIndex();
  log("=== Initialization Complete ===");
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/chat", async (req, res) => {
  const requestStart = Date.now();
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: true, message: "Message is required." });
    }
    if (message.length > config.maxPromptLength) {
      return res.status(400).json({
        error: true,
        message: `Message too long. Maximum ${config.maxPromptLength} characters.`,
      });
    }

    const originalQuery = message.trim();
    log(`=== New chat request: "${originalQuery}" ===`);

    const englishQuery = await translateToEnglish(originalQuery);
    const { context, sources } = await buildContext(englishQuery);

    if (!context || context.trim().length === 0) {
      log("No context available (no books, no internet)");
      return res.json({
        answer: "I couldn't find any relevant information from local books or web sources. Please try a different query or add books to the books/ directory.",
        originalQuery,
        translatedQuery: englishQuery,
        sources: [],
      });
    }

    const answer = await generateResponse(englishQuery, context);
    const elapsed = ((Date.now() - requestStart) / 1000).toFixed(1);
    log(`=== Request complete in ${elapsed}s ===`);

    res.json({
      answer,
      originalQuery,
      translatedQuery: englishQuery,
      sources,
      elapsed,
    });
  } catch (err) {
    log(`ERROR in /api/chat: ${err.message}`);
    res.status(500).json({
      error: true,
      message: err.message,
      hint: "Check server logs for details.",
    });
  }
});

app.get("/api/status", (req, res) => {
  const modelPath = path.resolve(__dirname, config.modelPath);
  const modelExists = fs.existsSync(modelPath);
  const executableExists = fs.existsSync(LLAMA_EXECUTABLE);
  res.json({
    status: "online",
    modelLoaded: modelExists && executableExists,
    booksIndexed: bookIndex.length,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    config: {
      contextSize: config.contextSize,
      maxTokens: config.maxTokens,
      topK: config.topK,
      minLocalRelevance: config.minLocalRelevance,
    }
  });
});

process.on("uncaughtException", (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.message}`);
  log(err.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  log(`UNHANDLED REJECTION: ${reason}`);
});

initialize().catch((err) => {
  log(`Initialization error: ${err.message}`);
  log(err.stack);
});

app.listen(config.port, config.host, () => {
  log(`=== GZ_AI server running at http://${config.host}:${config.port} ===`);
  log(`Open your browser and navigate to: http://127.0.0.1:${config.port}`);
});
