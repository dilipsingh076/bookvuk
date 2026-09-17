"""The job-processing loop, in one place.

`scripts/worker.py` (a separate container) and the in-process thread started by
`main.py` on a single-service deployment both call `run_worker_loop`. They are
deliberately not two implementations: this repository has already paid for that
mistake once — there were two ways to cancel an order and only one of them
restored stock, so an admin cancellation quietly lost inventory (see
`core/fulfilment.py`). A queue drain has the same shape of risk, because the
divergence would only show up as jobs that never run.

Which process runs it is a deployment decision, not a behavioural one:

* **Separate container** — the right shape when you can afford it. Scale by
  running more of them.
* **Inside the API** — for hosts whose free tier only offers web services, so
  there is nowhere else to put it. Set `RUN_WORKER_IN_PROCESS=true`.

Either way, claiming uses `SELECT ... FOR UPDATE SKIP LOCKED`, so any number of
loops can run at once and a job still goes to exactly one of them.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Callable

from app.core import job_handlers  # noqa: F401  (registers handlers)
from app.core.jobs import claim_batch, run_job
from app.core.sweeps import run_due_sweeps
from app.database.db import SessionLocal

logger = logging.getLogger("bookvuk.worker")

# How long the in-process worker waits before restarting after a crash.
RESTART_DELAY_SECONDS = 30.0


def _quietly(action: Callable[[], None]) -> None:
    """Run a cleanup call that is allowed to fail.

    `rollback()` and `close()` both round-trip to the server, so a connection
    that has already dropped makes *cleanup* raise. Letting that propagate loses
    the original error and takes the loop down with it.
    """
    try:
        action()
    except Exception:
        logger.debug("worker cleanup failed", exc_info=True)


def run_worker_loop(
    *,
    should_stop: Callable[[], bool],
    batch_size: int = 10,
    idle_sleep: float = 2.0,
    sweep_interval: float = 900.0,
    once: bool = False,
) -> int:
    """Claim and run due jobs until `should_stop()` says otherwise.

    Returns the number of jobs processed. `once` drains what is currently due and
    returns, which is what a test or a cron-style invocation wants.
    """
    processed = 0
    # Sweep immediately on start, then on the interval. `once` therefore sweeps
    # exactly once before it drains.
    next_sweep = 0.0

    while not should_stop():
        session = SessionLocal()
        try:
            if sweep_interval > 0 and time.monotonic() >= next_sweep:
                # Abandoned carts have no request to hang a job off — the customer
                # left — so something has to go looking for them.
                counts = run_due_sweeps(session)
                if any(counts.values()):
                    logger.info("sweeps queued work", extra=counts)
                next_sweep = time.monotonic() + sweep_interval

            jobs = claim_batch(session, limit=batch_size)
            if not jobs:
                if once:
                    break
                time.sleep(idle_sleep)
                continue

            for job in jobs:
                if should_stop():
                    break
                run_job(session, job)
                processed += 1
        except Exception:
            # A failure in the claim loop itself must not kill the worker.
            logger.exception("worker loop error")
            _quietly(session.rollback)
            time.sleep(idle_sleep)
        finally:
            # Both of these talk to the database, so both can raise when the
            # connection is the thing that broke — and `finally` is outside the
            # `except` above, so an exception here escapes the loop entirely.
            # That is how a dropped connection killed the worker outright.
            _quietly(session.close)

    return processed


def start_worker_thread(
    *,
    batch_size: int = 10,
    idle_sleep: float = 2.0,
    sweep_interval: float = 900.0,
) -> tuple[threading.Thread, threading.Event]:
    """Run the loop in a daemon thread beside the API. Returns the thread and its stop flag.

    A thread rather than a task on the event loop: every handler and every
    SQLAlchemy call below is blocking, so on the loop it would stall request
    serving for the duration of each job.

    The thread is a daemon so a shutdown is never held up by an idle sleep; the
    stop event is still set first, which lets a job that is mid-flight finish.
    Anything it does not reach stays claimable — a job whose lease expires is
    picked up again rather than lost.
    """
    stop = threading.Event()

    def _run() -> None:
        logger.info("in-process worker started")
        processed = 0
        # Restarts, because in this mode nothing else will. A separate worker
        # container that dies is restarted by the orchestrator; a thread that dies
        # inside a healthy API is simply gone, and the only symptom is that jobs
        # stop being processed — no failed request, no unhealthy instance,
        # nothing to notice until a customer asks where their confirmation is.
        while not stop.is_set():
            try:
                processed += run_worker_loop(
                    should_stop=stop.is_set,
                    batch_size=batch_size,
                    idle_sleep=idle_sleep,
                    sweep_interval=sweep_interval,
                )
            except Exception:
                logger.exception("in-process worker crashed; restarting")
                # Long enough that a persistent failure (bad credentials, the
                # database gone) does not become a hot loop of stack traces.
                stop.wait(RESTART_DELAY_SECONDS)
                continue
            # A clean return means `should_stop` went true.
            break
        logger.info("in-process worker stopped", extra={"processed": processed})

    thread = threading.Thread(target=_run, name="bookvuk-worker", daemon=True)
    thread.start()
    return thread, stop
