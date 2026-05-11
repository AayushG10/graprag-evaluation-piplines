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

# Full dataset — 25 companies across 5 sectors
SP500_TICKERS = [
    # Tech
    "AAPL", "MSFT", "GOOGL", "AMZN", "META",
    # Finance
    "JPM", "BAC", "WFC", "GS", "MS",
    # Energy
    "XOM", "CVX", "COP",
    # Healthcare
    "JNJ", "PFE", "MRK",
    # Retail
    "WMT", "TGT", "HD", "COST",
    # Industrial
    "CAT", "HON", "GE", "T", "VZ",
]

# Start with 5 tickers to test the pipeline end-to-end before scaling
PILOT_TICKERS = ["AAPL", "MSFT", "JPM", "XOM", "JNJ"]


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
                        help="Download all 25 tickers (takes ~20 min)")
    parser.add_argument("--email", default="hackathon@example.com")
    args = parser.parse_args()

    years = [int(y) for y in settings.FILING_YEARS.split(",")]
    tickers = SP500_TICKERS if args.full else (args.tickers or PILOT_TICKERS)

    print(f"Downloading {len(tickers)} tickers × {len(years)} years "
          f"= {len(tickers) * len(years)} filings\n")
    download_10k(tickers=tickers, years=years, email=args.email)
