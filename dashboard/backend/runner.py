"""Run all 3 pipelines concurrently and return unified results."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from pipelines.llm_only import LLMOnlyPipeline
from pipelines.basic_rag import BasicRAGPipeline
from pipelines.graphrag import GraphRAGPipeline
from pipelines.base import PipelineResult
from dashboard.backend.models import BenchmarkResponse, PipelineResponse

_executor = ThreadPoolExecutor(max_workers=6)
_llm_only: LLMOnlyPipeline | None = None
_basic_rag: BasicRAGPipeline | None = None
_graphrag:  GraphRAGPipeline | None = None


def init_pipelines() -> None:
    global _llm_only, _basic_rag, _graphrag
    print("Initialising pipelines...")

    try:
        _llm_only = LLMOnlyPipeline()
        print("  ✅ LLM Only pipeline ready")
    except Exception as exc:
        print(f"  ⚠ LLM Only pipeline failed to init: {exc}")

    try:
        _basic_rag = BasicRAGPipeline()
        print("  ✅ Basic RAG pipeline ready")
    except Exception as exc:
        print(f"  ⚠ Basic RAG pipeline failed to init (FAISS index may not exist yet): {exc}")

    try:
        _graphrag = GraphRAGPipeline()
        print("  ✅ GraphRAG pipeline ready")
    except Exception as exc:
        print(f"  ⚠ GraphRAG pipeline failed to init: {exc}")

    ready = sum(p is not None for p in [_llm_only, _basic_rag, _graphrag])
    print(f"✅ {ready}/3 pipelines ready")


def _score_pipeline(
    r: PipelineResult,
    query: str,
    reference: Optional[str],
) -> PipelineResult:
    """Attach BERTScore + LLM judge. Uses reference if given, otherwise no-reference judge."""
    if r.error or not r.answer.strip():
        return r
    try:
        from evaluation.bert_score import compute_bertscore
        from evaluation.llm_judge import llm_judge

        # BERTScore only makes sense with a reference string
        if reference and reference.strip():
            r.bertscore_f1 = compute_bertscore(r.answer, reference)

        # LLM judge works with or without reference
        r.judge_pass, r.judge_reason = llm_judge(query, r.answer, reference)
    except Exception as exc:
        r.judge_reason = f"Eval error: {exc}"
    return r


def _to_response(r: PipelineResult) -> PipelineResponse:
    return PipelineResponse(
        pipeline_name=r.pipeline_name,
        answer=r.answer,
        prompt_tokens=r.prompt_tokens,
        completion_tokens=r.completion_tokens,
        total_tokens=r.total_tokens,
        latency_ms=round(r.latency_ms, 1),
        cost_usd=round(r.cost_usd, 6),
        retrieved_chunks=r.retrieved_chunks,
        graph_hops=r.graph_hops,
        graph_data=r.graph_data,
        bertscore_f1=r.bertscore_f1,
        judge_pass=r.judge_pass,
        judge_reason=r.judge_reason,
        error=r.error,
    )


def _safe_run(pipeline, query: str) -> PipelineResult:
    """Run a pipeline, returning an error result if the pipeline is None or throws."""
    if pipeline is None:
        return PipelineResult(
            pipeline_name="unknown",
            answer="",
            error="Pipeline not initialized (check server logs)",
        )
    return pipeline.run(query)


async def run_all(query: str, reference: Optional[str] = None) -> BenchmarkResponse:
    loop = asyncio.get_running_loop()

    # Run all 3 pipelines in parallel
    p1, p2, p3 = await asyncio.gather(
        loop.run_in_executor(_executor, _safe_run, _llm_only, query),
        loop.run_in_executor(_executor, _safe_run, _basic_rag, query),
        loop.run_in_executor(_executor, _safe_run, _graphrag,  query),
    )

    # Determine reference for scoring:
    # - Explicit reference from user takes priority
    # - Otherwise use GraphRAG's answer as the grounded reference for BERTScore
    #   (GraphRAG pulls from structured graph data, so it's the most grounded answer)
    graphrag_as_ref = p3.answer if not p3.error and p3.answer.strip() else None
    ref_for_p1_p2 = reference or graphrag_as_ref
    ref_for_p3 = reference  # GraphRAG scores against explicit reference only (or no-ref judge)

    # Run evaluation in parallel
    p1, p2, p3 = await asyncio.gather(
        loop.run_in_executor(_executor, _score_pipeline, p1, query, ref_for_p1_p2),
        loop.run_in_executor(_executor, _score_pipeline, p2, query, ref_for_p1_p2),
        loop.run_in_executor(_executor, _score_pipeline, p3, query, ref_for_p3),
    )

    # Token reduction: graphrag vs basic_rag
    reduction = 0.0
    if p2.total_tokens > 0 and not p3.error:
        reduction = round((1 - p3.total_tokens / p2.total_tokens) * 100, 1)

    return BenchmarkResponse(
        query=query,
        pipeline1=_to_response(p1),
        pipeline2=_to_response(p2),
        pipeline3=_to_response(p3),
        token_reduction_pct=reduction,
    )
