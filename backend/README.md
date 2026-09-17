# BookVuk Backend

FastAPI + SQLAlchemy + Alembic on PostgreSQL. Serves the catalog, auth, customer
(cart / wishlist / orders) and admin APIs, plus book cover images from `static/`.

## Setup

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cp .env.example .env        # then edit .env
```

Point `.env` at a database (see below), then:

```bash
PYTHONPATH=. ./venv/bin/python scripts/check_db.py   # verify connectivity first
PYTHONPATH=. ./venv/bin/alembic upgrade head         # create the schema
PYTHONPATH=. ./venv/bin/uvicorn app.main:app --reload --port 8000
```

Seed the catalogue (the JSON lives in `frontend/data/`):

```bash
PYTHONPATH=. ./venv/bin/python scripts/seed_authors.py --json-path ../frontend/data/authors.json
PYTHONPATH=. ./venv/bin/python scripts/seed_books.py   --json-path ../frontend/data/bookCatalog.json
```

Interactive API docs: <http://localhost:8000/docs>

## Database configuration

Configure **either** `DATABASE_URL` **or** the five discrete `DATABASE_*` fields.
`DATABASE_URL` wins if both are set. Passwords are percent-encoded automatically,
so special characters need no escaping. See [.env.example](.env.example).

### Supabase (or any managed Postgres)

1. In the Supabase dashboard: **Connect** → copy a connection string.
   - **Session pooler** (port 5432) — use this for a long-running server like uvicorn. Reachable over IPv4 and IPv6.
   - **Transaction pooler** (port 6543) — for serverless/short-lived functions.
   - **Direct connection** (`db.<ref>.supabase.co`) — IPv6 only unless you buy the IPv4 add-on.
2. Put it in `.env` and require TLS:

   ```ini
   DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   DATABASE_SSLMODE=require
   ```

   Replace `[YOUR-PASSWORD]` with the real password — the app refuses to start
   with the placeholder still in place.
3. `python scripts/check_db.py` should report `tls: ENCRYPTED`.
4. `alembic upgrade head`, then run the seed scripts above.

Alembic and the API share one URL builder (`Settings.sqlalchemy_url`), so
migrations always connect with the same host and TLS settings as the app.

To verify the server certificate as well, set `DATABASE_SSLMODE=verify-full` and
`DATABASE_SSLROOTCERT=/path/to/prod-ca-2021.crt` (downloadable from Supabase).

The engine is configured for a remote database: `pool_pre_ping` (drops connections
the provider's pooler already closed), `pool_recycle`, a connect timeout and TCP
keepalives. Tune via the `DATABASE_POOL_*` / `DATABASE_CONNECT_TIMEOUT` settings.

### Local Postgres

```ini
DATABASE_HOSTNAME=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=...
DATABASE_NAME=BookVuk
```

Leave `DATABASE_SSLMODE` unset — a local server usually has no TLS.

## Layout

| Path | Contents |
| --- | --- |
| `app/main.py` | app factory, CORS, the in-process worker's lifespan. Serves no files |
| `app/api/routes/` | `auth` (`/auth`), `catalog` (`/api/catalog`), `customer` (`/api/customer`), `admin` (`/api/admin`) |
| `app/database/models/` | SQLAlchemy models |
| `app/schema/` | Pydantic request/response models |
| `app/core/` | settings (`config.py`), JWT + role dependencies (`security.py`) |
| `app/utils/utils.py` | argon2 password hashing |
| `alembic/versions/` | migrations |
| `scripts/` | `check_db.py`, `seed_books.py`, `seed_authors.py`, `worker.py` |
| `app/core/storage.py` | cover uploads to Supabase Storage |

## Admin access

`/auth/register` always creates a `customer`, so the `/api/admin` surface needs an
admin created out of band:

```bash
PYTHONPATH=. ./venv/bin/python scripts/create_admin.py --email admin@example.com
# add --promote to turn an existing account into an admin
```

## Auth model

- Passwords are hashed with **argon2** (needs `argon2-cffi`, in `requirements.txt`).
- **Access tokens** are HS256 JWTs carrying `user_id`, `role` and `typ: "access"`,
  expiring after `ACCESS_TOKEN_EXPIRE_MINUTES`.
- **Refresh tokens** carry `typ: "refresh"` and last `REFRESH_TOKEN_EXPIRE_DAYS`.
  `POST /auth/refresh` exchanges one for a new access token. The `typ` claim is
  checked on every use, so a refresh token cannot be replayed as an access token.
  `/auth/refresh` re-reads the user, so a deleted account or a changed role cannot
  keep minting valid tokens.
- **Revocation**: each refresh token carries a `jti` recorded in `refresh_tokens`.
  `POST /auth/logout` marks it revoked, and `/auth/refresh` refuses revoked,
  expired or unknown ids. Only the id is stored, never the token string. Revoke
  every session for a user by setting `revoked_at` on all their rows. Tokens are
  not rotated on refresh yet, so a stolen token stays usable until revoked or
  expired.
- `SECRET_KEY` must be at least 32 chars and is rejected if it matches a known
  public example key. Generate with `openssl rand -hex 32`.
- Login and registration are rate-limited per client IP. The counters are
  **in-process**, so the effective limit multiplies by the number of workers and
  resets on restart — move them to Redis or the reverse proxy for a multi-process
  deployment.

## Order lifecycle

Statuses are constrained to the set in `app/core/order_status.py`; anything else
is a 422. `delivered` and `cancelled` are terminal, because cancelling restores
stock and reviving such an order would count that stock twice.

Each stage also records *when* it was reached (`packed_at`, `shipped_at`,
`delivered_at`, `cancelled_at`), which is what the customer's status timeline
shows. A repeated PUT of the same status leaves the original timestamp alone.

Checkout and cancellation take `SELECT ... FOR UPDATE` locks on the affected book
rows (ordered by id to keep a consistent lock order). Without this, concurrent
checkouts each read the same stock and all pass the availability check, overselling
the inventory.

### Cancelling goes through one function

`app/core/fulfilment.py::cancel_order_in_transaction` is the only place an order is
cancelled, and both the customer route and the admin route call it. There used to
be two implementations and only the customer's restored the stock, so an admin
cancellation quietly lost those units from inventory — and the sales-trend report
then excluded the order on the grounds that its stock had come back.

The stock restore, the status change and any refund all share one transaction. A
commit between them would leave a window where the order reads `cancelled` while
its units are still spent.

Cancelling a **paid** order queues an `order_refund` job. With no gateway
configured the order is marked `refund_pending` and admins are notified instead, so
the obligation is visible rather than silently dropped.

## Tests

Tests need a **throwaway** PostgreSQL database — not SQLite, because the app
depends on Postgres behaviour (UUID columns, `SELECT ... FOR UPDATE`, full-text
search, trigram indexes). The suite refuses to run unless `TEST_DATABASE_URL` is
set, so it can never point at a real database by accident. It creates the schema
from the models, truncates between tests, and drops it at the end.

The test role must be able to `CREATE EXTENSION pg_trgm` — the `books` trigram
indexes cannot be built without it, and `create_all` does not install extensions.
The suite creates it for you and fails with instructions if it lacks the rights.

```bash
./venv/bin/pip install -r requirements-dev.txt
TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/bookvuk_test \
  PYTHONPATH=. ./venv/bin/pytest
```

Coverage includes the regressions that mattered: forged-token rejection, token
type confusion, refresh revocation, per-user data isolation, cart input
validation, order status transitions, a concurrent-checkout test that fails if the
stock row locking is removed, an admin-cancellation test that fails if the stock
restore is removed, and two `EXPLAIN`-based tests that fail if a search query is
rewritten into a form its index cannot serve.

The frontend has its own suite (`cd frontend && npm test`) covering the guest cart,
the merge into an account at sign-in, and the order badges.

## Observability

- `GET /health` — liveness; no database access, so a brief database blip does not
  pull the process out of rotation.
- `GET /health/ready` — readiness; runs `select 1` and returns 503 if that fails.
- One JSON log line per request with method, path, status and duration.
  `LOG_JSON=false` gives readable local output; `LOG_LEVEL` sets verbosity.
- Every response carries `X-Request-ID` (an upstream one is reused if present),
  so a reported error can be traced to its log line.

## Uploaded book covers

Covers live in **Supabase Storage** and nowhere else. `books.cover_image` holds
the object's full URL, and the object is named for the book's id — one row, one
object, so re-uploading replaces a cover rather than leaving an orphan.

There is no local fallback and the API serves no files: the `/static` mount and
`backend/static/` are both gone. That second destination was never really a
backend, it was a trap — an instance filesystem is wiped on every deploy, so the
upload returned 200 and the cover disappeared days later with nothing failing at
the time to say so. `save_book_cover` now refuses outright when
`SUPABASE_URL` / `SUPABASE_SERVICE_KEY` are unset.

Naming it by the row's id is what removed the guessing. The ~200 seeded covers
had `cover_image` NULL and were found by *convention* — `catalog_id` + `.jpg`,
reconstructed independently by the frontend. A cover could be missing in a way no
query could find. `bookCoverSrc` in the storefront is now one line: the column,
or the placeholder.

The bucket must be **public**, and `SUPABASE_SERVICE_KEY` must be the service key
(`sb_secret_…`, formerly `service_role`) — the publishable/anon key is refused by
row-level security. The storefront needs the same host in
`NEXT_PUBLIC_MEDIA_ORIGIN`, which feeds the CSP's `img-src`; without it the
browser blocks every cover and shows nothing in the network tab to say why.

The upload is one `POST` made with `urllib` rather than the `supabase` SDK or
`httpx`: a dependency added to the API image is a dependency to patch forever.
Uploads are capped at `MAX_COVER_UPLOAD_BYTES` and read with a ceiling, because
`UploadFile.read()` with no argument pulls the whole body into memory.

## Deployment

`render.yaml` at the repository root is a Render Blueprint that creates both the
API and the storefront. Which keys to set, and what breaks without each, is in
`DEPLOYMENT.md`.

Migrations are **not** run by the deploy: Render's `preDeployCommand` needs a paid
instance, and the database is Supabase so it is reachable from anywhere. Run them
yourself after any deploy that adds one —

```bash
PYTHONPATH=. ./venv/bin/alembic upgrade head
```

The API image deliberately does not migrate on start: a container that migrates
on boot races its own replicas.

## Background jobs

Work that a customer should not wait for — order confirmation e-mail, admin
notification fan-out, low-stock alerts, password-reset mail, order status updates,
back-in-stock notices, abandoned-cart reminders and refunds — runs in a worker
rather than inside the request. Checkout used to make a blocking SMTP call with a
15-second timeout *after* the order was already committed.

```bash
PYTHONPATH=. ./venv/bin/python scripts/worker.py          # long-running
PYTHONPATH=. ./venv/bin/python scripts/worker.py --once   # drain and exit
```

The loop itself is `app/core/worker_runtime.py`, not the script. A
single-service deployment runs the *same* loop in a daemon thread inside the API
(`RUN_WORKER_IN_PROCESS=true`), which is what hosts whose free tier offers only
web services need — Render's background workers are a paid service type, so
there is nowhere else to put it. Two copies of this loop would be free to drift,
and the drift would surface only as jobs that silently never ran.

Enabling it alongside several uvicorn workers is safe: each process starts one
loop and claiming is `FOR UPDATE SKIP LOCKED`, so no job is run twice. The
trade-off is that a web service which sleeps when idle sleeps its queue too —
jobs wait for the next request rather than being lost.

**The in-process thread restarts itself, and the loop's cleanup cannot kill it.**
Both matter only in this mode. A separate worker *container* that dies is
restarted by the orchestrator (`restart: unless-stopped`); a thread inside a
healthy API is simply gone, and the only symptom is that jobs stop being
processed — no failed request, no unhealthy instance, nothing to notice until a
customer asks where their confirmation went. Two things caused exactly that:
`session.close()` runs in a `finally` *outside* the `except` that guards the
loop body, and it round-trips to the server, so a dropped connection made the
cleanup raise and take the worker down with it. `tests/test_worker_runtime.py`
pins both.

### Retention

Nothing in this application used to delete a row it had finished with, and four
tables grew without bound as a result — `refresh_tokens` reached more rows than
`books` on a database with twenty users. `sweeps.py::sweep_expired_rows` runs on
the same timer as the abandoned-cart scan and removes expired refresh tokens,
completed jobs, read notifications and closed rate-limit windows, on windows set
by the `*_RETENTION_DAYS` settings.

Two things it must never remove, both pinned by `tests/test_retention.py`:

- **A failed job.** One that exhausted its retries has `completed_at` NULL and
  `last_error` set — the only record of why it never ran. Sweeping on
  `completed_at` skips it for free; sweeping on age would delete it.
- **An unread notification**, however old. The unread badge is the point.

Deletes are capped per pass (`RETENTION_SWEEP_BATCH`). With
`RUN_WORKER_IN_PROCESS=true` this runs in the process serving requests, so an
unbounded `DELETE` would hold locks with requests queued behind it; a backlog is
cleared over several passes instead.

`rate_limit_counters` is the one that needed this most urgently and had the least
evidence: `ratelimit.py` gives the *memory* backend an opportunistic cleanup and
the *database* backend none, and a multi-worker deployment runs the database one.

Most jobs are enqueued by the request that made them necessary. Abandoned carts are
the exception — the whole point is that the customer *stopped* making requests — so
the worker also runs `app/core/sweeps.py` on a timer (`--sweep-interval`, default
900s, `0` disables). The sweep is idempotent: a worker restart cannot send a second
reminder, and nobody is nudged more than once in 7 days.

The queue is the `jobs` table, not Redis, for one specific reason: `enqueue()`
writes in the **caller's transaction**, so "order committed but its confirmation
never queued" is unreachable. Claiming uses `SELECT ... FOR UPDATE SKIP LOCKED`,
so running more worker processes is the only thing needed to scale throughput —
a locked job is invisible to other workers instead of blocking them.

Failures retry with backoff (1m, 5m, 15m, 1h, 6h) and then stop, leaving the row
with `last_error` set for inspection. Handlers are idempotent, because a retry
must not send two e-mails or duplicate a notification.

## Payments

### Test and live keys, one flag

Both key sets live in the environment at once and `RAZORPAY_MODE` (`test` |
`live`) picks which is used. Switching is a one-word change rather than a
copy-paste of secrets, and the set you are not using stays on hand.

| Mode | Reads |
| --- | --- |
| `test` (default) | `RAZORPAY_TEST_KEY_ID` / `_KEY_SECRET` / `_WEBHOOK_SECRET` |
| `live` | `RAZORPAY_LIVE_KEY_ID` / `_KEY_SECRET` / `_WEBHOOK_SECRET` |

Everything that talks to Razorpay reads `settings.razorpay_key_id` and friends,
never the per-mode fields, so one place decides and no call site can mix a live
key with a test webhook secret. The default is `test`: a deployment that forgets
the flag rehearses rather than taking real money.

**Keys are checked against the mode they are filed under.** Razorpay key ids
announce themselves (`rzp_test_…` / `rzp_live_…`), which makes the worst mistake
here cheap to catch at boot: a live key in the test slot charges real cards
during what somebody believes is a rehearsal, and a test key in the live slot is
a shop that silently cannot be paid. Ids in an unrecognised format are left
alone, so an unusual key cannot stop the app starting.

**`orders.payment_mode` records which keys took the money**, stamped when the
gateway order is created rather than read back from settings later — the flag can
be flipped between a payment and the report that counts it. This only matters
because one database serves both modes, which is the normal state before launch:
without it, `sum(total) where payment_status = 'paid'` counts play money as
revenue. NULL where no gateway was involved (cash on delivery, or payments
unconfigured).


`POST /api/customer/orders/{id}/payment` creates a gateway order; the browser
completes it in Razorpay's window. Two independent paths then mark it paid:

1. **Webhook** (`POST /api/payments/webhook/razorpay`) — the source of truth.
   Requires `RAZORPAY_WEBHOOK_SECRET`, which is a *different* value from the API
   key secret. Without this endpoint a customer who pays and closes the tab leaves
   the order `pending` forever: money taken, nothing fulfilled.
2. **Browser callback** (`.../payment/confirm`) — the fast path, so the customer
   sees confirmation immediately.

Both verify an HMAC signature with `compare_digest` and both are idempotent;
webhooks are delivered at least once, so the same event will arrive again. A late
`payment.failed` never downgrades an order that is already paid.

`POST /api/customer/checkout` accepts an **`Idempotency-Key`** header. Sending the
same key returns the first order instead of placing a second one — checkout moves
money and decrements stock, so a double-click must not create two orders.

## Store settings

Six commerce rules — shipping, the free-shipping threshold, tax, whether cash on
delivery is offered and up to what total, and how much of an order store credit
may cover — live in `store_settings` and are editable from `/admin/settings`.
They are not deployment configuration; they are how the shop is run, and they
change on a different clock from the code.

**The environment is the default, the row is the override.** Every column is
nullable and NULL means "use the environment value", which buys two things: the
app behaves identically before anyone opens the screen, and clearing a field
hands that setting back rather than making somebody remember the original number.
The screen shows which is which — a default nobody chose and a decision somebody
made should not look the same.

`core/store_settings.py::current()` resolves them, cached for ten seconds.
`compute_totals` runs on every cart render and every checkout, and a database
round trip per call to read six numbers that change a few times a year would be
paid on the hot path. The cost is that another worker sees a change within the
TTL; the worker that made it sees it at once, because saving invalidates locally.

**Deliberately narrow.** `EDITABLE_FIELDS` is the whole writable surface and the
update schema is `extra="forbid"`, so a request naming a secret is a 422 rather
than something quietly ignored. Keys, the database URL and the gateway
credentials stay in the environment: an admin screen that can rewrite those is an
admin account that can redirect the shop's money.

## Cash on delivery

India buys a lot of books this way, and a shop that only takes cards turns those
customers away at the last step.

`payment_method` (`online` | `cod`) is **separate from `payment_status`**, and the
separation is the whole design. It is tempting to model COD as
`payment_status = "cod"`, and that breaks immediately: a collected COD order is
*paid*, the same status as a card order, and the only lasting difference is the
route the money took. Keeping them apart means fulfilment, refunds and the
revenue reports do not have to care which it was. Both columns are now CHECK-
constrained (`f3a91d6c47b2`); `payment_status` had been free-form since it was
added, and a mistyped payment status is money the shop cannot account for.

`COD_MAX_ORDER_TOTAL` (default ₹3000) caps it. An order refused at the door costs
the courier fee both ways plus the handling, and that loss scales with the order
value. `GET /api/customer/cart/totals` reports `cod_available` so the storefront
knows whether to offer the option — but that is a hint, not the rule:
`POST /api/customer/checkout` re-checks, because a client that simply omits the
check would otherwise walk straight past it.

`POST /api/admin/orders/{id}/collect-cash` is the half no gateway can do. Without
it a COD order stays `pending` forever — delivered, money in hand, and missing
from every report that counts revenue by `payment_status`. It is its own endpoint
rather than a field on the status update because cash changing hands and a parcel
being marked delivered are two different events: a courier can deliver and fail to
collect. Idempotent, so a double-click cannot book the money twice, and it refuses
an order that was not placed for cash.

## Guest carts

A visitor builds a cart before signing in; the browser holds it and
`POST /api/customer/cart/merge` folds it into the account cart at sign-in
(quantities summed, each line capped at stock, unknown or out-of-stock titles
skipped rather than failing the whole merge). Sign-in is asked for at checkout,
not at add-to-cart.

The cart response embeds each line's book, so a client never downloads the
catalogue to render a cart.

## Search

`GET /api/catalog/books/paged?q=…` ranks results instead of just filtering them.
Two strategies, tried in order (`app/core/search.py`):

1. **Full text** against `books.search_vector`, a PostgreSQL *generated* column
   weighting title (A) above author (B) above description (C), ranked with
   `ts_rank_cd` and served by a GIN index. Generated rather than trigger-maintained
   so it cannot drift from the row it describes.
2. **Trigram**, only if full text matched nothing — this is what forgives
   "harri potter" and what makes partial words work.

`sort` defaults to `relevance` when `q` is present and `newest` otherwise; an
explicit `sort` always wins, and `sort=relevance` without `q` is a 400 rather than
a silent substitution.

The old query was `ILIKE '%term%'` over three columns: a leading wildcard, so no
index could be used. Measured on a 20k-book catalogue, that plan was a sequential
scan at **14.5 ms**; the full-text plan is a bitmap index scan at **0.60 ms**. The
trigram fallback must be written as the `<%` operator against a bare column —
the equivalent-looking `word_similarity(...) >= 0.6` is a function result, cannot
be indexed, and measured 41 ms against 0.16 ms. Two `EXPLAIN`-based tests pin this.

`pg_trgm` is required and the migration installs it.

The `english` text-search config is deliberate for this bilingual catalogue: it
stems the Latin titles properly and passes Devanagari through as exact tokens,
where `simple` would stem neither.

### Romanised Hindi

Half the catalogue is Devanagari and shoppers type Hindi on a Latin keyboard, so
`books.search_aliases` holds romanised spellings (`core/transliterate.py`) and is
folded into `search_vector` at title weight, with its own trigram index for the
fuzzy fallback. Several spellings are generated per word, because people write both
"godaan" and "godan", and Hindi deletes internal vowels — प्रेमचंद is written
"premchand", not "premachand".

Measured on the 200-book catalogue, romanised queries that previously returned
nothing: `godaan` 0 → 1, `karmabhumi` 0 → 1, `gaban` 0 → 1, `rangbhumi` 0 → 1,
`munshi` 0 → 20, `premchand` 3 → 20, and the misspelling `nirmalla` 0 → 1. Latin
and Devanagari searches are unchanged.

Aliases are maintained by a mapper event on `Book`, so no write path can leave a
Hindi title unsearchable. Rows that predate the column are filled in once with
`scripts/backfill_search_aliases.py` (`--dry-run` to preview).

## Used books (buyback)

Customers sell the shop their used books; the shop resells them below the price of a
new copy. Course titles repeat every year, so a copy sold back in June is wanted
again in July.

```
seller quotes  ->  submits  ->  admin approves  ->  book arrives, admin grades it
                                                 ->  admin pays  ->  copy on the shelf
```

Grading on arrival is a separate step on purpose: the condition claimed and the
condition that turns up are often different, and re-quoting has to happen before any
money moves. A downgrade lowers the payout and the seller is told the new figure.

**Rates** (`core/buyback.py`) — two separate tables, not derived from each other, so
paying sellers more is a deliberate decision rather than something that silently
moves shelf prices:

| Condition | Shop pays | Shelf price | Margin | Buyer saves |
|---|---|---|---|---|
| Like new | 30% of printed price | 70% | 2.3x | 30% |
| Good | 25% | 65% | 2.6x | 35% |
| Fair | 20% | 60% | 3.0x | 40% |

The resale spread is deliberately narrow (60–70%), so Fair sits only ten points below
Like new. Expect Fair stock to move slowest — widening that gap is the lever if those
start sitting on the shelf.

Nothing under ₹20 is bought — the paperwork costs more than the book.

**A used copy is its own `books` row** under the catalogue title it is a copy of
(`condition`, `parent_book_id`). That is what keeps the cart, the
`SELECT ... FOR UPDATE` stock locking, checkout and refunds working untouched: they
already operate on a book row. A second Good copy adds stock to the existing row
rather than creating a duplicate listing; a Fair copy is a separate row, because it
is a different product at a different price.

Books entered by hand (not in the catalogue) are priced from the MRP the seller reads
off the cover, and an admin picks the catalogue title to file the copy under when it
arrives. The payout endpoint refuses until they do, so a used copy always has a
parent.

### Store credit

`wallet_transactions` is a ledger; the balance is `SUM(amount)`. There is deliberately
no balance column — a cached balance and its history are two records of the same fact,
and when they disagree nothing can say which is right. Rows are append-only; a mistake
is corrected with an opposing `adjustment`.

Credit is a **tender, not a discount**: `orders.total` stays the value of the goods and
the gateway is charged `total - wallet_credit_used`. Recording it as a discount would
understate what every order was worth in every report that reads `total`.

`WALLET_MAX_REDEMPTION_PERCENT` (default 50) caps how much of one order credit may
cover. Without it, a seller with a large balance checks out for nothing and the shop
ships stock with no money arriving — buyback would become a way to drain inventory.

Cancelling an order returns its credit (`wallet.refund_redemption`, idempotent). The
gateway refund only covers what went on a card, so without this the credit half of a
part-paid order would simply disappear.

## Scaling notes

**Connection budget.** Each uvicorn worker keeps its own pool, so a container
opens up to `workers x (DATABASE_POOL_SIZE + DATABASE_MAX_OVERFLOW)` connections
— with the defaults that is `4 x (5 + 5) = 40`. Multiply by container count and
compare against the pooler's limit before scaling out; lower `DATABASE_POOL_SIZE`
rather than discovering the ceiling in production.

**Rate limiting.** `RATE_LIMIT_BACKEND=memory` (default) counts per worker, so N
workers allow roughly N times the configured attempts. Set
`RATE_LIMIT_BACKEND=database` for a limit shared across every worker and
container, with no Redis to run.

**Counts are counted, not downloaded.** `/api/admin/queue` returns the four
"what is waiting" figures as a single 83-byte response. The dashboard used to
derive them in the browser by fetching every order and every buyback request —
**96 KB** to render four numbers, growing linearly with the shop. The screens
still judge rows client-side, because they already hold the rows; the dashboard
holds none and should not fetch them to count. The SQL predicates and their
TypeScript twins are held together by `tests/test_admin_queue.py`.

**The database is the latency, not the query count.** Measured against the
Supabase pooler in `ap-northeast-1`, a `select 1` round trip is **176ms**, and the
busiest customer endpoint (`/api/catalog/books/paged`) issues **four** queries —
count, books, the eager-loaded categories, and the demand signal. Four necessary
queries is not a code problem; 176ms each is a geography one. The largest single
speed-up available is putting the database in the same region as the app: same
region is single-digit milliseconds against ~70ms Singapore-to-Tokyo, so
`/books/paged` would spend ~8ms in the database instead of ~700ms.

`pool_pre_ping` costs a measured **118ms per request** — it issues its own round
trip before handing a connection out — and is deliberately kept: it prevents a
stale-connection error when the pooler drops an idle connection, and Supabase does
not document the idle timeout precisely enough to replace it with a shorter
`pool_recycle`. A rare 500 at checkout is worse than 118ms. Once app and database
are co-located the cost becomes negligible anyway.

**Caching.** `/robots.txt`, `/sitemap.xml` and `/api/catalog/facets` are identical
for every visitor and send `Cache-Control`, so a proxy or CDN can serve them
without touching the database. `/api/catalog/categories` was the one public
catalogue endpoint missing the header — seven rows that change perhaps twice a
year, costing a round trip per visitor because nothing was allowed to keep them —
and `/books/{id}/related` now matches `/trending` at five minutes. The paged
catalogue and the product page stay uncached deliberately: their staleness would
be a stock number the shopper acts on.

**Foreign keys are indexed.** `ForeignKey(...)` creates a constraint, not an
index, and PostgreSQL validates a parent `DELETE` by scanning the child table —
sequentially, with no index on the referencing column. Six were unindexed until
`e7f2c94a1b38`; `cart_items.book_id` was the one that bites first. To re-check:

```sql
select c.conrelid::regclass, a.attname from pg_constraint c
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
where c.contype = 'f' and not exists (
  select 1 from pg_index i where i.indrelid = c.conrelid and a.attnum = i.indkey[0]);
```

**Do not drop an index because `idx_scan` is 0.** On a database this size that
statistic means "this code path has not run yet", not "this index earns nothing".
`ix_books_aliases_trgm` reads as unused precisely because it works: it backs the
romanised-Hindi *fallback*, which by design only runs when full text matches
nothing.

**Admin list endpoints attach names with one query, not one per row.** Both
`/api/admin/buyback` and `/api/admin/orders` looked the seller or customer up
inside their row serialiser, which is invisible on one row and ruinous on a page
of them: the buyback queue issued 159 queries for 158 rows and took **29 seconds**
against the remote database, so the screen simply sat on its loading state. Each
list now builds an `id -> user` map first (**29s -> 1.0s**). The serialisers still
accept a single-row path for the detail endpoints.

**Indexes for the hot paths.** `orders(user_id, created_at DESC)` for "my orders",
`books(category_id, created_at DESC)` for category browse,
`notifications(user_id, is_read)` for the unread badge, and a *partial*
`jobs(run_at) WHERE completed_at IS NULL` matching `claim_batch`'s predicate — once
the queue has a history of completed rows, a plain index on `run_at` makes every
worker walk all of them.

## Notes

- CORS is driven by `CORS_ORIGINS`; with the default, browse the frontend on
  `localhost`, not `127.0.0.1`, or requests are blocked.
### Seed accounts

The seeded accounts live in the Supabase database. Their passwords are **not
recorded here**: this file is committed, so a working admin password in it is a
working admin password for anyone who gets a copy of the repository — including
every future clone, fork and CI log.

| Email | Role |
|---|---|
| `admin@booknest.com` | admin |
| `demo@booknest.com` | customer |
| `racer0@booknest.com` … `racer5@booknest.com` | customer (load-test) |

To get in:

- **Set a fresh password** for one of them with `scripts/create_admin.py`
  (`--email admin@booknest.com`), or
- **Make your own admin** with the same script and a new address.

The passwords that used to be printed here should be treated as public and
rotated. The six `racer*` accounts are load-test leftovers and can be deleted
from the real database.
