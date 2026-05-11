"use client";

import { useState, useRef } from "react";
import QueryInput from "@/components/QueryInput";
import PipelineCard from "@/components/PipelineCard";
import MetricsTable from "@/components/MetricsTable";

export interface PipelineResult {
  pipeline_name: string;
  answer: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
  cost_usd: number;
  retrieved_chunks: string[];
  graph_hops: number;
  bertscore_f1: number | null;
  judge_pass: boolean | null;
  judge_reason: string | null;
  error: string | null;
}

export interface BenchmarkResult {
  query: string;
  pipeline1: PipelineResult;
  pipeline2: PipelineResult;
  pipeline3: PipelineResult;
  token_reduction_pct: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Home() {
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const demoRef = useRef<HTMLDivElement>(null);

  function scrollToDemo() {
    demoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleQuery(query: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#020817] text-slate-100 overflow-x-hidden">

      {/* ════════════════════ NAV ════════════════════ */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#020817]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 via-cyan-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <span className="text-sm font-black text-white">G</span>
            </div>
            <div>
              <span className="font-bold text-white text-sm">GraphRAG Finance</span>
              <span className="hidden sm:inline text-slate-500 text-xs ml-2">Benchmark</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="text-xs text-slate-400 hover:text-white transition-colors hidden md:block">How it works</a>
            <a href="#data" className="text-xs text-slate-400 hover:text-white transition-colors hidden md:block">Dataset</a>
            <a href="/benchmark" className="text-xs text-slate-400 hover:text-emerald-400 transition-colors hidden md:block font-medium">Benchmark →</a>
            <button
              onClick={scrollToDemo}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 text-xs transition-all hover:shadow-lg hover:shadow-emerald-500/25"
            >
              Try Demo →
            </button>
          </div>
        </div>
      </nav>

      {/* ════════════════════ HERO ════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-16 grid-bg">
        {/* Floating orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="float-slow absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/8 rounded-full blur-3xl" />
          <div className="float-med absolute top-1/3 right-1/4 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl" />
          <div className="float-fast absolute bottom-1/4 left-1/2 w-64 h-64 bg-indigo-500/8 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-5 py-2 text-xs text-emerald-400 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
            TigerGraph GraphRAG Inference Hackathon
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.05]">
              <span className="text-white">Graph-powered RAG</span>
              <br />
              <span className="gradient-text">proves itself live.</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Ask any question about SEC 10-K filings. Watch three AI pipelines answer it
              simultaneously — and see why GraphRAG wins by up to{" "}
              <span className="text-emerald-400 font-bold">88% fewer tokens</span>.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={scrollToDemo}
              className="group relative rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-8 py-3.5 text-sm font-bold text-slate-950 transition-all hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/30"
            >
              <span className="relative z-10">Try the Demo</span>
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">→</span>
            </button>
            <a
              href="#how-it-works"
              className="rounded-xl border border-slate-700 hover:border-slate-500 bg-slate-900/50 hover:bg-slate-800/50 text-slate-300 hover:text-white px-8 py-3.5 text-sm font-medium transition-all"
            >
              See how it works
            </a>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 max-w-3xl mx-auto">
            {[
              { n: "88%", label: "Token Reduction", sub: "GraphRAG vs Basic RAG" },
              { n: "25", label: "SEC Filings", sub: "5 companies × 5 years" },
              { n: "2-hop", label: "Graph Depth", sub: "Company → Doc → Risk" },
              { n: "4,400+", label: "Text Chunks", sub: "Indexed in FAISS" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm px-4 py-4 text-center hover:border-slate-700 transition-colors">
                <p className="text-2xl font-black gradient-text">{s.n}</p>
                <p className="text-xs font-semibold text-slate-300 mt-1">{s.label}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-600">
          <span className="text-[10px] uppercase tracking-widest">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-slate-600 to-transparent" />
        </div>
      </section>

      {/* ════════════════════ HOW IT WORKS ════════════════════ */}
      <section id="how-it-works" className="py-28 px-6 relative">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <div className="relative mx-auto max-w-6xl">
          <div className="text-center mb-16 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-500">Architecture</p>
            <h2 className="text-4xl font-black text-white">Three pipelines. One truth.</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Every query runs all three approaches in parallel — you see the real cost-quality tradeoff in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              {
                num: "01", name: "LLM Only", color: "purple",
                icon: "🧠",
                desc: "Raw question sent directly to the LLM with zero external context. Fast but relies entirely on training data — often hallucinates specific figures.",
                pros: ["Fastest response", "No setup needed"],
                cons: ["High hallucination risk", "No real-time data"],
              },
              {
                num: "02", name: "Basic RAG", color: "blue",
                icon: "🔍",
                desc: "Top-5 chunks retrieved from 4,400+ SEC filing passages via FAISS vector search, then fed as context to the LLM.",
                pros: ["Grounded in real filings", "Semantic search"],
                cons: ["Large context window", "High token cost"],
              },
              {
                num: "03", name: "GraphRAG", color: "emerald",
                icon: "🕸️",
                desc: "Multi-hop TigerGraph traversal extracts only the precise facts needed — Company → Document → Risk/Executive — in 2 hops.",
                pros: ["88% fewer tokens", "Structured reasoning", "Multi-hop context"],
                cons: ["Requires graph build"],
              },
            ].map((p) => (
              <div
                key={p.num}
                className={`relative rounded-2xl border p-6 space-y-4 overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl ${
                  p.color === "emerald"
                    ? "border-emerald-700/50 bg-gradient-to-b from-emerald-950/40 to-slate-900/40 hover:shadow-emerald-900/50"
                    : p.color === "blue"
                    ? "border-blue-800/40 bg-gradient-to-b from-blue-950/30 to-slate-900/40 hover:shadow-blue-900/30"
                    : "border-purple-800/40 bg-gradient-to-b from-purple-950/30 to-slate-900/40 hover:shadow-purple-900/30"
                }`}
              >
                {p.color === "emerald" && (
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
                )}
                <div className="flex items-start justify-between">
                  <div className="text-3xl">{p.icon}</div>
                  <span className={`text-5xl font-black opacity-10 ${
                    p.color === "emerald" ? "text-emerald-400" : p.color === "blue" ? "text-blue-400" : "text-purple-400"
                  }`}>{p.num}</span>
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${
                    p.color === "emerald" ? "text-emerald-300" : p.color === "blue" ? "text-blue-300" : "text-purple-300"
                  }`}>{p.name}</h3>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">{p.desc}</p>
                </div>
                <div className="space-y-1.5">
                  {p.pros.map(pro => (
                    <div key={pro} className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="text-emerald-500">✓</span> {pro}
                    </div>
                  ))}
                  {p.cons.map(con => (
                    <div key={con} className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="text-slate-600">✗</span> {con}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Graph schema */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-5 text-center">
              TigerGraph Knowledge Graph — 5 Vertex Types · 5 Edge Types
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {[
                { label: "Company", color: "emerald" },
                { label: "→ FILED_BY →", arrow: true },
                { label: "Document", color: "cyan" },
                { label: "→ MENTIONS_RISK →", arrow: true },
                { label: "Risk", color: "rose" },
              ].map((item, i) =>
                item.arrow ? (
                  <span key={i} className="text-slate-600 text-xs font-mono hidden sm:block">{item.label}</span>
                ) : (
                  <div key={i} className={`rounded-lg border px-4 py-2 text-xs font-semibold ${
                    item.color === "emerald" ? "border-emerald-700/50 bg-emerald-900/30 text-emerald-300" :
                    item.color === "cyan"    ? "border-cyan-700/50 bg-cyan-900/30 text-cyan-300" :
                    item.color === "rose"    ? "border-rose-700/50 bg-rose-900/30 text-rose-300" :
                    "border-slate-700 bg-slate-800/50 text-slate-300"
                  }`}>{item.label}</div>
                )
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {[
                { label: "Executive", color: "violet" },
                { label: "Sector", color: "amber" },
                { label: "HAS_EXECUTIVE", arrow: true },
                { label: "OPERATES_IN", arrow: true },
                { label: "SUCCEEDED_BY", arrow: true },
              ].map((item, i) =>
                item.arrow ? (
                  <span key={i} className="rounded-full border border-slate-700/50 bg-slate-800/30 px-3 py-1 text-[10px] font-mono text-slate-500">{item.label}</span>
                ) : (
                  <div key={i} className={`rounded-lg border px-4 py-2 text-xs font-semibold ${
                    item.color === "violet" ? "border-violet-700/50 bg-violet-900/30 text-violet-300" :
                    "border-amber-700/50 bg-amber-900/30 text-amber-300"
                  }`}>{item.label}</div>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════ DATASET ════════════════════ */}
      <section id="data" className="py-24 px-6 border-t border-slate-800/60">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-500">Dataset</p>
            <h2 className="text-4xl font-black text-white">Real filings. Real answers.</h2>
            <p className="text-slate-400 max-w-lg mx-auto text-sm">
              25 SEC 10-K annual reports downloaded directly from EDGAR, parsed and indexed.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-8">
            {[
              { ticker: "AAPL", name: "Apple", sector: "Technology", color: "from-slate-700 to-slate-800" },
              { ticker: "MSFT", name: "Microsoft", sector: "Technology", color: "from-blue-900/60 to-slate-800" },
              { ticker: "JPM",  name: "JPMorgan", sector: "Finance", color: "from-sky-900/60 to-slate-800" },
              { ticker: "XOM",  name: "ExxonMobil", sector: "Energy", color: "from-red-900/40 to-slate-800" },
              { ticker: "JNJ",  name: "Johnson & Johnson", sector: "Healthcare", color: "from-rose-900/40 to-slate-800" },
            ].map(c => (
              <div key={c.ticker} className={`rounded-xl border border-slate-700/50 bg-gradient-to-b ${c.color} p-4 text-center hover:border-slate-600 transition-colors`}>
                <p className="text-2xl font-black text-white">{c.ticker}</p>
                <p className="text-xs text-slate-300 mt-0.5">{c.name}</p>
                <p className="text-[10px] text-slate-500 mt-1 rounded-full border border-slate-700 px-2 py-0.5 inline-block">{c.sector}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex flex-wrap justify-center gap-2">
            <span className="text-xs text-slate-500">Years covered:</span>
            {["2019", "2020", "2021", "2022", "2023"].map(y => (
              <span key={y} className="rounded-full border border-slate-700 bg-slate-800/50 px-3 py-0.5 text-xs text-slate-400 font-mono">{y}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ DEMO ════════════════════ */}
      <section id="demo" ref={demoRef} className="py-24 px-6 relative border-t border-slate-800/60">
        {/* Glow behind the demo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl">
          {/* Section header */}
          <div className="text-center mb-12 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-500">Live Benchmark</p>
            <h2 className="text-4xl font-black text-white">Enter your query</h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm">
              Type any financial question about Apple, Microsoft, JPMorgan, ExxonMobil, or Johnson &amp; Johnson from 2019–2023.
              All three pipelines run in parallel.
            </p>
          </div>

          {/* Query box — centrepiece */}
          <div className="max-w-3xl mx-auto mb-8">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-6 backdrop-blur-sm glow-emerald">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Ask a question</p>
              <QueryInput onSubmit={handleQuery} loading={loading} />

              <div className="mt-6 grid grid-cols-3 gap-3 pt-4 border-t border-slate-800">
                {[
                  { icon: "🧠", label: "LLM Only", sub: "No context" },
                  { icon: "🔍", label: "Basic RAG", sub: "Vector search" },
                  { icon: "🕸️", label: "GraphRAG", sub: "Graph traversal" },
                ].map(p => (
                  <div key={p.label} className="text-center">
                    <span className="text-xl">{p.icon}</span>
                    <p className="text-xs font-semibold text-slate-300 mt-1">{p.label}</p>
                    <p className="text-[10px] text-slate-600">{p.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="max-w-3xl mx-auto mb-6 fade-up rounded-xl border border-red-700/40 bg-red-950/30 px-5 py-4 flex items-start gap-3">
              <span className="text-red-400 mt-0.5">⚠</span>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Loading skeletons */}
          {loading && (
            <div className="space-y-4">
              <p className="text-center text-sm text-slate-500 animate-pulse">Running all 3 pipelines in parallel…</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {["LLM Only", "Basic RAG", "GraphRAG"].map((name) => (
                  <div key={name} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="shimmer h-5 w-24 rounded-full" />
                      <div className="shimmer h-4 w-16 rounded" />
                    </div>
                    <div className="space-y-2">
                      <div className="shimmer h-3 w-full rounded" />
                      <div className="shimmer h-3 w-5/6 rounded" />
                      <div className="shimmer h-3 w-4/5 rounded" />
                      <div className="shimmer h-3 w-3/5 rounded" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="shimmer h-12 rounded-lg" />
                      <div className="shimmer h-12 rounded-lg" />
                    </div>
                    <p className="text-xs text-slate-600 text-center">{name} running…</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div className="space-y-6">
              {/* Token reduction banner */}
              {result.token_reduction_pct > 0 && (
                <div className="fade-up max-w-3xl mx-auto rounded-2xl border border-emerald-700/40 bg-gradient-to-r from-emerald-950/60 to-cyan-950/40 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="flex items-baseline gap-2 shrink-0">
                    <span className="text-5xl font-black gradient-text">{result.token_reduction_pct}%</span>
                    <span className="text-emerald-400 font-bold text-lg">saved</span>
                  </div>
                  <div className="border-l border-emerald-800/40 pl-5 space-y-1">
                    <p className="text-sm font-semibold text-white">GraphRAG is dramatically more efficient</p>
                    <p className="text-xs text-slate-400">
                      Used <span className="text-emerald-400 font-bold">{result.pipeline3.total_tokens.toLocaleString()} tokens</span> vs Basic RAG&apos;s{" "}
                      <span className="text-slate-300 font-semibold">{result.pipeline2.total_tokens.toLocaleString()}</span> — same answer quality at a fraction of the cost
                    </p>
                  </div>
                </div>
              )}

              {/* Query echo */}
              <div className="fade-up max-w-3xl mx-auto rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-3 flex items-center gap-3">
                <span className="text-slate-600 text-sm">Q:</span>
                <p className="text-sm text-slate-300 italic">&ldquo;{result.query}&rdquo;</p>
              </div>

              {/* 3 pipeline cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="fade-up fade-up-1"><PipelineCard data={result.pipeline1} label="Pipeline 1" /></div>
                <div className="fade-up fade-up-2"><PipelineCard data={result.pipeline2} label="Pipeline 2" /></div>
                <div className="fade-up fade-up-3"><PipelineCard data={result.pipeline3} label="Pipeline 3" highlight /></div>
              </div>

              {/* Metrics table */}
              <div className="fade-up fade-up-4">
                <MetricsTable result={result} />
              </div>

              {/* Run another query CTA */}
              <div className="fade-up text-center pt-4">
                <button
                  onClick={() => { setResult(null); demoRef.current?.scrollIntoView({ behavior: "smooth" }); }}
                  className="rounded-xl border border-slate-700 hover:border-emerald-700/60 hover:bg-emerald-950/20 text-slate-400 hover:text-emerald-300 px-6 py-2.5 text-sm transition-all"
                >
                  ↺ Run another query
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════ FOOTER ════════════════════ */}
      <footer className="border-t border-slate-800/60 py-10 px-6">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-[10px] font-black text-white">G</div>
            <span className="text-sm font-semibold text-slate-400">GraphRAG Finance Benchmark</span>
          </div>
          <p className="text-xs text-slate-600 text-center">
            SEC data via EDGAR · Embeddings: sentence-transformers · Vector DB: FAISS · Graph DB: TigerGraph Savanna · LLM: OpenRouter
          </p>
        </div>
      </footer>

    </div>
  );
}
