#!/usr/bin/env python3
"""Background job worker.

Run alongside the API (a second container off the same image):

  PYTHONPATH=. ./venv/bin/python scripts/worker.py

Several workers can run at once — claiming uses `FOR UPDATE SKIP LOCKED`, so each
job goes to exactly one of them. Stop with SIGINT/SIGTERM; the current batch is
allowed to finish rather than being abandoned mid-job.

The loop itself lives in `app/core/worker_runtime.py`, because a single-service
deployment runs the same loop inside the API process (`RUN_WORKER_IN_PROCESS`).
Two copies of it would be free to drift, and the drift would show up only as
jobs that silently never ran.
"""

from __future__ import annotations

import argparse
import logging
import signal
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings  # noqa: E402
from app.core.jobs import registered_kinds  # noqa: E402
from app.core.logging import configure_logging  # noqa: E402
from app.core.worker_runtime import run_worker_loop  # noqa: E402

logger = logging.getLogger("bookvuk.worker")

_stopping = False


def _request_stop(signum, _frame):
    global _stopping
    _stopping = True
    logger.info("stop requested (signal %s); finishing the current batch", signum)


def main() -> int:
    parser = argparse.ArgumentParser(description="Process queued background jobs")
    parser.add_argument("--batch-size", type=int, default=settings.WORKER_BATCH_SIZE)
    parser.add_argument("--idle-sleep", type=float, default=settings.WORKER_IDLE_SLEEP_SECONDS,
                        help="seconds to wait when the queue is empty")
    parser.add_argument("--once", action="store_true",
                        help="drain what is due and exit (useful in tests/CI)")
    parser.add_argument("--sweep-interval", type=float, default=settings.WORKER_SWEEP_INTERVAL_SECONDS,
                        help="seconds between periodic scans (abandoned carts); 0 disables")
    args = parser.parse_args()

    configure_logging(level=settings.LOG_LEVEL, as_json=settings.LOG_JSON)
    signal.signal(signal.SIGINT, _request_stop)
    signal.signal(signal.SIGTERM, _request_stop)

    logger.info(
        "worker started",
        extra={"db": settings.safe_database_target, "kinds": ",".join(registered_kinds())},
    )

    processed = run_worker_loop(
        should_stop=lambda: _stopping,
        batch_size=args.batch_size,
        idle_sleep=args.idle_sleep,
        sweep_interval=args.sweep_interval,
        once=args.once,
    )

    logger.info("worker stopped", extra={"processed": processed})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
