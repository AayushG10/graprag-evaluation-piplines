import sys
sys.path.insert(0, ".")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dashboard.backend.models import QueryRequest, BenchmarkResponse
from dashboard.backend.runner import init_pipelines, run_all

app = FastAPI(title="GraphRAG Finance Benchmark API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_pipelines()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/query", response_model=BenchmarkResponse)
async def run_query(req: QueryRequest) -> BenchmarkResponse:
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    return await run_all(req.query, req.reference_answer)
