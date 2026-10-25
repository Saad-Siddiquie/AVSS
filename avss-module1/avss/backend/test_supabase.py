"""
Quick Supabase connectivity test.
Run from the backend directory with the venv active:

    python test_supabase.py

Tests:
  1. PostgreSQL connection via SQLAlchemy
  2. Supabase Storage bucket access
"""
import os
import sys

# Load .env
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✓ .env loaded")
except ImportError:
    print("⚠ python-dotenv not installed — reading from environment")

DB_URL        = os.getenv("DATABASE_URL", "")
SUPABASE_URL  = os.getenv("SUPABASE_URL", "")
ANON_KEY      = os.getenv("SUPABASE_ANON_KEY", "")
SERVICE_KEY   = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET        = os.getenv("SUPABASE_STORAGE_BUCKET", "avss-videos")

print(f"\n── Configuration ──────────────────────────────")
print(f"  DATABASE_URL:          {DB_URL[:60]}..." if len(DB_URL) > 60 else f"  DATABASE_URL:          {DB_URL}")
print(f"  SUPABASE_URL:          {SUPABASE_URL}")
print(f"  SUPABASE_ANON_KEY:     {ANON_KEY[:30]}..." if ANON_KEY else "  SUPABASE_ANON_KEY:     ❌ NOT SET")
print(f"  SUPABASE_SERVICE_KEY:  {'SET (' + SERVICE_KEY[:20] + '...)' if SERVICE_KEY and 'YOUR_' not in SERVICE_KEY else '❌ NOT SET — needed for Storage uploads'}")
print(f"  STORAGE_BUCKET:        {BUCKET}")

# ── Test 1: PostgreSQL ────────────────────────────────────────────────────────
print(f"\n── Test 1: PostgreSQL Connection ───────────────")
if not DB_URL or "sqlite" in DB_URL:
    print("  ⚠ Still using SQLite — switch DATABASE_URL to Supabase PostgreSQL URI")
else:
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(DB_URL, connect_args={"connect_timeout": 10})
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            print(f"  ✓ Connected! PostgreSQL version: {version[:50]}")
    except Exception as e:
        print(f"  ❌ Connection failed: {e}")
        print("     → Check DATABASE_URL and that your IP is allowed in Supabase")

# ── Test 2: Supabase Storage ──────────────────────────────────────────────────
print(f"\n── Test 2: Supabase Storage ────────────────────")
if not SUPABASE_URL or not SERVICE_KEY or "YOUR_" in SERVICE_KEY:
    print("  ⚠ SUPABASE_SERVICE_ROLE_KEY not set — skipping Storage test")
    print("    → Get it from: Supabase Dashboard → Settings → API → service_role → Reveal")
else:
    try:
        from supabase import create_client
        client = create_client(SUPABASE_URL, SERVICE_KEY)
        buckets = client.storage.list_buckets()
        names   = [b.name for b in buckets]
        print(f"  ✓ Storage connected! Buckets: {names}")
        if BUCKET in names:
            print(f"  ✓ Bucket '{BUCKET}' exists and is ready")
        else:
            print(f"  ⚠ Bucket '{BUCKET}' not found — creating it...")
            client.storage.create_bucket(BUCKET, options={"public": True})
            print(f"  ✓ Bucket '{BUCKET}' created successfully")
    except ImportError:
        print("  ❌ supabase-py not installed — run: pip install supabase")
    except Exception as e:
        print(f"  ❌ Storage test failed: {e}")

print(f"\n── Summary ─────────────────────────────────────")
print("  Run this after filling in both keys in .env")
print("  If both tests pass, restart the backend and the project is ready.\n")
