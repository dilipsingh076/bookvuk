#!/usr/bin/env python3
"""Create (or promote) an admin user.

`/auth/register` always assigns role="customer", so there is otherwise no way to
get an admin account and the whole /api/admin surface is unreachable.

Run from the backend directory:

  PYTHONPATH=. ./venv/bin/python scripts/create_admin.py --email admin@example.com

The password is read interactively so it does not land in shell history. Pass
--password to script it (e.g. in a provisioning job).
"""

from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database.db import SessionLocal  # noqa: E402
from app.database.models.user import User  # noqa: E402
from app.utils.utils import hash_password  # noqa: E402

MIN_PASSWORD_LENGTH = 8


def main() -> int:
    parser = argparse.ArgumentParser(description="Create or promote an admin user")
    parser.add_argument("--email", required=True)
    parser.add_argument("--username", help="defaults to the email local-part")
    parser.add_argument("--full-name", default=None)
    parser.add_argument("--password", help="prompted for if omitted")
    parser.add_argument(
        "--promote",
        action="store_true",
        help="if the email already exists, set its role to admin instead of failing",
    )
    args = parser.parse_args()

    password = args.password or getpass.getpass("Password: ")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise SystemExit(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")

    username = args.username or args.email.split("@")[0]

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == args.email).first()
        if existing:
            if not args.promote:
                raise SystemExit(
                    f"{args.email} already exists with role={existing.role!r}. "
                    "Re-run with --promote to make it an admin."
                )
            existing.role = "admin"
            existing.password_hash = hash_password(password)
            db.commit()
            print(f"Promoted {args.email} to admin (password reset).")
            return 0

        user = User(
            email=args.email,
            username=username,
            full_name=args.full_name,
            password_hash=hash_password(password),
            role="admin",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"Created admin {user.email} (id={user.id}).")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
