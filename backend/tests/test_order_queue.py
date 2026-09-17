"""The order lenses, which are now the only definition of them.

These three questions used to be written twice: as TypeScript predicates the
Orders screen ran over every order it had downloaded, and as filters inside
`/api/admin/queue` that counted them. Paginating the list removed the screen's
ability to filter or count anything itself, so both the list and the counts now
come from here.

That makes this module the single place either can be wrong, which is what these
pin. The behavioural half — that the counts match rows the filters actually
select — lives in `test_admin_queue.py`, which has a database.
"""

from __future__ import annotations

import pytest
from sqlalchemy.dialects import postgresql

from app.core import order_queue


def _sql(criterion) -> str:
    return str(criterion.compile(dialect=postgresql.dialect(),
                                 compile_kwargs={"literal_binds": True}))


def test_every_lens_the_screen_offers_is_known_here():
    """The tabs and this module have to agree on the set, or a tab shows `all`."""
    assert set(order_queue.LENSES) == {"todo", "cash", "unpaid", "all"}


def test_all_is_no_filter_rather_than_a_true_expression():
    """"No filter" is the honest description, and it keeps the query from
    carrying a WHERE clause that does nothing."""
    assert order_queue.criterion_for(order_queue.LENS_ALL) is None


def test_an_unrecognised_lens_falls_back_to_everything():
    """A stale bookmark or a typo'd query string must not return an empty list
    that reads as "nothing to do"."""
    assert order_queue.criterion_for("nonsense") is None


@pytest.mark.parametrize("lens", ["todo", "cash", "unpaid"])
def test_each_working_lens_has_a_filter(lens):
    assert order_queue.criterion_for(lens) is not None


def test_to_fulfil_excludes_unpaid_online_orders():
    """Picking stock for money that never arrived loses the shop both."""
    sql = _sql(order_queue.to_fulfil())
    assert "payment_status" in sql and "paid" in sql
    assert "cod" in sql          # …unless it is payable at the door
    assert "delivered" in sql and "cancelled" in sql
    assert "packed" in sql and "shipped" in sql


def test_cash_to_collect_is_about_payment_not_delivery():
    """A courier can deliver and fail to collect, so this must not be phrased as
    "not yet delivered"."""
    sql = _sql(order_queue.cash_to_collect())
    assert "cod" in sql and "pending" in sql
    assert "cancelled" in sql
    assert "delivered" not in sql


def test_awaiting_payment_excludes_closed_orders():
    """A cancelled order that was never paid is a closed file, not a debt.
    Leaving those in makes the tab a graveyard nobody reads."""
    sql = _sql(order_queue.awaiting_payment())
    assert "online" in sql
    assert "cancelled" in sql and "delivered" in sql


def test_the_three_lenses_are_distinct():
    """Two lenses compiling to the same SQL means one of them is a copy-paste
    that silently stopped answering its own question."""
    sqls = {_sql(order_queue.criterion_for(l)) for l in ("todo", "cash", "unpaid")}
    assert len(sqls) == 3
