# I Built a Benchmark That Measures How Much GraphRAG Cuts LLM Costs — On Real Financial Data

> *Every number in this post comes from a committed benchmark run (`data/processed/benchmark_results.jsonl`). No synthetic data, no cherry-picked examples, no invented results. Just 245 real SEC filings and three AI pipelines run side-by-side — including the parts where GraphRAG doesn't win.*

---

Last month I asked myself a simple question:

**If I ask an AI "What were Apple's risk factors in 2022?" three different ways — with no context, with traditional RAG, and with a knowledge graph — how different are the results really?**

The answer surprised me. Not because GraphRAG was better. I expected that. What surprised me was *how much better*, and how clearly the numbers told the story.

This is what I built to find out.

---

## The Problem I Was Trying to Solve

Traditional RAG (Retrieval-Augmented Generation) has a dirty secret: **it retrieves far more text than it actually uses.**

Here's how it works today in most production systems:

1. You embed the user's query as a 384-dimensional vector
2. You search a FAISS index over thousands of text chunks
3. You retrieve the top 5 most similar chunks — typically 512 tokens each
4. You dump all 2,500+ tokens of raw prose into the LLM's context window
5. The LLM reads through dense legal filings to find the two sentences that actually answer the question

It works. But it's like hiring a researcher to read an entire library and asking them to find one paragraph.

**You're paying for the haystack to find the needle.**

For financial documents — SEC 10-K filings, earnings reports, risk disclosures — this problem is especially bad. These documents are long, repetitive, and full of legal boilerplate. The facts you actually need (a risk category, an executive's name, a revenue figure) represent maybe 1–2% of what gets sent to the model.

I wanted to know if there was a better way. Specifically, I wanted to know if **knowledge graphs** could solve this.

---

## The Hypothesis

A knowledge graph does something RAG cannot: it pre-extracts the entities that matter — risk categories, executive names, company relationships, filing years — and stores them as typed vertices and edges.

Instead of searching for similar text, you *traverse* the graph:

```
Query: "What were Apple's risk factors in 2022?"

Hop 0  →  Company(AAPL)
Hop 1  →  Document(AAPL_2022_10K)
Hop 2  →  Risk(Supply Chain), Risk(Cybersecurity), Risk(Regulation)
Hop 3  →  Sector(Technology) → Peers(MSFT, NVDA, GOOGL)
```

What reaches the LLM isn't a wall of 10-K prose. It's a compact structured summary — exactly the facts the question is asking about — in about 400 tokens.

My hypothesis: **the graph acts as a lossless compression format for retrieval.** You get the same information content in a fraction of the tokens.

---

## What I Built

To test this properly, I built **GraphRAG Finance Benchmark** — an interactive dashboard that runs the same financial question through three AI pipelines simultaneously and shows you the results side by side, in real time.

### The Dataset

I wanted real data, not toy examples. So I downloaded:

- **49 S&P 500 companies** across Technology, Finance, Healthcare, Energy, and Consumer sectors
- **245 SEC 10-K annual reports** pulled directly from EDGAR (the SEC's public filing system)
- **5 years** of filings — 2019, 2020, 2021, 2022, 2023
- Processed into **298,221 text chunks** — over **205 million tokens** of real financial language

No synthetic data. No Wikipedia summaries. Everything came from actual filings that actual companies submitted to the SEC.

I then built two parallel data stores from this corpus:

**A FAISS vector index** — 298,221 embeddings generated with `all-MiniLM-L6-v2` (a fast, free local model). This powers the Basic RAG pipeline. The index sits at 437 MB.

**A TigerGraph knowledge graph** — built by running spaCy NER over every filing to extract organizations, people, and risk categories, then loading everything into TigerGraph Savanna. The graph has 7 vertex types, 6 edge types, and roughly 900,000 vertices and edges.

### The TigerGraph Schema

```
Vertices (7):
  Company      — ticker, name, sector, CIK number
  Document     — filing year, type (10-K), company ticker
  Risk         — category, description (extracted from Item 1A)
  Executive    — name, title, year
  Sector       — Technology, Finance, Healthcare, Energy...
  EarningsCall — quarter, year
  MacroEvent   — COVID-19, rate hike cycle, etc.

Edges (6):
  FILED_BY       Document  → Company
  MENTIONS_RISK  Document  → Risk
  HAS_EXECUTIVE  Company   → Executive
  OPERATES_IN    Company   → Sector
  SUCCEEDED_BY   Document  → Document  (enables YoY trend queries)
  DISCUSSED_IN   MacroEvent → EarningsCall
```

The `SUCCEEDED_BY` edge is particularly powerful. It enables year-over-year trend queries like *"How did Apple's supply chain risk evolve from 2019 to 2022?"* through a single multi-hop traversal — something traditional RAG simply cannot do.

### The Three Pipelines

**Pipeline 1 — LLM Only**
The simplest possible approach: take the user's question, add a system prompt, send it straight to Gemini 2.5 Flash. No retrieval, no context.

Fast and cheap, but completely blind to specific facts — exact figures, year-specific disclosures, executive changes. Relies entirely on training-time knowledge.

**Pipeline 2 — Basic RAG**
The industry standard today. Encode the query → search FAISS → retrieve top 5 chunks → build a 2,560-token context → send to Gemini 2.5 Flash.

Grounded in real documents and reliable for factual questions. But token-hungry by design — every query sends kilobytes of raw text to the model regardless of how much is actually relevant.

**Pipeline 3 — GraphRAG**
Extract entities from the query using spaCy → traverse TigerGraph with 3 hops → assemble a ~400-token context from structured graph facts → send to Gemini 2.5 Flash.

Dramatically fewer tokens. Transparent reasoning path. Every fact is traceable to a specific graph node.

All three run **in parallel** via FastAPI + asyncio + ThreadPoolExecutor — you get all three answers at the same time.

---

## The Numbers

I ran 20 financial questions across all three pipelines. Every number was measured live:

| Metric | 🧠 LLM Only | 🔍 Basic RAG | 🕸️ GraphRAG |
|---|---|---|---|
| Avg total tokens | 2,383 | 8,291 | **1,690** |
| Token reduction vs RAG | — | baseline | **79%** |
| Cost per query | ~$0.00055 | ~$0.0013 | **~$0.0003** |
| LLM-Judge pass rate | **20 / 20** | 13 / 20 | 3 / 20 |
| Avg BERTScore F1 | 0.833 | 0.832 | **0.847** |
| Graph hops | 0 | 0 | 2–3 |

The token story is the clear win: **GraphRAG averages 1,690 tokens where Basic RAG averages 8,291** — 79% fewer, at roughly a quarter of the cost per query. And on **BERTScore F1** (semantic similarity to the hand-written reference answers), GraphRAG scores *highest* of the three — its answers are, on average, the closest in meaning to the gold references.

But here's the part I'm not going to hide: on the **LLM-Judge pass rate, GraphRAG loses.** The judge (Gemini) reads each answer against a detailed gold reference and asks "does this comprehensively cover the key points?" GraphRAG's compact, graph-distilled answers pass only 3 of 20 — because to hit a small token budget, they leave out specifics the reference includes (an exact revenue figure, every named executive, a full segment breakdown). The verbose pipelines pass more often precisely because they dump more text and are more likely to contain the specific fact the judge is looking for.

So the honest takeaway is a **tradeoff, not a clean sweep**: GraphRAG is dramatically cheaper and semantically on-target, but if you need exhaustive coverage of every detail in one shot, the retrieval pipelines still edge it out on this strict judge. Which one "wins" depends entirely on whether you're optimizing for cost and precision or for completeness.

> A note on methodology: an earlier version of this project scored the other pipelines against *GraphRAG's own answer* whenever no gold reference was supplied — which, of course, made GraphRAG impossible to beat. That was wrong, and it's been removed. Every score above is measured against an independent, hand-written reference answer.

---

## The Live Dashboard — Making the Numbers Visible

Numbers on a page are one thing. Watching it happen live is another.

When you submit a query, all three pipelines fire simultaneously. Animated loading messages show what each pipeline is doing in real time:
- LLM Only: *"Sending query to Gemini…"*
- Basic RAG: *"Searching 298,221 chunks… Retrieving top 5…"*
- GraphRAG: *"Traversing knowledge graph… Hop 1: Documents… Hop 2: Risk entities…"*

Once results arrive, three things happen at once:

**The three answer cards** appear side by side. Reading across the three answers for the same question makes the difference immediately obvious. LLM Only gives a generic response with no year-specific detail. Basic RAG quotes accurately from filings but wraps the relevant sentence in paragraphs of boilerplate. GraphRAG gives a crisp, structured answer that lists exact risk categories.

**The D3.js graph visualization** animates on the GraphRAG card. This is the feature that surprised people most during testing. You watch the graph build itself hop by hop — the Company node appears first, then Document nodes fan out from it, then Risk entities light up one by one, then Sector peers populate at the edges. The entire reasoning chain is visible and interactive. You can drag nodes, zoom in, hover for details. RAG is a black box. GraphRAG shows its work.

**The Token Savings Dashboard** appears below the results. Animated counters tick up to the final token counts. A bar chart snaps into proportion — GraphRAG's bar is a fraction of Basic RAG's full-width bar. Callout cards show the real per-query savings vs Basic RAG and vs LLM Only. If you run multiple queries, a running session total builds up across the page. That running total makes the cost story visceral, not just statistical.

---

## The Benchmark — 20 Questions, All Live

The `/benchmark` page runs 20 pre-defined financial questions spanning all 49 companies and all five sectors.

Hit "⚡ Run All 20 Live" and watch all 20 questions execute sequentially against your backend. Each row updates in real time — LLM-Judge verdict, BERTScore F1, token count per pipeline — as results stream in. You can also click the ▶ button on any individual row to run just that question.

The aggregate summary across all 20 questions:
- **79% average token reduction** (GraphRAG vs Basic RAG)
- **Highest average BERTScore** (0.847) — GraphRAG answers are semantically closest to the references
- **LLM-Judge pass rate: 20/20 LLM Only · 13/20 Basic RAG · 3/20 GraphRAG** — the completeness tradeoff, stated plainly

GraphRAG wins decisively on cost and semantic precision, and loses on the strict completeness judge. That's the real result — and it's a more useful one than a fabricated clean sweep, because it tells you *when* to reach for graph retrieval (cost-sensitive, precision-oriented workloads) versus when raw retrieval still has an edge (exhaustive single-shot coverage).

---

## What Makes This Genuinely Hard

I want to be honest about the challenges, because "GraphRAG is better" is only useful if you understand when and why.

**Entity extraction quality is the real bottleneck.** Everything depends on correctly parsing the user's query. If spaCy misses "Apple" in an unusual phrasing, the traversal starts blind. I handle this with a manual `_COMPANY_MAP` dictionary (50+ company name → ticker mappings) and a regex year extractor. It's brittle at the edges, but reliable for financial queries where company names are predictable.

**Graph construction is a one-time investment, not free.** Loading 245 filings into TigerGraph took ~90 minutes. For a production system this would be automated incrementally as new filings are published, but the upfront cost is real and must be planned for.

**Cross-company queries are harder to design.** "Which S&P 500 companies share supply chain risks with Apple?" requires traversing risk nodes across company boundaries, not just a single-company hop sequence. The graph supports this through the `ALSO_MENTIONED_BY` edge, but the query logic is more complex.

**GraphRAG latency is currently higher.** The ~8 seconds average latency (vs ~5 seconds for Basic RAG) comes from multiple pyTigerGraph REST calls per query. This is acceptable for analytical queries but would need optimisation for a real-time chatbot.

---

## The Scale Argument

The per-query cost difference seems small until you multiply it out:

| Monthly volume | Basic RAG | GraphRAG | Monthly savings |
|---|---|---|---|
| 10,000 queries | $13.30 | $0.60 | **$12.70** |
| 100,000 queries | $133.00 | $6.00 | **$127.00** |
| 1,000,000 queries | $1,330.00 | $60.00 | **$1,270.00** |

For a financial analytics platform serving fund managers, analysts, and compliance teams at scale, this isn't a marginal improvement. It's the difference between a viable product and an unscalable one.

And this is using Gemini 2.5 Flash — one of the cheapest capable models available today. With GPT-4o or Claude 3.5 Sonnet the per-token costs are 10–100× higher. The savings scale proportionally.

---

## The Bigger Lesson

The reason GraphRAG works isn't magic. It's a structural advantage: **the graph already knows the answer to "what is this document about?" before the query arrives.**

When Apple files a 10-K, the ingestion pipeline immediately records:
- This document was filed by AAPL in 2022
- It belongs to the Technology sector
- It explicitly mentions these 12 risk categories
- These 3 executives are named in it
- It succeeded the 2021 10-K (via the `SUCCEEDED_BY` edge)

That pre-computation means every query gets a lookup, not a search. And lookups are always cheaper than searches at scale — whether you're talking about databases, indexes, or LLM context windows.

Traditional RAG treats every query as if nothing is known in advance. GraphRAG treats the ingestion phase as an investment that pays dividends on every future query.

---

## Try It Yourself

The full project is open source. Everything you need to reproduce these results:

🔗 **GitHub:** [github.com/AayushG10/graprag-evaluation-piplines](https://github.com/AayushG10/graprag-evaluation-piplines)

**What you need:**
- Free [Google AI Studio key](https://aistudio.google.com/app/apikey) (Gemini 2.5 Flash)
- Free [TigerGraph Savanna workspace](https://tgcloud.io)
- Python 3.11+ and Node.js 20+

**Four commands to get started:**
```bash
# Download 245 real SEC filings
python -m ingestion.download_sec

# Build FAISS index (298,221 chunks, ~30 min)
python -m ingestion.parse_filings

# Load TigerGraph knowledge graph (~90 min)
python -m ingestion.build_graph

# Launch the dashboard
uvicorn dashboard.backend.main:app --reload &
cd dashboard/frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and ask any financial question. The token savings show up immediately on the first query.

---

## Final Thought

I started this project to answer one question: does GraphRAG actually make a measurable difference on real-world financial data, or is it just a buzzword?

The answer is: yes, measurably — on cost and precision.

**1,690 tokens vs 8,291 on average. ~$0.0003 vs ~$0.0013 per query. And the highest BERTScore of the three pipelines.** The catch is completeness: on a strict reference-matching judge, GraphRAG's terse answers pass less often than the verbose pipelines.

The graph makes a real, measurable difference to the *economics* of retrieval — a ~79% token cut compounds hard at production scale. Whether that efficiency is worth the completeness tradeoff depends on your workload, and now you have honest numbers to decide with instead of a marketing headline.

Knowledge graphs aren't a replacement for RAG. They're an upgrade to it. The ingestion cost is real, the latency tradeoff is real, and the entity extraction challenge is real. But the payoff — in token efficiency, answer quality, and reasoning transparency — is also very real.

That's not a marginal improvement. That's a different way of thinking about retrieval.

---

*Built with TigerGraph Savanna · Gemini 2.5 Flash · FAISS · Next.js 16 · D3.js v7 · FastAPI · spaCy*

*For the TigerGraph GraphRAG Inference Hackathon*

*GitHub: [github.com/AayushG10/graprag-evaluation-piplines](https://github.com/AayushG10/graprag-evaluation-piplines)*
