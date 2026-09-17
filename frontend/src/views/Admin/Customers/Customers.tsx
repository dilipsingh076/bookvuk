"use client";

/**
 * The people who buy from the shop.
 *
 * There was no way to look at a customer at all. Orders could be searched by
 * e-mail, which answers "show me this order" and not "how many times has this
 * person ordered, what have they spent, are we holding credit of theirs" — so
 * the commonest support question needed a database client.
 *
 * Built for one situation: somebody is on the phone. The list narrows by
 * whatever they said their name or e-mail was; opening a row gives the whole
 * history in one request rather than three.
 */

import Modal from "../../../components/ui/Modal";
import { Button, Input, LoaderBlock } from "../../../components/ui";
import CustomerDetail from "./CustomerDetail";
import CustomerRow from "./CustomerRow";
import { useCustomers } from "./useCustomers";

const Customers = () => {
  const c = useCustomers();

  return (
    <>
      <div className="py-8">
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-2xl font-extrabold text-bookvuk-navy">Customers</div>
          <div className="mt-1 text-sm text-bookvuk-muted">
            Search by name or e-mail, then open someone to see their whole history.
          </div>

          <div className="mt-5 rounded-xl border bg-bookvuk-lilac p-4">
            <Input
              value={c.q}
              onChange={(e) => c.setQ(e.target.value)}
              placeholder="Search by name, email or username"
              className="rounded-lg border-gray-200 px-3 py-2"
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-12 bg-bookvuk-lilac px-4 py-3 text-xs font-semibold text-bookvuk-muted">
              <div className="col-span-5">Customer</div>
              <div className="col-span-2 text-right">Orders</div>
              <div className="col-span-2 text-right">Spent</div>
              <div className="col-span-3 text-right">Credit held · Last order</div>
            </div>
            <div className="divide-y bg-white">
              {c.loading ? (
                <LoaderBlock size="md" height="panel" caption="Loading customers…" />
              ) : c.error ? (
                <div className="px-4 py-6 text-sm text-rose-700">
                  {(c.error as Error)?.message || "Failed to load customers"}
                </div>
              ) : c.rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-bookvuk-muted">No customers found.</div>
              ) : (
                c.rows.map((row) => (
                  <CustomerRow key={row.id} customer={row} onOpen={() => c.open(row.id)} />
                ))
              )}
            </div>
          </div>

          {c.meta && c.meta.pages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <div className="tabular-nums text-bookvuk-muted">
                Page {c.meta.page} of {c.meta.pages} · {c.meta.total} customers
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  radius="lg"
                  disabled={c.meta.page <= 1 || c.loading}
                  onClick={c.prevPage}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  radius="lg"
                  disabled={c.meta.page >= c.meta.pages || c.loading}
                  onClick={c.nextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Modal isOpen={c.openId !== null} onClose={c.close} panelClassName="max-w-3xl">
        <div className="flex items-center justify-between border-b border-bookvuk-border px-6 py-4">
          <div className="text-sm font-semibold text-bookvuk-navy">
            {c.detail ? c.detail.name : "Customer"}
          </div>
          <button
            type="button"
            onClick={c.close}
            className="rounded-lg border border-bookvuk-border px-3 py-1 text-sm font-semibold text-bookvuk-navy hover:bg-bookvuk-lilac"
          >
            Close
          </button>
        </div>

        <CustomerDetail detail={c.detail} error={c.detailError} />
      </Modal>
    </>
  );
};

export default Customers;
