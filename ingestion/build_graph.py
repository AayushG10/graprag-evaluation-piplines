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
import os
import re
import pathlib
from collections import defaultdict
from functools import lru_cache
from tqdm import tqdm
import pyTigerGraph as tg
from config import settings


@lru_cache(maxsize=1)
def _nlp():
    """Lazily load spaCy's small English model for PERSON-name extraction."""
    import spacy
    return spacy.load("en_core_web_sm", disable=["parser", "lemmatizer"])


# ── TigerGraph connection ─────────────────────────────────────────────────────

def get_connection() -> tg.TigerGraphConnection:
    if settings.USE_SAVANNA:
        host = f"https://{settings.TIGERGRAPH_HOST}"

        # Option A: pre-fetched token already in .env (preferred)
        if settings.TIGERGRAPH_TOKEN:
            conn = tg.TigerGraphConnection(
                host=host,
                graphname=settings.TIGERGRAPH_GRAPH_NAME,
                apiToken=settings.TIGERGRAPH_TOKEN,
            )
            print(f"✅ Connected to TigerGraph Savanna: {settings.TIGERGRAPH_HOST} (token auth)")
            return conn

        # Option B: fetch token from secret via GSQL REST endpoint
        if not settings.TIGERGRAPH_SECRET:
            raise RuntimeError(
                "TigerGraph Savanna auth failed: set TIGERGRAPH_TOKEN or TIGERGRAPH_SECRET in .env.\n"
                "To get a fresh token, go to: TigerGraph Savanna → Admin Portal → My Profile → Secrets\n"
                "Then run: curl -X POST https://<host>/gsql/v1/tokens -H 'Content-Type: application/json' "
                "-d '{\"secret\":\"YOUR_SECRET\"}'"
            )
        import requests as _req
        resp = _req.post(
            f"{host}/gsql/v1/tokens",
            json={"secret": settings.TIGERGRAPH_SECRET},
            timeout=15,
        )
        resp.raise_for_status()
        token = resp.json()["token"]
        conn = tg.TigerGraphConnection(
            host=host,
            graphname=settings.TIGERGRAPH_GRAPH_NAME,
            apiToken=token,
        )
        print(f"✅ Connected to TigerGraph Savanna: {settings.TIGERGRAPH_HOST} (secret auth)")
        return conn
    else:
        conn = tg.TigerGraphConnection(
            host=f"http://{settings.TIGERGRAPH_HOST}",
            graphname=settings.TIGERGRAPH_GRAPH_NAME,
            username=settings.TIGERGRAPH_USERNAME,
            password=settings.TIGERGRAPH_PASSWORD,
        )
        print(f"✅ Connected to TigerGraph CE: {settings.TIGERGRAPH_HOST}")
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
CREATE DIRECTED EDGE MENTIONS_RISK (FROM Document, TO Risk, description STRING)
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

    # If MENTIONS_RISK already existed from an earlier run without the
    # per-document `description` attribute, add it now. MENTIONS_RISK is a
    # global/shared edge, so this must go through a GLOBAL schema-change job
    # — a plain inline `ALTER EDGE` reports success but does not actually
    # apply, and subsequent upserts of the attribute then fail with
    # "Invalid edge attribute" (REST-30200).
    try:
        existing = conn.getEdgeType("MENTIONS_RISK")
        attrs = [a["AttributeName"] for a in existing.get("Attributes", [])]
        if "description" not in attrs:
            conn.gsql(
                "USE GLOBAL\n"
                "CREATE GLOBAL SCHEMA_CHANGE JOB _add_mr_desc {\n"
                "  ALTER EDGE MENTIONS_RISK ADD ATTRIBUTE (description STRING);\n"
                "}\n"
                "RUN GLOBAL SCHEMA_CHANGE JOB _add_mr_desc\n"
                "DROP JOB _add_mr_desc"
            )
            print("✅ MENTIONS_RISK.description attribute added")
        else:
            print("  (MENTIONS_RISK.description already present)")
    except Exception as exc:
        print(f"  (Alter note: {exc})")


# ── Entity extraction ─────────────────────────────────────────────────────────

# Company ticker → display name mapping
TICKER_NAMES = {
    # Technology
    "AAPL": "Apple Inc.", "MSFT": "Microsoft Corp.", "GOOGL": "Alphabet Inc.",
    "AMZN": "Amazon.com Inc.", "META": "Meta Platforms Inc.",
    "NVDA": "NVIDIA Corp.", "TSLA": "Tesla Inc.", "INTC": "Intel Corp.",
    "AMD": "Advanced Micro Devices Inc.", "ORCL": "Oracle Corp.",
    # Finance
    "JPM": "JPMorgan Chase & Co.", "BAC": "Bank of America Corp.", "WFC": "Wells Fargo & Co.",
    "GS": "Goldman Sachs Group Inc.", "MS": "Morgan Stanley",
    "C": "Citigroup Inc.", "AXP": "American Express Co.", "BLK": "BlackRock Inc.",
    "SCHW": "Charles Schwab Corp.", "USB": "U.S. Bancorp",
    # Healthcare
    "JNJ": "Johnson & Johnson", "PFE": "Pfizer Inc.", "MRK": "Merck & Co.",
    "ABBV": "AbbVie Inc.", "UNH": "UnitedHealth Group Inc.", "CVS": "CVS Health Corp.",
    "BMY": "Bristol-Myers Squibb Co.", "AMGN": "Amgen Inc.",
    # Energy
    "XOM": "ExxonMobil Corp.", "CVX": "Chevron Corp.", "COP": "ConocoPhillips",
    "SLB": "Schlumberger Ltd.", "PSX": "Phillips 66", "VLO": "Valero Energy Corp.",
    "MPC": "Marathon Petroleum Corp.",
    # Retail & Consumer
    "WMT": "Walmart Inc.", "TGT": "Target Corp.", "HD": "Home Depot Inc.", "COST": "Costco Wholesale Corp.",
    "MCD": "McDonald's Corp.", "SBUX": "Starbucks Corp.", "NKE": "Nike Inc.",
    # Industrial
    "CAT": "Caterpillar Inc.", "HON": "Honeywell International Inc.", "GE": "General Electric Co.",
    "BA": "Boeing Co.", "MMM": "3M Co.",
    # Telecom & Media
    "T": "AT&T Inc.", "VZ": "Verizon Communications Inc.", "DIS": "Walt Disney Co.",
}

# Company ticker → sector mapping
TICKER_SECTOR = {
    # Technology (10)
    "AAPL": "Technology", "MSFT": "Technology", "GOOGL": "Technology",
    "AMZN": "Technology", "META": "Technology",
    "NVDA": "Technology", "TSLA": "Technology", "INTC": "Technology",
    "AMD": "Technology", "ORCL": "Technology",
    # Finance (10)
    "JPM": "Finance", "BAC": "Finance", "WFC": "Finance",
    "GS": "Finance", "MS": "Finance",
    "C": "Finance", "AXP": "Finance", "BLK": "Finance",
    "SCHW": "Finance", "USB": "Finance",
    # Healthcare (8)
    "JNJ": "Healthcare", "PFE": "Healthcare", "MRK": "Healthcare",
    "ABBV": "Healthcare", "UNH": "Healthcare", "CVS": "Healthcare",
    "BMY": "Healthcare", "AMGN": "Healthcare",
    # Energy (7)
    "XOM": "Energy", "CVX": "Energy", "COP": "Energy",
    "SLB": "Energy", "PSX": "Energy", "VLO": "Energy", "MPC": "Energy",
    # Retail & Consumer (7)
    "WMT": "Retail", "TGT": "Retail", "HD": "Retail", "COST": "Retail",
    "MCD": "Retail", "SBUX": "Retail", "NKE": "Retail",
    # Industrial (5)
    "CAT": "Industrial", "HON": "Industrial", "GE": "Industrial",
    "BA": "Industrial", "MMM": "Industrial",
    # Telecom & Media (3)
    "T": "Telecom", "VZ": "Telecom", "DIS": "Telecom",
}

# Title-phrase regex for locating executive mentions in Item 10 text. Filing
# text has all whitespace/newlines collapsed to single spaces (see
# extract_text_from_sgml), so a plain "name , title" regex can't reliably
# separate a person's name from adjacent title words (e.g. "Maestri Senior
# Vice President" — "Senior Vice President" looks just as name-shaped as
# "Maestri"). Instead we locate known title phrases, then run spaCy NER on a
# short window of text immediately before each one to find the real PERSON
# entity closest to it.
_TITLE_PHRASES = (
    r"(?:President and )?Chief Executive Officer|"
    r"Chief Financial Officer|Chief Operating Officer|Chief Technology Officer|"
    r"Chief Marketing Officer|Chief Accounting Officer|Chief Legal Officer|"
    r"Chief Information Officer|Chief Human Resources Officer|"
    r"Executive Vice President|Senior Vice President|Vice President|"
    r"General Counsel and Secretary|General Counsel|Corporate Secretary|"
    r"Chairman of the Board|Chairman|President|Treasurer|Secretary"
)
_TITLE_PATTERN = re.compile(r"(?:" + _TITLE_PHRASES + r")")
_NAME_WINDOW = 60   # chars of context before a title phrase to search for a PERSON entity

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


_ITEM_1A_PATTERN = re.compile(r"Item\s*1A\.?\s*Risk Factors", re.IGNORECASE)
_ITEM_1B_PATTERN = re.compile(r"Item\s*1B\.?", re.IGNORECASE)
_ITEM_1A_MAX_SECTION_LEN = 200_000


def isolate_risk_factors_section(text: str) -> str:
    """Isolate the Item 1A "Risk Factors" section from the filing text, so
    risk-keyword matching doesn't accidentally pull sentences from unrelated
    sections (financial footnotes, compensation plans, debt indentures) that
    happen to share vocabulary. "Item 1A. Risk Factors" appears multiple
    times per filing (once in the table of contents, once as the real
    section heading, sometimes again as a cross-reference) — of these, the
    real heading is the one with a legitimate, reasonably-sized span of text
    before the next "Item 1B" heading. Falls back to the full text if no
    such span is found (e.g. non-standard formatting)."""
    starts = [m.end() for m in _ITEM_1A_PATTERN.finditer(text)]
    best_start, best_end, best_len = None, None, 0
    for start in starts:
        end_match = _ITEM_1B_PATTERN.search(text, start)
        if not end_match:
            continue
        length = end_match.start() - start
        if length > _ITEM_1A_MAX_SECTION_LEN:
            continue
        if length > best_len:
            best_start, best_end, best_len = start, end_match.start(), length
    if best_start is None:
        return text
    return text[best_start:best_end]


# Patterns that indicate a matched "sentence" is really financial-statement/
# XBRL boilerplate (footnote headers, subsidiary lists, table fragments)
# rather than genuine risk-factor narrative.
_NON_NARRATIVE_PATTERNS = re.compile(
    r"Abstract\]|Months Ended|Ended Dec|\d{1,3}(?:,\d{3})+|Delaware|Bahamas|"
    r"^\s*\d+\s|Investment Co\.|Neftegas",
    re.IGNORECASE,
)


def _looks_like_narrative(sentence: str) -> bool:
    """Heuristic filter: does this look like actual risk-factor prose, or a
    financial-statement/XBRL/subsidiary-list fragment that happens to contain
    the keyword incidentally?"""
    words = sentence.split()
    if len(words) < 8:
        return False
    digit_chars = sum(1 for c in sentence if c.isdigit())
    if digit_chars / max(len(sentence), 1) > 0.15:
        return False
    if _NON_NARRATIVE_PATTERNS.search(sentence):
        return False
    return True


# Split text into sentences on period boundaries. Bounded and linear —
# avoids the catastrophic backtracking of a per-keyword "[^.]*kw[^.]*\." scan
# over multi-megabyte filings (some bank 10-Ks extract to 20 MB+).
_SENTENCE_SPLIT = re.compile(r"[^.]*\.")


def _sentences(source: str) -> list[str]:
    return [m.group(0).strip() for m in _SENTENCE_SPLIT.finditer(source)]


def extract_risks(text: str) -> list[dict]:
    """Find risk-related sentences and classify them. Prefers the isolated
    Item 1A "Risk Factors" section (falling back to the full filing text for
    any keyword not found there), and within each, picks the first sentence
    that reads like genuine narrative prose rather than a boilerplate
    fragment. Sentences are split once per source and reused across all
    keywords, keeping this linear in the size of the text."""
    risk_section = isolate_risk_factors_section(text)
    # Only treat the section as usable if isolation actually found something
    # substantial; otherwise go straight to the full text.
    section_sentences = _sentences(risk_section) if len(risk_section) > 500 else []
    full_sentences: list[str] | None = None   # split lazily, only if needed

    text_lower = text.lower()
    found = []
    for keyword, category in _RISK_CATEGORIES.items():
        if keyword not in text_lower:
            continue
        description = keyword
        # Try the risk section first, then fall back to the full document.
        for sentences in (section_sentences, None):
            if sentences is None:
                if full_sentences is None:
                    full_sentences = _sentences(text)
                sentences = full_sentences
            for sentence in sentences:
                if keyword in sentence.lower() and _looks_like_narrative(sentence):
                    description = sentence
                    break
            if description != keyword:
                break
        found.append({
            "id": keyword.replace(" ", "_"),
            "description": description[:300],
            "category": category,
        })
    return found


def _dedupe_repeated_name(name: str) -> str:
    """Collapse "Timothy D. Cook Timothy D. Cook" -> "Timothy D. Cook", and
    "ANDREW P. SWIGER Andrew P. Swiger" -> "Andrew P. Swiger" — filing text
    sometimes repeats a name back-to-back (e.g. certification pages, once in
    ALL CAPS and once title-cased), and spaCy captures the whole repeated
    span as one entity. Prefer the less-shouty half when they match."""
    words = name.split()
    half = len(words) // 2
    first_half, second_half = words[:half], words[half : half * 2]
    if half and [w.lower() for w in first_half] == [w.lower() for w in second_half]:
        all_caps_count = lambda ws: sum(1 for w in ws if w.isupper() and len(w) > 1)
        return " ".join(second_half if all_caps_count(first_half) > all_caps_count(second_half) else first_half)
    return name


def extract_executives(text: str) -> list[dict]:
    """Extract executive name + title pairs from Item 10 section via title-phrase
    matching + spaCy PERSON-entity recognition on the text just before each title."""
    executives = []
    seen_ids: set[str] = set()
    nlp = _nlp()

    for match in _TITLE_PATTERN.finditer(text):
        title = match.group(0).strip()
        window_start = max(0, match.start() - _NAME_WINDOW)
        window = text[window_start:match.start()]

        doc = nlp(window)
        people = [ent.text.strip() for ent in doc.ents if ent.label_ == "PERSON"]
        if not people:
            continue
        name = _dedupe_repeated_name(people[-1])   # closest PERSON entity to the title
        if len(name.split()) < 2 or len(name) >= 50:
            continue

        exec_id = name.lower().replace(" ", "_")
        if exec_id in seen_ids:
            continue
        seen_ids.add(exec_id)
        executives.append({
            "id": exec_id,
            "name": name,
            "title": title[:100],
        })
        if len(executives) >= 20:   # cap per filing
            break
    return executives


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
    Read chunks.jsonl, extract entities per filing, and upsert into TigerGraph
    using pyTigerGraph's REST++ batch API.
    """
    with open(chunks_path) as f:
        chunks = [json.loads(line) for line in f]

    # Group chunks by (ticker, year) to process per filing
    filings: dict[str, list[dict]] = defaultdict(list)
    for chunk in chunks:
        key = f"{chunk['ticker']}/{chunk['year']}"
        filings[key].append(chunk)

    # Map (ticker, year) -> raw filing path so entity extraction can run on the
    # clean, deduplicated filing text rather than the reconstructed chunk text.
    # The chunk text carries a per-chunk "Company: T Year: Y —" prefix and a
    # 64-word overlap between adjacent chunks; joining it back together injects
    # that boilerplate mid-document and inflates size ~30%, which both degrades
    # section detection (Item 1A isolation) and makes keyword scanning much
    # slower. Re-extracting from the raw file avoids all of that.
    from ingestion.parse_filings import find_filing_files, extract_text_from_sgml
    raw_paths: dict[str, pathlib.Path] = {}
    for filepath, ticker, year in find_filing_files(settings.SEC_DATA_DIR):
        raw_paths[f"{ticker}/{year}"] = filepath

    # Resume support: skip filings whose Document vertex is already present, so
    # a run interrupted partway (e.g. by a TigerGraph workspace idle-stall) can
    # be continued without redoing everything. The single filing that was
    # in-flight when interrupted may have a Document but incomplete edges, so we
    # always reprocess the last already-loaded filing (in processing order) to
    # guarantee it ends up complete. All upserts are idempotent, so reprocessing
    # is safe.
    skip_keys: set[str] = set()
    if os.getenv("RESUME_LOAD") == "1":
        existing_docs = {d["v_id"] for d in conn.getVertices("Document", limit=1000)}
        ordered_keys = list(filings.keys())
        loaded_in_order = [
            k for k in ordered_keys
            if f"{k.split('/')[0]}_{k.split('/')[1]}_10K" in existing_docs
        ]
        skip_keys = set(loaded_in_order)
        if loaded_in_order:
            skip_keys.discard(loaded_in_order[-1])   # reprocess the interrupted one
        print(f"  Resume mode: {len(skip_keys)} already-loaded filings will be skipped.")

    print(f"\nLoading {len(filings) - len(skip_keys)} filings into TigerGraph...")

    # Track documents for SUCCEEDED_BY edges
    ticker_docs: dict[str, list[str]] = defaultdict(list)

    for filing_key, filing_chunks in tqdm(filings.items(), desc="Loading graph"):
        ticker, year = filing_key.split("/")
        if filing_key in skip_keys:
            # Still record the doc for SUCCEEDED_BY chaining, but don't re-upsert.
            ticker_docs[ticker].append((year, f"{ticker}_{year}_10K"))
            continue
        raw_path = raw_paths.get(filing_key)
        if raw_path is not None:
            full_text = extract_text_from_sgml(raw_path)
        else:
            # Fallback: reconstruct from chunks if the raw file is unavailable
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
        # The Risk vertex itself is shared across all companies (keyed by
        # keyword, e.g. "supply_chain") so that the cross-company "which
        # companies share risk X" query mode works. But that means the
        # vertex's own `description` can only hold one representative
        # sentence — not specific to whichever company is being queried. The
        # real, per-document description is stored on the MENTIONS_RISK edge
        # instead, so GraphRAG's per-company queries show a description
        # that's actually about the company being asked about.
        risks = extract_risks(full_text)
        for risk in risks:
            conn.upsertVertex("Risk", risk["id"], {
                "description": risk["description"],
                "category": risk["category"],
            })
            conn.upsertEdge(
                "Document", doc_id, "MENTIONS_RISK", "Risk", risk["id"],
                attributes={"description": risk["description"]},
            )
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
