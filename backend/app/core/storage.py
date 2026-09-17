"""Where an uploaded book cover goes: Supabase Storage, and nowhere else.

There used to be a second backend that wrote to `static/books/` and let the API
serve it back. That is gone along with the static mount, because on any hosted
instance it was never a backend so much as a trap: the filesystem is wiped on
every deploy, so the upload returned 200 and the cover disappeared days later,
with nothing failing at the time to say so.

With one destination, `books.cover_image` is the only place a cover's location is
recorded — no filename conventions, no path reconstruction in the frontend, and
a cover that is missing is missing in a way a query can find.

Uploading is done with `urllib` from the standard library rather than the
`supabase` SDK or `httpx`. Storage needs exactly one POST, and a dependency added
to the API image is a dependency to patch forever.
"""

from __future__ import annotations

import hashlib
import logging
import mimetypes
import urllib.error
import urllib.request
from pathlib import Path
from typing import Final

from app.core.config import settings

logger = logging.getLogger("bookvuk.storage")

# Kept narrow on purpose. An SVG cover would be an XSS vector — it is a document
# that can carry script, and it would be served from the API's own origin.
ALLOWED_COVER_TYPES: Final[dict[str, str]] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

_UPLOAD_TIMEOUT_SECONDS: Final[int] = 20

#: One year, immutable. Correct only because the object name is content-addressed.
CACHE_CONTROL: Final[str] = "public, max-age=31536000, immutable"


class StorageError(RuntimeError):
    """Raised when a cover could not be stored. The caller turns this into a 502."""


def extension_for(filename: str) -> str | None:
    """The allowed extension of `filename`, or None if it is not a cover type."""
    suffix = Path(filename or "").suffix.lower()
    return suffix if suffix in ALLOWED_COVER_TYPES else None


def _content_type(ext: str) -> str:
    return ALLOWED_COVER_TYPES.get(ext) or mimetypes.guess_type(f"x{ext}")[0] or "application/octet-stream"


def _public_url(bucket: str, object_name: str) -> str:
    base = (settings.SUPABASE_URL or "").rstrip("/")
    return f"{base}/storage/v1/object/public/{bucket}/{object_name}"


def _save_to_supabase(object_name: str, data: bytes, ext: str) -> str:
    bucket = settings.SUPABASE_STORAGE_BUCKET
    base = (settings.SUPABASE_URL or "").rstrip("/")
    url = f"{base}/storage/v1/object/{bucket}/{object_name}"

    request = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            # Both headers, deliberately. Supabase has two generations of key:
            # the legacy `service_role` JWT and the newer opaque `sb_secret_…`.
            # The legacy pair of endpoints wants `apikey`, the newer ones read
            # `Authorization`, and sending both is accepted by all of them — so
            # this works whichever key the project was created with.
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
            "apikey": settings.SUPABASE_SERVICE_KEY or "",
            "Content-Type": _content_type(ext),
            # Supabase defaults objects to `no-cache`, so every cover was
            # revalidated against the origin on every page view — measured TTFB
            # of 0.15-2.1s per image, and Cloudflare reporting a MISS each time.
            # Safe to cache this hard because the object name carries a hash of
            # the bytes: different artwork is a different URL.
            "Cache-Control": CACHE_CONTROL,
            # Re-uploading a cover for the same book must replace it, not 409.
            # The object name is derived from the book id, so the previous file
            # is by definition the same book's old cover.
            "x-upsert": "true",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=_UPLOAD_TIMEOUT_SECONDS) as response:
            if response.status not in (200, 201):
                raise StorageError(f"storage returned {response.status}")
    except urllib.error.HTTPError as exc:
        # The body carries Supabase's reason ("Bucket not found", "new row
        # violates row-level security policy"). Without it this is unfixable.
        detail = exc.read().decode("utf-8", "replace")[:500]
        logger.error("cover upload rejected", extra={"status": exc.code, "detail": detail})
        raise StorageError(f"storage rejected the upload ({exc.code})") from exc
    except urllib.error.URLError as exc:
        logger.error("cover upload could not reach storage", extra={"reason": str(exc.reason)})
        raise StorageError("storage unreachable") from exc

    return _public_url(bucket, object_name)


def object_name_for(book_id: str, data: bytes, ext: str) -> str:
    """`<book id>-<content hash>.<ext>` — the name a cover is stored under.

    The hash is what makes the caching safe. Covers are served with a one-year
    `immutable` cache header, which is only correct if a *changed* cover means a
    *changed* URL: with a bare `<book id>.jpg`, replacing the artwork would leave
    every browser and CDN serving the old picture for a year.

    Eight hex characters is plenty here — this is cache busting, not integrity.
    """
    digest = hashlib.sha256(data).hexdigest()[:8]
    return f"{book_id}-{digest}{ext}"


def _require_storage() -> None:
    if not settings.object_storage_enabled:
        # Better a clear refusal than a file written somewhere nothing serves.
        raise StorageError(
            "Object storage is not configured; set SUPABASE_URL and "
            "SUPABASE_SERVICE_KEY (the service role key)"
        )


def save_book_cover(book_id: str, data: bytes, ext: str) -> str:
    """Store a cover and return the absolute URL to persist in `books.cover_image`.

    Returns the same URL for the same bytes, so re-uploading an identical file is
    free rather than orphaning the previous object.
    """
    _require_storage()
    return _save_to_supabase(object_name_for(book_id, data, ext), data, ext)


#: Where a seller's photographs of their own book live, inside the same bucket.
#: A prefix rather than a second bucket: these need exactly the same public-read
#: policy as covers, and a second bucket is a second thing to configure and to
#: get wrong on a new deployment.
BUYBACK_PREFIX: Final[str] = "buyback"


def save_buyback_photo(request_id: str, data: bytes, ext: str) -> str:
    """Store one photograph of a book somebody is offering the shop.

    The same content-addressed naming as covers, for the same reason: these are
    served with a one-year immutable cache header, and a changed photo has to be
    a changed URL.

    Uploading the identical file twice returns the identical URL rather than
    leaving an orphan — which matters more here than for covers, because a seller
    who is unsure whether their upload worked will simply do it again.
    """
    _require_storage()
    name = f"{BUYBACK_PREFIX}/{object_name_for(request_id, data, ext)}"
    return _save_to_supabase(name, data, ext)


#: Photographs attached to a return claim, under their own prefix so a bucket
#: listing says what it is looking at.
RETURNS_PREFIX: Final[str] = "returns"


def save_return_photo(request_id: str, data: bytes, ext: str) -> str:
    """Store one photograph of a book that arrived damaged.

    The argument about a damage claim is entirely visual, and settling it from a
    written description is how a shop ends up refunding things it should not and
    refusing things it should.
    """
    _require_storage()
    name = f"{RETURNS_PREFIX}/{object_name_for(request_id, data, ext)}"
    return _save_to_supabase(name, data, ext)
