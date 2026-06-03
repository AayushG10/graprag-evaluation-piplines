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
        "query": "What was Microsoft's total revenue in fiscal year 2023?",
        "reference": "Microsoft reported total revenue of $211.9 billion in fiscal year 2023, "
                     "driven by cloud services, Office products, and LinkedIn.",
    },
    {
        "query": "How did COVID-19 impact JPMorgan's business operations in 2020?",
        "reference": "JPMorgan increased credit loss provisions significantly in 2020 due to COVID-19, "
                     "while investment banking revenues rose on market volatility.",
    },
    {
        "query": "What are ExxonMobil's key environmental and climate risks?",
        "reference": "ExxonMobil faces risks from climate regulation, carbon taxes, stranded assets, "
                     "and transition to renewable energy affecting long-term demand for oil.",
    },
    {
        "query": "Who are Johnson & Johnson's key executives mentioned in 2021 filings?",
        "reference": "Johnson & Johnson's 2021 10-K listed Alex Gorsky as Chairman and CEO, "
                     "and Joaquin Duato as Vice Chairman.",
    },
    {
        "query": "How did Apple's supply chain risks change from 2019 to 2022?",
        "reference": "Apple's supply chain risks intensified from 2019 to 2022 due to US-China tensions, "
                     "COVID-related factory shutdowns, and semiconductor shortages.",
    },
    {
        "query": "What cybersecurity risks did Microsoft disclose in its 2023 10-K?",
        "reference": "Microsoft disclosed risks including nation-state cyberattacks, ransomware, "
                     "vulnerabilities in cloud infrastructure, and insider threats.",
    },
    {
        "query": "What was JPMorgan's net income in 2021 and what drove the increase?",
        "reference": "JPMorgan's net income was $48.3 billion in 2021, driven by reserve releases "
                     "as the economy recovered from COVID-19 impacts.",
    },
    {
        "query": "What sector does ExxonMobil operate in and who are its main competitors?",
        "reference": "ExxonMobil operates in the integrated oil and gas sector, competing with "
                     "Chevron, Shell, BP, and TotalEnergies.",
    },
    {
        "query": "What litigation risks did Johnson & Johnson face in 2022?",
        "reference": "Johnson & Johnson faced significant litigation over talc-based products "
                     "and opioid-related claims in its 2022 10-K filings.",
    },
    {
        "query": "What were NVIDIA's key growth drivers in fiscal year 2023?",
        "reference": "NVIDIA's growth in FY2023 was driven by data center GPU demand for AI "
                     "training, particularly from hyperscale cloud providers.",
    },
    {
        "query": "What risks did Tesla disclose related to its manufacturing operations in 2022?",
        "reference": "Tesla disclosed risks including production ramp challenges at new Gigafactories, "
                     "supply chain disruptions, and dependence on key suppliers.",
    },
    {
        "query": "What were Goldman Sachs's main regulatory risks in 2021?",
        "reference": "Goldman Sachs disclosed regulatory risks including capital requirements, "
                     "1MDB settlement obligations, and evolving financial regulations globally.",
    },
    {
        "query": "What were UnitedHealth Group's key business segments in 2022?",
        "reference": "UnitedHealth Group operates through UnitedHealthcare (insurance) and "
                     "Optum (health services, pharmacy, analytics) segments.",
    },
    {
        "query": "How did Chevron describe its climate-related risks and opportunities in 2021?",
        "reference": "Chevron described climate risks including carbon regulation, stranded asset risk, "
                     "and opportunities in lower-carbon businesses like hydrogen and carbon capture.",
    },
    {
        "query": "What were Boeing's main operational risks in 2020?",
        "reference": "Boeing's 2020 10-K highlighted 737 MAX grounding impacts, COVID-19 demand "
                     "reduction for commercial aircraft, and defense program cost overruns.",
    },
    {
        "query": "What were Amazon's key risk factors related to competition in 2022?",
        "reference": "Amazon cited competition from Walmart, Target, and specialized retailers in "
                     "e-commerce, plus cloud competition from Microsoft Azure and Google Cloud.",
    },
    {
        "query": "What were Intel's main challenges and risks described in its 2022 10-K?",
        "reference": "Intel described risks including manufacturing execution challenges, loss of "
                     "market share to AMD and ARM-based chips, and high capital expenditure needs.",
    },
    {
        "query": "What were Disney's primary revenue sources and risks in 2021?",
        "reference": "Disney's 2021 revenues came from streaming (Disney+), parks, and media networks, "
                     "with COVID-19 park closures being a major risk factor.",
    },
    {
        "query": "What inflation and interest rate risks did Bank of America describe in 2022?",
        "reference": "Bank of America described risks from rapidly rising interest rates affecting "
                     "loan demand and deposit behavior, alongside inflation impacting operating costs.",
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
