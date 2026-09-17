#!/usr/bin/env python3
"""
Verify the configured database is reachable, and report TLS status and latency.

Run from the backend directory:

  PYTHONPATH=. ./venv/bin/python scripts/check_db.py

Use this right after pointing .env at Supabase (or any managed Postgres) to
confirm credentials, networking and TLS before running migrations. Prints the
target host but never the password.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import text  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.database.db import engine  # noqa: E402

# Tables the app expects once migrations have run.
EXPECTED_TABLES = (
    "users",
    "books",
    "categories",
    "authors",
    "carts",
    "cart_items",
    "orders",
    "order_items",
    "notifications",
    "wishlist",
)


def main() -> int:
    print(f"target      : {settings.safe_database_target}")
    sslmode = settings.DATABASE_SSLMODE or "(unset)"
    print(f"sslmode     : {sslmode}")

    started = time.perf_counter()
    try:
        connection = engine.connect()
    except Exception as exc:  # noqa: BLE001 - surface the driver's own message
        print(f"\nFAILED to connect: {type(exc).__name__}: {exc}", file=sys.stderr)
        print(
            "\nCommon causes:\n"
            "  - wrong password (Supabase: Project Settings -> Database -> Reset password)\n"
            "  - IPv6-only direct connection: use the pooler host, or add the IPv4 add-on\n"
            "  - TLS required: set DATABASE_SSLMODE=require\n"
            "  - free-tier project paused: resume it in the Supabase dashboard",
            file=sys.stderr,
        )
        return 1

    with connection:
        connect_ms = (time.perf_counter() - started) * 1000
        print(f"connected in: {connect_ms:.0f} ms")

        version = connection.execute(text("show server_version")).scalar()
        who = connection.execute(text("select current_user")).scalar()
        database = connection.execute(text("select current_database()")).scalar()
        print(f"server      : PostgreSQL {version}")
        print(f"user/db     : {who} @ {database}")

        # Ask the driver, not pg_stat_ssl: behind a pooler (Supabase's Supavisor,
        # pgbouncer) pg_stat_ssl describes the pooler-to-Postgres hop, which is
        # internal and unencrypted, so it reports false even though our own
        # connection is encrypted. ssl_in_use is the client's own view.
        raw = connection.connection.dbapi_connection
        if raw.info.ssl_in_use:
            protocol = raw.info.ssl_attribute("protocol")
            cipher = raw.info.ssl_attribute("cipher")
            print(f"tls         : ENCRYPTED ({protocol}, {cipher})")
        else:
            print("tls         : NOT encrypted - set DATABASE_SSLMODE=require")

        started = time.perf_counter()
        connection.execute(text("select 1"))
        print(f"query rtt   : {(time.perf_counter() - started) * 1000:.1f} ms")

        present = {
            row[0]
            for row in connection.execute(
                text("select tablename from pg_tables where schemaname = 'public'")
            )
        }
        missing = [t for t in EXPECTED_TABLES if t not in present]
        revision = (
            connection.execute(text("select version_num from alembic_version")).scalar()
            if "alembic_version" in present
            else None
        )
        print(f"alembic     : {revision or 'not stamped - run `alembic upgrade head`'}")

        if missing:
            print(f"tables      : MISSING {', '.join(missing)}")
        else:
            counts = ", ".join(
                f"{t}={connection.execute(text(f'select count(*) from {t}')).scalar()}"
                for t in ("books", "authors", "categories", "users")
            )
            print(f"tables      : all present ({counts})")

    print("\nOK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
