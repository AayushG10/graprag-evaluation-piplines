"""
Step 1 of data pipeline: Download SEC 10-K filings from EDGAR.

Usage:
    python -m ingestion.download_sec                  # pilot: 5 tickers
    python -m ingestion.download_sec --full           # all 25 tickers
    python -m ingestion.download_sec --tickers AAPL MSFT
"""

import argparse
from sec_edgar_downloader import Downloader
from config import settings

# Round 2 — 50 companies across 8 sectors (~100M tokens)
SP500_TICKERS = [
    # Technology (10)
    "AAPL", "MSFT", "GOOGL", "AMZN", "META",
    "NVDA", "TSLA", "INTC", "AMD", "ORCL",
    # Finance (10)
    "JPM", "BAC", "WFC", "GS", "MS",
    "C", "AXP", "BLK", "SCHW", "USB",
    # Healthcare (8)
    "JNJ", "PFE", "MRK", "ABBV",
    "UNH", "CVS", "BMY", "AMGN",
    # Energy (7)
    "XOM", "CVX", "COP", "SLB",
    "PSX", "VLO", "MPC",
    # Retail & Consumer (7)
    "WMT", "TGT", "HD", "COST",
    "MCD", "SBUX", "NKE",
    # Industrial (5)
    "CAT", "HON", "GE", "BA", "MMM",
    # Telecom & Media (3)
    "T", "VZ", "DIS",
]

# Round 1 pilot tickers (already downloaded)
PILOT_TICKERS = ["AAPL", "MSFT", "JPM", "XOM", "JNJ"]

# Round 2 — new tickers only (skip already downloaded)
ROUND2_NEW_TICKERS = [t for t in SP500_TICKERS if t not in PILOT_TICKERS]


def download_10k(
    tickers: list[str],
    years: list[int],
    email: str = "hackathon@example.com",
) -> None:
    dl = Downloader("GraphRAGFinance", email, settings.SEC_DATA_DIR)
    total = len(tickers) * len(years)
    done = 0
    for ticker in tickers:
        for year in years:
            done += 1
            print(f"[{done}/{total}] Downloading {ticker} 10-K {year}...")
            try:
                dl.get(
                    "10-K",
                    ticker,
                    after=f"{year}-01-01",
                    before=f"{year}-12-31",
                    download_details=False,
                )
            except Exception as exc:
                print(f"  ⚠ Skipped {ticker} {year}: {exc}")
    print(f"\n✅ Done. Files saved to: {settings.SEC_DATA_DIR}/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download SEC 10-K filings")
    parser.add_argument("--tickers", nargs="+", default=None)
    parser.add_argument("--full", action="store_true",
                        help="Download all 50 tickers (takes ~45 min)")
    parser.add_argument("--round2", action="store_true",
                        help="Download only the 45 new Round 2 tickers")
    parser.add_argument("--email", default="hackathon@example.com")
    args = parser.parse_args()

    years = [int(y) for y in settings.FILING_YEARS.split(",")]
    if args.full:
        tickers = SP500_TICKERS
    elif args.round2:
        tickers = ROUND2_NEW_TICKERS
    else:
        tickers = args.tickers or PILOT_TICKERS

    print(f"Downloading {len(tickers)} tickers × {len(years)} years "
          f"= {len(tickers) * len(years)} filings\n")
    download_10k(tickers=tickers, years=years, email=args.email)
