"use client";

import { useEffect, useRef, useState } from "react";
import type { BenchmarkResult } from "@/app/page";

// ── Animated number counter ───────────────────────────────────────────────────
function AnimatedNumber({
  target,
  duration = 1200,
  className,
  prefix = "",
  suffix = "",
}: {
  target: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = prevRef.current;
    const end = target;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = end;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return (
    <span className={className}>
      {prefix}{display.toLocaleString()}{suffix}
    </span>
  );
}

// ── Animated token bar ─────────────────────────────────────────────────────────
function TokenBar({
  label,
  icon,
  tokens,
  maxTokens,
  color,
  bgColor,
  delay = 0,
  isWinner = false,
}: {
  label: string;
  icon: string;
  tokens: number;
  maxTokens: number;
  color: string;
  bgColor: string;
  delay?: number;
  isWinner?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const pct = maxTokens > 0 ? (tokens / maxTokens) * 100 : 0;

  useEffect(() => {
    setWidth(0);
    const t = setTimeout(() => setWidth(pct), delay + 100);
    return () => clearTimeout(t);
  }, [pct, delay]);

  return (
    <div className="flex items-center gap-3 group">
      {/* Label */}
      <div className="w-24 shrink-0 text-right">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{icon} {label}</span>
      </div>

      {/* Bar track */}
      <div className="flex-1 h-8 bg-slate-800/60 rounded-lg overflow-hidden relative border border-slate-700/30">
        {/* Animated fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-lg flex items-center transition-all ease-out"
          style={{
            width: `${width}%`,
            backgroundColor: bgColor,
            borderRight: `2px solid ${color}`,
            transitionDuration: "1100ms",
          }}
        />
        {/* Token count label */}
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-extrabold font-mono z-10"
          style={{ color }}
        >
          {tokens.toLocaleString()}
        </span>
        {isWinner && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-extrabold text-emerald-400 tracking-widest z-10">
            WINNER ✓
          </span>
        )}
      </div>

      {/* Percentage label */}
      <div className="w-12 shrink-0 text-left">
        <span className="text-[10px] text-slate-600 font-mono">{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  current: BenchmarkResult;
  history: BenchmarkResult[];
}

export default function TokenSavings({ current, history }: Props) {
  const p1 = current.pipeline1;
  const p2 = current.pipeline2;
  const p3 = current.pipeline3;

  const maxTokens = Math.max(p1.total_tokens, p2.total_tokens, p3.total_tokens, 1);
  const savedVsRag = Math.max(0, p2.total_tokens - p3.total_tokens);
  const savedVsLlm = Math.max(0, p1.total_tokens - p3.total_tokens);
  const pctSaved = p2.total_tokens > 0
    ? Math.round((savedVsRag / p2.total_tokens) * 100)
    : 0;
  const costSaved = Math.max(0, p2.cost_usd - p3.cost_usd);

  // Session totals
  const sessionSaved = history.reduce((acc, r) => {
    return acc + Math.max(0, r.pipeline2.total_tokens - r.pipeline3.total_tokens);
  }, 0);
  const sessionCostSaved = history.reduce((acc, r) => {
    return acc + Math.max(0, r.pipeline2.cost_usd - r.pipeline3.cost_usd);
  }, 0);
  const queryCount = history.length;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-sm overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800/60 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-extrabold tracking-widest text-emerald-400 uppercase">Token Savings Dashboard</span>
        </div>
        {queryCount > 0 && (
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span className="font-mono">{queryCount} quer{queryCount === 1 ? "y" : "ies"} this session</span>
            <span>·</span>
            <span className="text-emerald-400 font-bold">
              {sessionSaved.toLocaleString()} tokens saved
            </span>
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">

        {/* ── Big three counters ────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {/* LLM Only */}
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/30 p-4 text-center space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-purple-400">🧠 LLM Only</p>
            <AnimatedNumber
              target={p1.total_tokens}
              className="block text-3xl font-black text-purple-300 font-mono"
              duration={1000}
            />
            <p className="text-[9px] text-slate-600 font-medium">tokens</p>
            <p className="text-[9px] text-slate-500 font-mono">${p1.cost_usd.toFixed(5)}</p>
          </div>

          {/* Basic RAG */}
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/30 p-4 text-center space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">🔍 Basic RAG</p>
            <AnimatedNumber
              target={p2.total_tokens}
              className="block text-3xl font-black text-blue-300 font-mono"
              duration={1100}
            />
            <p className="text-[9px] text-slate-600 font-medium">tokens</p>
            <p className="text-[9px] text-slate-500 font-mono">${p2.cost_usd.toFixed(5)}</p>
          </div>

          {/* GraphRAG — winner */}
          <div className="rounded-xl bg-emerald-950/30 border border-emerald-700/40 p-4 text-center space-y-1 relative overflow-hidden">
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 relative z-10">🕸 GraphRAG</p>
            <AnimatedNumber
              target={p3.total_tokens}
              className="block text-3xl font-black text-emerald-300 font-mono relative z-10"
              duration={1200}
            />
            <p className="text-[9px] text-slate-600 font-medium relative z-10">tokens</p>
            <p className="text-[9px] text-slate-500 font-mono relative z-10">${p3.cost_usd.toFixed(5)}</p>
          </div>
        </div>

        {/* ── Bar chart ─────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Token Usage Comparison — Current Query</p>
          <div className="space-y-2.5">
            <TokenBar
              label="LLM Only"  icon="🧠"
              tokens={p1.total_tokens} maxTokens={maxTokens}
              color="#c084fc" bgColor="#c084fc18"
              delay={0}
            />
            <TokenBar
              label="Basic RAG" icon="🔍"
              tokens={p2.total_tokens} maxTokens={maxTokens}
              color="#60a5fa" bgColor="#60a5fa18"
              delay={150}
            />
            <TokenBar
              label="GraphRAG"  icon="🕸"
              tokens={p3.total_tokens} maxTokens={maxTokens}
              color="#34d399" bgColor="#34d39918"
              delay={300}
              isWinner
            />
          </div>
        </div>

        {/* ── Savings callout ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* vs Basic RAG */}
          <div className="rounded-xl bg-emerald-950/40 border border-emerald-800/40 p-4 flex items-center gap-4">
            <div className="shrink-0 w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <span className="text-emerald-400 text-lg font-black">{pctSaved}%</span>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-300">vs Basic RAG</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Saved{" "}
                <span className="text-emerald-400 font-bold font-mono">
                  <AnimatedNumber target={savedVsRag} duration={1300} />
                </span>{" "}
                tokens
                {costSaved > 0 && (
                  <span className="text-slate-500"> = ${costSaved.toFixed(5)}</span>
                )}
              </p>
            </div>
          </div>

          {/* vs LLM Only */}
          <div className="rounded-xl bg-purple-950/30 border border-purple-800/30 p-4 flex items-center gap-4">
            <div className="shrink-0 w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <span className="text-purple-400 text-lg font-black">
                {p1.total_tokens > 0 ? Math.round((savedVsLlm / p1.total_tokens) * 100) : 0}%
              </span>
            </div>
            <div>
              <p className="text-xs font-bold text-purple-300">vs LLM Only</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Saved{" "}
                <span className="text-purple-400 font-bold font-mono">
                  <AnimatedNumber target={Math.max(0, savedVsLlm)} duration={1400} />
                </span>{" "}
                tokens
              </p>
            </div>
          </div>
        </div>

        {/* ── Session running total ─────────────────────────────────────────── */}
        {queryCount > 1 && (
          <div className="rounded-xl border border-cyan-800/30 bg-cyan-950/20 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-cyan-400 text-sm">⚡</span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400">Session Total</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <div>
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Queries</span>
                <p className="text-sm font-black text-white font-mono">{queryCount}</p>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Total Tokens Saved</span>
                <p className="text-sm font-black text-emerald-400 font-mono">
                  <AnimatedNumber target={sessionSaved} duration={800} />
                </p>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Cost Saved</span>
                <p className="text-sm font-black text-emerald-400 font-mono">
                  ${sessionCostSaved.toFixed(5)}
                </p>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Avg Reduction</span>
                <p className="text-sm font-black text-cyan-400 font-mono">
                  {Math.round(
                    history.reduce((acc, r) => {
                      const saved = r.pipeline2.total_tokens > 0
                        ? ((r.pipeline2.total_tokens - r.pipeline3.total_tokens) / r.pipeline2.total_tokens) * 100
                        : 0;
                      return acc + saved;
                    }, 0) / queryCount
                  )}%
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
