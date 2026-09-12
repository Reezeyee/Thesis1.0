"""
Generates a new API key for the Coffee Cherry Maturity Detection API and stores
ONLY its SHA-256 hash in backend/api_key.hash. The server never keeps the raw
key anywhere -- it just hashes whatever comes in on the X-API-Key header and
compares that to this file.

Run this once to set the API up, and again any time you want to rotate the key
(e.g. if it leaks). After rotating, update the key everywhere that calls this
API (the website's VITE_BACKEND_API_KEY, curl scripts, Postman, etc.) -- the
old key stops working the moment this script runs.

Usage:
    python backend/generate_api_key.py
"""
import hashlib
import secrets
from pathlib import Path

HASH_FILE = Path(__file__).resolve().parent / "api_key.hash"


def main() -> None:
    key = secrets.token_hex(32)
    key_hash = hashlib.sha256(key.encode("utf-8")).hexdigest()

    HASH_FILE.write_text(key_hash + "\n")

    print("=" * 72)
    print("New API key generated. COPY IT NOW -- it is shown only once and is")
    print("never written to disk anywhere. Only its hash is saved.")
    print("=" * 72)
    print(f"\n  API key:  {key}\n")
    print(f"Hash saved to: {HASH_FILE}")
    print("\nAdd the key to whatever calls this API, e.g. the website's .env:")
    print("  VITE_BACKEND_API_KEY=<the key above>")
    print("\nAnd send it on every request (except /health) as a header:")
    print("  X-API-Key: <the key above>")


if __name__ == "__main__":
    main()
