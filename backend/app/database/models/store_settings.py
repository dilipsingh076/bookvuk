import uuid

from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID

from ..base import Base


class StoreSettings(Base):
    """The handful of commerce rules a shopkeeper changes without a deploy.

    Exactly one row. Every value is **nullable**, and NULL means "use the value
    from the environment" — so this table is an override layer, not a
    replacement. Three things follow from that:

    * The app works identically before the row exists, which is what makes this
      safe to add to a running deployment.
    * A setting can be handed back to the environment by clearing it, rather than
      by knowing what the default was and retyping it.
    * The environment stays the place a *deployment* is configured, and this is
      the place a *shop* is run.

    Deliberately narrow. Secrets, database URLs and gateway keys are not here and
    must not be: an admin screen that can rewrite them is an admin account that
    can redirect the shop's money.
    """

    __tablename__ = "store_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ---- what an order costs ----
    shipping_flat_rate = Column(Numeric(12, 2), nullable=True)
    #: Order total above which shipping is free. 0 disables the threshold.
    free_shipping_threshold = Column(Numeric(12, 2), nullable=True)
    #: Fraction, not percent: 0.05 is 5%.
    tax_rate = Column(Numeric(6, 4), nullable=True)

    # ---- cash on delivery ----
    cod_enabled = Column(Boolean, nullable=True)
    #: Above this, online payment only. 0 disables the ceiling.
    cod_max_order_total = Column(Numeric(12, 2), nullable=True)

    # ---- store credit ----
    #: Most of one order that buyback credit may cover.
    wallet_max_redemption_percent = Column(Integer, nullable=True)

    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    #: Who last changed it. Email rather than a foreign key: this is an audit
    #: note, and it should survive the account being deleted.
    updated_by = Column(String(255), nullable=True)
