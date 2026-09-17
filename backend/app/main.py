import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import (
    auth,
    admin,
    buyback,
    catalog,
    customer,
    discovery,
    health,
    payment_webhook,
    profile,
    returns,
    reviews,
    shipping,
)
from app.core import job_handlers  # noqa: F401  (registers job handlers)
from app.core.config import settings
from app.core.logging import RequestContextMiddleware, configure_logging

configure_logging(level=settings.LOG_LEVEL, as_json=settings.LOG_JSON)

logger = logging.getLogger("bookvuk.main")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Optionally run the job queue inside this process.

    Off by default: the worker belongs in its own container, which is what lets
    it be scaled independently. It is switched on for
    single-service deployments — a host whose free tier offers only web services
    has nowhere else to run it, and without it order confirmations, refunds and
    abandoned-cart sweeps queue up and are never processed.

    Enabling it with several uvicorn workers is safe: each process starts one
    loop and claiming is `FOR UPDATE SKIP LOCKED`, so no job is run twice.
    """
    worker = None
    if settings.RUN_WORKER_IN_PROCESS:
        # Imported here rather than at module scope so the API does not pull in
        # the job handlers on deployments that do not use this.
        from app.core.worker_runtime import start_worker_thread

        thread, stop = start_worker_thread(
            batch_size=settings.WORKER_BATCH_SIZE,
            idle_sleep=settings.WORKER_IDLE_SLEEP_SECONDS,
            sweep_interval=settings.WORKER_SWEEP_INTERVAL_SECONDS,
        )
        worker = (thread, stop)
        logger.info("job queue running in-process")

    yield

    if worker is not None:
        thread, stop = worker
        stop.set()
        # Bounded: a job still running at shutdown keeps its claim and is picked
        # up again, so waiting forever buys nothing.
        thread.join(timeout=10)


app = FastAPI(title="BookVuk API", version="1.0.0", lifespan=lifespan)

# Correlation ids and one structured access line per request. Added before CORS
# so the id is attached even to responses CORS rejects.
app.add_middleware(RequestContextMiddleware)

# Configured via CORS_ORIGINS (comma-separated) so deployments can set their own
# frontend origin without a code change.
origins = settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(customer.router)
app.include_router(discovery.router)
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(admin.router)
app.include_router(catalog.router)
app.include_router(buyback.router)
app.include_router(payment_webhook.router)
app.include_router(reviews.router)
app.include_router(returns.router)
app.include_router(shipping.router)

# No static mount. Book covers live in Supabase Storage and `books.cover_image`
# holds their full URL, so the API serves no files of its own — which is also
# what keeps the image small and makes the instance's disk genuinely disposable.
# The storefront's own assets (logo, placeholder, og-card) are served by Next
# from `frontend/public`, and always were.
