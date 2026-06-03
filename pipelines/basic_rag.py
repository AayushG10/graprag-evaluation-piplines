"""Pipeline 2: FAISS vector retrieval + LLM synthesis with metadata pre-filtering."""

import json
import re
import time
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from openai import OpenAI
from pipelines.base import BasePipeline, PipelineResult
from config import settings

_SYSTEM = (
    "You are a senior financial analyst. Use ONLY the provided context excerpts "
    "from SEC 10-K filings to answer the question. Cite company and year when relevant. "
    "If the answer is not clearly in the context, say what was found and note the limitations. "
    "Do not hallucinate facts not present in the context."
)

# Company name → ticker (for query parsing)
_COMPANY_TICKERS = {
    "apple": "AAPL", "microsoft": "MSFT", "google": "GOOGL", "alphabet": "GOOGL",
    "amazon": "AMZN", "meta": "META", "nvidia": "NVDA", "tesla": "TSLA",
    "intel": "INTC", "oracle": "ORCL", "amd": "AMD",
    "jpmorgan": "JPM", "jp morgan": "JPM", "bank of america": "BAC",
    "wells fargo": "WFC", "goldman": "GS", "morgan stanley": "MS",
    "citigroup": "C", "citi": "C", "american express": "AXP",
    "blackrock": "BLK", "schwab": "SCHW", "us bancorp": "USB",
    "johnson": "JNJ", "pfizer": "PFE", "merck": "MRK",
    "abbvie": "ABBV", "unitedhealth": "UNH", "cvs": "CVS",
    "bristol": "BMY", "amgen": "AMGN",
    "exxon": "XOM", "chevron": "CVX", "conocophillips": "COP",
    "schlumberger": "SLB", "phillips 66": "PSX", "valero": "VLO",
    "marathon petroleum": "MPC",
    "walmart": "WMT", "target": "TGT", "home depot": "HD",
    "costco": "COST", "mcdonald": "MCD", "starbucks": "SBUX", "nike": "NKE",
    "caterpillar": "CAT", "honeywell": "HON", "general electric": "GE",
    "boeing": "BA", "3m": "MMM",
    "at&t": "T", "verizon": "VZ", "disney": "DIS",
}
_YEAR_RE = re.compile(r"\b(201[0-9]|202[0-9])\b")


def _parse_query_metadata(query: str) -> tuple[str | None, str | None]:
    """Extract ticker and year from the query string."""
    lower = query.lower()
    ticker = next((v for k, v in _COMPANY_TICKERS.items() if k in lower), None)
    year_match = _YEAR_RE.search(query)
    year = year_match.group(0) if year_match else None
    return ticker, year


class BasicRAGPipeline(BasePipeline):
    name = "basic_rag"

    def __init__(self) -> None:
        self.embedder = SentenceTransformer(settings.EMBED_MODEL)
        self.index = faiss.read_index(settings.FAISS_INDEX_PATH)
        with open(settings.CHUNKS_PATH) as f:
            self.chunks = [json.loads(line) for line in f]

        # Build reverse-lookup: list of chunk indices per (ticker, year)
        self._ticker_year_idx: dict[tuple[str, str], list[int]] = {}
        self._ticker_idx: dict[str, list[int]] = {}
        for i, chunk in enumerate(self.chunks):
            t, y = chunk.get("ticker", ""), chunk.get("year", "")
            self._ticker_year_idx.setdefault((t, y), []).append(i)
            self._ticker_idx.setdefault(t, []).append(i)

        self.client = OpenAI(
            api_key=settings.active_api_key,
            base_url=settings.active_base_url,
        )

    def _retrieve(self, query: str) -> list[str]:
        """
        Retrieve TOP_K chunks using a two-stage approach:
        1. If a ticker (and optionally year) is detected, first search within
           that company's chunks using FAISS sub-index re-ranking, then fall
           back to global search if results are insufficient.
        2. Otherwise, do a plain global FAISS search with larger TOP_K.
        """
        top_k = max(settings.TOP_K, 8)   # use at least 8 chunks
        ticker, year = _parse_query_metadata(query)

        # ── Stage 1: company-scoped retrieval (when ticker detected) ──────────
        if ticker:
            # Get candidate indices for this company (filter by year if specified)
            if year:
                candidates = self._ticker_year_idx.get((ticker, year), [])
                if len(candidates) < top_k:
                    # Expand to all years for this company
                    candidates = self._ticker_idx.get(ticker, [])
            else:
                candidates = self._ticker_idx.get(ticker, [])

            if candidates:
                # Embed query and compute cosine similarity against company's vectors
                vec = self.embedder.encode([query], normalize_embeddings=True).astype("float32")

                # Extract the sub-matrix from FAISS via reconstruct()
                try:
                    sub_vecs = np.array(
                        [self.index.reconstruct(int(i)) for i in candidates[:3000]],
                        dtype="float32"
                    )
                    # Cosine similarity (vectors are already normalized)
                    scores = sub_vecs @ vec[0]
                    top_positions = np.argsort(-scores)[:top_k]
                    company_chunks = [
                        self.chunks[candidates[int(pos)]]["text"]
                        for pos in top_positions
                        if candidates[int(pos)] < len(self.chunks)
                    ]
                    if company_chunks:
                        return company_chunks
                except Exception:
                    pass   # fall through to global search

        # ── Stage 2: global FAISS search ─────────────────────────────────────
        vec = self.embedder.encode([query], normalize_embeddings=True)
        _, indices = self.index.search(np.array(vec, dtype="float32"), top_k * 3)
        seen_sources: set[str] = set()
        results = []
        for i in indices[0]:
            if not (0 <= i < len(self.chunks)):
                continue
            chunk = self.chunks[i]
            # Deduplicate by source to avoid all results from same filing
            src = chunk.get("source", "")
            if src not in seen_sources or len(results) < top_k // 2:
                results.append(chunk["text"])
                seen_sources.add(src)
            if len(results) >= top_k:
                break
        return results

    def run(self, query: str) -> PipelineResult:
        t0 = time.monotonic()
        try:
            chunks = self._retrieve(query)
            context = "\n\n---\n\n".join(chunks)
            user_msg = f"Context from SEC 10-K filings:\n{context}\n\nQuestion: {query}"
            resp = self.client.chat.completions.create(
                model=settings.active_model,
                messages=[
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": user_msg},
                ],
            )
            latency_ms = (time.monotonic() - t0) * 1000
            usage = resp.usage
            return PipelineResult(
                pipeline_name=self.name,
                answer=resp.choices[0].message.content or "",
                prompt_tokens=usage.prompt_tokens,
                completion_tokens=usage.completion_tokens,
                total_tokens=usage.total_tokens,
                latency_ms=latency_ms,
                cost_usd=self._estimate_cost(
                    settings.active_model,
                    usage.prompt_tokens,
                    usage.completion_tokens,
                ),
                retrieved_chunks=chunks,
            )
        except Exception as exc:
            return PipelineResult(
                pipeline_name=self.name,
                answer="",
                error=str(exc),
                latency_ms=(time.monotonic() - t0) * 1000,
            )
