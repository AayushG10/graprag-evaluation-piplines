"""
Step 2 of data pipeline: Parse downloaded HTML filings → plain text →
overlapping chunks → chunks.jsonl + FAISS index.

Usage:
    python -m ingestion.parse_filings
"""

import json
import pathlib
import re
import os
import numpy as np
from tqdm import tqdm
from bs4 import BeautifulSoup
from sentence_transformers import SentenceTransformer
import faiss
from config import settings


# ── Text extraction ──────────────────────────────────────────────────────────

def extract_text_from_sgml(filepath: pathlib.Path) -> str:
    """
    SEC full-submission.txt files are SGML wrappers containing multiple
    embedded HTML/text documents. We extract ALL <TEXT>...</TEXT> blocks
    (main 10-K body + all exhibits) to maximise token coverage.
    """
    raw = filepath.read_text(encoding="utf-8", errors="ignore")

    # Extract ALL <TEXT>...</TEXT> blocks (not just the first)
    text_blocks = re.findall(r"<TEXT>(.*?)</TEXT>", raw, re.DOTALL | re.IGNORECASE)

    if not text_blocks:
        text_blocks = [raw]  # fallback: parse whole file

    all_text_parts = []
    for block in text_blocks:
        # Skip pure XML data blocks (standalone XBRL instance/schema documents
        # that start with an XML declaration and contain no human-readable
        # prose at all). Do NOT skip on "<xbrl" alone — modern 10-Ks use
        # Inline XBRL, where the entire human-readable filing itself is
        # wrapped in XBRL tags, so that heuristic was discarding the main
        # document (Item 1 Business, Item 1A Risk Factors, MD&A, etc.) for
        # every filing. The ix:header/xbrli:xbrl/xbrl tag removal below plus
        # the post-extraction length check already handle telling prose
        # apart from pure machine-readable data.
        if block.strip().startswith("<?xml"):
            continue
        # Skip binary/encoded blocks
        if "begin 644" in block[:100]:
            continue

        soup = BeautifulSoup(block, "lxml")
        # These contain no visible content — safe to remove entirely,
        # including their children (ix:header holds hidden XBRL tagging
        # metadata, not prose).
        for tag in soup(["script", "style", "head", "meta", "link", "ix:header"]):
            tag.decompose()
        # These are just outer wrapper/namespace containers around the
        # *entire* visible document in Inline XBRL filings — unwrap (drop
        # the tag but keep its children) rather than decompose, or the
        # whole human-readable filing gets deleted along with the wrapper.
        for tag in soup(["xbrli:xbrl", "xbrl"]):
            tag.unwrap()

        text = soup.get_text(separator=" ")
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) > 200:  # skip near-empty blocks
            all_text_parts.append(text)

    return " ".join(all_text_parts)


def find_filing_files(raw_dir: str) -> list[tuple[pathlib.Path, str, str]]:
    """
    Walk data/raw/sec-edgar-filings/ and find all full-submission.txt files.
    Returns list of (filepath, ticker, year).
    """
    results = []
    # sec-edgar-downloader saves to <raw_dir>/sec-edgar-filings/
    base = pathlib.Path(raw_dir) / "sec-edgar-filings"
    if not base.exists():
        base = pathlib.Path(raw_dir)  # fallback if structure differs

    for ticker_dir in sorted(base.iterdir()):
        if not ticker_dir.is_dir():
            continue
        ticker = ticker_dir.name
        filing_type_dir = ticker_dir / "10-K"
        if not filing_type_dir.exists():
            continue
        for filing_dir in sorted(filing_type_dir.iterdir()):
            if not filing_dir.is_dir():
                continue
            year = _parse_year_from_accession(filing_dir.name, filing_dir)
            submission = filing_dir / "full-submission.txt"
            if submission.exists():
                results.append((submission, ticker, year))
    return results


def _parse_year_from_accession(folder_name: str, folder_path: pathlib.Path) -> str:
    """
    Accession numbers look like: 0000320193-22-000108
    The middle segment (22) is the 2-digit year → 2022.
    """
    match = re.search(r"-(\d{2})-", folder_name)
    if match:
        two_digit = int(match.group(1))
        return str(2000 + two_digit)
    # fallback: folder mtime
    import time
    return str(time.gmtime(folder_path.stat().st_mtime).tm_year)


# ── Boilerplate detection ─────────────────────────────────────────────────────

_BOILERPLATE_PHRASES = [
    "securities and exchange commission",
    "table of contents",
    "form 10-k",
    "large accelerated filer",
    "emerging growth company",
    "financial statement schedules",
    "exhibits, financial statement",
    "incorporated by reference",
]

def _is_boilerplate(chunk: str) -> bool:
    """Return True if the chunk is mostly SEC header/table-of-contents noise."""
    lower = chunk.lower()
    hits = sum(1 for phrase in _BOILERPLATE_PHRASES if phrase in lower)
    return hits >= 2


# ── Chunking ─────────────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    """
    Sliding window chunker operating on word tokens.
    chunk_size: words per chunk
    overlap: words shared between adjacent chunks
    """
    words = text.split()
    if len(words) <= chunk_size:
        return [text]

    chunks = []
    step = chunk_size - overlap
    for start in range(0, len(words) - overlap, step):
        chunk = " ".join(words[start : start + chunk_size])
        chunks.append(chunk)
        if start + chunk_size >= len(words):
            break
    return chunks


# ── Main processing ───────────────────────────────────────────────────────────

def process_all_filings() -> list[dict]:
    """
    Walk data/raw/, extract text from every filing, chunk it, and
    write all chunks to data/processed/chunks.jsonl.

    Each line:
        {"text": "...", "source": "AAPL/2022", "chunk_id": 0}
    """
    os.makedirs(settings.PROCESSED_DIR, exist_ok=True)
    filings = find_filing_files(settings.SEC_DATA_DIR)
    print(f"Found {len(filings)} filing files across all tickers/years\n")

    all_chunks = []
    chunk_id = 0

    with open(settings.CHUNKS_PATH, "w") as out:
        for filepath, ticker, year in tqdm(filings, desc="Parsing filings"):
            try:
                text = extract_text_from_sgml(filepath)
                if len(text) < 500:   # skip near-empty files
                    continue
                chunks = chunk_text(text, settings.CHUNK_SIZE, settings.CHUNK_OVERLAP)
                for chunk in chunks:
                    if _is_boilerplate(chunk):
                        continue
                    # Prefix ticker+year so FAISS can match company-specific queries
                    enriched = f"Company: {ticker} Year: {year} — {chunk}"
                    record = {
                        "text": enriched,
                        "source": f"{ticker}/{year}",
                        "ticker": ticker,
                        "year": year,
                        "chunk_id": chunk_id,
                    }
                    out.write(json.dumps(record) + "\n")
                    all_chunks.append(record)
                    chunk_id += 1
            except Exception as exc:
                print(f"  ⚠ Skipped {filepath}: {exc}")

    total_words = sum(len(c["text"].split()) for c in all_chunks)
    total_tokens = total_words * 4 // 3   # ~1.33 tokens per word
    print(f"\n✅ {len(all_chunks):,} chunks written to {settings.CHUNKS_PATH}")
    print(f"   Total words:      {total_words:,}")
    print(f"   Estimated tokens: {total_tokens:,}")
    print(f"   Filings parsed:   {len(filings)}")
    print(f"   Avg chunks/filing: {len(all_chunks)//max(len(filings),1)}")
    return all_chunks


# ── FAISS index builder ───────────────────────────────────────────────────────

def build_faiss_index(chunks: list[dict] | None = None) -> None:
    """
    Embed all chunks with sentence-transformers and build a FAISS
    flat inner-product index (equivalent to cosine similarity on
    normalised vectors). Saves index to FAISS_INDEX_PATH.
    """
    if chunks is None:
        # Load from disk if called standalone
        with open(settings.CHUNKS_PATH) as f:
            chunks = [json.loads(line) for line in f]

    print(f"\nEmbedding {len(chunks):,} chunks with {settings.EMBED_MODEL}...")
    model = SentenceTransformer(settings.EMBED_MODEL)

    texts = [c["text"] for c in chunks]
    # Encode in batches of 256 to avoid OOM
    embeddings = model.encode(
        texts,
        batch_size=256,
        normalize_embeddings=True,
        show_progress_bar=True,
    )
    embeddings = np.array(embeddings, dtype="float32")

    index = faiss.IndexFlatIP(settings.EMBED_DIMENSION)
    index.add(embeddings)
    faiss.write_index(index, settings.FAISS_INDEX_PATH)

    print(f"✅ FAISS index saved to {settings.FAISS_INDEX_PATH}")
    print(f"   Vectors: {index.ntotal:,}  Dimension: {settings.EMBED_DIMENSION}")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    chunks = process_all_filings()
    build_faiss_index(chunks)
