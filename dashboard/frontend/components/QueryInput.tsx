"use client";

import { useState } from "react";

const CATEGORIES = [
  {
    label: "Single Company",
    icon: "🏢",
    color: "text-blue-400 border-blue-700/40 bg-blue-900/20 hover:border-blue-500/60",
    active: "border-blue-500 bg-blue-900/40 text-blue-300",
    queries: [
      "What were Apple's main risk factors in 2022?",
      "What were NVIDIA's key risk factors in 2023?",
      "How did Tesla describe its competition risks in 2022?",
      "What were Goldman Sachs's main regulatory risks in 2021?",
      "What cybersecurity risks did Microsoft report in 2022?",
      "Who are JPMorgan's key executives?",
    ],
  },
  {
    label: "Cross-Company",
    icon: "🔗",
    color: "text-purple-400 border-purple-700/40 bg-purple-900/20 hover:border-purple-500/60",
    active: "border-purple-500 bg-purple-900/40 text-purple-300",
    queries: [
      "Which S&P 500 companies share supply chain risks with Apple?",
      "Compare inflation risk exposure between JPMorgan and Goldman Sachs",
      "Which tech companies reported cybersecurity risks in 2022?",
      "Compare regulatory risks between Pfizer and Johnson & Johnson",
      "Which energy companies face the most climate regulation risk?",
    ],
  },
  {
    label: "Sector",
    icon: "🏭",
    color: "text-amber-400 border-amber-700/40 bg-amber-900/20 hover:border-amber-500/60",
    active: "border-amber-500 bg-amber-900/40 text-amber-300",
    queries: [
      "What risks are common across technology sector companies?",
      "How do finance sector companies describe interest rate risks?",
      "What are the main risks in the healthcare sector?",
      "Compare risk profiles across energy sector companies",
    ],
  },
  {
    label: "Trend (YoY)",
    icon: "📈",
    color: "text-emerald-400 border-emerald-700/40 bg-emerald-900/20 hover:border-emerald-500/60",
    active: "border-emerald-500 bg-emerald-900/40 text-emerald-300",
    queries: [
      "How did Apple's supply chain risk evolve from 2019 to 2023?",
      "How did Microsoft's cloud business grow from 2019 to 2023?",
      "How did COVID-19 impact JPMorgan's 2020 annual report?",
      "How did ExxonMobil's climate risk disclosures change over 5 years?",
    ],
  },
];

interface Props {
  onSubmit: (query: string) => void;
  loading: boolean;
}

export default function QueryInput({ onSubmit, loading }: Props) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) onSubmit(query.trim());
  }

  const cat = CATEGORIES[activeCategory];

  return (
    <div className="space-y-4">
      {/* Input */}
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-4 text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about any S&P 500 company — risk factors, executives, financials, 2019–2023…"
          disabled={loading}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-10 pr-32 py-4 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50 transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-semibold px-5 py-2 text-sm transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Running
            </span>
          ) : "Run →"}
        </button>
      </form>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((c, i) => (
          <button
            key={c.label}
            onClick={() => setActiveCategory(i)}
            disabled={loading}
            className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-all disabled:opacity-40 ${
              activeCategory === i ? c.active + " border-opacity-100" : c.color
            }`}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Query chips */}
      <div className="flex flex-wrap gap-2">
        {cat.queries.map((q) => (
          <button
            key={q}
            onClick={() => { setQuery(q); }}
            disabled={loading}
            className={`rounded-full border px-3 py-1 text-[11px] transition-all disabled:opacity-40 ${cat.color}`}
          >
            {q.length > 52 ? q.slice(0, 51) + "…" : q}
          </button>
        ))}
      </div>
    </div>
  );
}
