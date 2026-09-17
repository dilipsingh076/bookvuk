from decimal import Decimal
from typing import Literal, Optional
from urllib.parse import parse_qsl, quote_plus, urlencode, urlsplit, urlunsplit

from pydantic import model_validator
from pydantic_settings import BaseSettings

# Fields required when DATABASE_URL is not supplied.
_DISCRETE_DB_FIELDS = (
    "DATABASE_USERNAME",
    "DATABASE_PASSWORD",
    "DATABASE_HOSTNAME",
    "DATABASE_PORT",
    "DATABASE_NAME",
)

# Supabase's dashboard hands out a URI with this literal placeholder in it.
_PASSWORD_PLACEHOLDERS = ("[YOUR-PASSWORD]", "[your-password]", "YOUR-PASSWORD")

# Secrets copied from public documentation. Treated as compromised.
_KNOWN_WEAK_SECRET_KEYS = {
    # FastAPI's OAuth2/JWT tutorial.
    "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7",
    "secret",
    "changeme",
    "replace-me",
}


def _normalize_scheme(url: str) -> str:
    """`postgres://` is not a SQLAlchemy dialect name; Supabase and Heroku both emit it."""
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://") :]
    return url


def _with_ssl_params(url: str, sslmode: Optional[str], sslrootcert: Optional[str]) -> str:
    """Merge SSL settings into the URL query string without clobbering explicit values."""
    if not sslmode and not sslrootcert:
        return url
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    if sslmode:
        query.setdefault("sslmode", sslmode)
    if sslrootcert:
        query.setdefault("sslrootcert", sslrootcert)
    return urlunsplit(parts._replace(query=urlencode(query)))


class Settings(BaseSettings):
    # Supply *either* DATABASE_URL (paste Supabase's connection string) *or* the
    # five discrete DATABASE_* fields. DATABASE_URL wins when both are present.
    DATABASE_URL: Optional[str] = None

    DATABASE_HOSTNAME: Optional[str] = None
    DATABASE_PORT: Optional[str] = None
    DATABASE_PASSWORD: Optional[str] = None
    DATABASE_NAME: Optional[str] = None
    DATABASE_USERNAME: Optional[str] = None

    # Managed Postgres (Supabase, RDS, Neon) requires TLS: set DATABASE_SSLMODE=require.
    # Leave unset for a local server. Use verify-full + DATABASE_SSLROOTCERT to also
    # authenticate the server certificate.
    DATABASE_SSLMODE: Optional[str] = None
    DATABASE_SSLROOTCERT: Optional[str] = None

    # Connection pool. A remote database needs pre-ping and recycling because idle
    # connections are dropped by the provider's pooler and by NAT timeouts.
    # Whether to test a pooled connection before handing it out.
    #
    # It costs one full round trip *per request*: measured at 243 ms against the
    # Tokyo database, on every endpoint, which is the single most expensive line
    # in the connection setup. Next door to the database it is about 2 ms and not
    # worth thinking about.
    #
    # It is on by default because it is the safe direction: a managed pooler
    # closes idle connections and pre-ping discards those instead of failing a
    # request. Turn it off where the round trip is expensive — and then keep
    # DATABASE_POOL_RECYCLE_SECONDS below the provider's idle timeout, which is
    # what actually prevents the stale connection rather than merely detecting it.
    DATABASE_POOL_PRE_PING: bool = True
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 5
    DATABASE_POOL_RECYCLE_SECONDS: int = 1800
    DATABASE_CONNECT_TIMEOUT: int = 10

    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    JWT_ISSUER: Optional[str] = None
    JWT_AUDIENCE: Optional[str] = None

    # Browser origins allowed to call the API, comma-separated.
    CORS_ORIGINS: str = "http://localhost:5173"

    LOG_LEVEL: str = "INFO"
    # JSON lines in deployment; set false for readable local output.
    LOG_JSON: bool = True

    # Public URL of the storefront: used in e-mail links and the sitemap.
    SITE_URL: str = "http://localhost:5173"
    SITE_NAME: str = "BookVuk"

    # ----- e-mail -----
    # Without SMTP_HOST, mail is written to the log instead of sent. That keeps
    # development and tests working without credentials, and makes it obvious in
    # production if the provider was never configured.
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_USE_TLS: bool = True
    EMAIL_FROM: str = "no-reply@bookvuk.com"
    EMAIL_FROM_NAME: str = "BookVuk"

    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 60

    # ----- payments (Razorpay) -----
    # Both key sets live here at once and `RAZORPAY_MODE` picks which is used, so
    # switching between them is a one-word change rather than a copy-paste of
    # secrets — and the set you are not using stays on hand instead of being lost.
    #
    # Unset (for the active mode) means payments are disabled: checkout still
    # records orders, but marks them unpaid rather than pretending money was
    # collected.
    RAZORPAY_MODE: Literal["test", "live"] = "test"

    RAZORPAY_TEST_KEY_ID: Optional[str] = None
    RAZORPAY_TEST_KEY_SECRET: Optional[str] = None
    # Set separately in the dashboard under Webhooks; signs webhook bodies, and
    # is NOT the same value as the API key secret. Each mode has its own.
    RAZORPAY_TEST_WEBHOOK_SECRET: Optional[str] = None

    RAZORPAY_LIVE_KEY_ID: Optional[str] = None
    RAZORPAY_LIVE_KEY_SECRET: Optional[str] = None
    RAZORPAY_LIVE_WEBHOOK_SECRET: Optional[str] = None

    CURRENCY: str = "INR"

    # ----- order pricing -----
    # A single book by India Post or a courier runs roughly 40-80 rupees. 49 is
    # the usual shelf rate for an online bookshop here: it does not cover the
    # worst case, and the threshold below is what makes the average work.
    SHIPPING_FLAT_RATE: str = "49.00"
    # Free shipping above this subtotal; 0 disables the threshold.
    FREE_SHIPPING_THRESHOLD: str = "499"
    # Zero, and not as a placeholder — for two independent reasons.
    #
    # `books.price` is the MRP printed on the cover, which under the Legal
    # Metrology (Packaged Commodities) Rules, 2011 is declared *inclusive of all
    # taxes*. Adding anything to it sells above MRP, which is an offence under
    # the Legal Metrology Act, 2009.
    #
    # And printed books (HSN 4901) are NIL-rated under GST anyway, so the right
    # figure would be zero even if the price were tax-exclusive.
    #
    # It stays a setting rather than being deleted because the day this shop
    # sells something that is *not* a printed book — a tote bag, an e-book —
    # that item is taxable. At that point this belongs on the product, not on
    # the store: one rate for a mixed basket is wrong for part of it.
    #
    # It was 0.08 — a US sales-tax placeholder, charged on top of an MRP.
    TAX_RATE: str = "0"

    # ----- buyback / store credit -----
    # The most of an order that store credit may pay for. Without a cap, a seller
    # with a large balance checks out for nothing and the shop ships stock with no
    # money arriving — buyback would become a way to drain inventory. 50% keeps
    # every order part-paid in cash while leaving the credit clearly worth having.
    WALLET_MAX_REDEMPTION_PERCENT: int = 50

    # Where an approved seller actually posts the book.
    #
    # An approved buyback told the seller to "post it to us" and no address
    # existed anywhere — not in the config, the API or the UI. The one physical
    # action the flow depends on had no destination. Left blank the UI now says
    # the address will be emailed, rather than issuing an instruction it cannot
    # complete; set it and the address appears wherever that instruction does.
    #
    # Newlines separate lines of the address, e.g.
    #   BUYBACK_SHIP_TO_ADDRESS="BookVuk Returns\n12 Example Road\nMumbai 400001"
    BUYBACK_SHIP_TO_ADDRESS: str = ""

    @property
    def buyback_ship_to(self) -> Optional[list[str]]:
        """The address as lines, or None when it has not been configured."""
        lines = [ln.strip() for ln in self.BUYBACK_SHIP_TO_ADDRESS.splitlines() if ln.strip()]
        return lines or None

    # How long a buyback offer stands. `quoted_amount` is snapshotted so a later
    # rate change cannot move an offer somebody accepted — but nothing ended one
    # either, so a book posted six months after the quote still had to be bought
    # at a price that may no longer make sense.
    #
    # A setting rather than a constant: the right window depends on how fast the
    # shop's rates move, which is an operational question.
    #
    # 0 disables expiry, which is what every request predating this behaves as.
    BUYBACK_QUOTE_VALID_DAYS: int = 14

    # Photographs the seller attaches to a request. Four because past that they
    # stop saying anything new about the grade, and each is a file kept forever.
    MAX_BUYBACK_PHOTOS: int = 4

    # The resolved credentials. Everything that talks to Razorpay reads these
    # rather than the per-mode fields, so exactly one place decides which set of
    # keys is live and no call site can accidentally mix them.

    @property
    def razorpay_key_id(self) -> Optional[str]:
        return self.RAZORPAY_LIVE_KEY_ID if self.RAZORPAY_MODE == "live" else self.RAZORPAY_TEST_KEY_ID

    @property
    def razorpay_key_secret(self) -> Optional[str]:
        return (
            self.RAZORPAY_LIVE_KEY_SECRET
            if self.RAZORPAY_MODE == "live"
            else self.RAZORPAY_TEST_KEY_SECRET
        )

    @property
    def razorpay_webhook_secret(self) -> Optional[str]:
        return (
            self.RAZORPAY_LIVE_WEBHOOK_SECRET
            if self.RAZORPAY_MODE == "live"
            else self.RAZORPAY_TEST_WEBHOOK_SECRET
        )

    @property
    def payments_enabled(self) -> bool:
        return bool(self.razorpay_key_id and self.razorpay_key_secret)

    @property
    def email_enabled(self) -> bool:
        return bool(self.SMTP_HOST)

    @property
    def object_storage_enabled(self) -> bool:
        """True when uploads should go to Supabase Storage rather than local disk."""
        return bool(self.SUPABASE_URL and self.SUPABASE_SERVICE_KEY)

    # ---- Cash on delivery ----
    #
    # India buys a lot of books this way, and a shop that only takes cards turns
    # those customers away at the last step. The cost is real though: an order
    # refused at the door is the courier fee both ways plus the handling, and
    # that loss scales with the order value — hence the ceiling.
    COD_ENABLED: bool = True
    # Above this total, online payment only. 0 disables the ceiling.
    COD_MAX_ORDER_TOTAL: Decimal = Decimal("3000")

    # ---- Object storage for uploaded book covers ----
    #
    # A container filesystem is ephemeral: on Render, Fly and every other
    # free/PaaS tier, anything written at runtime is gone on the next deploy or
    # restart. The 200-odd seeded covers survive because they are baked into the
    # image; a cover an admin uploads is not, so without these it silently
    # disappears and the book falls back to the placeholder.
    #
    # Leave them unset and uploads keep writing to `static/books/` exactly as
    # before, which is what local development wants.
    SUPABASE_URL: Optional[str] = None
    # The **service role** key, not the anon key: the anon key cannot write to a
    # bucket under the default policies. It is a server-side secret — it must
    # never be given to the frontend.
    SUPABASE_SERVICE_KEY: Optional[str] = None
    SUPABASE_STORAGE_BUCKET: str = "book-covers"

    # `UploadFile.read()` pulls the whole body into memory, so without a ceiling a
    # single request can exhaust a 512MB free instance. Covers are ~60KB.
    MAX_COVER_UPLOAD_BYTES: int = 5 * 1024 * 1024

    # ---- Retention: how long rows that are no longer needed are kept ----
    #
    # Nothing in this application used to delete a row it had finished with, and
    # four tables grew without bound as a result — `refresh_tokens` reached more
    # rows than `books` on a database with twenty users. None of them hold
    # business data past these windows; see `core/sweeps.py`.
    #
    # Days, all of them. Set any to 0 to keep that table forever.

    # A refresh token past its expiry is already refused. The grace period only
    # exists so "when did this session end" stays answerable for a while.
    REFRESH_TOKEN_RETENTION_DAYS: int = 7
    # Completed jobs only. A job that exhausted its retries has `completed_at`
    # NULL and `last_error` set, so it never matches the sweep's predicate —
    # which is deliberate: that row is the record of the failure.
    JOB_RETENTION_DAYS: int = 30
    # Read notifications only. Unread ones stay regardless of age, because the
    # unread badge is the entire point of the table.
    NOTIFICATION_RETENTION_DAYS: int = 90
    # A rate-limit window that has closed can never be consulted again.
    RATE_LIMIT_RETENTION_DAYS: int = 1
    # Ceiling on rows removed per table per pass. The sweep runs inside the API
    # process when RUN_WORKER_IN_PROCESS is on, so an unbounded DELETE would hold
    # locks for as long as it took while requests waited behind it.
    RETENTION_SWEEP_BATCH: int = 1000

    # Run the job queue inside the API process instead of a separate container.
    #
    # The worker is normally its own service, which is the right shape when you
    # can afford one. Render's free tier only offers web
    # services — background workers are a paid service type — so a free
    # deployment has nowhere to run `scripts/worker.py` and order confirmations,
    # refunds and abandoned-cart sweeps would queue up forever.
    #
    # Safe to enable with several uvicorn workers: claiming is
    # `FOR UPDATE SKIP LOCKED`, so two loops never take the same job.
    RUN_WORKER_IN_PROCESS: bool = False
    WORKER_BATCH_SIZE: int = 10
    WORKER_IDLE_SLEEP_SECONDS: float = 2.0
    WORKER_SWEEP_INTERVAL_SECONDS: float = 900.0

    # "memory" (per worker) or "database" (shared across workers, no Redis).
    RATE_LIMIT_BACKEND: str = "memory"

    # Auth rate limits, per client IP.
    LOGIN_RATE_LIMIT_ATTEMPTS: int = 10
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = 300
    REGISTER_RATE_LIMIT_ATTEMPTS: int = 5
    REGISTER_RATE_LIMIT_WINDOW_SECONDS: int = 3600

    class Config:
        env_file = ".env"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @model_validator(mode="after")
    def _validate_razorpay_mode(self):
        """Refuse a key that disagrees with the mode it is filed under.

        Razorpay key ids announce their own mode — `rzp_test_…` / `rzp_live_…` —
        which makes the worst mistake in this whole area cheap to catch: a live
        key pasted into the test slot takes real money from real cards during
        what somebody believes is a test, and a test key in the live slot means a
        shop that silently cannot be paid.

        Only checked when the id carries the prefix, so an unusual key format
        cannot lock the app out of booting.
        """
        for mode in ("test", "live"):
            key_id = (getattr(self, f"RAZORPAY_{mode.upper()}_KEY_ID") or "").strip()
            if not key_id.startswith("rzp_"):
                continue
            if not key_id.startswith(f"rzp_{mode}_"):
                found = key_id.split("_")[1] if "_" in key_id[4:] else "unknown"
                raise ValueError(
                    f"RAZORPAY_{mode.upper()}_KEY_ID looks like a {found}-mode key "
                    f"({key_id[:12]}…). Swapping these takes real money in test, or "
                    f"leaves live checkout unable to charge."
                )
        return self

    @model_validator(mode="after")
    def _validate_secret_key(self):
        key = (self.SECRET_KEY or "").strip()
        # This is the key printed in FastAPI's public OAuth2/JWT tutorial. Anyone
        # who recognises it can mint a token with role=admin, so refuse to boot.
        if key in _KNOWN_WEAK_SECRET_KEYS:
            raise ValueError(
                "SECRET_KEY is a publicly known example key. Anyone could forge admin "
                "tokens with it. Generate a new one: openssl rand -hex 32"
            )
        if len(key) < 32:
            raise ValueError(
                f"SECRET_KEY is too short ({len(key)} chars); use at least 32. "
                "Generate one: openssl rand -hex 32"
            )
        return self

    @model_validator(mode="after")
    def _validate_database_config(self):
        if self.DATABASE_URL:
            url = self.DATABASE_URL.strip()
            if any(p in url for p in _PASSWORD_PLACEHOLDERS):
                raise ValueError(
                    "DATABASE_URL still contains Supabase's [YOUR-PASSWORD] placeholder. "
                    "Replace it with the real database password."
                )
            return self

        missing = [f for f in _DISCRETE_DB_FIELDS if not getattr(self, f)]
        if missing:
            raise ValueError(
                "Incomplete database configuration: set DATABASE_URL, or all of "
                f"{', '.join(_DISCRETE_DB_FIELDS)}. Missing: {', '.join(missing)}."
            )
        return self

    @property
    def sqlalchemy_url(self) -> str:
        """The single source of truth for the DB URL, used by the app and by Alembic."""
        if self.DATABASE_URL:
            url = _normalize_scheme(self.DATABASE_URL.strip())
        else:
            # Percent-encode the credentials: managed providers generate passwords
            # containing @ / ? # which would otherwise corrupt the URL.
            url = (
                "postgresql://"
                f"{quote_plus(self.DATABASE_USERNAME)}:{quote_plus(self.DATABASE_PASSWORD)}"
                f"@{self.DATABASE_HOSTNAME}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"
            )
        return _with_ssl_params(url, self.DATABASE_SSLMODE, self.DATABASE_SSLROOTCERT)

    @property
    def safe_database_target(self) -> str:
        """host:port/dbname with credentials stripped, for logs and CLI output."""
        parts = urlsplit(self.sqlalchemy_url)
        host = parts.hostname or "?"
        port = parts.port or 5432
        return f"{host}:{port}{parts.path}"


settings = Settings()
