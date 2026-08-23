# GZ_AI Requirements

GZ_AI is a 100% JavaScript/Node.js local AI assistant that uses GGUF models, llama.cpp, and a lightweight TF-IDF RAG system.

---

## A. System Requirements

| Component | Minimum | Recommended |
|---|---|---|
| Operating System | Windows 10 64-bit | Windows 11 64-bit |
| RAM | 8 GB | 16 GB+ |
| CPU | 4 cores, AVX2 | 8+ cores |
| GPU | Optional | NVIDIA GPU |
| Storage | 5 GB free | 20 GB+ SSD |
| Node.js | 18+ | 20/22 LTS |
| npm | 9+ | Latest |

---

## B. Software Requirements

Required software:

- Node.js
- npm
- GGUF-compatible language model
- llama.cpp / node-llama-cpp

Python is NOT required.

Flask is NOT required.

Python packages are NOT required.

---

## C. Node.js Requirements

Recommended:

```text
Node.js 22 LTS

Also supported where dependencies allow:

Node.js 20 LTS
Node.js 18+

Check your installed versions:

node --version
npm --version


---

D. Node.js Dependencies

Example package.json:

{
  "dependencies": {
    "express": "^4.21.0",
    "node-llama-cpp": "^3.2.0",
    "@xenova/transformers": "^2.17.2",
    "pdf-parse": "^1.1.1",
    "duck-duck-scrape": "^3.1.1",
    "wikipedia": "^2.1.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "helmet": "^7.1.0"
  }
}

The project's actual package.json is the authoritative dependency list.


---

E. GGUF Model Requirements

GZ_AI requires a GGUF model for local inference.

Model	Approx. Size	Suitable For

TinyLlama 1.1B	~600 MB	Low-end systems
Phi-2 2.7B	~1.6 GB	Basic tasks
Mistral 7B	~4 GB	Better quality
Llama 3 8B	~5 GB	Higher quality
Qwen 2.5	Varies	Multilingual tasks


For CPU systems, Q4_K_M quantization is a practical choice.

Actual RAM usage depends on model size, quantization, context size, CPU threads, and GPU layers.


---

F. RAG Requirements

GZ_AI uses TF-IDF for local document retrieval.

TF-IDF is faster and significantly lighter than embedding-based retrieval, while embeddings generally provide stronger semantic understanding.

TF-IDF is used because GZ_AI is designed to work efficiently on systems with limited RAM and CPU resources.

RAG Pipeline

User Question
      |
      v
Query Processing
      |
      v
TF-IDF Document Search
      |
      v
Relevance Check
      |
      +------------------+
      |                  |
    Relevant          Not Relevant
      |                  |
      v                  v
Local Books        Web Fallback
      |             DuckDuckGo
      |             Wikipedia
      |                  |
      +--------+---------+
               |
               v
        Context Builder
               |
               v
          GGUF Model
               |
               v
             Answer


---

G. Supported Document Formats

Format	Support

.txt	Supported
.md	Supported
.pdf	Supported


Example:

books/
├── Python.pdf
├── JavaScript.md
├── Networking.txt
└── Machine-Learning.pdf


---

H. Internet Requirements

Internet access is NOT required for:

Local GGUF inference

Local document search

TF-IDF RAG

Local book-based questions

Local model execution


Internet access IS required for:

DuckDuckGo web fallback

Wikipedia fallback

External web resources

Future external APIs


GZ_AI can operate completely locally when web fallback is not required.


---

I. Installation

Clone the repository:

git clone https://github.com/yourusername/GZ_AI.git
cd GZ_AI

Install dependencies:

npm install

Create required directories:

mkdir books
mkdir models
mkdir data
mkdir data/index


---

J. Project Structure

GZ_AI/
├── app.js
├── config.js
├── index.html
├── package.json
├── README.md
├── books/
├── models/
├── data/
│   └── index/
└── llama/


---

K. GGUF Model Setup

Place your GGUF model inside:

models/
└── model.gguf

Configure the model path:

modelPath: "./models/model.gguf"

The filename can be different as long as the configured path matches the actual model.


---

L. Book Setup

Place books and documents inside:

books/

Example:

books/
├── Python.pdf
├── JavaScript.pdf
├── AI.md
├── Networking.txt
└── Data-Science.pdf

The application indexes these documents and uses them as local knowledge sources.


---

M. Starting GZ_AI

Start the application:

npm start

Open:

http://127.0.0.1:3000


---

N. Low-End System Configuration

For systems with limited RAM or CPU:

{
  contextSize: 2048,
  maxTokens: 256,
  cpuThreads: 4,
  gpuLayers: 0,
  topK: 3
}

Recommended model:

1B - 3B parameter quantized GGUF

Recommended quantization:

Q4_K_M


---

O. Recommended System Configuration

For systems with 16 GB or more RAM:

{
  contextSize: 4096,
  maxTokens: 512,
  cpuThreads: 8,
  gpuLayers: 0,
  topK: 5
}

If a compatible GPU is available, GPU layers can be enabled according to available VRAM.


---

P. Performance Configuration

Faster Responses

Use:

{
  contextSize: 2048,
  maxTokens: 256,
  topK: 3
}

Additional recommendations:

Use a smaller GGUF model

Use Q4 quantization

Reduce context size

Reduce maximum output tokens

Keep the document index manageable

Avoid unnecessarily large models


Better Quality

Use:

{
  contextSize: 4096,
  maxTokens: 512,
  topK: 5
}

Additional recommendations:

Use a larger GGUF model

Increase context size

Retrieve more relevant documents

Use higher-quality source documents

Use GPU acceleration when available



---

Q. CPU Requirements

GZ_AI can run completely on the CPU.

CPU-only configuration:

gpuLayers: 0

AVX2 support is recommended for better performance.

Older CPUs may still work if supported by the installed runtime, but inference can be significantly slower.


---

R. GPU Requirements

A dedicated GPU is optional.

GPU acceleration can improve inference speed, especially with larger GGUF models.

The required VRAM depends on:

GGUF model size

Quantization

Context size

Number of GPU layers

Runtime configuration


Do not assume that a model's file size is equal to its total VRAM requirement.


---

S. Storage Requirements

Minimum:

5 GB free

Recommended:

20 GB+ SSD

Storage requirements increase when you add:

Multiple GGUF models

Large PDF collections

Large document indexes

llama.cpp binaries

Application dependencies


An SSD is strongly recommended for faster model loading and document indexing.


---

T. Memory Requirements

Approximate system recommendations:

RAM	Recommended Model Size

4 GB	Very small models only
8 GB	1B - 3B models
16 GB	3B - 8B models
32 GB	7B+ models
64 GB+	Larger local models


These are general guidelines. Actual requirements depend on quantization, context size, and runtime overhead.


---

U. API Requirements

GZ_AI can expose local HTTP endpoints such as:

POST /api/chat
GET  /api/status

Example request:

{
  "message": "What is Python?"
}

Example response:

{
  "answer": "Python is a high-level programming language.",
  "originalQuery": "What is Python?",
  "translatedQuery": "What is Python?",
  "sources": [
    {
      "type": "book",
      "name": "Python.pdf",
      "score": 0.85
    }
  ]
}


---

V. Security Requirements

For local use:

Keep the server bound to localhost when possible.

Never expose API keys in frontend JavaScript.

Treat retrieved documents as untrusted content.

Treat web search results as untrusted content.

Do not allow retrieved text to override system instructions.

Use environment variables for sensitive configuration.

Add authentication before exposing the application publicly.

Use HTTPS when deploying over an untrusted network.


Local inference does not automatically make external web requests private.


---

W. Troubleshooting

Model Does Not Load

Check that the GGUF file exists:

models/model.gguf

Verify the configured path:

modelPath: "./models/model.gguf"

Also verify that the model is compatible with the installed llama.cpp runtime.

Dependencies Fail

Run:

npm install

If necessary:

rm -rf node_modules
npm install

On Windows, delete the node_modules folder manually if required.

Out of Memory

Reduce:

contextSize: 2048,
maxTokens: 256

Then use a smaller GGUF model.

Slow Inference

Try:

Smaller model

Q4 quantization

Lower context size

Fewer output tokens

Appropriate CPU thread count

GPU acceleration if available



---

X. Development Setup

Clone:

git clone https://github.com/yourusername/GZ_AI.git
cd GZ_AI

Install:

npm install

Run:

npm start

For development, modify the source files and restart the Node.js server when necessary.


---

Y. License

GZ_AI is released under the MIT License.

See the LICENSE file for the complete license text.


---

Z. Final Requirements Summary

GZ_AI requires:

Node.js
npm
GGUF Model
llama.cpp / node-llama-cpp

Recommended system:

Windows 11 64-bit
16 GB RAM
8+ CPU cores
SSD
Node.js 22 LTS
Q4_K_M GGUF model

Optional:

NVIDIA GPU
Internet connection

Internet is only necessary for features such as web fallback.

The core AI inference and local RAG functionality can run locally without Python or cloud-based LLM APIs.