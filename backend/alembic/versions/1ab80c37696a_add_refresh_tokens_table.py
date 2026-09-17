"""add refresh_tokens table

Revision ID: 1ab80c37696a
Revises: 08340cc4a711
Create Date: 2026-08-18 19:28:16.506487

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1ab80c37696a'
down_revision: Union[str, Sequence[str], None] = '08340cc4a711'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the refresh-token registry that makes refresh tokens revocable.

    Autogenerate also proposed re-applying the `books.rating` REAL -> Float type
    change. That is a persistent false positive: SQLAlchemy's Float(precision=2)
    maps to REAL in PostgreSQL, so the comparison never settles. 8d6ef3d58848
    already made that change and repeating it here is what produced the duplicate
    migration this project had to untangle, so it is intentionally left out.
    """
    op.create_table('refresh_tokens',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('jti', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_refresh_tokens_expires_at'), 'refresh_tokens', ['expires_at'], unique=False)
    op.create_index(op.f('ix_refresh_tokens_jti'), 'refresh_tokens', ['jti'], unique=True)
    op.create_index(op.f('ix_refresh_tokens_user_id'), 'refresh_tokens', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_refresh_tokens_user_id'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_jti'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_expires_at'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')
    # ### end Alembic commands ###
