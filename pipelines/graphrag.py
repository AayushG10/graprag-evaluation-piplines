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
    # Technology
    "apple": "AAPL", "microsoft": "MSFT", "google": "GOOGL", "alphabet": "GOOGL",
    "amazon": "AMZN", "meta": "META", "facebook": "META",
    "nvidia": "NVDA", "tesla": "TSLA", "intel": "INTC",
    "amd": "AMD", "advanced micro devices": "AMD", "oracle": "ORCL",
    # Finance
    "jpmorgan": "JPM", "jp morgan": "JPM", "jpm": "JPM",
    "bank of america": "BAC", "wells fargo": "WFC",
    "goldman": "GS", "goldman sachs": "GS",
    "morgan stanley": "MS", "citigroup": "C", "citi": "C",
    "american express": "AXP", "amex": "AXP",
    "blackrock": "BLK", "schwab": "SCHW", "charles schwab": "SCHW",
    "us bancorp": "USB", "usb": "USB",
    # Healthcare
    "johnson": "JNJ", "j&j": "JNJ",
    "pfizer": "PFE", "merck": "MRK",
    "abbvie": "ABBV", "unitedhealth": "UNH", "united health": "UNH",
    "cvs": "CVS", "bristol": "BMY", "bristol myers": "BMY",
    "amgen": "AMGN",
    # Energy
    "exxon": "XOM", "exxonmobil": "XOM", "chevron": "CVX",
    "conocophillips": "COP", "schlumberger": "SLB", "slb": "SLB",
    "phillips 66": "PSX", "valero": "VLO", "marathon petroleum": "MPC",
    # Retail & Consumer
    "walmart": "WMT", "target": "TGT", "home depot": "HD",
    "costco": "COST", "mcdonald": "MCD", "mcdonalds": "MCD",
    "starbucks": "SBUX", "nike": "NKE",
    # Industrial
    "caterpillar": "CAT", "honeywell": "HON", "general electric": "GE",
    "boeing": "BA", "3m": "MMM",
    # Telecom & Media
    "at&t": "T", "att": "T", "verizon": "VZ", "disney": "DIS",
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

    # If a pre-fetched token is set in .env, try it first (auto-refresh if expired)
    if settings.TIGERGRAPH_TOKEN:
        # Check token expiry before using it
        import base64 as _b64, time as _time
        try:
            parts = settings.TIGERGRAPH_TOKEN.split(".")
            pad = 4 - len(parts[1]) % 4
            payload = _b64.b64decode(parts[1] + "=" * pad)
            import json as _json
            exp = _json.loads(payload).get("exp", 0)
            if exp < _time.time() + 60:   # expired or expires in <1 min
                raise ValueError("Token expired")
            return tg.TigerGraphConnection(
                host=host,
                graphname=graph,
                apiToken=settings.TIGERGRAPH_TOKEN,
            )
        except ValueError:
            pass  # fall through to secret-based refresh
        except Exception:
            # Can't decode token — use it anyway and let TigerGraph reject it
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


def _query_graph(conn: tg.TigerGraphConnection, parsed: dict) -> tuple[dict, dict]:
    """
    Run targeted GSQL queries based on what was parsed from the question.
    Returns (facts, graph_data) where graph_data has nodes+edges for visualization.
    """
    facts = {"documents": [], "risks": [], "executives": [], "companies": []}
    ticker = parsed.get("ticker")
    year   = parsed.get("year")
    risks  = parsed.get("risks", [])

    # ── Graph visualization data ──────────────────────────────────────────
    graph_data: dict = {"nodes": [], "edges": []}
    _seen: set = set()

    def _node(node_id: str, label: str, node_type: str, hop: int) -> None:
        if node_id not in _seen:
            graph_data["nodes"].append({
                "id": node_id, "label": label,
                "type": node_type, "hop": hop,
            })
            _seen.add(node_id)

    def _edge(src: str, tgt: str, label: str, hop: int) -> None:
        graph_data["edges"].append({
            "source": src, "target": tgt,
            "label": label, "hop": hop,
        })

    # ── Hop 1: Get documents for the company/year ─────────────────────────
    if ticker:
        _node(ticker, ticker, "company", 0)

        try:
            doc_filter = f'v.ticker == "{ticker}"'
            if year:
                doc_filter += f' AND v.year == "{year}"'
            docs = conn.getVertices("Document", where=doc_filter, limit=5)
            facts["documents"] = [d["attributes"] for d in docs]
            for d in docs:
                doc_id = d["v_id"]
                doc_yr = d["attributes"].get("year", "")
                _node(doc_id, f"{ticker} {doc_yr} 10-K", "document", 1)
                _edge(doc_id, ticker, "FILED_BY", 1)
        except Exception:
            pass

        # ── Hop 2: Get risks mentioned in those documents ─────────────────
        try:
            doc_id = f"{ticker}_{year}_10K" if year else f"{ticker}_2022_10K"
            risk_edges = conn.getEdges("Document", doc_id, "MENTIONS_RISK")
            for edge in risk_edges:
                risk_id = edge.get("to_id", "")
                label = risk_id.replace("_", " ").title()
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
                _node(risk_id, label, "risk", 2)
                _edge(doc_id, risk_id, "MENTIONS_RISK", 2)
        except Exception:
            pass

        # ── Hop 2: Get executives for the company ─────────────────────────
        try:
            exec_edges = conn.getEdges("Company", ticker, "HAS_EXECUTIVE")
            for edge in exec_edges:
                exec_id = edge.get("to_id", "")
                try:
                    exec_v = conn.getVerticesById("Executive", exec_id)
                    if exec_v:
                        attrs = exec_v[0]["attributes"]
                        facts["executives"].append(attrs)
                        name = attrs.get("name", exec_id)
                        _node(exec_id, name, "executive", 2)
                        _edge(ticker, exec_id, "HAS_EXECUTIVE", 2)
                except Exception:
                    pass
        except Exception:
            pass

    # ── Cross-company risk query (no ticker specified) ────────────────────
    elif risks:
        try:
            risk_id = risks[0].replace(" ", "_")
            risk_label = risks[0].replace("_", " ").title()
            _node(risk_id, risk_label, "risk", 0)

            docs_with_risk = conn.getEdges("Risk", risk_id, "ALSO_MENTIONED_BY")
            for edge in docs_with_risk:
                doc_id = edge.get("to_id", "")
                try:
                    doc_v = conn.getVerticesById("Document", doc_id)
                    if doc_v:
                        attrs = doc_v[0]["attributes"]
                        facts["documents"].append(attrs)
                        co = attrs.get("ticker", "?")
                        yr = attrs.get("year", "?")
                        _node(doc_id, f"{co} {yr} 10-K", "document", 1)
                        _edge(risk_id, doc_id, "ALSO_MENTIONED_BY", 1)
                        # Hop 2: company node
                        _node(co, co, "company", 2)
                        _edge(doc_id, co, "FILED_BY", 2)
                except Exception:
                    pass
        except Exception:
            pass

    # ── Hop 3 (YoY): all docs for ticker when no year given ──────────────
    if ticker and year is None:
        try:
            all_docs = conn.getVertices(
                "Document", where=f'v.ticker == "{ticker}"', limit=10
            )
            if all_docs and not facts["documents"]:
                facts["documents"] = [d["attributes"] for d in all_docs]
                for d in all_docs:
                    doc_id = d["v_id"]
                    doc_yr = d["attributes"].get("year", "")
                    _node(doc_id, f"{ticker} {doc_yr} 10-K", "document", 1)
                    _edge(doc_id, ticker, "FILED_BY", 1)
        except Exception:
            pass

    # ── Sector peer comparison (Hop 3) ────────────────────────────────────
    if ticker:
        try:
            sector_edges = conn.getEdges("Company", ticker, "OPERATES_IN")
            for edge in sector_edges:
                sector_id = edge.get("to_id", "")
                sector_companies = conn.getEdges(
                    "Sector", sector_id, "OPERATES_IN", direction="from"
                )
                peer_tickers = [
                    e.get("from_id", "")
                    for e in sector_companies
                    if e.get("from_id", "") != ticker
                ][:4]
                if peer_tickers:
                    facts["companies"].append({
                        "type": "sector_peers",
                        "sector": sector_id,
                        "peers": peer_tickers,
                    })
                    _node(sector_id, sector_id, "sector", 3)
                    _edge(ticker, sector_id, "OPERATES_IN", 3)
                    for peer in peer_tickers:
                        _node(peer, peer, "company", 3)
                        _edge(peer, sector_id, "OPERATES_IN", 3)
        except Exception:
            pass

    # ── Fallback: get all companies in relevant sector ────────────────────
    if not any(facts.values()):
        try:
            companies = conn.getVertices("Company", limit=10)
            facts["companies"] = [c["attributes"] for c in companies]
            for c in companies[:6]:
                cid = c["v_id"]
                _node(cid, cid, "company", 0)
        except Exception:
            pass

    return facts, graph_data


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
            if c.get("type") == "sector_peers":
                hops = max(hops, 3)
                lines.append(f"• Sector: {c.get('sector','?')}  |  Peers: {', '.join(c.get('peers', []))}")
            else:
                lines.append(f"• {c.get('ticker','?')} ({c.get('sector','?')})")

    return "\n".join(lines) if lines else "No relevant graph data found.", hops


class GraphRAGPipeline(BasePipeline):
    name = "graphrag"

    def __init__(self) -> None:
        self.llm = OpenAI(
            api_key=settings.active_api_key,
            base_url=settings.active_base_url,
        )

    def run(self, query: str) -> PipelineResult:
        t0 = time.monotonic()
        try:
            # Step 1: Parse query for entities
            parsed = _parse_query(query)

            # Step 2: Connect to TigerGraph Savanna
            try:
                conn = _get_connection()
            except Exception as conn_exc:
                err_str = str(conn_exc)
                if "workspace" in err_str.lower() or "start" in err_str.lower() or "500" in err_str:
                    return PipelineResult(
                        pipeline_name=self.name,
                        answer="",
                        error="TigerGraph workspace is stopped. Please start the workspace at https://tgcloud.io, then refresh the token.",
                        latency_ms=(time.monotonic() - t0) * 1000,
                    )
                raise

            # Step 3: Multi-hop graph traversal
            facts, graph_data = _query_graph(conn, parsed)

            # Step 4: Build compact context from graph
            context, hops = _build_context(facts, parsed)

            # Step 5: LLM synthesis on focused graph context
            user_msg = f"Graph Context:\n{context}\n\nQuestion: {query}"
            resp = self.llm.chat.completions.create(
                model=settings.active_model,
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
                    settings.active_model,
                    usage.prompt_tokens,
                    usage.completion_tokens,
                ),
                retrieved_chunks=[context],
                graph_hops=hops,
                graph_data=graph_data,
            )
        except Exception as exc:
            return PipelineResult(
                pipeline_name=self.name,
                answer="",
                error=str(exc),
                latency_ms=(time.monotonic() - t0) * 1000,
            )
