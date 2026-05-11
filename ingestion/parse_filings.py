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
    SEC full-submission.txt files are SGML wrappers containing embedded HTML.
    We extract the first <TEXT>...</TEXT> block that belongs to the 10-K document,
    then strip HTML tags to get clean plain text.
    """
    raw = filepath.read_text(encoding="utf-8", errors="ignore")

    # Pull the HTML content out of the SGML <TEXT> block
    text_match = re.search(r"<TEXT>(.*?)</TEXT>", raw, re.DOTALL | re.IGNORECASE)
    if text_match:
        html_content = text_match.group(1)
    else:
        html_content = raw  # fallback: parse whole file

    soup = BeautifulSoup(html_content, "lxml")
    for tag in soup(["script", "style", "head", "meta", "link", "ix:header"]):
        tag.decompose()

    text = soup.get_text(separator=" ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


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

    total_tokens = sum(len(c["text"].split()) * 4 // 3 for c in all_chunks)
    print(f"\n✅ {len(all_chunks):,} chunks written to {settings.CHUNKS_PATH}")
    print(f"   Estimated tokens: {total_tokens:,}")
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
