"""
Pipeline 3: TigerGraph GraphRAG — multi-hop graph retrieval + LLM synthesis.

Implements the same retrieval patterns as github.com/tigergraph/graphrag:
  - Entity extraction from query
  - Multi-hop graph traversal (Document → Risk → Company, etc.)
  - Context assembly from subgraph
  - LLM synthesis on focused context (much fewer tokens than Basic RAG)
"""

import time
import re
from openai import OpenAI
import pyTigerGraph as tg
from pipelines.base import BasePipeline, PipelineResult
from config import settings

# ── Company name → ticker mapping for query parsing ──────────────────────────
_COMPANY_MAP = {
    "apple": "AAPL", "microsoft": "MSFT", "google": "GOOGL",
    "amazon": "AMZN", "meta": "META", "facebook": "META",
    "jpmorgan": "JPM", "jp morgan": "JPM", "jpm": "JPM",
    "bank of america": "BAC", "wells fargo": "WFC",
    "goldman": "GS", "morgan stanley": "MS",
    "exxon": "XOM", "exxonmobil": "XOM", "chevron": "CVX",
    "johnson": "JNJ", "pfizer": "PFE", "merck": "MRK",
    "walmart": "WMT", "target": "TGT", "home depot": "HD",
}

_RISK_KEYWORDS = [
    "supply chain", "cybersecurity", "interest rate", "inflation",
    "recession", "regulation", "competition", "pandemic", "covid",
    "climate", "currency", "litigation", "geopolitical", "tariff",
    "china", "data privacy", "foreign exchange",
]

_YEAR_PATTERN = re.compile(r"\b(201[0-9]|202[0-9])\b")

_SYSTEM_PROMPT = """You are a senior financial analyst. Using ONLY the graph context
below (extracted from SEC 10-K filings via multi-hop graph traversal), answer the
question concisely and accurately. Cite specific companies, years, and facts from
the context. Do not hallucinate beyond what is provided."""


def _get_connection() -> tg.TigerGraphConnection:
    host = f"https://{settings.TIGERGRAPH_HOST}"
    graph = settings.TIGERGRAPH_GRAPH_NAME

    # If a pre-fetched token is set in .env, use it directly (no secret call needed)
    if settings.TIGERGRAPH_TOKEN:
        return tg.TigerGraphConnection(
            host=host,
            graphname=graph,
            apiToken=settings.TIGERGRAPH_TOKEN,
        )

    # Otherwise fetch a token from the secret via GSQL endpoint
    import requests as _req
    try:
        resp = _req.post(
            f"{host}/gsql/v1/tokens",
            json={"secret": settings.TIGERGRAPH_SECRET},
            timeout=15,
        )
        resp.raise_for_status()
        token = resp.json()["token"]
        return tg.TigerGraphConnection(host=host, graphname=graph, apiToken=token)
    except Exception as exc:
        raise RuntimeError(
            f"TigerGraph auth failed — secret may be expired. "
            f"Run: python3 -c \"import requests; r=requests.post('{host}/gsql/v1/tokens', "
            f"json={{'secret':'YOUR_SECRET'}}); print(r.json()['token'])\" "
            f"then set TIGERGRAPH_TOKEN=<token> in .env. Error: {exc}"
        ) from exc


def _parse_query(query: str) -> dict:
    """Extract ticker, year, and risk keywords from the natural language query."""
    lower = query.lower()
    ticker = next(
        (v for k, v in _COMPANY_MAP.items() if k in lower), None
    )
    year_match = _YEAR_PATTERN.search(query)
    year = year_match.group(0) if year_match else None
    risks = [r for r in _RISK_KEYWORDS if r in lower]
    return {"ticker": ticker, "year": year, "risks": risks}


def _query_graph(conn: tg.TigerGraphConnection, parsed: dict) -> dict:
    """
    Run targeted GSQL queries based on what was parsed from the question.
    Returns a dict of graph facts to build context from.
    """
    facts = {"documents": [], "risks": [], "executives": [], "companies": []}
    ticker = parsed.get("ticker")
    year   = parsed.get("year")
    risks  = parsed.get("risks", [])

    # ── Hop 1: Get documents for the company/year ─────────────────────────
    if ticker:
        try:
            doc_filter = f'v.ticker == "{ticker}"'
            if year:
                doc_filter += f' AND v.year == "{year}"'
            docs = conn.getVertices("Document", where=doc_filter, limit=5)
            facts["documents"] = [d["attributes"] for d in docs]
        except Exception:
            pass

        # ── Hop 2: Get risks mentioned in those documents ─────────────────
        try:
            doc_id = f"{ticker}_{year}_10K" if year else f"{ticker}_2022_10K"
            risk_edges = conn.getEdges("Document", doc_id, "MENTIONS_RISK")
            for edge in risk_edges:
                risk_id = edge.get("to_id", "")
                # Use the risk_id as the label (supply_chain → Supply Chain)
                label = risk_id.replace("_", " ").title()
                # Look up category from Risk vertex
                try:
                    rv = conn.getVerticesById("Risk", risk_id)
                    category = rv[0]["attributes"].get("category", "") if rv else ""
                except Exception:
                    category = ""
                facts["risks"].append({
                    "id": risk_id,
                    "description": label,
                    "category": category,
                })
        except Exception:
            pass

        # ── Hop 2: Get executives for the company ─────────────────────────
        try:
            exec_edges = conn.getEdges(
                "Company", ticker, "HAS_EXECUTIVE"
            )
            for edge in exec_edges:
                exec_id = edge.get("to_id", "")
                try:
                    exec_v = conn.getVerticesById("Executive", exec_id)
                    if exec_v:
                        facts["executives"].append(exec_v[0]["attributes"])
                except Exception:
                    pass
        except Exception:
            pass

    # ── Cross-company risk query (no ticker specified) ────────────────────
    elif risks:
        try:
            risk_id = risks[0].replace(" ", "_")
            docs_with_risk = conn.getEdges(
                "Risk", risk_id, "ALSO_MENTIONED_BY"
            )
            for edge in docs_with_risk:
                doc_id = edge.get("to_id", "")
                try:
                    doc_v = conn.getVerticesById("Document", doc_id)
                    if doc_v:
                        facts["documents"].append(doc_v[0]["attributes"])
                except Exception:
                    pass
        except Exception:
            pass

    # ── Fallback: get all companies in relevant sector ────────────────────
    if not any(facts.values()):
        try:
            companies = conn.getVertices("Company", limit=10)
            facts["companies"] = [c["attributes"] for c in companies]
        except Exception:
            pass

    return facts


def _build_context(facts: dict, parsed: dict) -> tuple[str, int]:
    """Convert graph facts into a compact context string. Returns (context, hops)."""
    lines = []
    hops = 0

    # Always show who/what this context is about
    ticker = parsed.get("ticker")
    year   = parsed.get("year")
    if ticker or year:
        header = "=== Query Context ==="
        if ticker:
            header_line = f"Company: {ticker}"
            if year:
                header_line += f"  |  Year: {year}  |  Filing: {ticker}_{year}_10K"
            lines.append(header)
            lines.append(header_line)

    if facts["documents"]:
        hops = 1
        lines.append("\n=== Filing Documents ===")
        for d in facts["documents"]:
            lines.append(f"• {d.get('ticker','?')} {d.get('year','?')} 10-K")

    if facts["risks"]:
        hops = max(hops, 2)
        lines.append("\n=== Risk Factors Identified ===")
        for r in facts["risks"]:
            lines.append(f"• [{r.get('category','?')}] {r.get('description','')[:200]}")

    if facts["executives"]:
        hops = max(hops, 2)
        lines.append("\n=== Key Executives ===")
        for e in facts["executives"]:
            lines.append(f"• {e.get('name','?')} — {e.get('title','?')}")

    if facts["companies"]:
        lines.append("\n=== Companies in Graph ===")
        for c in facts["companies"]:
            lines.append(f"• {c.get('ticker','?')} ({c.get('sector','?')})")

    return "\n".join(lines) if lines else "No relevant graph data found.", hops


class GraphRAGPipeline(BasePipeline):
    name = "graphrag"

    def __init__(self) -> None:
        self.llm = OpenAI(
            api_key=settings.OPENROUTER_API_KEY,
            base_url=settings.OPENROUTER_BASE_URL,
        )

    def run(self, query: str) -> PipelineResult:
        t0 = time.monotonic()
        try:
            # Step 1: Parse query for entities
            parsed = _parse_query(query)

            # Step 2: Connect to TigerGraph Savanna
            conn = _get_connection()

            # Step 3: Multi-hop graph traversal
            facts = _query_graph(conn, parsed)

            # Step 4: Build compact context from graph
            context, hops = _build_context(facts, parsed)

            # Step 5: LLM synthesis on focused graph context
            user_msg = f"Graph Context:\n{context}\n\nQuestion: {query}"
            resp = self.llm.chat.completions.create(
                model=settings.OPENROUTER_MODEL,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user",   "content": user_msg},
                ],
            )
            latency_ms = (time.monotonic() - t0) * 1000
            usage = resp.usage
            return PipelineResult(
                pipeline_name=self.name,
                answer=resp.choices[0].message.content or "",
                prompt_tokens=usage.prompt_tokens,
                completion_tokens=usage.completion_tokens,
                total_tokens=usage.total_tokens,
                latency_ms=latency_ms,
                cost_usd=self._estimate_cost(
                    settings.OPENROUTER_MODEL,
                    usage.prompt_tokens,
                    usage.completion_tokens,
                ),
                retrieved_chunks=[context],
                graph_hops=hops,
            )
        except Exception as exc:
            return PipelineResult(
                pipeline_name=self.name,
                answer="",
                error=str(exc),
                latency_ms=(time.monotonic() - t0) * 1000,
            )
