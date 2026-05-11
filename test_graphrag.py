"""
Test all 3 pipelines side by side.
Usage: python test_graphrag.py
"""

from pipelines.llm_only import LLMOnlyPipeline
from pipelines.basic_rag import BasicRAGPipeline
from pipelines.graphrag import GraphRAGPipeline

TEST_QUERIES = [
    "What were Apple's main risk factors in 2022?",
    "What impact did COVID-19 have on Microsoft's business in 2020?",
    "What are the main risks ExxonMobil faces?",
]


def print_result(result) -> None:
    print(f"\n{'─'*55}")
    print(f"  {result.pipeline_name.upper().replace('_',' ')}")
    print(f"{'─'*55}")
    if result.error:
        print(f"  ERROR: {result.error}")
        return
    print(f"  {result.answer[:400]}{'...' if len(result.answer) > 400 else ''}")
    print(f"\n  Tokens : {result.total_tokens:,}  |  Cost: ${result.cost_usd:.6f}  |  {result.latency_ms:.0f}ms")
    if result.graph_hops:
        print(f"  Hops   : {result.graph_hops}")


def run_all(query: str):
    print(f"\n{'='*55}")
    print(f"  QUERY: {query}")
    print(f"{'='*55}")

    p1 = LLMOnlyPipeline().run(query)
    p2 = BasicRAGPipeline().run(query)
    p3 = GraphRAGPipeline().run(query)

    print_result(p1)
    print_result(p2)
    print_result(p3)

    if not any(r.error for r in [p1, p2, p3]):
        print(f"\n  TOKEN SUMMARY")
        print(f"  LLM Only  : {p1.total_tokens:>5,} tokens  ${p1.cost_usd:.6f}")
        print(f"  Basic RAG : {p2.total_tokens:>5,} tokens  ${p2.cost_usd:.6f}")
        print(f"  GraphRAG  : {p3.total_tokens:>5,} tokens  ${p3.cost_usd:.6f}")
        if p2.total_tokens > 0:
            reduction = (1 - p3.total_tokens / p2.total_tokens) * 100
            print(f"\n  ✅ GraphRAG uses {reduction:.0f}% fewer tokens than Basic RAG")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", default=None)
    args = parser.parse_args()

    queries = [args.query] if args.query else TEST_QUERIES
    for q in queries:
        run_all(q)
