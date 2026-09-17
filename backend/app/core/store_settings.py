"""The commerce rules, resolved from the database over the environment.

`pricing.py` and `wallet.py` compute money without a database session — they are
pure functions over their inputs, which is what makes them testable — so this
module resolves the values for them rather than threading a session through
every caller.

**The environment is the default, the row is the override.** A NULL column means
"whatever the deployment was configured with", so the app behaves identically
before anyone opens the settings screen, and clearing a field hands it back to
the environment instead of requiring the admin to remember the original number.

Cached for a few seconds, for a specific reason: `compute_totals` is called on
every cart render and every checkout, and a database round trip per call — 150ms
to a remote pooler — would be paid on the hot path to read six numbers that
change a few times a year. The cost is that another worker's change takes up to
`CACHE_TTL_SECONDS` to be seen; a pricing change is not an emergency, and the
worker that made it sees it at once because saving invalidates locally.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from decimal import Decimal
from typing import Final, Optional

from .config import settings

CACHE_TTL_SECONDS: Final[float] = 10.0

#: Exactly the fields the admin screen may write. Anything absent from this list
#: cannot be changed through the API even if a column exists — secrets and
#: infrastructure settings stay in the environment, where an admin session cannot
#: reach them.
EDITABLE_FIELDS: Final[tuple[str, ...]] = (
    "shipping_flat_rate",
    "free_shipping_threshold",
    "tax_rate",
    "cod_enabled",
    "cod_max_order_total",
    "wallet_max_redemption_percent",
)


@dataclass(frozen=True)
class StoreConfig:
    shipping_flat_rate: Decimal
    free_shipping_threshold: Decimal
    tax_rate: Decimal
    cod_enabled: bool
    cod_max_order_total: Decimal
    wallet_max_redemption_percent: int


def _from_env() -> StoreConfig:
    return StoreConfig(
        shipping_flat_rate=Decimal(str(settings.SHIPPING_FLAT_RATE)),
        free_shipping_threshold=Decimal(str(settings.FREE_SHIPPING_THRESHOLD)),
        tax_rate=Decimal(str(settings.TAX_RATE)),
        cod_enabled=bool(settings.COD_ENABLED),
        cod_max_order_total=Decimal(str(settings.COD_MAX_ORDER_TOTAL)),
        wallet_max_redemption_percent=int(settings.WALLET_MAX_REDEMPTION_PERCENT),
    )


_lock = threading.Lock()
_cached: Optional[StoreConfig] = None
_cached_at: float = 0.0


def invalidate() -> None:
    """Drop the cache. Called after a save so the writer sees its own change."""
    global _cached, _cached_at
    with _lock:
        _cached = None
        _cached_at = 0.0


def _read_row():
    """The single settings row, or None. Opens its own short session."""
    from ..database.db import SessionLocal
    from ..database.models.store_settings import StoreSettings

    session = SessionLocal()
    try:
        return session.query(StoreSettings).first()
    finally:
        session.close()


def _fresh(now: float) -> bool:
    return _cached is not None and now - _cached_at < CACHE_TTL_SECONDS


def current() -> StoreConfig:
    """The rules in force right now.

    The refresh is **single-flight**: the lock is held across the database read,
    so concurrent callers that all miss the cache produce one query between them
    rather than one each.

    Holding a lock across I/O is usually wrong, and here it is the lesser evil.
    This is called from inside request handlers that are *already* holding a
    pooled connection, so a refresh that fans out opens a second connection per
    in-flight request: twelve concurrent checkouts on an expired cache wanted
    twenty-four connections from a pool of ten, and the failure lands exactly when
    traffic is highest. Serialising them costs the waiters one round trip, once
    per TTL, and they would have been queueing on the pool otherwise.
    """
    global _cached, _cached_at

    with _lock:
        if _fresh(time.monotonic()):
            return _cached  # type: ignore[return-value]

        # Re-checked under the lock, so the eleven callers that queued behind the
        # one doing the read return from cache instead of repeating it.
        try:
            row = _read_row()
        except Exception:
            # A settings lookup must never be the thing that takes checkout down.
            # The environment is a complete, valid configuration on its own.
            row = None

        base = _from_env()
        resolved = base if row is None else StoreConfig(
            **{
                field: (
                    getattr(base, field)
                    if getattr(row, field) is None
                    else _coerce(field, getattr(row, field))
                )
                for field in EDITABLE_FIELDS
            }
        )
        _cached = resolved
        _cached_at = time.monotonic()
        return resolved


def _coerce(field: str, value):
    if field == "cod_enabled":
        return bool(value)
    if field == "wallet_max_redemption_percent":
        return int(value)
    return Decimal(str(value))
