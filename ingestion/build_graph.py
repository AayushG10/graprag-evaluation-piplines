"""
Step 3 of data pipeline: Extract entities/relationships from chunks
and load them into TigerGraph as a knowledge graph.

Schema:
  Vertices: Company, Executive, Document, Risk, Sector, MacroEvent
  Edges:    HAS_EXECUTIVE, FILED_BY, MENTIONS_RISK, OPERATES_IN,
            SUCCEEDED_BY, ALSO_MENTIONED_BY

Usage:
    python -m ingestion.build_graph
"""

import json
import re
import pathlib
from collections import defaultdict
from tqdm import tqdm
import pyTigerGraph as tg
from config import settings


# ── TigerGraph connection ─────────────────────────────────────────────────────

def get_connection() -> tg.TigerGraphConnection:
    if settings.USE_SAVANNA:
        # First get the token, then reconnect with it in the constructor
        _tmp = tg.TigerGraphConnection(
            host=f"https://{settings.TIGERGRAPH_HOST}",
            graphname=settings.TIGERGRAPH_GRAPH_NAME,
            gsqlSecret=settings.TIGERGRAPH_SECRET,
        )
        result = _tmp.getToken(settings.TIGERGRAPH_SECRET)
        token = result[0] if isinstance(result, tuple) else result
        conn = tg.TigerGraphConnection(
            host=f"https://{settings.TIGERGRAPH_HOST}",
            graphname=settings.TIGERGRAPH_GRAPH_NAME,
            gsqlSecret=settings.TIGERGRAPH_SECRET,
            apiToken=token,
        )
    else:
        conn = tg.TigerGraphConnection(
            host=f"http://{settings.TIGERGRAPH_HOST}",
            graphname=settings.TIGERGRAPH_GRAPH_NAME,
            username=settings.TIGERGRAPH_USERNAME,
            password=settings.TIGERGRAPH_PASSWORD,
        )
    print(f"✅ Connected to TigerGraph: {settings.TIGERGRAPH_HOST}")
    return conn


# ── Schema creation ───────────────────────────────────────────────────────────

SCHEMA_GSQL = """
USE GLOBAL

CREATE VERTEX Company (
    PRIMARY_ID id STRING,
    name STRING,
    ticker STRING,
    sector STRING
) WITH STATS="OUTDEGREE_BY_EDGETYPE", PRIMARY_ID_AS_ATTRIBUTE="true"

CREATE VERTEX Executive (
    PRIMARY_ID id STRING,
    name STRING,
    title STRING
) WITH PRIMARY_ID_AS_ATTRIBUTE="true"

CREATE VERTEX Document (
    PRIMARY_ID id STRING,
    ticker STRING,
    year STRING,
    filing_type STRING
) WITH PRIMARY_ID_AS_ATTRIBUTE="true"

CREATE VERTEX Risk (
    PRIMARY_ID id STRING,
    description STRING,
    category STRING
) WITH PRIMARY_ID_AS_ATTRIBUTE="true"

CREATE VERTEX Sector (
    PRIMARY_ID id STRING,
    name STRING
) WITH PRIMARY_ID_AS_ATTRIBUTE="true"

CREATE VERTEX MacroEvent (
    PRIMARY_ID id STRING,
    description STRING,
    year STRING
) WITH PRIMARY_ID_AS_ATTRIBUTE="true"

CREATE DIRECTED EDGE HAS_EXECUTIVE (FROM Company, TO Executive)
CREATE DIRECTED EDGE FILED_BY (FROM Document, TO Company)
CREATE DIRECTED EDGE MENTIONS_RISK (FROM Document, TO Risk)
CREATE DIRECTED EDGE OPERATES_IN (FROM Company, TO Sector)
CREATE DIRECTED EDGE SUCCEEDED_BY (FROM Document, TO Document)
CREATE DIRECTED EDGE ALSO_MENTIONED_BY (FROM Risk, TO Document)

CREATE GRAPH FinanceGraph (
    Company, Executive, Document, Risk, Sector, MacroEvent,
    HAS_EXECUTIVE, FILED_BY, MENTIONS_RISK, OPERATES_IN,
    SUCCEEDED_BY, ALSO_MENTIONED_BY
)
"""


def create_schema(conn: tg.TigerGraphConnection) -> None:
    print("Creating TigerGraph schema...")
    try:
        conn.gsql(SCHEMA_GSQL)
        print("✅ Schema created")
    except Exception as exc:
        # Schema may already exist — that's fine
        print(f"  (Schema note: {exc})")


# ── Entity extraction ─────────────────────────────────────────────────────────

# Company ticker → sector mapping
TICKER_SECTOR = {
    "AAPL": "Technology", "MSFT": "Technology", "GOOGL": "Technology",
    "AMZN": "Technology", "META": "Technology",
    "JPM": "Finance", "BAC": "Finance", "WFC": "Finance",
    "GS": "Finance", "MS": "Finance",
    "XOM": "Energy", "CVX": "Energy", "COP": "Energy",
    "JNJ": "Healthcare", "PFE": "Healthcare", "MRK": "Healthcare",
    "WMT": "Retail", "TGT": "Retail", "HD": "Retail", "COST": "Retail",
    "CAT": "Industrial", "HON": "Industrial", "GE": "Industrial",
    "T": "Telecom", "VZ": "Telecom",
}

# Regex patterns for executive titles in Item 10
_EXEC_PATTERN = re.compile(
    r"((?:[A-Z][a-z]+ ){1,3}(?:[A-Z][a-z]+))"   # Name (1-4 words, each capitalised)
    r"\s*[,–-]\s*"
    r"((?:Chief|President|Senior Vice|Vice|Executive Vice|Chief Executive|"
    r"Chief Financial|Chief Operating|Chief Technology|Chief Marketing|"
    r"General Counsel|Secretary)[^,\n]{0,60})",
    re.MULTILINE,
)

# Risk keywords → category
_RISK_CATEGORIES = {
    "supply chain": "Operational",
    "cybersecurity": "Technology",
    "cyber": "Technology",
    "interest rate": "Financial",
    "inflation": "Macroeconomic",
    "recession": "Macroeconomic",
    "regulation": "Regulatory",
    "regulatory": "Regulatory",
    "competition": "Competitive",
    "pandemic": "Macroeconomic",
    "covid": "Macroeconomic",
    "climate": "Environmental",
    "currency": "Financial",
    "foreign exchange": "Financial",
    "litigation": "Legal",
    "geopolitical": "Geopolitical",
    "china": "Geopolitical",
    "tariff": "Trade",
    "data privacy": "Regulatory",
}

# Macro events to flag when found in text
_MACRO_EVENTS = [
    ("COVID-19 pandemic", ["covid", "pandemic", "coronavirus"], "2020"),
    ("Federal Reserve rate hikes", ["rate hike", "federal reserve", "fed rate"], "2022"),
    ("Supply chain crisis", ["supply chain disruption", "supply shortage"], "2021"),
    ("SVB collapse / banking stress", ["svb", "silicon valley bank", "bank failure"], "2023"),
    ("Inflation surge", ["inflation", "consumer price", "cpi"], "2022"),
    ("Russia-Ukraine war", ["russia", "ukraine", "geopolitical conflict"], "2022"),
    ("AI investment boom", ["artificial intelligence", "generative ai", "llm"], "2023"),
]


def extract_risks(text: str) -> list[dict]:
    """Find risk-related sentences and classify them."""
    text_lower = text.lower()
    found = []
    for keyword, category in _RISK_CATEGORIES.items():
        if keyword in text_lower:
            # Grab the sentence containing the keyword as description
            pattern = re.compile(
                r"[^.]*" + re.escape(keyword) + r"[^.]*\.", re.IGNORECASE
            )
            match = pattern.search(text)
            description = match.group(0).strip() if match else keyword
            found.append({
                "id": keyword.replace(" ", "_"),
                "description": description[:300],
                "category": category,
            })
    return found


def extract_executives(text: str) -> list[dict]:
    """Extract executive name + title pairs from Item 10 section."""
    executives = []
    for match in _EXEC_PATTERN.finditer(text):
        name = match.group(1).strip()
        title = match.group(2).strip()
        # Filter out false positives (very short names, etc.)
        if len(name.split()) >= 2 and len(name) < 50:
            executives.append({
                "id": name.lower().replace(" ", "_"),
                "name": name,
                "title": title[:100],
            })
    return executives[:20]   # cap at 20 per filing


def extract_macro_events(text: str, year: str) -> list[dict]:
    """Flag macro events mentioned in the filing."""
    text_lower = text.lower()
    found = []
    for event_name, keywords, event_year in _MACRO_EVENTS:
        if any(kw in text_lower for kw in keywords):
            found.append({
                "id": event_name.lower().replace(" ", "_").replace("/", "_"),
                "description": event_name,
                "year": event_year,
            })
    return found


# ── Graph loading ─────────────────────────────────────────────────────────────

def load_graph(conn: tg.TigerGraphConnection, chunks_path: str) -> None:
    """
    Read chunks.jsonl, extract entities per chunk, and upsert into TigerGraph
    using pyTigerGraph's REST++ batch API.
    """
    with open(chunks_path) as f:
        chunks = [json.loads(line) for line in f]

    # Group chunks by (ticker, year) to process per filing
    filings: dict[str, list[dict]] = defaultdict(list)
    for chunk in chunks:
        key = f"{chunk['ticker']}/{chunk['year']}"
        filings[key].append(chunk)

    print(f"\nLoading {len(filings)} filings into TigerGraph...")

    # Track documents for SUCCEEDED_BY edges
    ticker_docs: dict[str, list[str]] = defaultdict(list)

    for filing_key, filing_chunks in tqdm(filings.items(), desc="Loading graph"):
        ticker, year = filing_key.split("/")
        full_text = " ".join(c["text"] for c in filing_chunks)
        doc_id = f"{ticker}_{year}_10K"

        # ── Upsert Company vertex ────────────────────────────────────────────
        sector = TICKER_SECTOR.get(ticker, "Other")
        conn.upsertVertex("Company", ticker, {
            "name": ticker,
            "ticker": ticker,
            "sector": sector,
        })

        # ── Upsert Sector vertex ─────────────────────────────────────────────
        conn.upsertVertex("Sector", sector, {"name": sector})
        conn.upsertEdge("Company", ticker, "OPERATES_IN", "Sector", sector)

        # ── Upsert Document vertex ───────────────────────────────────────────
        conn.upsertVertex("Document", doc_id, {
            "ticker": ticker,
            "year": year,
            "filing_type": "10-K",
        })
        conn.upsertEdge("Document", doc_id, "FILED_BY", "Company", ticker)
        ticker_docs[ticker].append((year, doc_id))

        # ── Extract + upsert Risks ───────────────────────────────────────────
        risks = extract_risks(full_text)
        for risk in risks:
            conn.upsertVertex("Risk", risk["id"], {
                "description": risk["description"],
                "category": risk["category"],
            })
            conn.upsertEdge("Document", doc_id, "MENTIONS_RISK", "Risk", risk["id"])
            conn.upsertEdge("Risk", risk["id"], "ALSO_MENTIONED_BY", "Document", doc_id)

        # ── Extract + upsert Executives ──────────────────────────────────────
        execs = extract_executives(full_text)
        for exec_ in execs:
            conn.upsertVertex("Executive", exec_["id"], {
                "name": exec_["name"],
                "title": exec_["title"],
            })
            conn.upsertEdge("Company", ticker, "HAS_EXECUTIVE", "Executive", exec_["id"])

        # ── Extract + upsert MacroEvents ─────────────────────────────────────
        events = extract_macro_events(full_text, year)
        for event in events:
            conn.upsertVertex("MacroEvent", event["id"], {
                "description": event["description"],
                "year": event["year"],
            })

    # ── Build SUCCEEDED_BY edges (year-over-year document chain) ─────────────
    print("Building year-over-year document chains...")
    for ticker, doc_list in ticker_docs.items():
        sorted_docs = sorted(doc_list, key=lambda x: x[0])   # sort by year
        for i in range(len(sorted_docs) - 1):
            _, doc_id_a = sorted_docs[i]
            _, doc_id_b = sorted_docs[i + 1]
            conn.upsertEdge("Document", doc_id_a, "SUCCEEDED_BY", "Document", doc_id_b)

    print("\n✅ Knowledge graph loaded into TigerGraph!")
    _print_summary(conn)


def _print_summary(conn: tg.TigerGraphConnection) -> None:
    """Print vertex and edge counts."""
    try:
        stats = conn.getStatistics()
        print("\nGraph summary:")
        for vtype in ["Company", "Executive", "Document", "Risk", "Sector", "MacroEvent"]:
            count = conn.getVertexCount(vtype)
            print(f"  {vtype}: {count:,}")
    except Exception:
        pass


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    conn = get_connection()
    create_schema(conn)
    load_graph(conn, settings.CHUNKS_PATH)
