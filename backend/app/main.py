import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.api.routes import auth, admin, catalog, customer

app = FastAPI()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

origins = ["http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(customer.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(catalog.router)

# serve static assets from backend (covers, etc.)
# `main.py` is at `backend/app/main.py`, so `parents[1]` is `backend/`.
static_dir = Path(__file__).resolve().parents[1] / "static"
static_dir.mkdir(parents=True, exist_ok=True)

# Back-compat: some clients use `/assets/*`, others use `/static/*`.
app.mount("/assets", StaticFiles(directory=str(static_dir)), name="assets")
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
