"""a place for the commerce rules a shopkeeper changes without a deploy

Revision ID: c4d70b82e916
Revises: a5c318e9f47d
Create Date: 2026-09-15 17:20:00.000000

Shipping, tax, the free-shipping threshold, the cash-on-delivery ceiling and the
store-credit cap all lived in the environment, so changing any of them meant a
redeploy. They are not deployment configuration; they are how the shop is run,
and they change on a different clock from the code.

Every column is nullable and NULL means "use the environment value". The table is
an override layer, not a replacement:

* the app behaves identically before a row exists, which is what makes this safe
  to apply to a running deployment;
* clearing a field hands it back to the environment, rather than requiring
  somebody to remember the original number and retype it.

Deliberately narrow. Secrets, the database URL and the gateway keys are not here
and must not be — an admin screen that can rewrite those is an admin account that
can redirect the shop's money.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c4d70b82e916"
down_revision: Union[str, None] = "a5c318e9f47d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "store_settings",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shipping_flat_rate", sa.Numeric(12, 2), nullable=True),
        sa.Column("free_shipping_threshold", sa.Numeric(12, 2), nullable=True),
        sa.Column("tax_rate", sa.Numeric(6, 4), nullable=True),
        sa.Column("cod_enabled", sa.Boolean(), nullable=True),
        sa.Column("cod_max_order_total", sa.Numeric(12, 2), nullable=True),
        sa.Column("wallet_max_redemption_percent", sa.Integer(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
    )
    # One shop, one row. Without this nothing stops a second row appearing and
    # `first()` silently picking whichever the database returns.
    op.create_index(
        "uq_store_settings_singleton",
        "store_settings",
        [sa.text("(true)")],
        unique=True,
    )
    op.create_check_constraint(
        "ck_store_settings_sane",
        "store_settings",
        "(tax_rate is null or (tax_rate >= 0 and tax_rate <= 1)) and "
        "(shipping_flat_rate is null or shipping_flat_rate >= 0) and "
        "(free_shipping_threshold is null or free_shipping_threshold >= 0) and "
        "(cod_max_order_total is null or cod_max_order_total >= 0) and "
        "(wallet_max_redemption_percent is null or "
        " (wallet_max_redemption_percent >= 0 and wallet_max_redemption_percent <= 100))",
    )


def downgrade() -> None:
    op.drop_index("uq_store_settings_singleton", table_name="store_settings")
    op.drop_table("store_settings")
