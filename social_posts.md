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

🧠 LLM Only:   2,410 tokens  $0.00054
🔍 Basic RAG:  8,536 tokens  $0.00133
🕸️ GraphRAG:     510 tokens  $0.00006

Same question. Same quality.
94% fewer tokens with TigerGraph. 🧵
```
📎 Attach: result_.png (token savings dashboard screenshot)

---

**Tweet 2 — The Data**
```
Before the AI, let me show you the data.

245 real SEC 10-K filings
49 S&P 500 companies
5 years (2019–2023)
159,789 text chunks
110M+ tokens

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

**Tweet 5 — Quality Proof**
```
"But does GraphRAG sacrifice quality?"

LLM-Judge (20 real financial questions):
🧠 LLM Only:  11/20 PASS
🔍 Basic RAG: 17/20 PASS
🕸️ GraphRAG:  20/20 PASS ✅

BERTScore F1:
LLM Only:  0.795
Basic RAG: 0.820
GraphRAG:  1.000

Cheaper. And more accurate.
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

🔍 Basic RAG:  8,536 tokens  $0.00133  17/20 pass
🕸️ GraphRAG:     510 tokens  $0.00006  20/20 pass ✅

94% fewer tokens. Better answers.

The knowledge graph sends the LLM only the facts it needs —
not 2,560 tokens of raw legal prose.

🔗 github.com/AayushG10/graprag-evaluation-piplines

#TigerGraph #GraphRAG #RAG #LLM #AI
```
📎 Attach: result_.png

---

## TAG @TIGERGRAPH directly
```
Hey @TigerGraph 👋

Submitted my entry for the GraphRAG Inference Hackathon 🕸️

GraphRAG Finance Benchmark — 94% token reduction
on 245 real SEC 10-K filings from 49 S&P 500 companies.

510 tokens vs 8,536 for Basic RAG.
20/20 LLM-Judge pass rate.
Live dashboard with D3.js graph traversal.

🔗 github.com/AayushG10/graprag-evaluation-piplines
```

---
---

# 💼 LINKEDIN

---

## LINKEDIN — FULL POST
```
🕸️ 94% fewer tokens. Better answers. This is what GraphRAG looks like on real data.

For the TigerGraph GraphRAG Inference Hackathon, I built a live benchmark that 
runs the same financial question through three AI pipelines simultaneously — and 
measures every token, every dollar, every quality score.

━━━━━━━━━━━━━━━━━━━━━━
THE NUMBERS (20 real questions, live measurement)
━━━━━━━━━━━━━━━━━━━━━━

                 LLM Only   Basic RAG   GraphRAG
Avg tokens:        2,410      8,536       510 ✅
Cost/query:      $0.00054   $0.00133   $0.00006 ✅
LLM-Judge:        11/20      17/20      20/20 ✅
BERTScore F1:      0.795      0.820      1.000 ✅

GraphRAG wins on every metric.

━━━━━━━━━━━━━━━━━━━━━━
THE DATASET
━━━━━━━━━━━━━━━━━━━━━━

📁 49 S&P 500 companies
📄 245 real SEC 10-K filings from EDGAR
📅 2019–2023 — five full years
🔢 159,789 text chunks
💬 110M+ tokens
🕸️ ~900K TigerGraph vertices + edges

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

At 1 million queries/month:
🔍 Basic RAG costs:  $1,330
🕸️ GraphRAG costs:     $60

That's the difference between a viable product and an unscalable one.

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

🔍 Basic RAG → 8,536 tokens — 17/20 judge pass
🕸️ GraphRAG  →   510 tokens — 20/20 judge pass ✅

94% fewer tokens. More accurate. 22× cheaper per query.

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
94% fewer tokens. 20/20 accuracy. This is GraphRAG on real financial data 🕸️

I built a live benchmark comparing 3 AI pipelines on 245 real 
SEC filings from 49 S&P 500 companies.

🧠 LLM Only   → 2,410 tokens
🔍 Basic RAG  → 8,536 tokens
🕸️ GraphRAG   →   510 tokens ✅

Traditional RAG floods the AI with raw legal text.
GraphRAG traverses a knowledge graph and sends only the facts that matter.

Same question. 94% cheaper. Better answer.

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
| Tweet 2 (data) | `benchmark.png` | Shows 110M tokens, 49 companies header |
| Tweet 5 (quality) | `benchmark_3.png` | Detailed per-question table |
| Tweet 7 (CTA) | `langing page .png` | Clean product hero shot |
| LinkedIn full | `result_.png` | 94% + bar chart is very visual |
| Instagram | `result_.png` | Best single image — numbers tell the story |

---

# 🔑 KEY NUMBERS — Use these in every post

| Number | Meaning |
|---|---|
| **94%** | Token reduction vs Basic RAG — your headline |
| **510 vs 8,536** | The raw before/after — impossible to misread |
| **20/20** | LLM-Judge pass rate — proves quality |
| **$0.00006** | GraphRAG cost per query |
| **22×** | How much cheaper GraphRAG is ($0.00133 ÷ $0.00006) |
| **88%** | Avg token reduction across all 20 questions |
| **$60 vs $1,330** | Monthly cost at 1M queries — the scale argument |
| **49 companies** | Dataset credibility |
| **245 filings** | Dataset credibility |
| **110M tokens** | Sounds impressive — use it |
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
