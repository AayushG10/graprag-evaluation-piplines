# Social Media Posts — GraphRAG Finance Benchmark
# TigerGraph GraphRAG Inference Hackathon

---

# 🐦 TWITTER / X

---

## MAIN THREAD — Post all 7 in sequence

---

**Tweet 1 — The Hook** 📌 PIN THIS
```
I ran the same financial question through 3 AI pipelines.

Here's what it actually cost:

🧠 LLM Only:   2,383 tokens  ~$0.0006
🔍 Basic RAG:  8,291 tokens  ~$0.0013
🕸️ GraphRAG:   1,690 tokens  ~$0.0003

Same question.
79% fewer tokens than vector RAG with TigerGraph. 🧵
```
📎 Attach: result_.png (token savings dashboard screenshot)

---

**Tweet 2 — The Data**
```
Before the AI, let me show you the data.

245 real SEC 10-K filings
49 S&P 500 companies
5 years (2019–2023)
298,221 text chunks
205M+ tokens

Zero synthetic data.
Every answer traces to an actual filing.
```
📎 Attach: benchmark.png

---

**Tweet 3 — The Problem**
```
Here's what's wrong with Basic RAG today:

You ask: "What were Apple's risk factors in 2022?"

It retrieves 5 chunks × 512 tokens
= 2,560 tokens of dense legal prose

Sends ALL of it to the LLM.

The real answer is buried in ~50 of those tokens.

You paid for 2,510 tokens you didn't need.
```

---

**Tweet 4 — The Graph Fix**
```
GraphRAG does this instead:

Company(AAPL)
→ Hop 1: Document(2022 10-K)
→ Hop 2: Risk(Supply Chain), Risk(Cybersecurity)
→ Hop 3: Sector(Tech) → Peers(MSFT, NVDA)

Context sent to LLM: ~400 structured tokens.
Not 2,560 tokens of prose.

The graph pre-extracts what matters.
Everything else is noise.
```
📎 Attach: pipline_pages.png

---

**Tweet 5 — The Honest Tradeoff**
```
"But does GraphRAG sacrifice quality?"

Here's the honest answer from 20 real questions:

BERTScore F1 (semantic match to gold answer):
🕸️ GraphRAG:  0.847  ← highest
🔍 Basic RAG: 0.832
🧠 LLM Only:  0.833

Strict LLM-Judge (full coverage of every detail):
🧠 LLM Only:  20/20
🔍 Basic RAG: 13/20
🕸️ GraphRAG:   3/20

Cheapest + closest in meaning. But terser,
so it covers fewer specifics. A real tradeoff.
```
📎 Attach: benchmark_3.png

---

**Tweet 6 — The Visual**
```
My favourite part of the whole project:

When GraphRAG answers, you watch the graph
build itself in real time.

Company → Documents → Risk entities → Sector peers

Hop by hop. Animated. Draggable.

RAG is a black box.
GraphRAG shows every step of its reasoning. 🕸️
```

---

**Tweet 7 — CTA**
```
Full project is open source 👇

245 real SEC filings · TigerGraph Savanna
Gemini 2.5 Flash · FAISS · Next.js · D3.js

🔗 github.com/AayushG10/graprag-evaluation-piplines

Built for @TigerGraph GraphRAG Inference Hackathon

#GraphRAG #TigerGraph #RAG #LLM #AI #FinTech
```
📎 Attach: langing page .png (hero shot)

---

## STANDALONE TWEET (post this if you only post one thing)
```
I built a benchmark on 245 real SEC 10-K filings.

Same question. Three pipelines. Live results.

🔍 Basic RAG:  8,291 tokens  ~$0.0013
🕸️ GraphRAG:   1,690 tokens  ~$0.0003  ← highest BERTScore

79% fewer tokens, closest semantic match to the gold answer.

The knowledge graph sends the LLM only the facts it needs —
not thousands of tokens of raw legal prose.

🔗 github.com/AayushG10/graprag-evaluation-piplines

#TigerGraph #GraphRAG #RAG #LLM #AI
```
📎 Attach: result_.png

---

## TAG @TIGERGRAPH directly
```
Hey @TigerGraph 👋

Submitted my entry for the GraphRAG Inference Hackathon 🕸️

GraphRAG Finance Benchmark — 79% token reduction
on 245 real SEC 10-K filings from 49 S&P 500 companies.

1,690 tokens vs 8,291 for Basic RAG, and the highest BERTScore of the three.
Full, honest benchmark (including where GraphRAG loses).
Live dashboard with D3.js graph traversal.

🔗 github.com/AayushG10/graprag-evaluation-piplines
```

---
---

# 💼 LINKEDIN

---

## LINKEDIN — FULL POST
```
🕸️ 79% fewer tokens, highest semantic accuracy — with an honest tradeoff. This is what GraphRAG looks like on real data.

For the TigerGraph GraphRAG Inference Hackathon, I built a live benchmark that 
runs the same financial question through three AI pipelines simultaneously — and 
measures every token, every dollar, every quality score.

━━━━━━━━━━━━━━━━━━━━━━
THE NUMBERS (20 real questions, live measurement)
━━━━━━━━━━━━━━━━━━━━━━

                 LLM Only   Basic RAG   GraphRAG
Avg tokens:        2,383      8,291     1,690 ✅
Cost/query:      ~$0.0006   ~$0.0013  ~$0.0003 ✅
BERTScore F1:      0.833      0.832     0.847 ✅
LLM-Judge:         20/20      13/20      3/20
   (judge rewards completeness → favors verbose answers)

GraphRAG wins on cost and semantic accuracy; the verbose pipelines win the strict completeness judge. Honest tradeoff, real numbers.

━━━━━━━━━━━━━━━━━━━━━━
THE DATASET
━━━━━━━━━━━━━━━━━━━━━━

📁 49 S&P 500 companies
📄 245 real SEC 10-K filings from EDGAR
📅 2019–2023 — five full years
🔢 298,221 text chunks
💬 205M+ tokens
🕸️ TigerGraph knowledge graph: Company/Document/Risk/Executive/Sector vertices + typed edges

Zero synthetic data. Every answer traces back to a real filing.

━━━━━━━━━━━━━━━━━━━━━━
WHY GRAPHRAG WINS
━━━━━━━━━━━━━━━━━━━━━━

Traditional RAG retrieves 5 raw text chunks and dumps 2,560 tokens 
of legal prose into the LLM. Most of it is irrelevant boilerplate.

GraphRAG does a 3-hop traversal on TigerGraph:

Company(AAPL) → Document(2022 10-K) → Risk entities → Sector peers

The LLM receives ~400 tokens of structured facts.
Not the haystack. Just the needle.

━━━━━━━━━━━━━━━━━━━━━━
THE SCALE ARGUMENT
━━━━━━━━━━━━━━━━━━━━━━

At 1 million queries/month (at the measured avg cost/query):
🔍 Basic RAG costs:  ~$1,300
🕸️ GraphRAG costs:    ~$300

A ~4× cost difference that compounds hard at production scale.

━━━━━━━━━━━━━━━━━━━━━━
WHAT'S IN THE DASHBOARD
━━━━━━━━━━━━━━━━━━━━━━

✅ 3 pipelines run in parallel — results side by side
✅ D3.js animated graph traversal — watch each hop light up
✅ Token savings counter — animates live, accumulates per session
✅ Live benchmark runner — 20 questions, real-time BERTScore + Judge
✅ Fully open source

🔗 github.com/AayushG10/graprag-evaluation-piplines

Built with: TigerGraph Savanna · Gemini 2.5 Flash · FAISS · Next.js · D3.js

#GraphRAG #TigerGraph #RAG #LLM #AI #MachineLearning
#FinTech #OpenSource #Hackathon #KnowledgeGraph
```
📎 Attach: result_.png

---

## LINKEDIN — SHORT VERSION
```
I benchmarked 3 AI pipelines on 245 real SEC 10-K filings.

The result:

🔍 Basic RAG → 8,291 tokens — 13/20 judge pass
🕸️ GraphRAG  → 1,690 tokens — highest BERTScore (0.847)

79% fewer tokens. ~4× cheaper per query. Semantically closest to the gold answer.
(The tradeoff: on a strict completeness judge, GraphRAG's terser answers pass less often.)

The graph pre-extracts risk categories, executives, and filing 
relationships before any query arrives — so retrieval becomes 
a 3-hop lookup instead of a brute-force similarity search.

Full open-source project:
github.com/AayushG10/graprag-evaluation-piplines

#TigerGraph #GraphRAG #RAG #LLM #AI #FinTech #Hackathon
```
📎 Attach: result_.png

---
---

# 📱 INSTAGRAM / THREADS

---

**Caption**
```
79% fewer tokens. Highest semantic accuracy. This is GraphRAG on real financial data 🕸️

I built a benchmark comparing 3 AI pipelines on 245 real 
SEC filings from 49 S&P 500 companies.

🧠 LLM Only   → 2,383 tokens
🔍 Basic RAG  → 8,291 tokens
🕸️ GraphRAG   → 1,690 tokens ✅

Traditional RAG floods the AI with raw legal text.
GraphRAG traverses a knowledge graph and sends only the facts that matter.

Same question. ~4× cheaper. Closest to the gold answer.

Built for the TigerGraph GraphRAG Inference Hackathon 🏆

Full project in bio →

.
.
.
#GraphRAG #TigerGraph #RAG #AI #MachineLearning #LLM
#FinTech #DataScience #OpenSource #Hackathon
#KnowledgeGraph #NLP #Python #NextJS #FinancialAI
```
📎 Attach: result_.png

---
---

# 🖼️ SCREENSHOT GUIDE
*(Which image to attach where)*

| Post | Screenshot to use | Why |
|---|---|---|
| Tweet 1 (hook) | `result_.png` | Token numbers are huge and readable |
| Tweet 2 (data) | `benchmark.png` | Shows 205M tokens, 49 companies header |
| Tweet 5 (quality) | `benchmark_3.png` | Detailed per-question table |
| Tweet 7 (CTA) | `langing page .png` | Clean product hero shot |
| LinkedIn full | `result_.png` | token bar chart is very visual |
| Instagram | `result_.png` | Best single image — numbers tell the story |

---

# 🔑 KEY NUMBERS — Use these in every post (all from the committed benchmark)

| Number | Meaning |
|---|---|
| **79%** | Avg token reduction vs Basic RAG — your headline |
| **1,690 vs 8,291** | Avg tokens GraphRAG vs Basic RAG |
| **0.847** | GraphRAG avg BERTScore — highest of the three (semantic accuracy) |
| **~$0.0003** | GraphRAG avg cost per query |
| **~4×** | How much cheaper GraphRAG is than Basic RAG per query |
| **20 / 13 / 3** | LLM-Judge pass (LLM Only / Basic RAG / GraphRAG) — the honest completeness tradeoff |
| **49 companies** | Dataset credibility |
| **245 filings** | Dataset credibility |
| **205M tokens** | Real dataset size |
| **3 hops** | TigerGraph's specific multi-hop capability |

---

# ⏰ POSTING SCHEDULE

**Day 1 — Submission day**
- Morning: Full Twitter thread (all 7 tweets)
- Afternoon: Full LinkedIn post
- Tag @TigerGraph on both

**Day 2 — Amplify**
- Post the standalone tweet (different from thread)
- Reply to comments with benchmark_3.png
- Short LinkedIn post with blog link

**Day 3 — Blog drop**
- Post blog link on Dev.to / Hashnode / Medium
- Share blog link on LinkedIn
- Add blog URL to GitHub README

**Always tag:** @TigerGraph
**Always use:** #TigerGraph #GraphRAG #RAG #LLM #AI #Hackathon
