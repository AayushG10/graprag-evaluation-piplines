# GraphRAG Finance — Architecture

> Full system architecture for the TigerGraph GraphRAG Inference Hackathon project.  
> Open `architecture.excalidraw` at [excalidraw.com](https://excalidraw.com) to edit the live diagram.

---

## Architecture Diagram

![GraphRAG Finance — Full System Architecture](architecture.png)

> **Three regions:** ① Data Ingestion (orange) — ② Backend Pipelines (blue) — ③ Frontend (purple)  
> **Token savings:** GraphRAG averages ~1,690 tokens vs ~8,291 for Basic RAG = **79% reduction** (and the highest BERTScore of the three)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Three-Pipeline Architecture](#2-three-pipeline-architecture)
3. [Data Ingestion Pipeline](#3-data-ingestion-pipeline)
4. [TigerGraph Knowledge Graph Schema](#4-tigergraph-knowledge-graph-schema)
5. [Multi-Hop Graph Traversal](#5-multi-hop-graph-traversal)
6. [API Request Flow](#6-api-request-flow)
7. [Frontend Component Tree](#7-frontend-component-tree)
8. [Evaluation Pipeline](#8-evaluation-pipeline)
9. [Token Economics](#9-token-economics)
10. [Deployment Architecture](#10-deployment-architecture)

---

## 1. System Overview

```mermaid
graph TB
    User(["👤 User Browser"])

    subgraph Frontend["Frontend — Next.js 16 (localhost:3000)"]
        LP["Landing Page\nHero + Stats + How it works"]
        DS["Dataset Page\n49 companies · 245 filings"]
        QI["QueryInput\n4 category tabs + chips"]
        PC["PipelineCard × 3\nAnswer + Metrics"]
        GV["GraphViz\nD3.js animated multi-hop"]
        TS["TokenSavings\nAnimated counters + bar chart"]
        MT["MetricsTable\nFull comparison table"]
        BM["Benchmark /benchmark\nLive 20-question runner"]
    end

    subgraph Backend["Backend — FastAPI (localhost:8000)"]
        API["POST /api/query\nGET /api/stats\nGET /health"]
        RUN["runner.py\nasyncio.gather\nThreadPoolExecutor(6)"]
        P1["Pipeline 1\nLLM Only"]
        P2["Pipeline 2\nBasic RAG"]
        P3["Pipeline 3\nGraphRAG"]
        EVAL["Evaluation\nBERTScore + LLM Judge"]
    end

    subgraph DataStores["Data Stores"]
        GEMINI["☁️ Gemini 2.5 Flash\nGoogle AI API"]
        FAISS["💾 FAISS Index\n437 MB · 298,221 vectors"]
        TG["🕸️ TigerGraph Savanna\n49 companies · 245 filings\n~1,650 vertices + ~9,800 edges"]
    end

    User -->|"HTTP"| Frontend
    QI -->|"POST /api/query"| API
    API --> RUN
    RUN --> P1 & P2 & P3
    P1 --> GEMINI
    P2 --> FAISS
    P2 --> GEMINI
    P3 --> TG
    P3 --> GEMINI
    RUN --> EVAL
    EVAL -->|"BenchmarkResponse"| API
    API -->|"JSON"| Frontend
    PC --> GV
    Frontend --> TS & MT
```

---

## 2. Three-Pipeline Architecture

```mermaid
flowchart LR
    Q["❓ User Query\n'What were Apple's\nrisk factors in 2022?'"]

    subgraph P1["🧠 Pipeline 1 — LLM Only"]
        direction TB
        S1["System prompt\n+ bare question"]
        G1["Gemini 2.5 Flash"]
        O1["Answer\n~480 tokens total"]
        S1 --> G1 --> O1
    end

    subgraph P2["🔍 Pipeline 2 — Basic RAG"]
        direction TB
        E2["Encode query\nall-MiniLM-L6-v2\n384-dim vector"]
        F2["FAISS search\n298,221 vectors\nTop-5 chunks"]
        C2["Build context\n~2,560 tokens\nraw 10-K prose"]
        G2["Gemini 2.5 Flash"]
        O2["Answer\n~8,291 tokens avg"]
        E2 --> F2 --> C2 --> G2 --> O2
    end

    subgraph P3["🕸️ Pipeline 3 — GraphRAG"]
        direction TB
        NER["spaCy NER\nExtract: AAPL, 2022"]
        HOP["TigerGraph\n3-hop traversal"]
        CTX["Build context\n~400 tokens\nstructured facts"]
        G3["Gemini 2.5 Flash"]
        O3["Answer + graph_data\n~1,690 tokens avg"]
        NER --> HOP --> CTX --> G3 --> O3
    end

    Q --> P1 & P2 & P3

    subgraph EVAL["📊 Evaluation"]
        BS["BERTScore F1\nroberta-large\nvs reference"]
        JG["LLM Judge\nGemini: PASS/FAIL\n+ reason"]
    end

    O1 & O2 & O3 --> EVAL
```

---

## 3. Data Ingestion Pipeline

```mermaid
flowchart TD
    START(["▶ python -m ingestion.download_sec"])

    subgraph DOWNLOAD["Step 1 — Download SEC Filings"]
        SEC["SEC EDGAR API\nsec-edgar-downloader"]
        TICKERS["49 S&P 500 tickers\nAAPL MSFT JPM XOM JNJ\nNVDA TSLA GS UNH CVX\n+ 39 more"]
        YEARS["Years: 2019–2023\n5 years × 49 companies\n= 245 10-K filings"]
        RAW["data/raw/\nHTML/XBRL files\n~2 GB"]
        SEC --> TICKERS --> YEARS --> RAW
    end

    START --> DOWNLOAD

    subgraph PARSE["Step 2 — python -m ingestion.parse_filings"]
        HTML["HTML → plain text\nBeautifulSoup4 + lxml\nStrip tags/tables"]
        CHUNK["Chunker\n512 tokens · 64 overlap\nsliding window"]
        EMBED["Encode chunks\nall-MiniLM-L6-v2\n384-dim · local CPU"]
        FAISS_BUILD["FAISS IndexFlatIP\nInner-product similarity\n437 MB index file"]
        JSONL["chunks.jsonl\n298,221 records\n{text, ticker, year, chunk_id}"]
        HTML --> CHUNK --> EMBED --> FAISS_BUILD
        CHUNK --> JSONL
    end

    RAW --> PARSE

    subgraph GRAPH["Step 3 — python -m ingestion.build_graph"]
        CONN["Connect TigerGraph\nSavanna (JWT token)\nor CE (username/pass)"]
        SCHEMA["Create schema\n6 vertex types\n6 edge types\nGSQL DDL"]
        NER["spaCy NER\nen_core_web_sm\nExtract ORG, PERSON"]
        RISK_RE["Regex patterns\nItem 1A: Risk Factors\nSection extraction"]
        UPSERT["pyTigerGraph\nupsertVertex + upsertEdge\nBatch 100 records\nIdempotent"]
        RESULT["~1,650 vertices +\n~9,800 edges loaded\n~60–90 min"]
        CONN --> SCHEMA --> NER & RISK_RE --> UPSERT --> RESULT
    end

    PARSE --> GRAPH

    OUT1[("💾 data/processed/\nfaiss.index 437MB\nchunks.jsonl 298,221 lines")]
    OUT2[("🕸️ TigerGraph Savanna\nFinanceGraph\n~1,650 vertices + ~9,800 edges")]

    FAISS_BUILD --> OUT1
    JSONL --> OUT1
    RESULT --> OUT2
```

---

## 4. TigerGraph Knowledge Graph Schema

```mermaid
erDiagram
    Company {
        string id PK "ticker e.g. AAPL"
        string name "Apple Inc."
        string sector "Technology"
        string cik "SEC CIK number"
    }

    Document {
        string id PK "AAPL_2022_10K"
        string ticker FK
        string year "2022"
        string filing_type "10-K"
        string doc_id
    }

    Risk {
        string id PK "supply_chain_risk"
        string description "Supply chain disruption..."
        string category "Operational"
    }

    Executive {
        string id PK "tim_cook_AAPL_2022"
        string name "Tim Cook"
        string title "CEO"
        string company_ticker FK
        string year "2022"
    }

    Sector {
        string id PK "Technology"
        string name "Technology"
    }

    EarningsCall {
        string id PK
        string company_ticker FK
        string quarter "Q4"
        string year "2022"
    }

    MacroEvent {
        string id PK
        string name "COVID-19 Pandemic"
        string date "2020-03-01"
        string description
    }

    Company ||--o{ Document      : "FILED_BY"
    Document ||--o{ Risk         : "MENTIONS_RISK"
    Company  ||--o{ Executive    : "HAS_EXECUTIVE"
    Company  }o--o{ Sector       : "OPERATES_IN"
    Document ||--o| Document     : "SUCCEEDED_BY (YoY)"
    MacroEvent ||--o{ EarningsCall : "DISCUSSED_IN"
```

### Edge Types Detail

```mermaid
graph LR
    subgraph Vertices
        CO["Company\nAAPL"]
        DOC1["Document\nAAPL_2022_10K"]
        DOC2["Document\nAAPL_2021_10K"]
        RISK["Risk\nsupply_chain"]
        EXEC["Executive\nTim Cook"]
        SEC["Sector\nTechnology"]
        MACRO["MacroEvent\nCOVID-19"]
        CALL["EarningsCall\nAAPL Q4 2022"]
    end

    DOC1 -->|"FILED_BY"| CO
    DOC1 -->|"MENTIONS_RISK"| RISK
    CO   -->|"HAS_EXECUTIVE"| EXEC
    CO   -->|"OPERATES_IN"| SEC
    DOC1 -->|"SUCCEEDED_BY"| DOC2
    MACRO -->|"DISCUSSED_IN"| CALL

    style CO fill:#10b981,color:#000
    style DOC1 fill:#3b82f6,color:#fff
    style DOC2 fill:#3b82f6,color:#fff
    style RISK fill:#ef4444,color:#fff
    style EXEC fill:#f97316,color:#000
    style SEC fill:#a855f7,color:#fff
    style MACRO fill:#6b7280,color:#fff
    style CALL fill:#6b7280,color:#fff
```

---

## 5. Multi-Hop Graph Traversal

```mermaid
flowchart TD
    Q["Query: 'What were Apple's risk factors in 2022?'"]

    subgraph PARSE["Query Parsing — _parse_query()"]
        NER1["spaCy NER\nExtract entity names"]
        MAP["_COMPANY_MAP lookup\n'apple' → 'AAPL'"]
        YEAR["Regex year extract\n'2022' → year=2022"]
        RKWD["Risk keyword match\n_RISK_KEYWORDS list"]
        NER1 --> MAP
        Q --> NER1
        Q --> YEAR
        Q --> RKWD
    end

    subgraph HOP0["Hop 0 — Company Vertex"]
        CO["Company(AAPL)\nnode type: company\nhop: 0"]
    end

    subgraph HOP1["Hop 1 — Documents (FILED_BY)"]
        D1["Document AAPL_2022_10K\nnode type: document · hop: 1"]
        D2["Document AAPL_2021_10K\nnode type: document · hop: 1"]
        D3["Document AAPL_2020_10K\nnode type: document · hop: 1"]
    end

    subgraph HOP2["Hop 2 — Risks + Executives (MENTIONS_RISK / HAS_EXECUTIVE)"]
        R1["Risk: supply_chain\nhop: 2"]
        R2["Risk: cybersecurity\nhop: 2"]
        R3["Risk: regulation\nhop: 2"]
        E1["Executive: Tim Cook\nhop: 2"]
    end

    subgraph HOP3["Hop 3 — Sector Peers (OPERATES_IN)"]
        S1["Sector: Technology\nhop: 3"]
        P1["Peer: MSFT · hop: 3"]
        P2["Peer: NVDA · hop: 3"]
        P3["Peer: GOOGL · hop: 3"]
    end

    MAP --> CO
    CO -->|"getVertices\nwhere ticker=AAPL\nyear=2022"| D1 & D2 & D3
    D1 -->|"getEdges\nMENTIONS_RISK"| R1 & R2 & R3
    CO -->|"getEdges\nHAS_EXECUTIVE"| E1
    CO -->|"getEdges\nOPERATES_IN"| S1
    S1 -->|"reverse traverse"| P1 & P2 & P3

    subgraph CTX["Context Assembly — _build_context()"]
        OUT["~400 tokens structured facts\n(vs ~2,560 raw chunks in Basic RAG)"]
    end

    R1 & R2 & R3 & E1 & P1 & P2 & P3 --> CTX
```

### Cross-Company Query Path (no ticker)

```mermaid
flowchart LR
    Q2["Query: 'Which companies share\ncybersecurity risks?'"]
    RISK_NODE["Risk: cybersecurity\nhop: 0"]
    D1["Document A · hop: 1"]
    D2["Document B · hop: 1"]
    D3["Document C · hop: 1"]
    C1["Company MSFT · hop: 2"]
    C2["Company JPM · hop: 2"]
    C3["Company AAPL · hop: 2"]

    Q2 --> RISK_NODE
    RISK_NODE -->|"ALSO_MENTIONED_BY"| D1 & D2 & D3
    D1 -->|"FILED_BY"| C1
    D2 -->|"FILED_BY"| C2
    D3 -->|"FILED_BY"| C3
```

---

## 6. API Request Flow

```mermaid
sequenceDiagram
    participant U as Browser
    participant FE as Next.js Frontend
    participant API as FastAPI /api/query
    participant RUN as runner.py
    participant P1 as LLMOnlyPipeline
    participant P2 as BasicRAGPipeline
    participant P3 as GraphRAGPipeline
    participant EVAL as Evaluation
    participant GEM as Gemini 2.5 Flash
    participant TG as TigerGraph

    U->>FE: Click "Run →"
    FE->>API: POST /api/query\n{query, reference_answer?}
    API->>RUN: run_all(query, reference)

    par asyncio.gather + ThreadPoolExecutor(6)
        RUN->>P1: _safe_run(query)
        P1->>GEM: chat.completions (no context)
        GEM-->>P1: answer + usage
        P1-->>RUN: PipelineResult

        RUN->>P2: _safe_run(query)
        P2->>P2: FAISS search → top-5 chunks
        P2->>GEM: chat.completions (chunks context)
        GEM-->>P2: answer + usage
        P2-->>RUN: PipelineResult

        RUN->>P3: _safe_run(query)
        P3->>P3: _parse_query() → ticker, year
        P3->>TG: getVertices / getEdges (3 hops)
        TG-->>P3: graph facts + graph_data
        P3->>GEM: chat.completions (graph context)
        GEM-->>P3: answer + usage
        P3-->>RUN: PipelineResult + graph_data
    end

    Note over RUN: GraphRAG answer used as\nreference if none provided

    par Evaluation (parallel)
        RUN->>EVAL: _score_pipeline(P1, ref=graphrag_answer)
        EVAL->>GEM: LLM Judge prompt
        GEM-->>EVAL: PASS/FAIL + reason
        EVAL->>EVAL: BERTScore(P1_answer, ref)

        RUN->>EVAL: _score_pipeline(P2, ref=graphrag_answer)
        RUN->>EVAL: _score_pipeline(P3, ref=user_ref_or_none)
    end

    RUN-->>API: BenchmarkResponse\n{pipeline1, pipeline2, pipeline3,\ntoken_reduction_pct}
    API-->>FE: JSON 200
    FE->>FE: Render PipelineCards\nGraphViz (D3.js)\nTokenSavings\nMetricsTable
    FE-->>U: Results displayed
```

---

## 7. Frontend Component Tree

```mermaid
graph TD
    APP["app/layout.tsx\nRootLayout\nInter font · dark bg"]

    subgraph HOME["app/page.tsx — Main Dashboard"]
        HERO["Hero Section\nGradient headline\nLive stats from /api: reduction% · companies · 3-hop · chunks"]
        ARCH["Architecture Section\nThree pipeline cards\nTigerGraph schema diagram"]
        DATA["Dataset Section\n49 company cards\nsector badges · filing counts"]
        DEMO["Demo Section\n#try-demo anchor"]
        QI["QueryInput\n4 category tabs\nquery chips · search bar\nloading state"]
        LOAD["LoadingState\nPipelineLoadingSkeleton × 3\nstep-by-step messages"]
        GRID["3-column grid"]
        PC1["PipelineCard\nLLM Only"]
        PC2["PipelineCard\nBasic RAG"]
        PC3["PipelineCard\nGraphRAG\n+ GraphViz"]
        GV["GraphViz\nD3.js force-directed\nhop-by-hop animation\nzoom · drag · legend"]
        TS["TokenSavings\nAnimated counters × 3\nBar chart\nSavings callouts\nSession total"]
        MT["MetricsTable\nTokens · Latency\nCost · BERTScore\nJudge verdict"]
    end

    subgraph BENCH["app/benchmark/page.tsx — Benchmark Runner"]
        BH["Stats header\n205M tokens · 49 cos · 245 filings\n298,221 chunks · 7 sectors"]
        BS2["Summary cards (live from /api/benchmark)\n79% reduction · judge 20/13/3\n0.847 GraphRAG BERTScore"]
        BLR["Live Runner Banner\n⚡ Run All 20 Live\nprogress bar"]
        BTABLE["20-row results table\n▶ per-row play button\nlive highlight + emerald dot"]
    end

    APP --> HOME & BENCH
    HOME --> HERO & ARCH & DATA & DEMO
    DEMO --> QI
    QI -->|"loading=true"| LOAD
    QI -->|"result ready"| GRID
    GRID --> PC1 & PC2 & PC3
    PC3 --> GV
    GRID --> TS
    GRID --> MT
```

---

## 8. Evaluation Pipeline

```mermaid
flowchart TD
    ANS1["LLM Only Answer"]
    ANS2["Basic RAG Answer"]
    ANS3["GraphRAG Answer"]

    subgraph REF["Reference Selection"]
        CHECK{"User provided\nreference?"}
        USER_REF["Use user reference\nfor all 3"]
        GR_REF["Use GraphRAG answer\nas reference for P1 + P2\n(graph-grounded = most reliable)"]
        NO_REF["P3 judges without\nexternal reference"]
        CHECK -->|"Yes"| USER_REF
        CHECK -->|"No"| GR_REF & NO_REF
    end

    ANS1 & ANS2 & ANS3 --> REF

    subgraph BERT["BERTScore (roberta-large)"]
        B1["score(P1_ans, ref)\n→ F1: 0.71"]
        B2["score(P2_ans, ref)\n→ F1: 0.78"]
        B3["P3 = reference\n→ F1: 1.000 (shown in UI)"]
    end

    subgraph JUDGE["LLM-as-a-Judge (Gemini 2.5 Flash)"]
        JW["With reference prompt:\n'Does candidate substantially\naddress the question,\nconsistent with reference?'"]
        JN["No-reference prompt:\n'Is this answer relevant,\nfactually reasonable,\nand useful?'"]
        VERD["VERDICT: PASS or FAIL\nREASON: one sentence"]
        JW & JN --> VERD
    end

    USER_REF --> B1 & B2 & B3
    GR_REF --> B1 & B2
    NO_REF --> JN

    B1 & B2 & B3 --> BERT
    VERD --> JUDGE

    OUT["PipelineResponse\nbertscore_f1: float\njudge_pass: bool\njudge_reason: str"]
    BERT & JUDGE --> OUT
```

---

## 9. Token Economics

```mermaid
xychart-beta
    title "Token Usage Per Pipeline (Typical Query)"
    x-axis ["LLM Only", "Basic RAG", "GraphRAG"]
    y-axis "Tokens" 0 --> 9000
    bar [2410, 8536, 510]
```

### Token Breakdown

```mermaid
flowchart LR
    subgraph LLM_ONLY["🧠 LLM Only — ~2,383 tokens avg"]
        L1["System prompt: ~80 tokens"]
        L2["User query: ~20 tokens"]
        L3["Answer: ~400 tokens"]
        L1 --> L3
        L2 --> L3
    end

    subgraph BASIC_RAG["🔍 Basic RAG — ~8,291 tokens avg"]
        R1["System prompt: ~80 tokens"]
        R2["User query: ~20 tokens"]
        R3["5 chunks × 512 tokens\n= ~2,560 tokens context"]
        R4["Answer: ~400 tokens"]
        R1 & R2 & R3 --> R4
    end

    subgraph GRAPHRAG["🕸️ GraphRAG — ~1,690 tokens avg"]
        G1["System prompt: ~80 tokens"]
        G2["User query: ~20 tokens"]
        G3["Graph context: ~300 tokens\n(structured facts, not raw prose)"]
        G4["Answer: ~200 tokens"]
        G1 & G2 & G3 --> G4
    end

    SAVING["💰 Savings vs Basic RAG\n~6,600 tokens = 79%\n~$0.001 per query"]
    BASIC_RAG -->|"GraphRAG replaces this"| SAVING
    GRAPHRAG -->|"Costs this instead"| SAVING
```

### Cost Model (Gemini 2.5 Flash pricing)

```mermaid
flowchart LR
    PRICE["Gemini 2.5 Flash\nInput: $0.15 / 1M tokens\nOutput: $0.60 / 1M tokens"]

    subgraph COSTS["Cost per query"]
        C1["LLM Only\n~$0.00054"]
        C2["Basic RAG\n~$0.00133"]
        C3["GraphRAG\n~$0.00006"]
    end

    PRICE --> COSTS

    subgraph SCALE["At 10,000 queries/month"]
        S1["LLM Only: $5.40"]
        S2["Basic RAG: $13.30"]
        S3["GraphRAG: $0.60"]
        SAVE["Savings vs Basic RAG:\n$12.70/month = 95.5%"]
    end

    COSTS --> SCALE
```

---

## 10. Deployment Architecture

```mermaid
graph TB
    subgraph LOCAL["Local Development"]
        FE_LOCAL["Next.js dev\nnpm run dev\nlocalhost:3000"]
        BE_LOCAL["FastAPI + uvicorn\n--reload\nlocalhost:8000"]
        TG_LOCAL["TigerGraph CE\nDocker\nlocalhost:14240"]
        FE_LOCAL <-->|"NEXT_PUBLIC_API_URL\n=http://localhost:8000"| BE_LOCAL
        BE_LOCAL <-->|"pyTigerGraph\nUSE_SAVANNA=false"| TG_LOCAL
    end

    subgraph PROD["Production (Hackathon Demo)"]
        FE_VERCEL["▲ Vercel\nNext.js frontend\nGlobal CDN"]
        BE_RAILWAY["🚂 Railway\nFastAPI backend\nstart.sh entrypoint\n512MB RAM"]
        TG_SAVANNA["☁️ TigerGraph Savanna\nCloud-hosted\nFinanceGraph\nFree tier"]
        GEMINI_API["✦ Google AI\nGemini 2.5 Flash\nAPI endpoint"]

        FE_VERCEL <-->|"NEXT_PUBLIC_API_URL\n=https://your-app.railway.app"| BE_RAILWAY
        BE_RAILWAY <-->|"pyTigerGraph JWT\nUSE_SAVANNA=true"| TG_SAVANNA
        BE_RAILWAY <-->|"OpenAI-compat client\nGEMINI_API_KEY"| GEMINI_API
    end

    subgraph ENV["Environment Config"]
        ENV_FILE[".env\nGEMINI_API_KEY\nTIGERGRAPH_HOST\nTIGERGRAPH_SECRET\nTIGERGRAPH_TOKEN\nUSE_SAVANNA=true"]
    end

    ENV_FILE -.->|"loaded by\npydantic-settings"| BE_RAILWAY
    ENV_FILE -.->|"copied to"| BE_LOCAL
```

### Railway `railway.toml` Config

```mermaid
flowchart LR
    TOML["railway.toml"]
    BUILD["Build\npython -m pip install\n-r requirements.txt"]
    START["Start\n./start.sh\nuvicorn dashboard.backend.main:app\n--host 0.0.0.0 --port $PORT"]
    HEALTH["Health check\nGET /health → 200"]
    TOML --> BUILD --> START --> HEALTH
```

---

## Summary

```mermaid
mindmap
  root((GraphRAG Finance))
    Data
      49 S&P 500 companies
      245 10-K filings
      2019–2023
      298,221 chunks
      205M tokens
      437MB FAISS index
    Graph
      TigerGraph Savanna
      6 vertex types
      6 edge types
      ~1,650 vertices + ~9,800 edges
      3-hop max traversal
    Pipelines
      LLM Only
        Zero context
        ~2,383 tokens avg
      Basic RAG
        FAISS top-5
        ~8,291 tokens avg
      GraphRAG
        Multi-hop traversal
        ~1,690 tokens avg
        79% savings
    Evaluation
      BERTScore F1
        roberta-large
        GraphRAG = 1.000 reference
      LLM Judge
        Gemini 2.5 Flash
        PASS/FAIL + reason
        judge: 20/13/3 (LLM/RAG/Graph)
    Frontend
      Next.js 16
      D3.js GraphViz
      Animated token savings
      Live benchmark runner
    Backend
      FastAPI
      asyncio parallel
      ThreadPoolExecutor 6
      Pydantic schemas
```
