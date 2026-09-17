"use client";

/**
 * One code, as the shopper would experience it.
 *
 * The column that matters is not `is_active`: a code can be active and still
 * refuse every customer — outside its window, or past its redemption cap — so
 * the state shown is the shopper's, with the reason when it is anything other
 * than live.
 */

import { couponIsLive, couponStateLabel, type AdminCoupon } from "../../../api/admin";
import { formatDay, formatMoney } from "./types";

type CouponRowProps = {
  coupon: AdminCoupon;
  onDelete: () => void;
};

const CouponRow = ({ coupon: c, onDelete }: CouponRowProps) => {
  const live = couponIsLive(c);
  const unconditional =
    Number(c.min_subtotal) === 0 && !c.starts_at && !c.expires_at && !c.max_redemptions_per_user;

  return (
    <div className="grid grid-cols-12 items-start gap-2 px-4 py-4 text-sm">
      <div className="col-span-3 min-w-0">
        <div className="font-mono font-semibold text-bookvuk-navy">{c.code}</div>
        {c.description ? (
          <div className="mt-1 text-xs text-bookvuk-muted">{c.description}</div>
        ) : null}
      </div>
      <div className="col-span-2 font-semibold tabular-nums text-bookvuk-navy">
        {c.discount_type === "percent" ? `${Number(c.value)}%` : formatMoney(c.value)}
        {c.max_discount ? (
          <div className="text-xs font-normal text-bookvuk-muted">
            max {formatMoney(c.max_discount)}
          </div>
        ) : null}
      </div>
      <div className="col-span-3 text-xs text-bookvuk-muted">
        {Number(c.min_subtotal) > 0 ? <div>over {formatMoney(c.min_subtotal)}</div> : null}
        {formatDay(c.starts_at) || formatDay(c.expires_at) ? (
          <div>
            {formatDay(c.starts_at) ?? "now"} → {formatDay(c.expires_at) ?? "no end"}
          </div>
        ) : null}
        {c.max_redemptions_per_user ? <div>{c.max_redemptions_per_user} per customer</div> : null}
        {unconditional ? <div>no conditions</div> : null}
      </div>
      <div className="col-span-2 tabular-nums text-bookvuk-navy">
        {c.times_redeemed}
        {c.max_redemptions ? <span className="text-bookvuk-muted"> / {c.max_redemptions}</span> : null}
        {/* What the code actually did, not just how often it was typed. A code
            used forty times that gave away more than it earned is a loss the
            counter above reports as a success — so the two numbers sit together.

            Both are on paid orders only, which is why a code can show a use and
            no money: the checkout was never paid for, and an unpaid checkout is
            not a giveaway. */}
        {c.times_redeemed > 0 ? (
          <div className="mt-1 text-xs font-normal text-bookvuk-muted">
            <div>−{formatMoney(c.discount_given)} given</div>
            <div>{formatMoney(c.revenue)} earned</div>
            <div className="mt-0.5 text-[11px]">on paid orders</div>
          </div>
        ) : null}
      </div>
      <div className="col-span-2 flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            live ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"
          }`}
        >
          {couponStateLabel(c)}
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default CouponRow;
