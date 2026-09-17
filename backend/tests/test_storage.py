"""Where an uploaded cover goes, and what the caller is told about it.

The interesting claim is not "it writes a file" — it is that a deployment with
object storage configured stops touching the local disk entirely. A cover that
lands on the container filesystem in production is lost on the next deploy, and
nothing about the request says so at the time.
"""

from __future__ import annotations

import urllib.error

import pytest

from app.core import storage


@pytest.mark.parametrize(
    "filename,expected",
    [
        ("cover.jpg", ".jpg"),
        ("COVER.JPEG", ".jpeg"),
        ("a.png", ".png"),
        ("a.webp", ".webp"),
        # An SVG is a document that can carry script, served from the API's own
        # origin. Allowing it would be a stored-XSS hole, not a convenience.
        ("payload.svg", None),
        ("shell.php", None),
        ("noextension", None),
        ("", None),
    ],
)
def test_only_real_image_extensions_are_accepted(filename, expected):
    assert storage.extension_for(filename) == expected


def test_refuses_rather_than_writing_somewhere_nothing_serves(monkeypatch):
    """There is no local fallback any more, and that is the point.

    Writing to the instance filesystem looked like it worked and lost the file on
    the next deploy. A refusal is the honest answer.
    """
    monkeypatch.setattr(storage.settings, "SUPABASE_URL", None)
    monkeypatch.setattr(storage.settings, "SUPABASE_SERVICE_KEY", None)

    with pytest.raises(storage.StorageError, match="not configured"):
        storage.save_book_cover("book-1", b"bytes", ".jpg")


def test_uploads_to_supabase_under_the_book_id_and_a_content_hash(monkeypatch):
    monkeypatch.setattr(storage.settings, "SUPABASE_URL", "https://proj.supabase.co")
    monkeypatch.setattr(storage.settings, "SUPABASE_SERVICE_KEY", "service-key")
    monkeypatch.setattr(storage.settings, "SUPABASE_STORAGE_BUCKET", "book-covers")

    sent = {}

    class _Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    def _fake_urlopen(request, timeout=None):
        sent["url"] = request.full_url
        sent["data"] = request.data
        sent["headers"] = {k.lower(): v for k, v in request.headers.items()}
        return _Response()

    monkeypatch.setattr(storage.urllib.request, "urlopen", _fake_urlopen)

    stored = storage.save_book_cover("book-1", b"bytes", ".jpg")

    name = storage.object_name_for("book-1", b"bytes", ".jpg")
    assert stored == f"https://proj.supabase.co/storage/v1/object/public/book-covers/{name}"
    assert sent["url"] == f"https://proj.supabase.co/storage/v1/object/book-covers/{name}"
    assert name.startswith("book-1-") and name.endswith(".jpg")
    assert sent["data"] == b"bytes"
    assert sent["headers"]["authorization"] == "Bearer service-key"
    # Sent alongside Authorization so the call works with both generations of
    # Supabase key: the legacy `service_role` JWT and the newer `sb_secret_…`.
    assert sent["headers"]["apikey"] == "service-key"
    assert sent["headers"]["content-type"] == "image/jpeg"
    # Re-uploading a cover for the same book must replace it rather than 409:
    # the object name is derived from the book id, so the existing object is by
    # definition that book's previous cover.
    assert sent["headers"]["x-upsert"] == "true"

    # Covers are served with a one-year `immutable` cache header, which is only
    # safe because the name carries a hash of the bytes: changed artwork is a
    # changed URL, so nothing serves the old picture for a year.
    assert sent["headers"]["cache-control"] == storage.CACHE_CONTROL
    assert "immutable" in storage.CACHE_CONTROL


def test_a_rejected_upload_raises_rather_than_reporting_success(monkeypatch):
    monkeypatch.setattr(storage.settings, "SUPABASE_URL", "https://proj.supabase.co")
    monkeypatch.setattr(storage.settings, "SUPABASE_SERVICE_KEY", "service-key")

    def _raise(request, timeout=None):
        raise urllib.error.HTTPError(
            request.full_url, 400, "Bad Request", {}, __import__("io").BytesIO(b"Bucket not found")
        )

    monkeypatch.setattr(storage.urllib.request, "urlopen", _raise)

    # Swallowing this would leave books.cover_image pointing at an object that
    # was never written — a 200 and a broken image.
    with pytest.raises(storage.StorageError):
        storage.save_book_cover("book-1", b"bytes", ".jpg")


def test_the_same_bytes_always_produce_the_same_name():
    """Re-uploading an identical file is free, rather than orphaning the old one."""
    a = storage.object_name_for("book-1", b"same", ".jpg")
    b = storage.object_name_for("book-1", b"same", ".jpg")
    assert a == b


def test_different_bytes_produce_a_different_url():
    """The whole basis for caching a cover for a year."""
    a = storage.object_name_for("book-1", b"one", ".jpg")
    b = storage.object_name_for("book-1", b"two", ".jpg")
    assert a != b
