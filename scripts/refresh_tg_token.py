#!/usr/bin/env python3
"""
Refresh the TigerGraph Savanna JWT token.

Usage:
    python3 scripts/refresh_tg_token.py

Reads TIGERGRAPH_SECRET from .env, exchanges it for a fresh token,
and writes TIGERGRAPH_TOKEN back to .env automatically.

If TIGERGRAPH_SECRET is not set, you can pass it on the command line:
    python3 scripts/refresh_tg_token.py --secret YOUR_SECRET_HERE
"""

import argparse
import re
import sys
import pathlib
import requests

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env"


def load_env_value(key: str) -> str:
    """Read a single key=value from .env (not using python-dotenv to avoid import issues)."""
    if not ENV_FILE.exists():
        return ""
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line.startswith(f"{key}="):
            return line[len(key) + 1:].strip()
    return ""


def update_env_value(key: str, value: str) -> None:
    """Update or append a key=value in .env."""
    content = ENV_FILE.read_text() if ENV_FILE.exists() else ""
    pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
    if pattern.search(content):
        new_content = pattern.sub(f"{key}={value}", content)
    else:
        new_content = content.rstrip("\n") + f"\n{key}={value}\n"
    ENV_FILE.write_text(new_content)
    print(f"✅ Updated {key} in .env")


def get_token(host: str, secret: str) -> str:
    """Exchange a secret for a JWT token via TigerGraph Savanna REST."""
    url = f"https://{host}/gsql/v1/tokens"
    print(f"Fetching token from: {url}")
    resp = requests.post(url, json={"secret": secret}, timeout=20)
    if resp.status_code != 200:
        print(f"❌ HTTP {resp.status_code}: {resp.text}")
        sys.exit(1)
    data = resp.json()
    token = data.get("token") or data.get("results", {}).get("token", "")
    if not token:
        print(f"❌ Unexpected response: {data}")
        sys.exit(1)
    return token


def main():
    parser = argparse.ArgumentParser(description="Refresh TigerGraph Savanna JWT token")
    parser.add_argument("--secret", default="", help="TigerGraph secret (overrides .env)")
    parser.add_argument("--host",   default="", help="TigerGraph host (overrides .env)")
    args = parser.parse_args()

    host   = args.host   or load_env_value("TIGERGRAPH_HOST")
    secret = args.secret or load_env_value("TIGERGRAPH_SECRET")

    if not host:
        print("❌ TIGERGRAPH_HOST not set in .env or --host flag")
        sys.exit(1)

    if not secret:
        print("❌ TIGERGRAPH_SECRET not set in .env or --secret flag")
        print("\nTo get your secret:")
        print("  1. Log in to TigerGraph Savanna: https://tgcloud.io")
        print("  2. Go to Admin Portal → User Management → Secrets")
        print("  3. Create or copy a secret, then run:")
        print(f"     python3 scripts/refresh_tg_token.py --secret YOUR_SECRET")
        sys.exit(1)

    token = get_token(host, secret)
    print(f"✅ Got fresh token (first 40 chars): {token[:40]}...")

    update_env_value("TIGERGRAPH_TOKEN", token)
    print("\n🔑 Token saved to .env. You can now run:")
    print("   python3 -m ingestion.build_graph")


if __name__ == "__main__":
    main()
