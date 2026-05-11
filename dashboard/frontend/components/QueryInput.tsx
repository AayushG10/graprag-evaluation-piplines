"use client";

import { useState } from "react";

const SAMPLE_QUERIES = [
  "What were Apple's main risk factors in 2022?",
  "What impact did COVID-19 have on Microsoft's business in 2020?",
  "What are the main risks ExxonMobil faces?",
  "Who are JPMorgan's key executives?",
];

interface Props {
  onSubmit: (query: string) => void;
  loading: boolean;
}

export default function QueryInput({ onSubmit, loading }: Props) {
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) onSubmit(query.trim());
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-4 text-gray-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a financial question — e.g. What were Apple's risk factors in 2022?"
          disabled={loading}
          className="w-full rounded-xl border border-gray-700 bg-gray-900 pl-10 pr-32 py-4 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50 transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-950 font-semibold px-5 py-2 text-sm transition-colors"
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

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-600">Try:</span>
        {SAMPLE_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => setQuery(q)}
            disabled={loading}
            className="rounded-full border border-gray-700/60 bg-gray-900/60 hover:border-emerald-700/60 hover:bg-emerald-900/20 hover:text-emerald-300 px-3 py-1 text-xs text-gray-400 transition-colors disabled:opacity-40"
          >
            {q.length > 48 ? q.slice(0, 48) + "…" : q}
          </button>
        ))}
      </div>
    </div>
  );
}
