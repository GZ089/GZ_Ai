# GZ_AI

GZ_AI is a local retrieval-augmented generation (RAG) assistant built entirely with JavaScript and Node.js. It uses a local GGUF model through llama.cpp for inference and a lightweight TF-IDF index for local document retrieval. No Python is used anywhere in this project.

## Features

- Fully local AI inference using a GGUF model
- Local books and document retrieval using TF-IDF
- Web fallback through DuckDuckGo and Wikipedia
- Optional translation of user queries to English
- Source attribution in chat responses
- Lightweight and suitable for low-resource systems
- Single inference queue for stable performance
- Clean and responsive chat interface

## Requirements

### Minimum System Requirements

| Component | Minimum |
|-----------|---------|
| Operating System | Windows 10 64-bit |
| RAM | 8 GB |
| CPU | 4 cores with AVX2 support |
| GPU | Not required |
| Storage | 5 GB free disk space |
| Node.js | 18.0.0 or newer |
| npm | 9.0.0 or newer |

### Recommended System Requirements

| Component | Recommended |
|-----------|-------------|
| Operating System | Windows 11 64-bit |
| RAM | 16 GB or more |
| CPU | 8 cores or more |
| GPU | NVIDIA GPU with 8 GB VRAM |
| Storage | 20 GB or more on SSD |
| Node.js | 20 LTS or 22 LTS |
| npm | Latest stable version |

### Software Dependencies

- Node.js
- npm
- A GGUF language model
- llama.cpp runtime

## Installation

Follow these steps to install and run GZ_AI on your system.

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/GZ_AI.git
cd GZ_AI
```

Step 2: Install Dependencies

```bash
npm install
```

Expected output:

```
added 125 packages, and audited 126 packages in 15s

20 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

Step 3: Create Required Directories

```bash
mkdir books
mkdir models
mkdir data
mkdir data/index
```

Step 4: Place the GGUF Model

Copy your GGUF model file into the models directory and name it model.gguf.

```bash
cp /path/to/your/model.gguf models/model.gguf
```

Step 5: Add Books

Place your text, markdown, or PDF files into the books directory.

```bash
cp /path/to/books/*.txt books/
```

Step 6: Start the Server

```bash
npm start
```

Expected output:

```
> gz-ai@2.0.0 start
> node app.js

[GZ_AI] === GZ_AI Initialization ===
[GZ_AI] Node.js version: v20.11.0
[GZ_AI] Platform: win32 x64
[GZ_AI] Current directory: C:\Users\GZ_Developer\GZ_AI
[GZ_AI] Directory ready: books
[GZ_AI] Directory ready: data/index
[GZ_AI] Directory ready: models
[GZ_AI] Model file found: 93.07 MB
[GZ_AI] Loaded existing index with 88 chunks
[GZ_AI] === Initialization Complete ===
[GZ_AI] GZ_AI server running at http://127.0.0.1:3000
```

Step 7: Open the Chat Interface

Open your browser and go to:

```
http://127.0.0.1:3000
```

Development

To run the server in development mode with automatic restarts:

```bash
npm run dev
```

To check for outdated packages:

```bash
npm outdated
```

To update all packages:

```bash
npm update
```

Project Structure

```
GZ_AI/
├── app.js
├── config.js
├── index.html
├── package.json
├── README.md
├── books/
│   ├── book1.txt
│   └── book2.txt
├── models/
│   └── model.gguf
└── data/
    └── index/
        └── book-tfidf-index.json
```

Configuration

All settings are located in config.js. You can adjust the following options:

Setting Description Default
modelPath Path to GGUF model ./models/model.gguf
contextSize Context window size in tokens 4096
maxTokens Maximum response length 512
temperature Response creativity 0.7
cpuThreads CPU threads for inference 4
gpuLayers GPU layers to use 0
topK Number of chunks to retrieve 5
minLocalRelevance Threshold for local-only answers 0.30
port Server port 3000

API Endpoints

POST /api/chat

Request:

```json
{
  "message": "What is Python?"
}
```

Response:

```json
{
  "answer": "Python is a programming language...",
  "originalQuery": "What is Python?",
  "translatedQuery": "What is Python?",
  "sources": [
    {
      "type": "book",
      "name": "python-guide.txt",
      "score": 0.85
    }
  ]
}
```

GET /api/status

Response:

```json
{
  "status": "online",
  "modelLoaded": true,
  "booksIndexed": 88
}
```

How It Works

GZ_AI processes each user question through the following pipeline:

1. Translation layer converts the query to English if needed.
2. Local books are searched first using TF-IDF cosine similarity.
3. If local relevance is above the configured threshold, only local content is used.
4. If local relevance is weak, DuckDuckGo and Wikipedia are queried.
5. The context builder combines the best retrieved content.
6. The local GGUF model generates an answer using the context.
7. The answer and sources are returned to the frontend.

Offline Behavior

GZ_AI works fully offline for local books and model inference. Translation, DuckDuckGo, and Wikipedia require internet access. If these services are unavailable, the assistant continues using local content and original query text.

Security

All book and web content is treated as untrusted data. Retrieved content never overrides the system prompt. The frontend sanitizes displayed text and does not execute JavaScript from retrieved documents.

Common Issues

npm install fails

Clear the npm cache and try again:

```bash
npm cache clean --force
npm install
```

Port already in use

Change the port in config.js to another value:

```javascript
port: 3001
```

Model not loading

Check that the model file exists:

```bash
ls models/
```

The file should be named model.gguf.

License

This project is licensed under the MIT License.

Credits

· llama.cpp for GGUF inference
· Express for the web server
· HuggingFace for model hosting

```

---

This README is written in plain, professional English without emojis and includes all necessary sections for a GitHub repository.