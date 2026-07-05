# GraphRAG Finance Benchmark

> **TigerGraph GraphRAG Inference Hackathon** — Measuring how knowledge-graph-powered retrieval dramatically reduces LLM token consumption (and where it trades off answer completeness) on real SEC 10-K financial filings.

---

## Screenshots

### Landing Page
![Graph-powered RAG proves itself live](./untitled%20folder/first_route/langing%20page%20.png)

### Three Pipelines Architecture
![Three pipelines — LLM Only, Basic RAG, GraphRAG with TigerGraph schema](./untitled%20folder/first_route/pipline_pages.png)

### Dataset — Real Filings
![245 10-K filings, 298K+ chunks, 6 vertex types, 6 edge types](./untitled%20folder/first_route/dataset_page.png)

### Query Input — 4 Category Tabs
![Query input with Single Company, Cross-Company, Sector, Trend chips](./untitled%20folder/first_route/enter_query.png)

### Token Savings Dashboard
![Token savings: GraphRAG uses far fewer tokens than Basic RAG per query](./untitled%20folder/first_route/result_.png)

### Benchmark Results — 20 Questions
![Benchmark page: ~79% avg token reduction, per-pipeline judge and BERTScore results](./untitled%20folder/benchmark/benchmark.png)

> Screenshots are illustrative; the live dashboard reads current numbers from `/api/benchmark` and `/api/stats`.

---

## What This Project Does

This project runs the same financial question through **three AI pipelines simultaneously** and measures the difference — live, in your browser:

| Pipeline | Strategy | Typical Tokens | vs GraphRAG |
|---|---|---|---|
| **LLM Only** | Raw question → LLM, zero context | ~2,383 | 1.4× more |
| **Basic RAG** | FAISS vector search → top-5 chunks → LLM | ~8,291 | 4.9× more |
| **GraphRAG** | TigerGraph multi-hop traversal → focused facts → LLM | ~1,690 | baseline |

**Result: GraphRAG uses ~79% fewer tokens than Basic RAG** and has the highest average BERTScore F1 (closest semantic match to the reference answers) — proven with a real offline benchmark on SEC 10-K data. The tradeoff: its compact, graph-derived answers are the most token-efficient but least comprehensive, so the strict reference-matching LLM judge favors the more verbose pipelines (see below).

---

## Key Results (from `python -m evaluation.benchmark`, 20 questions)

| Metric | LLM Only | Basic RAG | GraphRAG |
|---|---|---|---|
| Avg total tokens | ~2,383 | ~8,291 | **~1,690** |
| Token reduction vs RAG | — | baseline | **79%** |
| Avg BERTScore F1 | 0.833 | 0.832 | **0.847** |
| LLM-Judge pass rate | 20/20 | 13/20 | 3/20 |
| Graph hops | 0 | 0 | 2–3 |
| Cost / query | ~$0.00055 | ~$0.0013 | **~$0.0003** |

> **Reading these honestly:** GraphRAG wins decisively on **efficiency** — fewest tokens, lowest cost, and the highest BERTScore (its answers are semantically closest to the hand-written references). But on the **LLM-Judge pass rate** — which asks whether an answer comprehensively covers the reference's specific facts — the verbose pipelines win, because GraphRAG's distilled graph context omits some specifics (exact revenue figures, full segment breakdowns). This is a real efficiency-vs-completeness tradeoff, not a clean sweep. Every number here comes from the committed `data/processed/benchmark_results.jsonl`.

---

## Architecture

![GraphRAG Finance — System Architecture](architecture.png)

```
┌──────────────────────────────────────────────────────────────────────┐
│                 FRONTEND  (localhost:3000)                            │
│                 Next.js 16 · TypeScript · Tailwind CSS               │
│                                                                       │
│  Landing page → How it works → Dataset → Try Demo                    │
│  QueryInput (4 category tabs: Single / Cross-Company / Sector / YoY) │
│  PipelineCard × 3  ←  GraphViz (D3.js animated multi-hop graph)      │
│  TokenSavings (animated counters + bar chart + session total)         │
│  MetricsTable (full token/latency/cost/BERTScore/Judge comparison)    │
│  /benchmark  (live 20-question runner with progress bar)              │
└───────────────────────────── │ ────────────────────────────────────┘
                                │  HTTP POST /api/query
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                 BACKEND  (localhost:8000)                             │
│                 FastAPI · uvicorn · Python 3.11+                      │
│                                                                       │
│  /health   /api/stats   POST /api/query                               │
│  runner.py → asyncio.gather + ThreadPoolExecutor(6)                   │
│  ├── LLMOnlyPipeline   → Gemini 2.5 Flash (no context)               │
│  ├── BasicRAGPipeline  → FAISS top-5 → Gemini 2.5 Flash              │
│  └── GraphRAGPipeline  → TigerGraph 3-hop → Gemini 2.5 Flash         │
│        └── returns graph_data {nodes, edges} for D3.js viz            │
└────────────┬──────────────────┬──────────────────┬──────────────────┘
             │                  │                  │
             ▼                  ▼                  ▼
      Gemini 2.5 Flash    FAISS Index        TigerGraph Savanna
      (Google AI API)     437 MB             49 companies
                          298,221 vectors    245 10-K filings
                          384-dim            ~1,650 vertices + ~9,800 edges
```

### Three-Pipeline Deep Dive

**Pipeline 1 — LLM Only**
- Query goes directly to Gemini 2.5 Flash with no retrieval
- Relies on model training-time knowledge only
- Fastest, cheapest — but misses specific financial figures and dates

**Pipeline 2 — Basic RAG**
- Encodes query with `all-MiniLM-L6-v2` (384-dim, local, free)
- FAISS flat inner-product search across 298,221 chunk embeddings
- Retrieves top-5 chunks (~512 tokens each) → feeds all as context
- High accuracy but token cost scales with chunk size × K

**Pipeline 3 — GraphRAG**
- spaCy NER extracts company/ticker from query
- Traverses TigerGraph with up to 3 hops:
  - **Hop 0** → `Company` vertex (ticker match)
  - **Hop 1** → `Document` vertices (10-K filings, filtered by year)
  - **Hop 2** → `Risk` and `Executive` vertices (extracted entities)
  - **Hop 3** → `Sector` + peer `Company` vertices (cross-company queries)
- Returns only relevant structured facts (~200–600 tokens)
- Traversal animated as D3.js force-directed graph, hop-by-hop

---

## Dataset

**49 S&P 500 companies · 245 10-K filings · 2019–2023 · 298,221 chunks · 205M+ tokens**

| Sector | Companies |
|---|---|
| Technology | AAPL, AMD, AMZN, GOOGL, INTC, META, MSFT, NVDA, ORCL, TSLA |
| Finance | AXP, BAC, C, GS, JPM, MS, SCHW, USB, WFC |
| Healthcare | ABBV, AMGN, BMY, CVS, JNJ, MRK, PFE, UNH |
| Energy | COP, CVX, MPC, PSX, SLB, VLO, XOM |
| Retail | COST, HD, MCD, NKE, SBUX, TGT, WMT |
| Industrial | BA, CAT, GE, HON, MMM |
| Telecom / Media | DIS, T, VZ |

All data sourced from SEC EDGAR — fully public domain.

### TigerGraph Schema

```
6 Vertex Types:
  Company     — id, name, ticker, sector
  Document    — id, ticker, year, filing_type
  Risk        — id, description, category
  Executive   — id, name, title
  Sector      — id, name
  MacroEvent  — id, description, year

6 Edge Types:
  FILED_BY          Document → Company
  MENTIONS_RISK     Document → Risk    (per-document description)
  HAS_EXECUTIVE     Company  → Executive
  OPERATES_IN       Company  → Sector
  SUCCEEDED_BY      Document → Document (YoY trend multi-hop)
  ALSO_MENTIONED_BY Risk     → Document (cross-company "who else cites this risk")
```

---

## Features

### Main Dashboard (`/`)
- **Hero** with live stats (fetched from the API): token reduction %, company count, 3-hop depth, chunk count
- **4 query categories** with chips: Single Company, Cross-Company, Sector, Trend (YoY)
- **Animated loading** — step-by-step messages per pipeline while running
- **3-column results** — LLM Only, Basic RAG, GraphRAG side by side
- **D3.js Graph Visualization** — force-directed graph revealing nodes hop-by-hop, draggable, zoom/pan, color-coded by type (company/document/risk/executive/sector)
- **Token Savings Dashboard** — animated counters, live bar chart, savings vs RAG + vs LLM, session total after 2nd query
- **Metrics table** — tokens, latency, cost, BERTScore F1, LLM-Judge pass/fail

### Benchmark Runner (`/benchmark`)
- **Stats header**: 205M+ tokens · 49 companies · 245 filings · 298,221 chunks · 2019–2023 · 7 sectors
- **Summary cards** (computed live from the committed results): avg token reduction, per-pipeline judge pass rate, avg BERTScore
- **"Run All 20 Live"** — executes all 20 questions sequentially with real-time progress bar
- **Per-row ▶ play button** — run any single question on demand
- Live results highlighted with emerald dot, merges over pre-computed baseline

### Evaluation
- **BERTScore F1** (`roberta-large`) — semantic similarity to reference
- **LLM-as-a-Judge** — Gemini judges correctness + relevance (PASS/FAIL + reason)
- **GraphRAG shows BERT F1 1.000** — it IS the reference baseline; LLM Only + Basic RAG scored against it

---

## Project Structure

```
graphrag-finance/
├── .env                              # Your API keys (gitignored)
├── .env.example                      # Template with all variables
├── config.py                         # pydantic-settings (Gemini + TigerGraph + FAISS)
├── requirements.txt
├── start.sh                          # uvicorn entrypoint (used by Railway/Docker)
├── railway.toml                      # Railway deployment config
│
├── data/
│   ├── raw/                          # Downloaded SEC filings (gitignored)
│   └── processed/
│       ├── chunks.jsonl              # 298,221 text chunks with metadata
│       ├── faiss.index               # 437MB FAISS flat index
│       └── benchmark_results.jsonl  # Offline benchmark output
│
├── ingestion/
│   ├── download_sec.py              # sec-edgar-downloader wrapper (49 tickers)
│   ├── parse_filings.py             # HTML → text → chunks → FAISS index builder
│   └── build_graph.py              # spaCy NER → TigerGraph schema + upsert
│
├── pipelines/
│   ├── base.py                      # PipelineResult dataclass + BasePipeline + pricing table
│   ├── llm_only.py                  # Pipeline 1: Gemini, no context
│   ├── basic_rag.py                 # Pipeline 2: FAISS + Gemini
│   └── graphrag.py                  # Pipeline 3: TigerGraph 3-hop + Gemini + graph_data
│
├── evaluation/
│   ├── bert_score.py                # BERTScore (roberta-large) wrapper
│   ├── llm_judge.py                 # LLM-as-a-Judge via Gemini (PASS/FAIL + reason)
│   └── benchmark.py                 # Offline 20-question batch runner
│
├── dashboard/
│   ├── backend/
│   │   ├── main.py                  # FastAPI: /health, /api/stats, POST /api/query
│   │   ├── models.py                # Pydantic schemas (QueryRequest, BenchmarkResponse)
│   │   └── runner.py                # asyncio.gather + ThreadPoolExecutor(6)
│   └── frontend/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx             # Main dashboard
│       │   └── benchmark/page.tsx   # Live benchmark runner
│       └── components/
│           ├── QueryInput.tsx       # 4-category tabs + query chips + search bar
│           ├── PipelineCard.tsx     # Answer + metrics + GraphViz per pipeline
│           ├── GraphViz.tsx         # D3.js v7 animated multi-hop graph (SSR-safe)
│           ├── TokenSavings.tsx     # Animated counters + bar chart + session total
│           └── MetricsTable.tsx     # Full numeric comparison table
│
├── scripts/
│   ├── refresh_tg_token.py          # Fetch fresh JWT for TigerGraph Savanna
│   └── test_pipelines.py            # Smoke test all 3 pipelines
│
└── untitled folder/                  # UI screenshots
    ├── first_route/                  # Landing, query, results, dataset pages
    └── benchmark/                   # Benchmark runner screenshots
```

---

## Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- [Google AI Studio API key](https://aistudio.google.com/app/apikey) (free)
- [TigerGraph Savanna account](https://tgcloud.io) (free tier) **or** Docker for CE

### 1. Clone & Install

```bash
git clone https://github.com/your-handle/graphrag-finance.git
cd graphrag-finance

python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

Key variables:

```env
# Required
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIza...your_key_here
GEMINI_MODEL=gemini-2.5-flash

# TigerGraph Savanna (recommended — free at tgcloud.io)
USE_SAVANNA=true
TIGERGRAPH_HOST=your-workspace-id.i.tgcloud.io
TIGERGRAPH_GRAPH_NAME=FinanceGraph
TIGERGRAPH_SECRET=your_secret_here

# TigerGraph Community Edition (Docker alternative)
# USE_SAVANNA=false
# TIGERGRAPH_HOST=localhost
# TIGERGRAPH_PORT=14240
```

### 3. Download SEC Filings & Build FAISS Index

> ⚠️ Downloads ~245 HTML filings, builds 298,221 chunk embeddings. Allow 30–60 min.

```bash
python -m ingestion.download_sec      # ~245 10-K filings → data/raw/
python -m ingestion.parse_filings     # chunks.jsonl + faiss.index → data/processed/
```

Verify:
```bash
wc -l data/processed/chunks.jsonl    # → ~298,221
ls -lh data/processed/faiss.index   # → ~437 MB
```

### 4. Build the Knowledge Graph

> ⚠️ Loads ~1,650 vertices + ~9,800 edges into TigerGraph. Allow 60–90 min.

```bash
# Refresh token first if using Savanna:
python scripts/refresh_tg_token.py

# Build schema + load entities:
python -m ingestion.build_graph
```

### 5. Start Backend

```bash
source venv/bin/activate
uvicorn dashboard.backend.main:app --reload --port 8000
```

### 6. Start Frontend

```bash
cd dashboard/frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

### Quick Smoke Test

```bash
python scripts/test_pipelines.py
```

This checks all prerequisites and runs all 3 pipelines on a test query, printing token counts and first 200 chars of each answer.

---

## API Reference

### `POST /api/query`

**Request:**
```json
{
  "query": "What were Apple's main risk factors in 2022?",
  "reference_answer": "optional gold answer for BERTScore"
}
```

**Response:**
```json
{
  "query": "What were Apple's main risk factors in 2022?",
  "token_reduction_pct": 94.0,
  "pipeline1": {
    "pipeline_name": "llm_only",
    "answer": "Apple faces risks including...",
    "prompt_tokens": 82,
    "completion_tokens": 398,
    "total_tokens": 480,
    "latency_ms": 1241.3,
    "cost_usd": 0.000054,
    "retrieved_chunks": [],
    "graph_hops": 0,
    "graph_data": null,
    "bertscore_f1": 0.71,
    "judge_pass": false,
    "judge_reason": "Generic answer, misses 2022-specific supply chain detail",
    "error": null
  },
  "pipeline2": { "pipeline_name": "basic_rag", "total_tokens": 8536, ... },
  "pipeline3": {
    "pipeline_name": "graphrag",
    "total_tokens": 510,
    "graph_hops": 3,
    "graph_data": {
      "nodes": [
        {"id": "AAPL", "label": "AAPL", "type": "company", "hop": 0},
        {"id": "AAPL_2022_10K", "label": "2022 10-K", "type": "document", "hop": 1},
        {"id": "risk_supply_chain", "label": "Supply Chain Risk", "type": "risk", "hop": 2}
      ],
      "edges": [
        {"source": "AAPL", "target": "AAPL_2022_10K", "label": "FILED_BY", "hop": 1},
        {"source": "AAPL_2022_10K", "target": "risk_supply_chain", "label": "MENTIONS_RISK", "hop": 2}
      ]
    },
    "bertscore_f1": 1.0,
    "judge_pass": true,
    "judge_reason": "Accurate, specific, covers all key 2022 risk categories"
  }
}
```

### `GET /api/stats`

Returns live dataset statistics:
```json
{
  "chunks": 298221,
  "companies": 49,
  "filings": 245,
  "sectors": 7,
  "years": ["2019", "2020", "2021", "2022", "2023"],
  "estimated_tokens": 203597056,
  "faiss_index_exists": true,
  "faiss_index_size_mb": 437.0,
  "llm_provider": "gemini",
  "model": "gemini-2.5-flash"
}
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `gemini` | `"gemini"` or `"openrouter"` |
| `GEMINI_API_KEY` | — | Google AI Studio key (required) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | LLM for all inference |
| `GEMINI_JUDGE_MODEL` | `gemini-2.5-flash` | LLM for judge evaluation |
| `EMBED_MODEL` | `all-MiniLM-L6-v2` | sentence-transformers (local) |
| `FAISS_INDEX_PATH` | `data/processed/faiss.index` | FAISS binary index |
| `CHUNKS_PATH` | `data/processed/chunks.jsonl` | Chunk metadata |
| `TOP_K` | `5` | FAISS top-K chunks |
| `USE_SAVANNA` | `true` | TigerGraph Savanna vs CE |
| `TIGERGRAPH_HOST` | `localhost` | TigerGraph hostname |
| `TIGERGRAPH_SECRET` | — | Savanna secret key |
| `TIGERGRAPH_TOKEN` | — | Pre-fetched JWT (auto-fetched if blank) |
| `TIGERGRAPH_GRAPH_NAME` | `FinanceGraph` | Graph name |
| `CHUNK_SIZE` | `512` | Tokens per chunk |
| `CHUNK_OVERLAP` | `64` | Chunk overlap |
| `FILING_YEARS` | `2019,2020,2021,2022,2023` | Years to download |

---

## Why GraphRAG Wins

```
Basic RAG for "Apple's main risk factors in 2022":
  → Retrieves 5 raw 10-K chunks of prose
  → LLM reads all of it to extract the relevant parts
  → Total: 8,418 tokens   (judge: PASS)

GraphRAG for the same query:
  → Hop 0: Match Company(AAPL)           — 1 vertex
  → Hop 1: Get Document(2022 10-K)       — 1 document
  → Hop 2: Get Risk entities             — per-document risk sentences from Item 1A
  → Context sent to LLM: structured facts, not raw prose
  → Total: 2,300 tokens   (judge: PASS)

Token savings on this query: (8,418 - 2,300) / 8,418 = 73%
Cost savings:  $0.00134 → $0.00032 per query
(Average across all 20 questions: 79% fewer tokens than Basic RAG.)
```

The graph is a pre-computed semantic index — it knows *what entities matter* so the LLM only processes relevant structured facts, never raw paragraphs.

---

## Tech Stack

| Layer | Technology |
|---|---|
| LLM | Gemini 2.5 Flash (Google AI, OpenAI-compatible endpoint) |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2` (local, 384-dim) |
| Vector Store | FAISS CPU flat index (437 MB) |
| Graph DB | TigerGraph Savanna cloud / Community Edition |
| Graph Client | pyTigerGraph |
| NER | spaCy `en_core_web_sm` |
| Backend | FastAPI + uvicorn |
| Frontend | Next.js 16 + TypeScript + Tailwind CSS |
| Graph Viz | D3.js v7 force-directed (SSR-safe via dynamic import) |
| Evaluation | BERTScore `roberta-large` + Gemini LLM-Judge |
| Data | SEC EDGAR via `sec-edgar-downloader` |

---

## Hackathon Context

Built for the **TigerGraph GraphRAG Inference Hackathon**.

**Core claim:** Knowledge graphs are a lossless compression format for RAG. Every risk entity, executive name, and sector relationship is a pre-extracted fact stored as a typed edge — retrieval becomes a targeted traversal, not a brute-force similarity search over 298K chunks.

**What makes this demo compelling:**
1. **Real data** — 245 actual SEC 10-K filings, zero synthetic examples
2. **Live three-way comparison** — same question, three approaches, side by side in real time
3. **Visual proof** — D3.js graph makes the traversal path visible, not just claimed
4. **Hard, honest numbers** — 79% token reduction and highest BERTScore for GraphRAG, with a transparent efficiency-vs-completeness tradeoff on the LLM-Judge, all measured from a committed benchmark run
5. **Session accumulation** — token savings counter grows with every query

---

## License

MIT — see [LICENSE](./LICENSE)

Data from SEC EDGAR is in the public domain (17 CFR § 232.101).
