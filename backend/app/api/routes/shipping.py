"""The courier list, for everyone who has to name one.

Two flows pick a courier from the same registry: an admin dispatching an order,
and a seller saying they have posted a book back. It started as an admin-only
endpoint, which left the seller's form with nothing to populate itself from —
and a second copy of the list in TypeScript would drift into a dropdown offering
couriers every save then rejects.

Public, and cached. It is the names of eight courier companies: there is nothing
here to protect, and requiring a token would only mean the sell form cannot draw
its own dropdown until the session is resolved.
"""

from __future__ import annotations

from fastapi import APIRouter, Response

from app.core import shipping

router = APIRouter(prefix="/api/shipping", tags=["Shipping"])


@router.get("/carriers")
def list_carriers(response: Response):
    """Every courier the server will accept a consignment number for."""
    # Changes when the code does, not when the data does.
    response.headers["Cache-Control"] = "public, max-age=3600"
    return [{"slug": c.slug, "label": c.label} for c in shipping.CARRIERS]
