#!/usr/bin/env python3
"""
Smoke test all 3 pipelines with a single query.

Usage:
    cd /path/to/graphrag-finance
    python3 scripts/test_pipelines.py

Tests:
  1. LLM Only — should always work if GEMINI_API_KEY is set
  2. Basic RAG — requires FAISS index + chunks.jsonl to exist
  3. GraphRAG  — requires TigerGraph connection + valid token
"""

import sys
import time
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

QUERY = "What were Apple's main risk factors in 2022?"

print("=" * 60)
print("GraphRAG Finance — Pipeline Smoke Test")
print(f"Query: {QUERY}")
print("=" * 60)


# ── Check prerequisites ───────────────────────────────────────────────────────
from config import settings

print("\n📋 Prerequisites:")
faiss_ok  = pathlib.Path(settings.FAISS_INDEX_PATH).exists()
chunks_ok = pathlib.Path(settings.CHUNKS_PATH).exists()
print(f"  FAISS index: {'✅' if faiss_ok else '❌ missing — build it first with: python3 -m ingestion.parse_filings'}")
print(f"  chunks.jsonl: {'✅' if chunks_ok else '❌ missing'}")
print(f"  LLM provider: {settings.LLM_PROVIDER} ({settings.active_model})")
print(f"  API key set: {'✅' if settings.active_api_key else '❌ missing'}")
print(f"  TigerGraph: {settings.TIGERGRAPH_HOST} (USE_SAVANNA={settings.USE_SAVANNA})")
print(f"  TG token set: {'✅' if settings.TIGERGRAPH_TOKEN else '❌ (will try secret)'}")


# ── Pipeline 1: LLM Only ─────────────────────────────────────────────────────
print("\n" + "─" * 40)
print("Pipeline 1: LLM Only")
try:
    from pipelines.llm_only import LLMOnlyPipeline
    t0 = time.monotonic()
    result = LLMOnlyPipeline().run(QUERY)
    elapsed = time.monotonic() - t0
    if result.error:
        print(f"  ❌ Error: {result.error}")
    else:
        print(f"  ✅ Answer ({result.total_tokens} tokens, {elapsed:.1f}s):")
        print(f"  {result.answer[:200]}...")
except Exception as exc:
    print(f"  ❌ Exception: {exc}")


# ── Pipeline 2: Basic RAG ────────────────────────────────────────────────────
print("\n" + "─" * 40)
print("Pipeline 2: Basic RAG (FAISS)")
if not faiss_ok:
    print("  ⏭ Skipped — FAISS index not built yet")
else:
    try:
        from pipelines.basic_rag import BasicRAGPipeline
        print("  Loading FAISS index + chunks (may take 30s for large index)...")
        t0 = time.monotonic()
        rag = BasicRAGPipeline()
        load_time = time.monotonic() - t0
        print(f"  Loaded in {load_time:.1f}s")
        result = rag.run(QUERY)
        if result.error:
            print(f"  ❌ Error: {result.error}")
        else:
            print(f"  ✅ Answer ({result.total_tokens} tokens, {len(result.retrieved_chunks)} chunks retrieved):")
            print(f"  {result.answer[:200]}...")
    except Exception as exc:
        print(f"  ❌ Exception: {exc}")


# ── Pipeline 3: GraphRAG ─────────────────────────────────────────────────────
print("\n" + "─" * 40)
print("Pipeline 3: GraphRAG (TigerGraph)")
try:
    from pipelines.graphrag import GraphRAGPipeline
    t0 = time.monotonic()
    result = GraphRAGPipeline().run(QUERY)
    elapsed = time.monotonic() - t0
    if result.error:
        print(f"  ❌ Error: {result.error}")
        if "expired" in result.error.lower() or "401" in result.error or "403" in result.error:
            print("  💡 Token may be expired. Run: python3 scripts/refresh_tg_token.py")
    else:
        print(f"  ✅ Answer ({result.total_tokens} tokens, {result.graph_hops} hops, {elapsed:.1f}s):")
        print(f"  {result.answer[:200]}...")
except Exception as exc:
    print(f"  ❌ Exception: {exc}")
    if "401" in str(exc) or "403" in str(exc) or "token" in str(exc).lower():
        print("  💡 Token may be expired. Run: python3 scripts/refresh_tg_token.py")

print("\n" + "=" * 60)
print("Done! Fix any ❌ above before running the full dashboard.")
