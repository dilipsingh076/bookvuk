"""The job loop's survival, not its happy path.

A worker that stops claiming is the failure that is hardest to notice: no
request fails, no instance goes unhealthy, and the only symptom is that
confirmation e-mails quietly stop arriving. These tests pin the two ways it
happened.
"""

from __future__ import annotations

import threading

import pytest

from app.core import worker_runtime


class _DeadSession:
    """A session whose connection dropped: every call to it raises."""

    def __init__(self, on_close=None):
        self.closed = False
        self._on_close = on_close

    def rollback(self):
        raise OSError("could not receive data from server")

    def close(self):
        self.closed = True
        if self._on_close:
            self._on_close()
        raise OSError("could not receive data from server")


def test_a_broken_connection_does_not_kill_the_loop(monkeypatch):
    """`rollback()` and `close()` also talk to the server, so they raise too.

    `close()` runs in a `finally`, outside the `except` that guards the body —
    which is exactly how a dropped connection took the whole worker down.
    """
    calls = {"n": 0}

    def _claim(session, limit):
        calls["n"] += 1
        raise OSError("connection dropped mid-claim")

    monkeypatch.setattr(worker_runtime, "SessionLocal", lambda: _DeadSession())
    monkeypatch.setattr(worker_runtime, "claim_batch", _claim)
    monkeypatch.setattr(worker_runtime, "run_due_sweeps", lambda s: {})
    monkeypatch.setattr(worker_runtime.time, "sleep", lambda _s: None)

    # Stop after three passes; without the fix the first one raises out.
    stop_after = iter([False, False, False, True])
    processed = worker_runtime.run_worker_loop(
        should_stop=lambda: next(stop_after, True),
        sweep_interval=0,
    )

    assert processed == 0
    assert calls["n"] == 3, "the loop should have kept going after each failure"


def test_the_thread_restarts_itself_when_the_loop_escapes(monkeypatch):
    """Nothing else restarts it in this mode.

    A separate worker *container* that dies is restarted by the orchestrator. A
    thread inside a healthy API is simply gone.
    """
    attempts = []
    restarted = threading.Event()

    def _loop(*, should_stop, **_kwargs):
        attempts.append(1)
        if len(attempts) == 1:
            raise RuntimeError("connection pool exhausted")
        restarted.set()
        return 0

    monkeypatch.setattr(worker_runtime, "run_worker_loop", _loop)
    # Don't wait the real backoff in a test.
    monkeypatch.setattr(worker_runtime, "RESTART_DELAY_SECONDS", 0.01)

    thread, stop = worker_runtime.start_worker_thread()
    try:
        assert restarted.wait(timeout=5), "the worker did not come back after crashing"
        assert len(attempts) >= 2
    finally:
        stop.set()
        thread.join(timeout=5)


def test_a_clean_return_does_not_restart(monkeypatch):
    """`should_stop` going true must end the thread, not spin it back up."""
    attempts = []

    def _loop(*, should_stop, **_kwargs):
        attempts.append(1)
        return 7

    monkeypatch.setattr(worker_runtime, "run_worker_loop", _loop)
    thread, stop = worker_runtime.start_worker_thread()
    thread.join(timeout=5)

    assert not thread.is_alive()
    assert len(attempts) == 1


def test_quietly_swallows_a_failing_cleanup():
    def _boom():
        raise OSError("gone")

    worker_runtime._quietly(_boom)  # must not raise


def test_quietly_still_runs_the_action():
    ran = []
    worker_runtime._quietly(lambda: ran.append(1))
    assert ran == [1]
