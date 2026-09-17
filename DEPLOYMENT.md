# Deploying BookVuk

Two services: a FastAPI backend and a Next.js storefront. This file lists every
environment variable you have to set, what breaks if you leave it at its
default, and where each service can actually run.

The authoritative lists are [`backend/.env.example`](backend/.env.example) (67
settings) and [`frontend/.env.example`](frontend/.env.example) (6). Everything
here is a subset of those, sorted by whether it will hurt you.

---

## Can both go on Vercel?

**Frontend: yes.** Next.js on Vercel is the path of least resistance — no
Dockerfile, no server to keep alive, and the App Router's server components and
image optimisation work as shipped.

**Backend: technically yes, practically no.** Vercel runs Python as serverless
functions, and four things in this backend assume a long-lived process:

| What | Where | On serverless |
|---|---|---|
| SQLAlchemy connection pool (`pool_size=5, max_overflow=5`) | [`app/database/db.py`](backend/app/database/db.py) | Every cold function builds its own pool. Under load that is *N × 10* connections against Supabase, which caps out long before your traffic does. You would have to point at Supabase's transaction pooler (port `6543`) and drop `DATABASE_POOL_SIZE` to 1. |
| Background job worker | [`app/main.py:43`](backend/app/main.py#L43), `scripts/worker.py` | There is no HTTP route that drains the queue — it is a thread or a standalone script. Order confirmation emails, refunds and abandoned-cart sweeps would simply never run. You would need Vercel Cron plus a new endpoint that does not exist yet. |
| Rate limiter | `RATE_LIMIT_BACKEND=memory` | Per-process counters. With functions scaling out, the login limit of 10 attempts becomes 10 × however many instances are warm. **Fixable:** set `RATE_LIMIT_BACKEND=database`, which is already implemented and needs no Redis. |
| Store-settings cache (10s TTL) | [`app/core/store_settings.py:31`](backend/app/core/store_settings.py#L31) | Harmless — just a few more reads. |

On top of that, cold start + a Supabase round trip (~175ms measured from here)
lands you in seconds, not milliseconds, on the first request of any idle period.

**Recommendation:** frontend on Vercel, backend on a host that runs the
container — Render (the Blueprint in `TODO.md` is already written for it),
Railway, or Fly.io. Put the backend in the same region as your Supabase project
while you are at it; the ~175ms per query is pure distance.

If you insist on all-Vercel, the minimum changes are: transaction pooler +
`DATABASE_POOL_SIZE=1`, `RATE_LIMIT_BACKEND=database`, and a new cron-triggered
route to drain the job queue.

---

## Before anything else: rotate these

These have been in a local `.env` on a development machine. Treat them as
burned.

- **`SUPABASE_SERVICE_KEY`** — bypasses row-level security entirely. Supabase
  dashboard → Project Settings → API → rotate.
- **`RAZORPAY_*_KEY_SECRET`** — Razorpay dashboard → Settings → API Keys →
  regenerate.
- **`SECRET_KEY`** — signs every access and refresh token. Rotating it signs
  everyone out, which is the point. Generate with:
  ```sh
  python -c "import secrets; print(secrets.token_urlsafe(64))"
  ```

Also: [`backend/README.md`](backend/README.md) prints seed account passwords.
Change those on the live database or delete the accounts.

---

## Backend — must set

Without these the service starts and then misbehaves quietly.

| Key | Value | If you skip it |
|---|---|---|
| `DATABASE_URL` | Supabase connection string | Falls back to the `DATABASE_HOSTNAME`/`_PORT`/… pieces, which default to `localhost` |
| `DATABASE_SSLMODE` | `require` | Unencrypted connection to a managed database |
| `SECRET_KEY` | 64-char random (above) | Token signing with a known key |
| `CORS_ORIGINS` | `https://yourdomain.com` | Browser blocks every API call from the site |
| `SITE_URL` | `https://yourdomain.com` | **Defaults to `http://localhost:5173`** — every password-reset and order-confirmation link in every email points at the customer's own machine |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | Cover uploads fail |
| `SUPABASE_SERVICE_KEY` | service role key | Cover uploads fail |
| `SUPABASE_STORAGE_BUCKET` | your bucket name | Cover uploads fail |
| `RAZORPAY_MODE` | `test` or `live` | — |
| `RAZORPAY_TEST_KEY_ID` / `_KEY_SECRET` / `_WEBHOOK_SECRET` | from Razorpay | With the mode set to `test` and these empty, checkout records every order as **unpaid** and the webhook returns 503 |
| `RAZORPAY_LIVE_KEY_ID` / `_KEY_SECRET` / `_WEBHOOK_SECRET` | from Razorpay | Same, for `RAZORPAY_MODE=live` |

The webhook secret is the one people forget. Razorpay dashboard → Settings →
Webhooks → add your endpoint → it shows you the secret once.

## Backend — should set

| Key | Value | Why |
|---|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_USE_TLS` | your provider | Without `SMTP_HOST` every email is **logged instead of sent** ([`app/core/email.py:27`](backend/app/core/email.py#L27)). Password resets silently do nothing. |
| `EMAIL_FROM`, `EMAIL_FROM_NAME` | `orders@yourdomain.com`, `BookVuk` | Otherwise mail comes from a default that will not pass SPF on your domain |
| `BUYBACK_SHIP_TO_ADDRESS` | your warehouse address | Customers selling books back are told where to post them; empty means they are told nothing |
| `DATABASE_POOL_PRE_PING` | `false` **if** the app and database are in different regions | Costs one round trip per request — ~175ms measured against Supabase Tokyo. Leave `true` if they are co-located. |
| `RATE_LIMIT_BACKEND` | `database` if you run more than one process | `memory` counts per worker |
| `RUN_WORKER_IN_PROCESS` | `true` on a single-service host | Off by default because the worker belongs in its own container. On a free tier with only one web service, leaving this off means jobs queue forever. |
| `LOG_JSON` | `true` | Structured access logs for whatever aggregates them |

## Backend — leave alone

These are set deliberately, not by accident:

- `TAX_RATE=0` — book prices are MRP, which is inclusive of all taxes under the
  Legal Metrology (Packaged Commodities) Rules, 2011. Printed books (HSN 4901)
  are NIL-rated anyway. Charging tax on top would be adding tax to a
  tax-inclusive price.
- `SHIPPING_FLAT_RATE=49.00`, `FREE_SHIPPING_THRESHOLD=499`
- `COD_MAX_ORDER_TOTAL=3000`, `COD_ENABLED`
- `WALLET_MAX_REDEMPTION_PERCENT=50`

---

## Frontend — must set

| Key | Value | If you skip it |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` | Canonical URLs, the sitemap and link previews all point at `localhost:5173` |
| `API_INTERNAL_URL` | `https://api.yourdomain.com` | Server components and `generateMetadata` try `127.0.0.1:8000` and fail during build |
| `NEXT_PUBLIC_MEDIA_ORIGIN` | **exactly** the backend's `SUPABASE_URL` | Next refuses to optimise the cover images and the CSP blocks them — with nothing in the network tab explaining why. This is the single most confusing thing to debug after a deploy. |

`NEXT_PUBLIC_API_BASE_URL` stays **empty** in normal deployments — Next rewrites
`/api` and `/auth` to the backend, so the browser talks to the site's own
origin. Only set it if you are serving the API from a different hostname without
the rewrite.

## Frontend — optional

- `NEXT_PUBLIC_SUPPORT_EMAIL` — defaults to `support@bookvuk.com`
- `NEXT_PUBLIC_SUPPORT_PHONE` — the phone card on Contact stays hidden unless
  set, deliberately: a wrong number costs more trust than no number

---

## Order of work

1. Rotate the three secrets above.
2. Create the Supabase storage bucket and note its name.
3. Run migrations against the production database — current head is
   `a7d2f61b3e89`:
   ```sh
   cd backend && DATABASE_URL="..." DATABASE_SSLMODE=require alembic upgrade head
   ```
   Run this from your machine. Render's `preDeployCommand` is a paid feature, so
   there is no hook doing it for you.
4. Deploy the backend, with the "must set" block filled in. Check `/health/ready`, which verifies the database too.
5. Point `CORS_ORIGINS` and `SITE_URL` at the frontend's real domain.
6. Deploy the frontend with its three keys. `NEXT_PUBLIC_MEDIA_ORIGIN` must
   match the backend's `SUPABASE_URL` character for character.
7. Register the Razorpay webhook against the deployed backend URL and paste the
   secret it gives you into `RAZORPAY_*_WEBHOOK_SECRET`.
8. Place one test order end to end — cart, coupon, payment, confirmation email.

## Housekeeping before launch

- Delete the leftover test accounts (`gate*@example.com`, `want-*`) — there are
  18 of them. `scripts/purge_test_data.py` is the tool.
- Change or remove the seed accounts documented in `backend/README.md`.
- Confirm `.env` is gitignored in both services. It is, currently — keep it that
  way.
