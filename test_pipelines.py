"""
Quick test for Pipeline 1 (LLM Only) and Pipeline 2 (Basic RAG).

Run AFTER:
  1. cp .env.example .env  (fill in OPENROUTER_API_KEY)
  2. pip install -r requirements.txt
  3. bash scripts/run_pipeline.sh   (to build chunks.jsonl + faiss.index)

Usage:
  python test_pipelines.py
  python test_pipelines.py --query "What were Apple's main risks in 2022?"
"""

import argparse
import json
from dataclasses import asdict

TEST_QUERIES = [
    "What were Apple's main risk factors in 2022?",
    "How did JPMorgan describe interest rate risk in 2023?",
    "What impact did COVID-19 have on Microsoft's business in 2020?",
]


def print_result(result) -> None:
    print(f"\n{'='*60}")
    print(f"Pipeline : {result.pipeline_name.upper()}")
    print(f"{'='*60}")
    if result.error:
        print(f"ERROR: {result.error}")
        return
    print(f"Answer   : {result.answer[:500]}{'...' if len(result.answer) > 500 else ''}")
    print(f"\nMetrics:")
    print(f"  Prompt tokens     : {result.prompt_tokens:,}")
    print(f"  Completion tokens : {result.completion_tokens:,}")
    print(f"  Total tokens      : {result.total_tokens:,}")
    print(f"  Latency           : {result.latency_ms:.0f} ms")
    print(f"  Cost              : ${result.cost_usd:.6f}")
    if result.retrieved_chunks:
        print(f"  Chunks retrieved  : {len(result.retrieved_chunks)}")


def run_test(query: str) -> None:
    print(f"\n\nQUERY: {query}")

    # ── Pipeline 1: LLM Only ──────────────────────────────────────────────
    print("\n[1/2] Running Pipeline 1 — LLM Only...")
    from pipelines.llm_only import LLMOnlyPipeline
    p1 = LLMOnlyPipeline()
    r1 = p1.run(query)
    print_result(r1)

    # ── Pipeline 2: Basic RAG ─────────────────────────────────────────────
    print("\n[2/2] Running Pipeline 2 — Basic RAG...")
    from pipelines.basic_rag import BasicRAGPipeline
    p2 = BasicRAGPipeline()
    r2 = p2.run(query)
    print_result(r2)

    # ── Token comparison ──────────────────────────────────────────────────
    if not r1.error and not r2.error:
        print(f"\n{'='*60}")
        print("TOKEN COMPARISON")
        print(f"{'='*60}")
        print(f"  LLM Only   : {r1.total_tokens:,} tokens  |  ${r1.cost_usd:.6f}")
        print(f"  Basic RAG  : {r2.total_tokens:,} tokens  |  ${r2.cost_usd:.6f}")
        diff = r2.total_tokens - r1.total_tokens
        print(f"  RAG overhead: +{diff:,} tokens (context added by retrieval)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", type=str, default=None,
                        help="Custom query to test (default: runs 3 preset queries)")
    args = parser.parse_args()

    queries = [args.query] if args.query else TEST_QUERIES

    for q in queries:
        run_test(q)

    print("\n\n✅ Pipeline 1 & 2 test complete.")
    print("If both worked, run Pipeline 3 next: python test_graphrag.py")
