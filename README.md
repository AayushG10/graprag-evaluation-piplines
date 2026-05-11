# GraphRAG Finance Benchmark

> **TigerGraph GraphRAG Inference Hackathon** — Proving that knowledge-graph-powered retrieval dramatically reduces LLM token consumption while maintaining answer quality on real SEC 10-K financial filings.

---

## What This Project Does

This project runs the same financial question through **three AI pipelines simultaneously** and measures the difference:

| Pipeline | Strategy | Typical Tokens |
|---|---|---|
| **LLM Only** | Raw question → LLM, zero context | ~500 |
| **Basic RAG** | FAISS vector search → top-5 chunks → LLM | ~3,500 |
| **GraphRAG** | TigerGraph multi-hop traversal → focused facts → LLM | ~400 |

**Result: GraphRAG uses ~88% fewer tokens than Basic RAG** with equivalent answer quality — proven live in the interactive dashboard.

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GraphRAG Finance Benchmark                           │
│                     TigerGraph GraphRAG Inference Hackathon                 │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────┐
  │                    FRONTEND  (localhost:3000)                         │
  │                    Next.js 16 · TypeScript · Tailwind CSS             │
  │                                                                       │
  │   ┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐    │
  │   │  Landing    │    │   Query Input   │    │  Results Page    │    │
  │   │  Hero       │    │   + Samples     │    │  3-col cards     │    │
  │   │  How it     │───▶│   POST /api/    │───▶│  Token banner    │    │
  │   │  works      │    │   query         │    │  MetricsTable    │    │
  │   │  Dataset    │    │                 │    │  BERTScore/Judge │    │
  │   └─────────────┘    └────────┬────────┘    └──────────────────┘    │
  └─────────────────────────────── │ ──────────────────────────────────────┘
                                   │  HTTP POST /api/query
                                   ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                    BACKEND  (localhost:8000)                          │
  │                    FastAPI · uvicorn · Python 3.14                    │
  │                                                                       │
  │   ┌──────────────────────────────────────────────────────────────┐   │
  │   │                    runner.py                                  │   │
  │   │           asyncio.gather  +  ThreadPoolExecutor(6)            │   │
  │   │                                                               │   │
  │   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │   │
  │   │   │  Pipeline 1  │  │  Pipeline 2  │  │   Pipeline 3     │  │   │
  │   │   │  LLM Only    │  │  Basic RAG   │  │   GraphRAG       │  │   │
  │   │   └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │   │
  │   └──────────│────────────────-│──────────────────- │ ───────────┘   │
  └──────────────│─────────────────│────────────────────│────────────────┘
                 │                 │                    │
                 ▼                 ▼                    ▼
```

---

### Pipeline Detail

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PIPELINE 1 — LLM Only                                               ~500T  │
│                                                                             │
│   User Query                                                                │
│       │                                                                     │
│       └──────────────────────────────────────────────────────────────────► │
│                                                               ┌──────────┐  │
│                                                               │ OpenRouter│  │
│                                                               │ LLaMA 3.1│  │
│                                                               │  70B     │  │
│                                                               └────┬─────┘  │
│                                                                    │        │
│                                                               Answer (raw)  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  PIPELINE 2 — Basic RAG                                            ~3,500T  │
│                                                                             │
│   User Query                                                                │
│       │                                                                     │
│       ▼                                                                     │
│   ┌───────────────────────────┐                                             │
│   │  sentence-transformers    │  embed query → 384-dim vector               │
│   │  all-MiniLM-L6-v2  (local)│                                             │
│   └─────────────┬─────────────┘                                             │
│                 │                                                           │
│                 ▼                                                           │
│   ┌───────────────────────────┐                                             │
│   │  FAISS Flat Index         │  cosine similarity search                   │
│   │  4,439 chunks  384-dim    │──► Top-5 chunks (512 tokens each)           │
│   └───────────────────────────┘                                             │
│                 │                                                           │
│                 ▼                                                           │
│   Context = chunk1 + chunk2 + chunk3 + chunk4 + chunk5  (~2,500 tokens)    │
│       │                                                                     │
│       └──────────────────────────────────────────────────────────────────► │
│                                                               ┌──────────┐  │
│                                                               │ OpenRouter│  │
│                                                               │ LLaMA 3.1│  │
│                                                               │  70B     │  │
│                                                               └────┬─────┘  │
│                                                                    │        │
│                                                            Answer (grounded)│
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  PIPELINE 3 — GraphRAG                                               ~420T  │
│                                                                             │
│   User Query                                                                │
│       │                                                                     │
│       ▼                                                                     │
│   ┌───────────────────────────┐                                             │
│   │  Entity Extraction        │  "Apple 2022" → ticker=AAPL, year=2022     │
│   │  _parse_query()           │  risks=["supply chain", "cybersecurity"]   │
│   └─────────────┬─────────────┘                                             │
│                 │                                                           │
│                 ▼                                                           │
│   ┌──────────────────────────────────────────────────────────────────┐     │
│   │                  TigerGraph Savanna (cloud)                       │     │
│   │                                                                   │     │
│   │     HOP 1                        HOP 2                            │     │
│   │   ┌──────────┐  FILED_BY    ┌──────────────┐  MENTIONS_RISK      │     │
│   │   │ Company  │─────────────►│   Document   │──────────────────►  │     │
│   │   │  AAPL    │              │ AAPL_2022_10K│                      │     │
│   │   └──────────┘              └──────────────┘  HAS_EXECUTIVE       │     │
│   │                                    │        ──────────────────►   │     │
│   │                             ┌──────┴──────────────────────────┐   │     │
│   │                             │    Risk          Executive       │   │     │
│   │                             │  supply_chain    Tim Cook / CFO  │   │     │
│   │                             │  cybersecurity                   │   │     │
│   │                             │  litigation                      │   │     │
│   │                             └──────────────────────────────────┘   │     │
│   └──────────────────────────────────────────────────────────────────┘     │
│                 │                                                           │
│                 ▼                                                           │
│   Focused Context (~300 tokens) — company header + risks + executives      │
│       │                                                                     │
│       └──────────────────────────────────────────────────────────────────► │
│                                                               ┌──────────┐  │
│                                                               │ OpenRouter│  │
│                                                               │ LLaMA 3.1│  │
│                                                               │  70B     │  │
│                                                               └────┬─────┘  │
│                                                                    │        │
│                                                     Answer (graph-grounded) │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Evaluation Layer

```
  After all 3 pipelines complete:

  ┌──────────────────────────────────────────────────────────────────────┐
  │                     EVALUATION  (parallel)                            │
  │                                                                       │
  │  Reference = GraphRAG answer (most grounded — uses real graph data)   │
  │                                                                       │
  │  ┌─────────────────────────────────────────────────────────────┐     │
  │  │  BERTScore F1                                               │     │
  │  │  Model: roberta-large                                       │     │
  │  │  Compares: Pipeline 1 & 2 answers vs GraphRAG answer        │     │
  │  │  Score: 0.0 – 1.0  (higher = more semantically similar)     │     │
  │  └─────────────────────────────────────────────────────────────┘     │
  │                                                                       │
  │  ┌─────────────────────────────────────────────────────────────┐     │
  │  │  LLM Judge                                                  │     │
  │  │  Model: openai/gpt-4o-mini (via OpenRouter)                 │     │
  │  │  Pipeline 1 & 2: judged against GraphRAG reference          │     │
  │  │  Pipeline 3: judged on factuality + relevance alone         │     │
  │  │  Output: PASS/FAIL + one-sentence reason                    │     │
  │  └─────────────────────────────────────────────────────────────┘     │
  │                                                                       │
  └──────────────────────────────────────────────────────────────────────┘
```

---

### TigerGraph Knowledge Graph Schema

```
  VERTICES                         EDGES
  ─────────────────────────────    ──────────────────────────────────────────
  ┌───────────┐                    Company  ──[FILED_BY]──────► Document
  │  Company  │  ticker, sector    Company  ──[HAS_EXECUTIVE]──► Executive
  └───────────┘                    Company  ──[OPERATES_IN]───► Sector
  ┌───────────┐                    Document ──[MENTIONS_RISK]──► Risk
  │ Document  │  ticker, year      Document ──[SUCCEEDED_BY]──► Document
  └───────────┘
  ┌───────────┐    Enables multi-hop:
  │   Risk    │    Company → Document → Risk          (2 hops)
  └───────────┘    Company → Document → Document      (YoY trends)
  ┌───────────┐
  │ Executive │  name, title
  └───────────┘
  ┌───────────┐
  │  Sector   │  name
  └───────────┘

  Loaded:  6 Companies · 25 Documents · 19 Risks · 9 Executives · 4 Sectors
```

---

### Data Ingestion Pipeline

```
  SEC EDGAR (external)
        │
        ▼
  ┌─────────────────┐
  │ download_sec.py │  sec-edgar-downloader → full-submission.txt (SGML)
  └────────┬────────┘
           │  data/raw/sec-edgar-filings/TICKER/10-K/ACCESSION/
           ▼
  ┌─────────────────┐
  │ parse_filings.py│  SGML → extract HTML → BeautifulSoup strip
  │                 │  → 512-token chunks with overlap-64
  │                 │  → filter boilerplate (SEC headers, TOC)
  │                 │  → prefix: "Company: AAPL Year: 2022 — ..."
  └────────┬────────┘
           │
           ├──► data/processed/chunks.jsonl     (4,439 chunks)
           │
           └──► data/processed/faiss.index      (384-dim flat index)

  ┌─────────────────┐
  │ build_graph.py  │  spaCy NER + regex patterns → entities
  │                 │  → pyTigerGraph REST++ upsert
  └────────┬────────┘
           │
           └──► TigerGraph Savanna (FinanceGraph)
```

---

### Dataset

- **25 SEC 10-K filings** downloaded from EDGAR
- **5 companies:** Apple (AAPL) · Microsoft (MSFT) · JPMorgan (JPM) · ExxonMobil (XOM) · Johnson & Johnson (JNJ)
- **5 years:** 2019 · 2020 · 2021 · 2022 · 2023
- **4,400+ text chunks** indexed in FAISS

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.10+ | Tested on 3.14 |
| Node.js | 18+ | For Next.js frontend |
| npm | 9+ | Comes with Node.js |
| Git | any | For cloning |

You also need accounts for:
- **OpenRouter** — [openrouter.ai](https://openrouter.ai) — free tier available
- **TigerGraph Savanna** — [tgcloud.io](https://tgcloud.io) — free tier available

---

## Project Structure

```
graphrag-finance/
├── .env                          # Your secrets (not committed)
├── .env.example                  # Template for .env
├── config.py                     # Pydantic settings (reads .env)
├── requirements.txt
├── test_graphrag.py              # CLI smoke test for all 3 pipelines
│
├── data/
│   ├── raw/                      # Downloaded SEC filings (auto-created)
│   └── processed/
│       ├── chunks.jsonl          # Parsed text chunks
│       └── faiss.index           # Vector index
│
├── ingestion/
│   ├── download_sec.py           # Download 10-K filings from EDGAR
│   ├── parse_filings.py          # SGML → text chunks → FAISS index
│   └── build_graph.py            # Load schema + data into TigerGraph
│
├── pipelines/
│   ├── base.py                   # PipelineResult dataclass + BasePipeline
│   ├── llm_only.py               # Pipeline 1
│   ├── basic_rag.py              # Pipeline 2
│   └── graphrag.py               # Pipeline 3 (TigerGraph multi-hop)
│
├── evaluation/
│   ├── bert_score.py             # BERTScore F1 wrapper
│   ├── llm_judge.py              # LLM-as-a-Judge (Pass/Fail + reason)
│   └── benchmark.py             # Offline batch benchmark runner
│
└── dashboard/
    ├── backend/
    │   ├── main.py               # FastAPI app
    │   ├── runner.py             # Parallel pipeline orchestration
    │   └── models.py             # Pydantic request/response schemas
    └── frontend/                 # Next.js 16 + TypeScript + Tailwind
        ├── app/
        │   ├── layout.tsx
        │   └── page.tsx          # Full landing + demo page
        └── components/
            ├── QueryInput.tsx
            ├── PipelineCard.tsx
            └── MetricsTable.tsx
```

---

## Setup

### Step 1 — Clone and enter the project

```bash
git clone <your-repo-url>
cd graphrag-finance
```

### Step 2 — Create a Python virtual environment

```bash
python3 -m venv venv
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows
```

### Step 3 — Install Python dependencies

```bash
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

> ⚠️ First install takes 3–5 minutes (PyTorch + Transformers are large).

### Step 4 — Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your credentials:

```env
# ── OpenRouter (required) ─────────────────────────────────────────────────────
OPENROUTER_API_KEY=sk-or-v1-...          # Get from openrouter.ai/keys
OPENROUTER_MODEL=meta-llama/llama-3.1-70b-instruct
JUDGE_MODEL=openai/gpt-4o-mini

# ── TigerGraph Savanna (required for Pipeline 3) ──────────────────────────────
TIGERGRAPH_HOST=your-workspace.i.tgcloud.io
TIGERGRAPH_GRAPH_NAME=FinanceGraph
TIGERGRAPH_SECRET=your_secret_here

# TIGERGRAPH_TOKEN is auto-fetched from the secret above.
# If the secret expires, generate a fresh token manually (see Troubleshooting).
TIGERGRAPH_TOKEN=
```

#### Getting your OpenRouter API key
1. Go to [openrouter.ai](https://openrouter.ai) → Sign in → Keys
2. Create a new key → Copy it → Paste as `OPENROUTER_API_KEY`

#### Getting your TigerGraph Savanna credentials
1. Go to [tgcloud.io](https://tgcloud.io) → Create account → New Workspace
2. Once workspace is **Running**, copy the hostname (shown in workspace details)
3. Click **Admin Panel** → **User Management** → **Secrets** → **Add Secret**
4. Name it anything (e.g. `demo`) → Create → Copy the secret string

---

## Data Ingestion (One-time Setup)

### Step 5 — Download SEC filings

```bash
python -m ingestion.download_sec
```

Downloads 10-K filings for AAPL, MSFT, JPM, XOM, JNJ (2019–2023) from EDGAR.  
Files land in `data/raw/sec-edgar-filings/`.

> Takes ~5 minutes depending on internet speed.

### Step 6 — Build FAISS vector index

```bash
python -m ingestion.parse_filings
```

Parses SGML filings → extracts text → chunks into 512-token segments → builds FAISS index.  
Output: `data/processed/chunks.jsonl` (4,400+ chunks) + `data/processed/faiss.index`

### Step 7 — Load TigerGraph knowledge graph

```bash
python -m ingestion.build_graph
```

Creates the schema (vertices + edges) and loads company/document/risk/executive data into TigerGraph Savanna.

Expected output:
```
✅ Schema created
✅ Loaded 5 companies
✅ Loaded 25 documents
✅ Loaded 19 risks
✅ Loaded 9 executives
✅ Graph build complete
```

---

## Running the Application

You need **two terminals** open.

### Terminal 1 — FastAPI Backend

```bash
cd graphrag-finance
source venv/bin/activate
uvicorn dashboard.backend.main:app --reload --port 8000
```

Expected output:
```
Initialising pipelines...
✅ All pipelines ready
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

> The `--reload` flag auto-restarts on code changes. Remove it in production.

### Terminal 2 — Next.js Frontend

```bash
cd graphrag-finance/dashboard/frontend
npm install          # First time only
npm run dev
```

Expected output:
```
▲ Next.js 16
- Local: http://localhost:3000
✓ Ready in 232ms
```

### Open the Dashboard

Visit **http://localhost:3000** in your browser.

---

## API Reference

The FastAPI backend exposes:

### `GET /health`

```bash
curl http://localhost:8000/health
# → {"status": "ok"}
```

### `POST /api/query`

```bash
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What were Apple main risk factors in 2022?"}'
```

**Request body:**
```json
{
  "query": "What were Apple main risk factors in 2022?",
  "reference_answer": "optional gold-standard answer for evaluation"
}
```

**Response:**
```json
{
  "query": "...",
  "token_reduction_pct": 88.5,
  "pipeline1": {
    "pipeline_name": "llm_only",
    "answer": "...",
    "prompt_tokens": 312,
    "completion_tokens": 220,
    "total_tokens": 532,
    "latency_ms": 1840,
    "cost_usd": 0.000041,
    "retrieved_chunks": [],
    "graph_hops": 0,
    "bertscore_f1": 0.812,
    "judge_pass": true,
    "judge_reason": "Answer is factually accurate...",
    "error": null
  },
  "pipeline2": { "..." },
  "pipeline3": { "..." }
}
```

### Interactive API Docs

FastAPI auto-generates Swagger UI at **http://localhost:8000/docs**

---

## CLI Testing (No Dashboard)

Run all 3 pipelines in the terminal:

```bash
# Default 3 test queries
python test_graphrag.py

# Custom query
python test_graphrag.py --query "What are JPMorgan key executives?"
```

Sample queries to try:
```bash
python test_graphrag.py --query "What were Apple's main risk factors in 2022?"
python test_graphrag.py --query "What impact did COVID-19 have on Microsoft in 2020?"
python test_graphrag.py --query "What are the main risks ExxonMobil faces?"
python test_graphrag.py --query "Who are JPMorgan's key executives?"
python test_graphrag.py --query "What cybersecurity risks does Johnson and Johnson report?"
```

---

## Offline Benchmark

Run a full evaluation across 5 preset questions and save results:

```bash
python -m evaluation.benchmark
```

Results saved to `data/processed/benchmark_results.jsonl`.

Each result includes tokens, latency, cost, BERTScore F1, and LLM judge verdict for all 3 pipelines.

---

## Troubleshooting

### TigerGraph authentication fails (`User authentication failed`)

Your secret has expired. Generate a fresh token:

```bash
# Step 1: Generate a new secret in TigerGraph Savanna UI
# tgcloud.io → Workspace → Admin Panel → User Management → Secrets → Add Secret

# Step 2: Exchange the secret for a token
source venv/bin/activate
python3 -c "
import requests
resp = requests.post(
    'https://YOUR_HOST.i.tgcloud.io/gsql/v1/tokens',
    json={'secret': 'YOUR_NEW_SECRET'},
    timeout=15
)
print('Token:', resp.json()['token'])
"

# Step 3: Paste the token into .env
# TIGERGRAPH_TOKEN=eyJhbGc...
```

### TigerGraph workspace not responding (`500 Server Error`)

Your workspace is paused (Savanna pauses free-tier workspaces automatically):

1. Go to [tgcloud.io](https://tgcloud.io)
2. Find your workspace → click **Start / Resume**
3. Wait ~2 minutes for it to show **Running** (green)
4. Re-run your command

### FAISS index not found

```bash
# Re-run the ingestion pipeline
python -m ingestion.parse_filings
```

### `ModuleNotFoundError` for any package

Make sure you activated the virtual environment first:

```bash
source venv/bin/activate      # macOS / Linux
venv\Scripts\activate         # Windows
```

### Frontend can't reach the backend (`fetch failed`)

1. Make sure the backend is running on port 8000: `curl http://localhost:8000/health`
2. Check `dashboard/frontend/.env.local` contains: `NEXT_PUBLIC_API_URL=http://localhost:8000`
3. Restart the frontend: `npm run dev`

### BERTScore is slow on first query

Normal — BERTScore loads the `roberta-large` model (~1.4GB) on first use and caches it. Subsequent queries are fast (~2s).

### Port already in use

```bash
# Kill whatever is on port 8000
lsof -ti:8000 | xargs kill -9

# Kill whatever is on port 3000
lsof -ti:3000 | xargs kill -9
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | ✅ Yes | — | OpenRouter API key |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | OpenRouter base URL |
| `OPENROUTER_MODEL` | No | `meta-llama/llama-3.1-70b-instruct` | Main LLM model |
| `JUDGE_MODEL` | No | `openai/gpt-4o-mini` | LLM Judge model |
| `EMBED_MODEL` | No | `all-MiniLM-L6-v2` | Sentence transformer model |
| `FAISS_INDEX_PATH` | No | `data/processed/faiss.index` | Path to FAISS index |
| `CHUNKS_PATH` | No | `data/processed/chunks.jsonl` | Path to text chunks |
| `TOP_K` | No | `5` | Number of RAG chunks to retrieve |
| `TIGERGRAPH_HOST` | ✅ Yes | — | Savanna hostname (no `https://`) |
| `TIGERGRAPH_GRAPH_NAME` | No | `FinanceGraph` | Graph name in TigerGraph |
| `TIGERGRAPH_SECRET` | ✅ Yes | — | Savanna secret for token exchange |
| `TIGERGRAPH_TOKEN` | No | — | Pre-fetched JWT (skips secret call) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **LLM** | OpenRouter (OpenAI-compatible API) |
| **Main model** | Meta LLaMA 3.1 70B Instruct |
| **Judge model** | OpenAI GPT-4o Mini |
| **Embeddings** | sentence-transformers `all-MiniLM-L6-v2` (local) |
| **Vector store** | FAISS (CPU) |
| **Graph database** | TigerGraph Savanna (cloud) |
| **Graph client** | pyTigerGraph 2.0 |
| **Backend** | FastAPI + uvicorn |
| **Frontend** | Next.js 16 + TypeScript + Tailwind CSS |
| **Evaluation** | BERTScore (roberta-large) + LLM-as-a-Judge |
| **SEC data** | sec-edgar-downloader + BeautifulSoup4 |

---

## Key Results

| Metric | LLM Only | Basic RAG | GraphRAG |
|---|---|---|---|
| Avg tokens | ~530 | ~3,500 | ~420 |
| Token vs Basic RAG | — | baseline | **-88%** |
| Avg cost/query | $0.00004 | $0.00025 | $0.00003 |
| Graph hops | 0 | 0 | **2** |
| Hallucination risk | High | Low | **Lowest** |
