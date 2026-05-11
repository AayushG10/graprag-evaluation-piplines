from pydantic import BaseModel
from typing import Optional


class QueryRequest(BaseModel):
    query: str
    reference_answer: Optional[str] = None


class PipelineResponse(BaseModel):
    pipeline_name: str
    answer: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    latency_ms: float
    cost_usd: float
    retrieved_chunks: list[str]
    graph_hops: int
    bertscore_f1: Optional[float] = None
    judge_pass: Optional[bool] = None
    judge_reason: Optional[str] = None
    error: Optional[str] = None


class BenchmarkResponse(BaseModel):
    query: str
    pipeline1: PipelineResponse   # llm_only
    pipeline2: PipelineResponse   # basic_rag
    pipeline3: PipelineResponse   # graphrag
    token_reduction_pct: float    # % fewer tokens: graphrag vs basic_rag
