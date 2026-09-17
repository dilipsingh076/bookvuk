"""add used-book buyback and store credit

Revision ID: d4e8b1c73a05
Revises: c8a51f3b7d92
Create Date: 2026-08-20 11:02:41.556210

Customers can sell the shop their used books; the shop resells them below the price
of a new copy. Course titles repeat every year, so a copy sold back in June is
wanted again in July.

Three parts:

* `buyback_requests` — a customer's offer, from submission through grading to
  payout. Money fields are snapshots so changing the rates later cannot alter an
  offer somebody has already accepted.
* `wallet_transactions` — a ledger of store credit. There is deliberately no
  balance column: a cached balance and its history are two records of the same
  fact, and when they disagree nothing can say which is right.
* `books.condition` / `parent_book_id` / `source_buyback_id` — a used copy is its
  own `books` row under the catalogue title it is a copy of. That is what keeps the
  cart, the `SELECT ... FOR UPDATE` stock locking, checkout and refunds working
  untouched: they already operate on a book row.

Written by hand: autogenerate would drag in the recurring books.rating REAL ->
Float false positive (see 8d6ef3d58848), and would not order the two new tables
against the self-referencing foreign key between them.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e8b1c73a05'
down_revision: Union[str, Sequence[str], None] = 'c8a51f3b7d92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'buyback_requests',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('book_id', sa.UUID(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('author', sa.String(length=255), nullable=True),
        sa.Column('isbn', sa.String(length=20), nullable=True),
        sa.Column('listed_price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('condition', sa.String(length=20), nullable=False),
        sa.Column('quantity', sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.Column('status', sa.String(length=20), server_default=sa.text("'submitted'"), nullable=False),
        sa.Column('quoted_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('final_amount', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('received_condition', sa.String(length=20), nullable=True),
        sa.Column('payout_method', sa.String(length=16), nullable=True),
        sa.Column('payout_reference', sa.String(length=128), nullable=True),
        sa.Column('payout_upi', sa.String(length=128), nullable=True),
        sa.Column('payout_account_name', sa.String(length=128), nullable=True),
        sa.Column('seller_note', sa.Text(), nullable=True),
        sa.Column('admin_note', sa.Text(), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('quantity >= 1', name='ck_buyback_quantity_positive'),
        sa.CheckConstraint('listed_price > 0', name='ck_buyback_listed_price_positive'),
    )
    op.create_index(op.f('ix_buyback_requests_user_id'), 'buyback_requests', ['user_id'])
    op.create_index(op.f('ix_buyback_requests_status'), 'buyback_requests', ['status'])
    op.create_index(op.f('ix_buyback_requests_isbn'), 'buyback_requests', ['isbn'])
    op.create_index('ix_buyback_status_created', 'buyback_requests', ['status', 'created_at'])
    op.create_index('ix_buyback_user_created', 'buyback_requests',
                    ['user_id', sa.text('created_at DESC')])

    op.create_table(
        'wallet_transactions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('kind', sa.String(length=32), nullable=False),
        sa.Column('order_id', sa.UUID(), nullable=True),
        sa.Column('buyback_request_id', sa.UUID(), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['buyback_request_id'], ['buyback_requests.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('amount <> 0', name='ck_wallet_amount_nonzero'),
    )
    op.create_index(op.f('ix_wallet_transactions_user_id'), 'wallet_transactions', ['user_id'])
    op.create_index(op.f('ix_wallet_transactions_kind'), 'wallet_transactions', ['kind'])
    op.create_index('ix_wallet_user_created', 'wallet_transactions',
                    ['user_id', sa.text('created_at DESC')])

    # Existing rows are all new stock, which is what the server default gives them.
    # Store credit spent on an order. A tender rather than a discount, so `total`
    # keeps meaning the value of the goods.
    op.add_column('orders', sa.Column('wallet_credit_used', sa.Numeric(precision=12, scale=2),
                                      server_default=sa.text('0'), nullable=False))

    op.add_column('books', sa.Column('condition', sa.String(length=20),
                                     server_default=sa.text("'new'"), nullable=False))
    op.add_column('books', sa.Column('parent_book_id', sa.UUID(), nullable=True))
    op.add_column('books', sa.Column('source_buyback_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_books_condition'), 'books', ['condition'])
    op.create_index(op.f('ix_books_parent_book_id'), 'books', ['parent_book_id'])
    op.create_foreign_key('fk_books_parent_book', 'books', 'books',
                          ['parent_book_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_books_source_buyback', 'books', 'buyback_requests',
                          ['source_buyback_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_books_source_buyback', 'books', type_='foreignkey')
    op.drop_constraint('fk_books_parent_book', 'books', type_='foreignkey')
    op.drop_index(op.f('ix_books_parent_book_id'), table_name='books')
    op.drop_index(op.f('ix_books_condition'), table_name='books')
    op.drop_column('books', 'source_buyback_id')
    op.drop_column('books', 'parent_book_id')
    op.drop_column('books', 'condition')
    op.drop_column('orders', 'wallet_credit_used')

    op.drop_index('ix_wallet_user_created', table_name='wallet_transactions')
    op.drop_index(op.f('ix_wallet_transactions_kind'), table_name='wallet_transactions')
    op.drop_index(op.f('ix_wallet_transactions_user_id'), table_name='wallet_transactions')
    op.drop_table('wallet_transactions')

    op.drop_index('ix_buyback_user_created', table_name='buyback_requests')
    op.drop_index('ix_buyback_status_created', table_name='buyback_requests')
    op.drop_index(op.f('ix_buyback_requests_isbn'), table_name='buyback_requests')
    op.drop_index(op.f('ix_buyback_requests_status'), table_name='buyback_requests')
    op.drop_index(op.f('ix_buyback_requests_user_id'), table_name='buyback_requests')
    op.drop_table('buyback_requests')
