"""Request-scoped logging with correlation ids.

Emits one JSON line per request so a log aggregator can parse it without a
grok pattern, and attaches an `X-Request-ID` header so a user-reported error can
be traced back to its log line. Dependency-free on purpose.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp

REQUEST_ID_HEADER = "X-Request-ID"

# Readable by any log record while a request is in flight.
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

logger = logging.getLogger("bookvuk.access")

# Paths that would otherwise flood the log with health-check noise.
_QUIET_PATHS = frozenset(("/health", "/health/ready", "/favicon.ico"))


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "request_id": getattr(record, "request_id", request_id_var.get()),
            "message": record.getMessage(),
        }
        for key in ("method", "path", "status", "duration_ms", "client"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class _RequestIdFilter(logging.Filter):
    """Guarantee every record has `request_id`.

    Records from libraries (uvicorn's startup lines, SQLAlchemy, anything else)
    never set it. Without this the plain-text formatter's `%(request_id)s` raises
    for each of those records, and logging prints a traceback instead of the line.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = request_id_var.get()
        return True


def configure_logging(*, level: str = "INFO", as_json: bool = True) -> None:
    handler = logging.StreamHandler()
    handler.addFilter(_RequestIdFilter())
    handler.setFormatter(
        JsonFormatter()
        if as_json
        else logging.Formatter("%(asctime)s %(levelname)s [%(request_id)s] %(name)s %(message)s")
    )

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())

    # uvicorn duplicates access lines that this middleware already covers.
    logging.getLogger("uvicorn.access").disabled = True
    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = True


class RequestContextMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        # Honour an upstream id so a trace spans the proxy and the app.
        incoming = request.headers.get(REQUEST_ID_HEADER)
        request_id = incoming or uuid.uuid4().hex[:16]
        token = request_id_var.set(request_id)
        request.state.request_id = request_id

        started = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            response.headers[REQUEST_ID_HEADER] = request_id
            return response
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            if request.url.path not in _QUIET_PATHS:
                logger.info(
                    "request",
                    extra={
                        "request_id": request_id,
                        "method": request.method,
                        "path": request.url.path,
                        "status": status,
                        "duration_ms": duration_ms,
                        "client": request.client.host if request.client else None,
                    },
                )
            request_id_var.reset(token)
