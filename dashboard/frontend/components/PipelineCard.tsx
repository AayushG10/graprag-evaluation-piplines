"use client";

import { PipelineResult } from "@/app/page";

const META: Record<string, { title: string; icon: string; badge: string; accent: string; topGlow: string; ring: string }> = {
  llm_only: {
    title: "LLM Only",  icon: "🧠",
    badge:   "border-purple-700/40 bg-purple-900/30 text-purple-300",
    accent:  "text-purple-400",
    topGlow: "",
    ring:    "border-slate-800",
  },
  basic_rag: {
    title: "Basic RAG", icon: "🔍",
    badge:   "border-blue-700/40 bg-blue-900/30 text-blue-300",
    accent:  "text-blue-400",
    topGlow: "",
    ring:    "border-slate-800",
  },
  graphrag: {
    title: "GraphRAG",  icon: "🕸️",
    badge:   "border-emerald-700/40 bg-emerald-900/30 text-emerald-300",
    accent:  "text-emerald-400",
    topGlow: "bg-gradient-to-r from-transparent via-emerald-500 to-transparent",
    ring:    "border-emerald-700/50 ring-1 ring-emerald-700/20",
  },
};

interface Props {
  data: PipelineResult;
  label: string;
  highlight?: boolean;
}

export default function PipelineCard({ data, label, highlight }: Props) {
  const m = META[data.pipeline_name] ?? {
    title: data.pipeline_name, icon: "⚙️",
    badge: "border-slate-700 bg-slate-800 text-slate-300",
    accent: "text-slate-400", topGlow: "", ring: "border-slate-800",
  };

  return (
    <div className={`relative rounded-2xl border bg-slate-900/70 backdrop-blur-sm flex flex-col h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-xl ${m.ring}`}>
      {/* Top accent line */}
      {highlight && <div className={`absolute top-0 left-0 right-0 h-px ${m.topGlow}`} />}

      <div className="p-5 space-y-4 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{m.icon}</span>
            <span className={`rounded-full border text-xs font-semibold px-2.5 py-0.5 ${m.badge}`}>{m.title}</span>
            {highlight && <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5">WINNER</span>}
          </div>
          <span className="text-[10px] text-slate-600 font-mono">{label}</span>
        </div>

        {/* Answer / Error */}
        {data.error ? (
          <div className="flex-1 rounded-xl border border-red-800/30 bg-red-950/20 p-3">
            <p className="text-xs text-red-400 break-words leading-relaxed">{data.error}</p>
          </div>
        ) : (
          <p className="flex-1 text-sm text-slate-300 leading-relaxed line-clamp-[11] min-h-[120px]">
            {data.answer}
          </p>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Tokens" value={data.total_tokens.toLocaleString()} accent={m.accent} />
          <Stat label="Latency" value={`${Math.round(data.latency_ms)} ms`} />
          <Stat label="Cost" value={`$${data.cost_usd.toFixed(5)}`} />
          {data.graph_hops > 0
            ? <Stat label="Graph hops" value={`${data.graph_hops} hops`} accent={m.accent} />
            : <Stat label="Chunks" value={`${data.retrieved_chunks.length} chunks`} />
          }
        </div>

        {/* Eval badges */}
        {(data.judge_pass !== null || data.bertscore_f1 !== null) && (
          <div className="flex items-center gap-2 flex-wrap">
            {data.judge_pass !== null && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                data.judge_pass
                  ? "bg-emerald-950/50 text-emerald-400 border-emerald-800/40"
                  : "bg-red-950/50 text-red-400 border-red-800/40"
              }`}>
                {data.judge_pass ? "✓ Judge Pass" : "✗ Judge Fail"}
              </span>
            )}
            {data.bertscore_f1 !== null && (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium border bg-slate-800/60 text-slate-400 border-slate-700/40">
                BERT F1 {data.bertscore_f1.toFixed(3)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-700/30 px-3 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${accent ?? "text-slate-200"}`}>{value}</p>
    </div>
  );
}
