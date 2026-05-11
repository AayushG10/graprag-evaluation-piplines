"use client";

import { BenchmarkResult, PipelineResult } from "@/app/page";

interface Props { result: BenchmarkResult; }

const PIPELINES = [
  { key: "pipeline1" as const, name: "LLM Only",  icon: "🧠", accent: "text-purple-400" },
  { key: "pipeline2" as const, name: "Basic RAG", icon: "🔍", accent: "text-blue-400" },
  { key: "pipeline3" as const, name: "GraphRAG",  icon: "🕸️", accent: "text-emerald-400" },
];

export default function MetricsTable({ result }: Props) {
  const rows: { label: string; fn: (p: PipelineResult) => string; highlight?: boolean }[] = [
    { label: "Prompt tokens",      fn: p => p.prompt_tokens.toLocaleString() },
    { label: "Completion tokens",  fn: p => p.completion_tokens.toLocaleString() },
    { label: "Total tokens",       fn: p => p.total_tokens.toLocaleString(), highlight: true },
    { label: "Latency (ms)",       fn: p => p.latency_ms.toFixed(0) },
    { label: "Cost (USD)",         fn: p => `$${p.cost_usd.toFixed(6)}`, highlight: true },
    { label: "Graph hops",         fn: p => p.graph_hops > 0 ? String(p.graph_hops) : "—" },
    { label: "Retrieved chunks",   fn: p => String(p.retrieved_chunks.length) },
    { label: "BERTScore F1",       fn: p => p.bertscore_f1 != null ? p.bertscore_f1.toFixed(3) : "—" },
    { label: "LLM Judge",          fn: p => p.judge_pass === null ? "—" : p.judge_pass ? "✓ Pass" : "✗ Fail" },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">Full Metrics Comparison</h2>
        {result.token_reduction_pct > 0 && (
          <span className="rounded-full border border-emerald-700/40 bg-emerald-900/30 text-emerald-400 text-xs font-bold px-3 py-1">
            GraphRAG saves {result.token_reduction_pct}% tokens
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 w-44">Metric</th>
              {PIPELINES.map(p => (
                <th key={p.key} className="px-6 py-3 text-right">
                  <span className={`text-xs font-bold ${p.accent}`}>{p.icon} {p.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.label} className={`border-b border-slate-800/50 transition-colors hover:bg-slate-800/20 ${row.highlight ? "bg-slate-800/10" : ""}`}>
                <td className="px-6 py-3 text-xs text-slate-500 font-medium">{row.label}</td>
                {PIPELINES.map(p => {
                  const pipeline = result[p.key];
                  const value = pipeline.error ? "error" : row.fn(pipeline);
                  const isGraphRAG = p.key === "pipeline3";
                  const isPass = value.includes("Pass");
                  const isFail = value.includes("Fail");
                  return (
                    <td key={p.key} className="px-6 py-3 text-right font-mono text-xs">
                      <span className={
                        isPass ? "text-emerald-400 font-bold" :
                        isFail ? "text-red-400" :
                        value === "error" ? "text-red-500" :
                        isGraphRAG && row.highlight ? "text-emerald-400 font-bold" :
                        "text-slate-300"
                      }>
                        {value}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 border-t border-slate-800 flex flex-wrap gap-4 text-[10px] text-slate-600">
        <span>Tokens measured from OpenRouter API response</span>
        <span>·</span>
        <span>Cost estimated from model pricing table</span>
        <span>·</span>
        <span>Latency = end-to-end wall time including retrieval</span>
      </div>
    </div>
  );
}
