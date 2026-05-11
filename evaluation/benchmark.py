"""
Offline batch benchmark — runs all 3 pipelines on a fixed question set and
saves results to data/processed/benchmark_results.jsonl.

Usage: python -m evaluation.benchmark
"""

import json
import time
from pathlib import Path

from pipelines.llm_only import LLMOnlyPipeline
from pipelines.basic_rag import BasicRAGPipeline
from pipelines.graphrag import GraphRAGPipeline
from evaluation.bert_score import compute_bertscore
from evaluation.llm_judge import llm_judge

QUESTIONS = [
    {
        "query": "What were Apple's main risk factors in 2022?",
        "reference": "Apple's 2022 10-K identified risks including global supply chain disruptions, "
                     "competition, cybersecurity threats, regulatory changes, and dependence on "
                     "third-party manufacturers.",
    },
    {
        "query": "What impact did COVID-19 have on Microsoft's business in 2020?",
        "reference": "Microsoft saw increased demand for cloud services and Teams during COVID-19, "
                     "while some hardware segments faced supply constraints.",
    },
    {
        "query": "What are the main risks ExxonMobil faces?",
        "reference": "ExxonMobil faces risks including oil price volatility, climate regulation, "
                     "geopolitical instability, and transition to renewable energy.",
    },
    {
        "query": "What are JPMorgan's key business segments?",
        "reference": "JPMorgan operates through Consumer & Community Banking, Corporate & Investment Bank, "
                     "Commercial Banking, and Asset & Wealth Management.",
    },
    {
        "query": "What cybersecurity risks does Johnson & Johnson report?",
        "reference": "Johnson & Johnson reports risks related to data breaches, ransomware attacks, "
                     "and unauthorized access to sensitive patient and product data.",
    },
]

OUTPUT_PATH = Path("data/processed/benchmark_results.jsonl")


def run_benchmark():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    pipelines = [LLMOnlyPipeline(), BasicRAGPipeline(), GraphRAGPipeline()]

    with OUTPUT_PATH.open("w") as f:
        for item in QUESTIONS:
            query = item["query"]
            reference = item["reference"]
            print(f"\n{'='*60}\nQ: {query}\n{'='*60}")

            row: dict = {"query": query, "reference": reference, "pipelines": []}

            for pipe in pipelines:
                t0 = time.monotonic()
                result = pipe.run(query)
                elapsed = time.monotonic() - t0

                bs = compute_bertscore(result.answer, reference) if not result.error else None
                passed, reason = llm_judge(query, result.answer, reference) if not result.error else (None, None)

                entry = {
                    "pipeline": result.pipeline_name,
                    "answer": result.answer[:500],
                    "total_tokens": result.total_tokens,
                    "latency_ms": round(result.latency_ms, 1),
                    "cost_usd": round(result.cost_usd, 6),
                    "graph_hops": result.graph_hops,
                    "bertscore_f1": bs,
                    "judge_pass": passed,
                    "judge_reason": reason,
                    "error": result.error,
                }
                row["pipelines"].append(entry)

                status = "ERROR" if result.error else f"{result.total_tokens} tokens"
                print(f"  {result.pipeline_name:<12} {status}  BERTScore={bs}  Judge={'PASS' if passed else 'FAIL' if passed is not None else 'N/A'}")

            f.write(json.dumps(row) + "\n")

    print(f"\nResults saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    run_benchmark()
