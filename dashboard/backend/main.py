import sys
import os
import json
import pathlib

# The app resolves data paths (chunks.jsonl, faiss.index, benchmark_results.jsonl)
# relative to the repo root, and imports top-level modules like `config`. Make
# that work regardless of the directory the server was launched from (e.g. a
# preview/supervisor process whose cwd is elsewhere) by anchoring to this file's
# location: dashboard/backend/main.py → repo root is two parents up.
_REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
os.chdir(_REPO_ROOT)
sys.path.insert(0, str(_REPO_ROOT))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dashboard.backend.models import QueryRequest, BenchmarkResponse
from dashboard.backend.runner import init_pipelines, run_all
from ingestion.build_graph import TICKER_NAMES, TICKER_SECTOR
from config import settings

BENCHMARK_RESULTS_PATH = pathlib.Path("data/processed/benchmark_results.jsonl")

app = FastAPI(title="GraphRAG Finance Benchmark API")

# Allow all origins in production (Railway + Vercel + localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_pipelines()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/stats")
def stats():
    """Return real-time dataset statistics."""
    chunks_path  = pathlib.Path(settings.CHUNKS_PATH)
    faiss_path   = pathlib.Path(settings.FAISS_INDEX_PATH)
    chunks_count = 0
    companies    = set()
    years        = set()
    filings      = set()   # distinct (ticker, year) pairs

    if chunks_path.exists():
        with open(chunks_path) as f:
            for line in f:
                try:
                    rec = json.loads(line)
                    chunks_count += 1
                    ticker = rec.get("ticker", "")
                    year   = rec.get("year", "")
                    companies.add(ticker)
                    years.add(year)
                    filings.add((ticker, year))
                except Exception:
                    pass

    sectors = {TICKER_SECTOR[t] for t in companies if t in TICKER_SECTOR}

    return {
        "chunks": chunks_count,
        "companies": len(companies),
        "filings": len(filings),
        "sectors": len(sectors),
        "years": sorted(years),
        "estimated_tokens": chunks_count * 512 * 4 // 3,   # ~683 tokens per chunk
        "faiss_index_exists": faiss_path.exists(),
        "faiss_index_size_mb": round(faiss_path.stat().st_size / 1e6, 1) if faiss_path.exists() else 0,
        "llm_provider": settings.LLM_PROVIDER,
        "model": settings.active_model,
    }


@app.get("/api/companies")
def companies():
    """Return the real list of companies currently loaded in chunks.jsonl."""
    chunks_path = pathlib.Path(settings.CHUNKS_PATH)
    years_by_ticker: dict[str, set[str]] = {}

    if chunks_path.exists():
        with open(chunks_path) as f:
            for line in f:
                try:
                    rec = json.loads(line)
                    ticker = rec.get("ticker", "")
                    year   = rec.get("year", "")
                    if ticker:
                        years_by_ticker.setdefault(ticker, set()).add(year)
                except Exception:
                    pass

    return [
        {
            "ticker": t,
            "name": TICKER_NAMES.get(t, t),
            "sector": TICKER_SECTOR.get(t, "Other"),
            "filings": len(years),
        }
        for t, years in sorted(years_by_ticker.items())
    ]


@app.get("/api/benchmark")
def benchmark():
    """Return the committed offline benchmark results (data/processed/benchmark_results.jsonl)."""
    if not BENCHMARK_RESULTS_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="No benchmark results found — run `python -m evaluation.benchmark` first.",
        )
    rows = []
    with open(BENCHMARK_RESULTS_PATH) as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


@app.post("/api/query", response_model=BenchmarkResponse)
async def run_query(req: QueryRequest) -> BenchmarkResponse:
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    return await run_all(req.query, req.reference_answer)
