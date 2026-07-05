"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ── Shapes matching data/processed/benchmark_results.jsonl (evaluation/benchmark.py)
// and the live /api/query response (dashboard/backend/models.py) ────────────────

interface PipelineEntry {
  pipeline: "llm_only" | "basic_rag" | "graphrag";
  answer: string;
  total_tokens: number;
  latency_ms: number;
  cost_usd: number;
  chunks_retrieved: number;
  graph_hops: number;
  bertscore_f1: number | null;
  judge_pass: boolean | null;
  judge_reason: string | null;
  error: string | null;
}

interface BenchmarkRow {
  id: number;
  query: string;
  reference: string;
  company: string;
  year: string;
  category: string;
  pipelines: PipelineEntry[];
  token_reduction_pct: number;
}

function getPipeline(row: BenchmarkRow, name: PipelineEntry["pipeline"]): PipelineEntry {
  return (
    row.pipelines.find((p) => p.pipeline === name) ?? {
      pipeline: name,
      answer: "",
      total_tokens: 0,
      latency_ms: 0,
      cost_usd: 0,
      chunks_retrieved: 0,
      graph_hops: 0,
      bertscore_f1: null,
      judge_pass: null,
      judge_reason: null,
      error: "No data",
    }
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  Risk:       "bg-red-500/10 text-red-400 border-red-500/20",
  Financials: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  ESG:        "bg-teal-500/10 text-teal-400 border-teal-500/20",
  Leadership: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  Strategy:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Legal:      "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Innovation: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

const COMPANY_COLORS: Record<string, string> = {
  AAPL: "text-blue-400",    MSFT: "text-cyan-400",
  JPM:  "text-emerald-400", XOM:  "text-orange-400",
  JNJ:  "text-rose-400",   NVDA: "text-green-400",
  TSLA: "text-red-400",    GS:   "text-yellow-400",
  UNH:  "text-violet-400", CVX:  "text-amber-400",
  BA:   "text-indigo-400", AMZN: "text-sky-400",
  INTC: "text-teal-400",   DIS:  "text-purple-400",
  BAC:  "text-lime-400",
};

function avg(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface LiveStats {
  chunks: number;
  companies: number;
  filings: number;
  sectors: number;
  years: string[];
  estimated_tokens: number;
}

export default function BenchmarkPage() {
  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(true);
  const [stats, setStats] = useState<LiveStats | null>(null);

  const [expanded, setExpanded] = useState<number | null>(null);
  const [filterCat, setFilterCat]  = useState<string>("All");
  const [filterCo,  setFilterCo]   = useState<string>("All");

  // Live re-run state — overrides the committed row's pipelines with fresh results
  const [liveResults, setLiveResults] = useState<Record<number, { pipelines: PipelineEntry[]; token_reduction_pct: number }>>({});
  const [runningId,   setRunningId]   = useState<number | null>(null);
  const [runProgress, setRunProgress] = useState<{ done: number; total: number } | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/benchmark`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.detail ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data: BenchmarkRow[]) => setRows(data))
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingRows(false));

    fetch(`${API_URL}/api/stats`)
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  async function runSingle(row: BenchmarkRow) {
    try {
      const res = await fetch(`${API_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: row.query, reference_answer: row.reference }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const toEntry = (p: {
        pipeline_name: string; total_tokens: number; latency_ms: number; cost_usd: number;
        retrieved_chunks: string[]; graph_hops: number; bertscore_f1: number | null;
        judge_pass: boolean | null; judge_reason: string | null; error: string | null;
      }, name: PipelineEntry["pipeline"]): PipelineEntry => ({
        pipeline: name,
        answer: "",
        total_tokens: p.total_tokens,
        latency_ms: p.latency_ms,
        cost_usd: p.cost_usd,
        chunks_retrieved: p.retrieved_chunks.length,
        graph_hops: p.graph_hops,
        bertscore_f1: p.bertscore_f1,
        judge_pass: p.judge_pass,
        judge_reason: p.judge_reason,
        error: p.error,
      });
      return {
        pipelines: [
          toEntry(data.pipeline1, "llm_only"),
          toEntry(data.pipeline2, "basic_rag"),
          toEntry(data.pipeline3, "graphrag"),
        ],
        token_reduction_pct: data.token_reduction_pct,
      };
    } catch { return null; }
  }

  async function runAll() {
    setIsRunningAll(true);
    setRunProgress({ done: 0, total: rows.length });
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setRunningId(row.id);
      const result = await runSingle(row);
      if (result) {
        setLiveResults((prev) => ({ ...prev, [row.id]: result }));
      }
      setRunProgress({ done: i + 1, total: rows.length });
    }
    setRunningId(null);
    setIsRunningAll(false);
  }

  async function runOne(row: BenchmarkRow) {
    setRunningId(row.id);
    const result = await runSingle(row);
    if (result) setLiveResults((prev) => ({ ...prev, [row.id]: result }));
    setRunningId(null);
  }

  // Merge live results with committed data
  const mergedData = rows.map((row) => {
    const live = liveResults[row.id];
    if (!live) return row;
    return { ...row, pipelines: live.pipelines, token_reduction_pct: live.token_reduction_pct };
  });

  const categories = ["All", ...Array.from(new Set(rows.map((r) => r.category)))];
  const companies  = ["All", ...Array.from(new Set(rows.map((r) => r.company))).sort()];

  const filtered = mergedData.filter(
    (r) =>
      (filterCat === "All" || r.category === filterCat) &&
      (filterCo  === "All" || r.company  === filterCo)
  );

  const avgReduction = avg(mergedData.map((r) => r.token_reduction_pct));
  const llmPassRate  = mergedData.filter((r) => getPipeline(r, "llm_only").judge_pass).length;
  const ragPassRate  = mergedData.filter((r) => getPipeline(r, "basic_rag").judge_pass).length;
  const gragPassRate = mergedData.filter((r) => getPipeline(r, "graphrag").judge_pass).length;
  const avgBertRag   = avg(mergedData.map((r) => getPipeline(r, "basic_rag").bertscore_f1 ?? 0));
  const avgBertLlm   = avg(mergedData.map((r) => getPipeline(r, "llm_only").bertscore_f1 ?? 0));
  const liveCount    = Object.keys(liveResults).length;

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
            Committed results from a real offline run
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            Benchmark Results
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            {rows.length} financial queries run across all 3 pipelines on{" "}
            {stats ? (
              <span className="text-emerald-400 font-semibold">
                {(stats.estimated_tokens / 1e6).toFixed(0)}M tokens ({stats.companies} companies, {stats.filings} filings)
              </span>
            ) : (
              <span className="text-emerald-400 font-semibold">the loaded dataset</span>
            )}
            . Every number below is read from a committed{" "}
            <code className="text-xs text-slate-300">benchmark_results.jsonl</code>, produced by
            an actual <code className="text-xs text-slate-300">python -m evaluation.benchmark</code> run.
          </p>
        </div>

        {loadError && (
          <div className="rounded-2xl border border-red-700/40 bg-red-950/30 p-5 mb-10 text-center text-sm text-red-300">
            Couldn&apos;t load benchmark results: {loadError}. Run{" "}
            <code className="text-xs">python -m evaluation.benchmark</code> against the backend and reload.
          </div>
        )}

        {!loadError && !loadingRows && rows.length === 0 && (
          <div className="rounded-2xl border border-amber-700/40 bg-amber-950/20 p-5 mb-10 text-center text-sm text-amber-300">
            No benchmark results yet. Run <code className="text-xs">python -m evaluation.benchmark</code> to
            generate <code className="text-xs">data/processed/benchmark_results.jsonl</code>.
          </div>
        )}

        {rows.length > 0 && (
        <>
        {/* LIVE RUNNER BANNER */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isRunningAll ? "bg-emerald-400 animate-pulse" : liveCount > 0 ? "bg-cyan-400" : "bg-slate-600"}`} />
              <span className="text-sm font-bold text-white">
                {isRunningAll ? `Running query ${runProgress?.done ?? 0} / ${runProgress?.total ?? rows.length}…` :
                 liveCount > 0 ? `${liveCount}/${rows.length} queries updated with live results` :
                 "Run benchmark live against your backend"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isRunningAll
                ? "Calling all 3 pipelines in parallel for each query — real tokens, real latency, real cost, scored against the same hand-written reference."
                : liveCount > 0
                ? "Stats above now reflect fresh live results. Rows marked 🔴 used live data."
                : "Re-runs each query live and re-scores against its hand-written reference — replacing the committed numbers with a fresh run."}
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            {liveCount > 0 && !isRunningAll && (
              <button
                onClick={() => setLiveResults({})}
                className="rounded-lg border border-slate-700 hover:border-red-700/40 bg-slate-800 hover:bg-red-950/20 text-slate-400 hover:text-red-400 px-4 py-2 text-xs font-semibold transition-all"
              >
                Reset
              </button>
            )}
            <button
              onClick={runAll}
              disabled={isRunningAll}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-bold px-5 py-2 text-xs transition-all flex items-center gap-2"
            >
              {isRunningAll ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Running…
                </>
              ) : `⚡ Run All ${rows.length} Live`}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {isRunningAll && runProgress && (
          <div className="rounded-full h-1.5 bg-slate-800 mb-6 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${(runProgress.done / runProgress.total) * 100}%` }}
            />
          </div>
        )}

        {/* DATASET BANNER — sourced live from /api/stats, not hardcoded */}
        {stats && (
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5 mb-10 flex flex-wrap gap-6 justify-center items-center">
            {[
              { label: "Total Tokens", value: `${(stats.estimated_tokens / 1e6).toFixed(0)}M+`, icon: "🧠" },
              { label: "Companies", value: `${stats.companies}`, icon: "🏢" },
              { label: "10-K Filings", value: `${stats.filings}`, icon: "📄" },
              { label: "Text Chunks", value: stats.chunks.toLocaleString(), icon: "🔷" },
              { label: "Years Covered", value: stats.years.length ? `${stats.years[0]}–${stats.years[stats.years.length - 1]}` : "—", icon: "📅" },
              { label: "Sectors", value: `${stats.sectors}`, icon: "🏭" },
            ].map((s) => (
              <div key={s.label} className="text-center min-w-[90px]">
                <div className="text-xl mb-0.5">{s.icon}</div>
                <div className="text-lg font-black text-cyan-300">{s.value}</div>
                <div className="text-xs text-slate-400">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* SUMMARY STATS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          {[
            { label: "Avg Token Reduction", value: `${avgReduction.toFixed(1)}%`, sub: "GraphRAG vs Basic RAG", color: "text-emerald-400" },
            { label: "GraphRAG Judge Pass", value: `${gragPassRate}/${rows.length}`, sub: `vs LLM Only ${llmPassRate}/${rows.length}`, color: "text-cyan-400" },
            { label: "Avg BERTScore (RAG)", value: avgBertRag.toFixed(3), sub: `LLM Only: ${avgBertLlm.toFixed(3)}`, color: "text-violet-400" },
            { label: "Queries Tested", value: `${rows.length}`, sub: `${companies.length - 1} companies · ${categories.length - 1} categories`, color: "text-amber-400" },
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
            {mergedData.map((row) => {
              const llmOnly  = getPipeline(row, "llm_only");
              const basicRag = getPipeline(row, "basic_rag");
              const graphrag = getPipeline(row, "graphrag");
              const max = Math.max(llmOnly.total_tokens, basicRag.total_tokens, graphrag.total_tokens, 1);
              return (
                <div key={row.id} className="grid grid-cols-[1fr_auto] gap-4 items-center">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold ${COMPANY_COLORS[row.company] ?? "text-slate-300"}`}>{row.company}</span>
                      <span className="text-xs text-slate-500 truncate">{row.query.slice(0, 55)}…</span>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <div className="relative h-2 rounded-full bg-slate-800 flex-1">
                        <div className="absolute left-0 top-0 h-2 rounded-full bg-violet-500/60" style={{ width: `${(llmOnly.total_tokens / max) * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 w-12 text-right">{llmOnly.total_tokens}</span>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <div className="relative h-2 rounded-full bg-slate-800 flex-1">
                        <div className="absolute left-0 top-0 h-2 rounded-full bg-blue-500/60" style={{ width: `${(basicRag.total_tokens / max) * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 w-12 text-right">{basicRag.total_tokens}</span>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <div className="relative h-2 rounded-full bg-slate-800 flex-1">
                        <div className="absolute left-0 top-0 h-2 rounded-full bg-emerald-500" style={{ width: `${(graphrag.total_tokens / max) * 100}%` }} />
                      </div>
                      <span className="text-xs text-emerald-400 font-bold w-12 text-right">{graphrag.total_tokens}</span>
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
          <div className="px-6 py-4 border-b border-white/5 flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">Detailed Results</h2>
              <span className="text-xs text-slate-500">({filtered.length}/{rows.length})</span>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {/* Category filter */}
              <div className="flex gap-1 flex-wrap">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFilterCat(c)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      filterCat === c
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : "border-white/10 text-slate-400 hover:text-slate-200"
                    }`}
                  >{c}</button>
                ))}
              </div>
              <div className="w-px h-4 bg-white/10" />
              {/* Company filter */}
              <select
                value={filterCo}
                onChange={(e) => setFilterCo(e.target.value)}
                className="text-xs bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-emerald-500/40"
              >
                {companies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
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

          {filtered.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-500 text-sm">No results match the current filters.</div>
          )}
          {filtered.map((row) => {
            const isLive = !!liveResults[row.id];
            const isThisRunning = runningId === row.id;
            const llmOnly  = getPipeline(row, "llm_only");
            const basicRag = getPipeline(row, "basic_rag");
            const graphrag = getPipeline(row, "graphrag");
            return (
            <div key={row.id}>
              {/* Row */}
              <div className={`w-full grid grid-cols-[32px_1fr_80px_100px_repeat(3,90px)_80px_36px] gap-3 px-6 py-4 border-b border-white/5 hover:bg-slate-800/40 transition-colors items-center ${isLive ? "bg-emerald-950/10" : ""}`}>
                <button onClick={() => setExpanded(expanded === row.id ? null : row.id)} className="contents">
                <span className="text-xs text-slate-600 font-mono flex items-center gap-1">
                  {isLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                  {!isLive && String(row.id).padStart(2,"0")}
                </span>
                <span className="text-sm text-slate-200 truncate pr-2">{row.query}</span>
                <span className={`text-xs font-bold font-mono ${COMPANY_COLORS[row.company] ?? "text-slate-300"}`}>{row.company}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border w-fit ${CATEGORY_COLORS[row.category] ?? "bg-slate-700 text-slate-300"}`}>{row.category}</span>

                {/* LLM Only */}
                <div className="text-center space-y-0.5">
                  <div className="text-xs text-slate-300">{llmOnly.total_tokens} tok</div>
                  <div className={`text-xs font-semibold ${llmOnly.judge_pass ? "text-emerald-400" : "text-red-400"}`}>
                    {llmOnly.judge_pass ? "✓ Pass" : "✗ Fail"}
                  </div>
                </div>

                {/* Basic RAG */}
                <div className="text-center space-y-0.5">
                  <div className="text-xs text-blue-300">{basicRag.total_tokens} tok</div>
                  <div className={`text-xs font-semibold ${basicRag.judge_pass ? "text-emerald-400" : "text-red-400"}`}>
                    {basicRag.judge_pass ? "✓ Pass" : "✗ Fail"}
                  </div>
                </div>

                {/* GraphRAG */}
                <div className="text-center space-y-0.5">
                  <div className="text-xs text-emerald-400 font-bold">{graphrag.total_tokens} tok</div>
                  <div className={`text-xs font-semibold ${graphrag.judge_pass ? "text-emerald-400" : "text-red-400"}`}>
                    {graphrag.judge_pass ? "✓ Pass" : "✗ Fail"}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-black text-emerald-400">{row.token_reduction_pct}%</span>
                </div>
                </button>
                {/* Per-row run button */}
                <button
                  onClick={() => runOne(row)}
                  disabled={isRunningAll || isThisRunning}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-700/50 hover:border-emerald-600/50 hover:bg-emerald-950/30 text-slate-500 hover:text-emerald-400 transition-all disabled:opacity-30"
                  title="Run this query live"
                >
                  {isThisRunning
                    ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                    : <span className="text-[10px]">▶</span>
                  }
                </button>
              </div>

              {/* Expanded detail */}
              {expanded === row.id && (
                <div className="px-6 py-5 bg-slate-800/30 border-b border-white/5">
                  {isLive && (
                    <div className="flex items-center gap-2 mb-4 text-[10px] text-emerald-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> LIVE RESULT
                    </div>
                  )}
                  <div className="mb-4 text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">Reference answer: </span>
                    {row.reference}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "🧠 LLM Only",  data: llmOnly,  color: "border-violet-500/30 bg-violet-500/5" },
                      { label: "🔍 Basic RAG", data: basicRag, color: "border-blue-500/30 bg-blue-500/5" },
                      { label: "🕸️ GraphRAG", data: graphrag,  color: "border-emerald-500/30 bg-emerald-500/5" },
                    ].map(({ label, data, color }) => (
                      <div key={label} className={`rounded-xl border p-4 ${color}`}>
                        <div className="text-sm font-bold text-white mb-3">{label}</div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between"><span className="text-slate-400">Tokens</span><span className="text-white font-mono">{data.total_tokens}</span></div>
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
                          {data.chunks_retrieved > 0 && <div className="flex justify-between"><span className="text-slate-400">Chunks</span><span className="text-white font-mono">{data.chunks_retrieved}</span></div>}
                          {data.graph_hops > 0 && <div className="flex justify-between"><span className="text-slate-400">Graph Hops</span><span className="text-emerald-400 font-mono font-bold">{data.graph_hops}</span></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
        </>
        )}

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
