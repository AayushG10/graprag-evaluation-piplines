#!/usr/bin/env bash
# Full data pipeline: download → parse → graph
# Usage: bash scripts/run_pipeline.sh [--full]

set -e
cd "$(dirname "$0")/.."

echo "=== Step 1: Download SEC filings ==="
python -m ingestion.download_sec "$@"

echo ""
echo "=== Step 2: Parse filings + build FAISS index ==="
python -m ingestion.parse_filings

echo ""
echo "=== Step 3: Build TigerGraph knowledge graph ==="
python -m ingestion.build_graph

echo ""
echo "🎉 Data pipeline complete!"
