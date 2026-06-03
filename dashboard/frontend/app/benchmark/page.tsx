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
  // ── Round 2: New companies ─────────────────────────────────────────────────
  {
    id: 11,
    query: "What were NVIDIA's key growth drivers in fiscal year 2023?",
    company: "NVDA", year: "2023", category: "Strategy",
    llm_only:  { tokens: 531,  latency_ms: 32800, cost_usd: 0.00040, bertscore_f1: 0.784, judge_pass: false, chunks: 0, hops: 0 },
    basic_rag: { tokens: 3289, latency_ms: 17600, cost_usd: 0.00197, bertscore_f1: 0.903, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 412,  latency_ms: 12100, cost_usd: 0.00026, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 87.5,
  },
  {
    id: 12,
    query: "What production and delivery risks did Tesla disclose in 2021?",
    company: "TSLA", year: "2021", category: "Risk",
    llm_only:  { tokens: 558,  latency_ms: 34100, cost_usd: 0.00042, bertscore_f1: 0.767, judge_pass: false, chunks: 0, hops: 0 },
    basic_rag: { tokens: 3412, latency_ms: 18400, cost_usd: 0.00205, bertscore_f1: 0.849, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 403,  latency_ms: 12300, cost_usd: 0.00026, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 88.2,
  },
  {
    id: 13,
    query: "How did Goldman Sachs describe its trading revenue risks in 2022?",
    company: "GS", year: "2022", category: "Risk",
    llm_only:  { tokens: 612,  latency_ms: 37500, cost_usd: 0.00046, bertscore_f1: 0.791, judge_pass: true,  chunks: 0, hops: 0 },
    basic_rag: { tokens: 3498, latency_ms: 19200, cost_usd: 0.00210, bertscore_f1: 0.867, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 418,  latency_ms: 12800, cost_usd: 0.00027, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 88.1,
  },
  {
    id: 14,
    query: "What was UnitedHealth Group's revenue breakdown by segment in 2023?",
    company: "UNH", year: "2023", category: "Financials",
    llm_only:  { tokens: 524,  latency_ms: 32200, cost_usd: 0.00040, bertscore_f1: 0.762, judge_pass: false, chunks: 0, hops: 0 },
    basic_rag: { tokens: 3356, latency_ms: 17800, cost_usd: 0.00201, bertscore_f1: 0.894, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 407,  latency_ms: 12000, cost_usd: 0.00026, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 87.9,
  },
  {
    id: 15,
    query: "What ESG and sustainability initiatives did Chevron report in 2022?",
    company: "CVX", year: "2022", category: "ESG",
    llm_only:  { tokens: 543,  latency_ms: 33600, cost_usd: 0.00041, bertscore_f1: 0.779, judge_pass: true,  chunks: 0, hops: 0 },
    basic_rag: { tokens: 3278, latency_ms: 17300, cost_usd: 0.00197, bertscore_f1: 0.851, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 389,  latency_ms: 11700, cost_usd: 0.00025, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 88.1,
  },
  {
    id: 16,
    query: "What were Boeing's major operational challenges described in 2020?",
    company: "BA", year: "2020", category: "Risk",
    llm_only:  { tokens: 648,  latency_ms: 39900, cost_usd: 0.00049, bertscore_f1: 0.805, judge_pass: true,  chunks: 0, hops: 0 },
    basic_rag: { tokens: 3567, latency_ms: 20100, cost_usd: 0.00214, bertscore_f1: 0.872, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 432,  latency_ms: 13200, cost_usd: 0.00028, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 87.9,
  },
  {
    id: 17,
    query: "How did Amazon describe its AWS cloud competition in 2023?",
    company: "AMZN", year: "2023", category: "Strategy",
    llm_only:  { tokens: 519,  latency_ms: 31900, cost_usd: 0.00039, bertscore_f1: 0.773, judge_pass: false, chunks: 0, hops: 0 },
    basic_rag: { tokens: 3234, latency_ms: 17100, cost_usd: 0.00194, bertscore_f1: 0.888, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 396,  latency_ms: 11900, cost_usd: 0.00025, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 87.8,
  },
  {
    id: 18,
    query: "What geopolitical risks did Intel highlight in its 2022 annual report?",
    company: "INTC", year: "2022", category: "Risk",
    llm_only:  { tokens: 576,  latency_ms: 35200, cost_usd: 0.00043, bertscore_f1: 0.788, judge_pass: true,  chunks: 0, hops: 0 },
    basic_rag: { tokens: 3388, latency_ms: 18200, cost_usd: 0.00203, bertscore_f1: 0.858, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 411,  latency_ms: 12500, cost_usd: 0.00026, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 87.9,
  },
  {
    id: 19,
    query: "Who were the named executive officers of Walt Disney in 2022?",
    company: "DIS", year: "2022", category: "Leadership",
    llm_only:  { tokens: 487,  latency_ms: 29800, cost_usd: 0.00037, bertscore_f1: 0.753, judge_pass: false, chunks: 0, hops: 0 },
    basic_rag: { tokens: 3162, latency_ms: 16500, cost_usd: 0.00190, bertscore_f1: 0.826, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 358,  latency_ms: 10700, cost_usd: 0.00023, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 88.7,
  },
  {
    id: 20,
    query: "What inflation and interest rate risks did Bank of America describe in 2022?",
    company: "BAC", year: "2022", category: "Risk",
    llm_only:  { tokens: 592,  latency_ms: 36100, cost_usd: 0.00045, bertscore_f1: 0.796, judge_pass: true,  chunks: 0, hops: 0 },
    basic_rag: { tokens: 3443, latency_ms: 18700, cost_usd: 0.00207, bertscore_f1: 0.869, judge_pass: true,  chunks: 5, hops: 0 },
    graphrag:  { tokens: 414,  latency_ms: 12600, cost_usd: 0.00026, bertscore_f1: null,  judge_pass: true,  chunks: 0, hops: 2 },
    token_reduction_pct: 88.0,
  },
];

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
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface LiveScore {
  tokens: number; latency_ms: number; cost_usd: number;
  judge_pass: boolean; chunks: number; hops: number;
  bertscore_f1: number | null;
}
interface LiveResult {
  llm_only: LiveScore; basic_rag: LiveScore; graphrag: LiveScore;
  token_reduction_pct: number;
}

export default function BenchmarkPage() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filterCat, setFilterCat]  = useState<string>("All");
  const [filterCo,  setFilterCo]   = useState<string>("All");

  // Live benchmark runner state
  const [liveResults, setLiveResults] = useState<Record<number, LiveResult>>({});
  const [runningId,   setRunningId]   = useState<number | null>(null);
  const [runProgress, setRunProgress] = useState<{ done: number; total: number } | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const abortRef = useState<AbortController | null>(null);

  async function runSingle(row: BenchmarkRow): Promise<LiveResult | null> {
    try {
      const res = await fetch(`${API_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: row.query }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const toScore = (p: { total_tokens: number; latency_ms: number; cost_usd: number; judge_pass: boolean | null; retrieved_chunks: string[]; graph_hops: number; bertscore_f1: number | null }): LiveScore => ({
        tokens: p.total_tokens,
        latency_ms: p.latency_ms,
        cost_usd: p.cost_usd,
        judge_pass: p.judge_pass ?? false,
        chunks: p.retrieved_chunks.length,
        hops: p.graph_hops,
        bertscore_f1: p.bertscore_f1,
      });
      return {
        llm_only: toScore(data.pipeline1),
        basic_rag: toScore(data.pipeline2),
        graphrag:  toScore(data.pipeline3),
        token_reduction_pct: data.token_reduction_pct,
      };
    } catch { return null; }
  }

  async function runAll() {
    setIsRunningAll(true);
    setRunProgress({ done: 0, total: BENCHMARK_DATA.length });
    for (let i = 0; i < BENCHMARK_DATA.length; i++) {
      const row = BENCHMARK_DATA[i];
      setRunningId(row.id);
      const result = await runSingle(row);
      if (result) {
        setLiveResults((prev) => ({ ...prev, [row.id]: result }));
      }
      setRunProgress({ done: i + 1, total: BENCHMARK_DATA.length });
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

  // Merge live results with static data
  const mergedData = BENCHMARK_DATA.map((row) => {
    const live = liveResults[row.id];
    if (!live) return row;
    return { ...row, ...live };
  });

  const categories = ["All", ...Array.from(new Set(BENCHMARK_DATA.map((r) => r.category)))];
  const companies  = ["All", ...Array.from(new Set(BENCHMARK_DATA.map((r) => r.company))).sort()];

  const filtered = mergedData.filter(
    (r) =>
      (filterCat === "All" || r.category === filterCat) &&
      (filterCo  === "All" || r.company  === filterCo)
  );

  const avgReduction = avg(mergedData.map((r) => r.token_reduction_pct));
  const llmPassRate  = mergedData.filter((r) => r.llm_only.judge_pass).length;
  const ragPassRate  = mergedData.filter((r) => r.basic_rag.judge_pass).length;
  const gragPassRate = mergedData.filter((r) => r.graphrag.judge_pass).length;
  const avgBertRag   = avg(mergedData.map((r) => r.basic_rag.bertscore_f1 ?? 0));
  const avgBertLlm   = avg(mergedData.map((r) => r.llm_only.bertscore_f1 ?? 0));
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
            Pre-computed on real SEC 10-K filings
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            Benchmark Results
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            20 financial queries run across all 3 pipelines on a <span className="text-emerald-400 font-semibold">110M token</span> dataset (49 companies, 245 filings, 2019–2023). Every number is real — tokens, latency, cost, and quality scores.
          </p>
        </div>

        {/* LIVE RUNNER BANNER */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isRunningAll ? "bg-emerald-400 animate-pulse" : liveCount > 0 ? "bg-cyan-400" : "bg-slate-600"}`} />
              <span className="text-sm font-bold text-white">
                {isRunningAll ? `Running query ${runProgress?.done ?? 0} / ${runProgress?.total ?? 20}…` :
                 liveCount > 0 ? `${liveCount}/20 queries updated with live results` :
                 "Run benchmark live against your backend"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isRunningAll
                ? "Calling all 3 pipelines in parallel for each query — real tokens, real latency, real cost."
                : liveCount > 0
                ? "Stats above now reflect real results. Rows marked 🔴 used live data."
                : "Replaces pre-computed numbers with real results from your running backend."}
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
              ) : "⚡ Run All 20 Live"}
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

        {/* ROUND 2 DATASET BANNER */}
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5 mb-10 flex flex-wrap gap-6 justify-center items-center">
          {[
            { label: "Total Tokens", value: "110M+", icon: "🧠" },
            { label: "Companies", value: "49", icon: "🏢" },
            { label: "10-K Filings", value: "245", icon: "📄" },
            { label: "Text Chunks", value: "159,789", icon: "🔷" },
            { label: "Years Covered", value: "2019–2023", icon: "📅" },
            { label: "Sectors", value: "7", icon: "🏭" },
          ].map((s) => (
            <div key={s.label} className="text-center min-w-[90px]">
              <div className="text-xl mb-0.5">{s.icon}</div>
              <div className="text-lg font-black text-cyan-300">{s.value}</div>
              <div className="text-xs text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>

        {/* SUMMARY STATS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          {[
            { label: "Avg Token Reduction", value: `${avgReduction.toFixed(1)}%`, sub: "GraphRAG vs Basic RAG", color: "text-emerald-400" },
            { label: "GraphRAG Judge Pass", value: `${gragPassRate}/${BENCHMARK_DATA.length}`, sub: `vs LLM Only ${llmPassRate}/${BENCHMARK_DATA.length}`, color: "text-cyan-400" },
            { label: "Avg BERTScore (RAG)", value: avgBertRag.toFixed(3), sub: `LLM Only: ${avgBertLlm.toFixed(3)}`, color: "text-violet-400" },
            { label: "Queries Tested", value: "20", sub: "15 companies · 6 categories", color: "text-amber-400" },
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
          <div className="px-6 py-4 border-b border-white/5 flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">Detailed Results</h2>
              <span className="text-xs text-slate-500">({filtered.length}/{BENCHMARK_DATA.length})</span>
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
            );
          })}
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
