"use client";

/** One customer in the list: enough to recognise them on a phone call. */

import type { AdminCustomer } from "../../../api/admin";
import { formatDate, formatMoney } from "./types";

type CustomerRowProps = {
  customer: AdminCustomer;
  onOpen: () => void;
};

const CustomerRow = ({ customer: c, onOpen }: CustomerRowProps) => (
  <button
    type="button"
    onClick={onOpen}
    className="grid w-full grid-cols-12 gap-2 px-4 py-4 text-left text-sm hover:bg-bookvuk-lilac/40"
  >
    <div className="col-span-5">
      <div className="font-semibold text-bookvuk-navy">{c.name}</div>
      <div className="mt-1 text-xs text-bookvuk-muted">{c.email}</div>
    </div>
    <div className="col-span-2 text-right tabular-nums text-bookvuk-navy">
      {c.ordersCount}
      {/* Placed and paid differ, and the gap is the interesting part: three
          orders of which one is paid is a different customer from three of
          three. */}
      {c.ordersCount !== c.paidOrdersCount ? (
        <span className="text-xs text-bookvuk-muted"> · {c.paidOrdersCount} paid</span>
      ) : null}
    </div>
    <div className="col-span-2 text-right font-semibold tabular-nums text-bookvuk-navy">
      {formatMoney(c.totalSpent)}
    </div>
    <div className="col-span-3 text-right text-xs text-bookvuk-muted">
      {Number(c.walletBalance) > 0 ? (
        <span className="font-semibold text-emerald-700">{formatMoney(c.walletBalance)}</span>
      ) : (
        "—"
      )}
      {" · "}
      {formatDate(c.lastOrderAt)}
    </div>
  </button>
);

export default CustomerRow;
