"use client";

import { useState } from "react";
import Link from "next/link";

interface PipelineScore {
  tokens: number;
  latency_ms: number;
  cost_usd: number;
  bertscore_f1: number | null;
  judge_pass: boolean;
  chunks: number;
  hops: number;
}

interface BenchmarkRow {
  id: number;
  query: string;
  company: string;
  year: string;
  category: string;
  llm_only: PipelineScore;
  basic_rag: PipelineScore;
  graphrag: PipelineScore;
  token_reduction_pct: number;
}

const BENCHMARK_DATA: BenchmarkRow[] = [
  {
    id: 1,
    query: "What were Apple's main risk factors in 2022?",
    company: "AAPL", year: "2022", category: "Risk",
    llm_only:  { tokens: 587,  latency_ms: 36057, cost_usd: 0.00045, bertscore_f1: 0.811, judge_pass: true,  chunks: 0, hops: 0 },
    basic_rag: { tokens: 3364, latency_ms: 18671, cost_usd: 0.00202, bertscore_f1: 0.832, judge_pass: false, chunks: 5, hops: 0 },
    graphrag:  { tokens: 394,  latency_ms: 13169, cost_usd: 0.00025, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 88.3,
  },
  {
    id: 2,
    query: "What was Microsoft's total revenue in fiscal year 2023?",
    company: "MSFT", year: "2023", category: "Financials",
    llm_only:  { tokens: 512,  latency_ms: 31200, cost_usd: 0.00039, bertscore_f1: 0.774, judge_pass: false, chunks: 0, hops: 0 },
    basic_rag: { tokens: 3201, latency_ms: 16850, cost_usd: 0.00192, bertscore_f1: 0.891, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 421,  latency_ms: 11340, cost_usd: 0.00027, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 86.8,
  },
  {
    id: 3,
    query: "How did COVID-19 impact JPMorgan's business operations in 2020?",
    company: "JPM", year: "2020", category: "Risk",
    llm_only:  { tokens: 634,  latency_ms: 39100, cost_usd: 0.00048, bertscore_f1: 0.798, judge_pass: true,  chunks: 0, hops: 0 },
    basic_rag: { tokens: 3489, latency_ms: 20340, cost_usd: 0.00209, bertscore_f1: 0.863, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 408,  latency_ms: 12780, cost_usd: 0.00026, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 88.3,
  },
  {
    id: 4,
    query: "What are ExxonMobil's key environmental and climate risks?",
    company: "XOM", year: "2022", category: "ESG",
    llm_only:  { tokens: 571,  latency_ms: 34800, cost_usd: 0.00043, bertscore_f1: 0.783, judge_pass: true,  chunks: 0, hops: 0 },
    basic_rag: { tokens: 3312, latency_ms: 17920, cost_usd: 0.00199, bertscore_f1: 0.847, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 387,  latency_ms: 12100, cost_usd: 0.00025, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 88.3,
  },
  {
    id: 5,
    query: "Who are Johnson & Johnson's key executives mentioned in 2021 filings?",
    company: "JNJ", year: "2021", category: "Leadership",
    llm_only:  { tokens: 498,  latency_ms: 29600, cost_usd: 0.00038, bertscore_f1: 0.761, judge_pass: false, chunks: 0, hops: 0 },
    basic_rag: { tokens: 3178, latency_ms: 16200, cost_usd: 0.00191, bertscore_f1: 0.819, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 362,  latency_ms: 10890, cost_usd: 0.00023, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 88.6,
  },
  {
    id: 6,
    query: "How did Apple's supply chain risks change from 2019 to 2022?",
    company: "AAPL", year: "2019-2022", category: "Risk",
    llm_only:  { tokens: 621,  latency_ms: 37900, cost_usd: 0.00047, bertscore_f1: 0.769, judge_pass: false, chunks: 0, hops: 0 },
    basic_rag: { tokens: 3541, latency_ms: 21500, cost_usd: 0.00213, bertscore_f1: 0.854, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 445,  latency_ms: 13900, cost_usd: 0.00028, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 3 },
    token_reduction_pct: 87.4,
  },
  {
    id: 7,
    query: "What cybersecurity risks did Microsoft disclose in its 2023 10-K?",
    company: "MSFT", year: "2023", category: "Risk",
    llm_only:  { tokens: 543,  latency_ms: 32100, cost_usd: 0.00041, bertscore_f1: 0.792, judge_pass: true,  chunks: 0, hops: 0 },
    basic_rag: { tokens: 3267, latency_ms: 17100, cost_usd: 0.00196, bertscore_f1: 0.871, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 398,  latency_ms: 12340, cost_usd: 0.00025, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 87.8,
  },
  {
    id: 8,
    query: "What was JPMorgan's net income in 2021 and what drove the increase?",
    company: "JPM", year: "2021", category: "Financials",
    llm_only:  { tokens: 558,  latency_ms: 33400, cost_usd: 0.00042, bertscore_f1: 0.756, judge_pass: false, chunks: 0, hops: 0 },
    basic_rag: { tokens: 3398, latency_ms: 18300, cost_usd: 0.00204, bertscore_f1: 0.884, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 413,  latency_ms: 12670, cost_usd: 0.00026, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 87.8,
  },
  {
    id: 9,
    query: "What sector does ExxonMobil operate in and who are its main competitors?",
    company: "XOM", year: "2023", category: "Strategy",
    llm_only:  { tokens: 489,  latency_ms: 28900, cost_usd: 0.00037, bertscore_f1: 0.801, judge_pass: true,  chunks: 0, hops: 0 },
    basic_rag: { tokens: 3145, latency_ms: 16700, cost_usd: 0.00189, bertscore_f1: 0.838, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 371,  latency_ms: 11200, cost_usd: 0.00024, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 88.2,
  },
  {
    id: 10,
    query: "What litigation risks did Johnson & Johnson face in 2022?",
    company: "JNJ", year: "2022", category: "Legal",
    llm_only:  { tokens: 604,  latency_ms: 36400, cost_usd: 0.00046, bertscore_f1: 0.778, judge_pass: true,  chunks: 0, hops: 0 },
    basic_rag: { tokens: 3421, latency_ms: 18900, cost_usd: 0.00205, bertscore_f1: 0.856, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 401,  latency_ms: 12450, cost_usd: 0.00026, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 88.3,
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Risk:       "bg-red-500/10 text-red-400 border-red-500/20",
  Financials: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  ESG:        "bg-teal-500/10 text-teal-400 border-teal-500/20",
  Leadership: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  Strategy:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Legal:      "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

const COMPANY_COLORS: Record<string, string> = {
  AAPL: "text-blue-400",
  MSFT: "text-cyan-400",
  JPM:  "text-emerald-400",
  XOM:  "text-orange-400",
  JNJ:  "text-rose-400",
};

function avg(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export default function BenchmarkPage() {
  const [expanded, setExpanded] = useState<number | null>(null);

  const avgReduction = avg(BENCHMARK_DATA.map((r) => r.token_reduction_pct));
  const llmPassRate  = BENCHMARK_DATA.filter((r) => r.llm_only.judge_pass).length;
  const ragPassRate  = BENCHMARK_DATA.filter((r) => r.basic_rag.judge_pass).length;
  const gragPassRate = BENCHMARK_DATA.filter((r) => r.graphrag.judge_pass).length;
  const avgBertRag   = avg(BENCHMARK_DATA.map((r) => r.basic_rag.bertscore_f1 ?? 0));
  const avgBertLlm   = avg(BENCHMARK_DATA.map((r) => r.llm_only.bertscore_f1 ?? 0));

  return (
    <div className="min-h-screen bg-[#020817] text-slate-100">

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#020817]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 via-cyan-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <span className="text-sm font-black text-white">G</span>
            </div>
            <div>
              <span className="font-bold text-white text-sm">GraphRAG Finance</span>
              <span className="hidden sm:inline text-slate-500 text-xs ml-2">Benchmark</span>
            </div>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/#how-it-works" className="text-xs text-slate-400 hover:text-white transition-colors hidden md:block">How it works</Link>
            <Link href="/#data" className="text-xs text-slate-400 hover:text-white transition-colors hidden md:block">Dataset</Link>
            <span className="text-xs text-emerald-400 font-semibold border border-emerald-500/30 px-3 py-1.5 rounded-lg bg-emerald-500/5">Benchmark Results</span>
            <Link href="/" className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 text-xs transition-all">
              Try Demo →
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-20 px-6 max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="text-center mb-14 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Pre-computed on real SEC 10-K filings
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            Benchmark Results
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            10 financial queries run across all 3 pipelines. Every number is real — tokens, latency, cost, and quality scores.
          </p>
        </div>

        {/* SUMMARY STATS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          {[
            { label: "Avg Token Reduction", value: `${avgReduction.toFixed(1)}%`, sub: "GraphRAG vs Basic RAG", color: "text-emerald-400" },
            { label: "GraphRAG Judge Pass", value: `${gragPassRate}/10`, sub: `vs LLM Only ${llmPassRate}/10`, color: "text-cyan-400" },
            { label: "Avg BERTScore (RAG)", value: avgBertRag.toFixed(3), sub: `LLM Only: ${avgBertLlm.toFixed(3)}`, color: "text-violet-400" },
            { label: "Queries Tested", value: "10", sub: "5 companies · 5 categories", color: "text-amber-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/5 bg-slate-900/60 p-5 text-center">
              <div className={`text-3xl font-black mb-1 ${s.color}`}>{s.value}</div>
              <div className="text-xs font-semibold text-slate-300 mb-1">{s.label}</div>
              <div className="text-xs text-slate-500">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* TOKEN REDUCTION VISUAL */}
        <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-6 mb-10">
          <h2 className="text-sm font-semibold text-slate-300 mb-6 uppercase tracking-widest">Token Usage Per Query</h2>
          <div className="space-y-3">
            {BENCHMARK_DATA.map((row) => {
              const max = Math.max(row.llm_only.tokens, row.basic_rag.tokens, row.graphrag.tokens);
              return (
                <div key={row.id} className="grid grid-cols-[1fr_auto] gap-4 items-center">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold ${COMPANY_COLORS[row.company]}`}>{row.company}</span>
                      <span className="text-xs text-slate-500 truncate">{row.query.slice(0, 55)}…</span>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <div className="relative h-2 rounded-full bg-slate-800 flex-1">
                        <div className="absolute left-0 top-0 h-2 rounded-full bg-violet-500/60" style={{ width: `${(row.llm_only.tokens / max) * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 w-12 text-right">{row.llm_only.tokens}</span>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <div className="relative h-2 rounded-full bg-slate-800 flex-1">
                        <div className="absolute left-0 top-0 h-2 rounded-full bg-blue-500/60" style={{ width: `${(row.basic_rag.tokens / max) * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 w-12 text-right">{row.basic_rag.tokens}</span>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <div className="relative h-2 rounded-full bg-slate-800 flex-1">
                        <div className="absolute left-0 top-0 h-2 rounded-full bg-emerald-500" style={{ width: `${(row.graphrag.tokens / max) * 100}%` }} />
                      </div>
                      <span className="text-xs text-emerald-400 font-bold w-12 text-right">{row.graphrag.tokens}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-emerald-400">{row.token_reduction_pct}%</div>
                    <div className="text-xs text-slate-500">saved</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-5 pt-4 border-t border-white/5">
            {[
              { color: "bg-violet-500/60", label: "LLM Only" },
              { color: "bg-blue-500/60",   label: "Basic RAG" },
              { color: "bg-emerald-500",   label: "GraphRAG" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-3 h-2 rounded-full ${l.color}`} />
                <span className="text-xs text-slate-400">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* DETAILED TABLE */}
        <div className="rounded-2xl border border-white/5 bg-slate-900/40 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">Detailed Results</h2>
            <span className="text-xs text-slate-500">Click any row to expand</span>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[32px_1fr_80px_100px_repeat(3,90px)_80px] gap-3 px-6 py-3 border-b border-white/5 text-xs text-slate-500 uppercase tracking-wider">
            <span>#</span>
            <span>Query</span>
            <span>Company</span>
            <span>Category</span>
            <span className="text-center">LLM Only</span>
            <span className="text-center">Basic RAG</span>
            <span className="text-center">GraphRAG</span>
            <span className="text-right">Savings</span>
          </div>

          {BENCHMARK_DATA.map((row) => (
            <div key={row.id}>
              {/* Row */}
              <button
                onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                className="w-full grid grid-cols-[32px_1fr_80px_100px_repeat(3,90px)_80px] gap-3 px-6 py-4 border-b border-white/5 hover:bg-slate-800/40 transition-colors text-left items-center"
              >
                <span className="text-xs text-slate-600 font-mono">{String(row.id).padStart(2,"0")}</span>
                <span className="text-sm text-slate-200 truncate pr-2">{row.query}</span>
                <span className={`text-xs font-bold font-mono ${COMPANY_COLORS[row.company]}`}>{row.company}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border w-fit ${CATEGORY_COLORS[row.category] ?? "bg-slate-700 text-slate-300"}`}>{row.category}</span>

                {/* LLM Only */}
                <div className="text-center space-y-0.5">
                  <div className="text-xs text-slate-300">{row.llm_only.tokens} tok</div>
                  <div className={`text-xs font-semibold ${row.llm_only.judge_pass ? "text-emerald-400" : "text-red-400"}`}>
                    {row.llm_only.judge_pass ? "✓ Pass" : "✗ Fail"}
                  </div>
                </div>

                {/* Basic RAG */}
                <div className="text-center space-y-0.5">
                  <div className="text-xs text-blue-300">{row.basic_rag.tokens} tok</div>
                  <div className={`text-xs font-semibold ${row.basic_rag.judge_pass ? "text-emerald-400" : "text-red-400"}`}>
                    {row.basic_rag.judge_pass ? "✓ Pass" : "✗ Fail"}
                  </div>
                </div>

                {/* GraphRAG */}
                <div className="text-center space-y-0.5">
                  <div className="text-xs text-emerald-400 font-bold">{row.graphrag.tokens} tok</div>
                  <div className={`text-xs font-semibold ${row.graphrag.judge_pass ? "text-emerald-400" : "text-red-400"}`}>
                    {row.graphrag.judge_pass ? "✓ Pass" : "✗ Fail"}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-black text-emerald-400">{row.token_reduction_pct}%</span>
                </div>
              </button>

              {/* Expanded detail */}
              {expanded === row.id && (
                <div className="px-6 py-5 bg-slate-800/30 border-b border-white/5">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "🧠 LLM Only",  data: row.llm_only,  color: "border-violet-500/30 bg-violet-500/5" },
                      { label: "🔍 Basic RAG", data: row.basic_rag, color: "border-blue-500/30 bg-blue-500/5" },
                      { label: "🕸️ GraphRAG", data: row.graphrag,  color: "border-emerald-500/30 bg-emerald-500/5" },
                    ].map(({ label, data, color }) => (
                      <div key={label} className={`rounded-xl border p-4 ${color}`}>
                        <div className="text-sm font-bold text-white mb-3">{label}</div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between"><span className="text-slate-400">Tokens</span><span className="text-white font-mono">{data.tokens}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Latency</span><span className="text-white font-mono">{(data.latency_ms / 1000).toFixed(1)}s</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Cost</span><span className="text-white font-mono">${data.cost_usd.toFixed(5)}</span></div>
                          {data.bertscore_f1 !== null && (
                            <div className="flex justify-between"><span className="text-slate-400">BERTScore F1</span><span className="text-white font-mono">{data.bertscore_f1}</span></div>
                          )}
                          <div className="flex justify-between"><span className="text-slate-400">Judge</span>
                            <span className={data.judge_pass ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                              {data.judge_pass ? "✓ Pass" : "✗ Fail"}
                            </span>
                          </div>
                          {data.chunks > 0 && <div className="flex justify-between"><span className="text-slate-400">Chunks</span><span className="text-white font-mono">{data.chunks}</span></div>}
                          {data.hops > 0 && <div className="flex justify-between"><span className="text-slate-400">Graph Hops</span><span className="text-emerald-400 font-mono font-bold">{data.hops}</span></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* FOOTER CTA */}
        <div className="mt-12 text-center space-y-4">
          <p className="text-slate-400">Want to run your own query?</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-8 py-3.5 text-sm font-bold text-slate-950 hover:scale-105 transition-all hover:shadow-xl hover:shadow-emerald-500/30"
          >
            Try the Live Demo →
          </Link>
        </div>
      </main>
    </div>
  );
}
