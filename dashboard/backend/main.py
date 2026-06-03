import sys
import os
import pathlib
sys.path.insert(0, ".")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dashboard.backend.models import QueryRequest, BenchmarkResponse
from dashboard.backend.runner import init_pipelines, run_all
from config import settings

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

    if chunks_path.exists():
        import json
        with open(chunks_path) as f:
            for line in f:
                try:
                    rec = json.loads(line)
                    chunks_count += 1
                    companies.add(rec.get("ticker", ""))
                    years.add(rec.get("year", ""))
                except Exception:
                    pass

    return {
        "chunks": chunks_count,
        "companies": len(companies),
        "years": sorted(years),
        "estimated_tokens": chunks_count * 512 * 4 // 3,   # ~683 tokens per chunk
        "faiss_index_exists": faiss_path.exists(),
        "faiss_index_size_mb": round(faiss_path.stat().st_size / 1e6, 1) if faiss_path.exists() else 0,
        "llm_provider": settings.LLM_PROVIDER,
        "model": settings.active_model,
    }


@app.post("/api/query", response_model=BenchmarkResponse)
async def run_query(req: QueryRequest) -> BenchmarkResponse:
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    return await run_all(req.query, req.reference_answer)
