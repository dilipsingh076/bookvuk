"use client";

/**
 * What is being bought and what it comes to.
 *
 * Every figure here except the line prices comes from the server, so the number
 * shown is the number charged. Credit is presented as a tender rather than a
 * discount — the order is still worth its total, and "to pay now" is what is
 * left after the credit is spent.
 */

import { formatPrice } from "../../utils/formatPrice";
import { Input } from "../../components/ui";
import type { CartTotals } from "../../api/commerce";
import type { Wallet } from "../../api/buyback";
import type { CheckoutLine } from "./types";

type OrderSummaryProps = {
  lineItems: CheckoutLine[];
  totals: CartTotals | null;
  couponInput: string;
  onCouponInput: (code: string) => void;
  onApplyCoupon: () => void;
  appliedCoupon: string | null;
  wallet: Wallet | null;
  useCredit: boolean;
  onUseCreditChange: (use: boolean) => void;
  creditToApply: number;
};

const Row = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: string;
  highlight?: boolean;
}) => {
  // Values arrive as decimal strings; a leading "-" is kept outside formatPrice
  // so the currency symbol does not end up after the minus sign.
  const display =
    value === undefined
      ? "—"
      : value.startsWith("-")
        ? `-${formatPrice(value.slice(1))}`
        : formatPrice(value);

  return (
    <div className="flex items-center justify-between">
      <span className="text-bookvuk-muted">{label}</span>
      <span className={highlight ? "font-semibold text-emerald-700" : "font-semibold text-bookvuk-navy"}>
        {display}
      </span>
    </div>
  );
};

const OrderSummary = ({
  lineItems,
  totals,
  couponInput,
  onCouponInput,
  onApplyCoupon,
  appliedCoupon,
  wallet,
  useCredit,
  onUseCreditChange,
  creditToApply,
}: OrderSummaryProps) => (
  <aside className="rounded-2xl border border-bookvuk-border bg-white p-6 shadow-bookvuk-card">
    <div className="text-lg font-bold text-bookvuk-navy">Order summary</div>

    <div className="mt-4 space-y-3">
      {lineItems.map((it) => (
        <div key={it.bookId} className="flex items-start justify-between gap-3 text-sm">
          <div className="min-w-0">
            <div className="truncate font-semibold text-bookvuk-navy">{it.book.title}</div>
            <div className="text-xs text-bookvuk-muted">Qty {it.qty}</div>
          </div>
          <div className="font-semibold text-bookvuk-navy">
            {formatPrice(it.book.price * it.qty)}
          </div>
        </div>
      ))}
    </div>

    <div className="mt-5 border-t border-bookvuk-border pt-4">
      <label className="text-sm font-semibold text-bookvuk-navy">Discount code</label>
      <div className="mt-2 flex gap-2">
        <Input
          value={couponInput}
          onChange={(e) => onCouponInput(e.target.value)}
          placeholder="Enter code"
          className="rounded-lg px-3 py-2 uppercase"
        />
        <button
          type="button"
          onClick={onApplyCoupon}
          className="shrink-0 rounded-lg border border-bookvuk-border px-4 py-2 text-sm font-semibold text-bookvuk-navy hover:bg-bookvuk-lilac"
        >
          Apply
        </button>
      </div>
      {appliedCoupon ? (
        <div className="mt-2 text-xs font-semibold text-emerald-700">{appliedCoupon} applied</div>
      ) : null}
    </div>

    <div className="mt-5 space-y-2 border-t border-bookvuk-border pt-4 text-sm">
      <Row label="Subtotal" value={totals?.subtotal} />
      {totals && Number(totals.discount) > 0 ? (
        <Row label="Discount" value={`-${totals.discount}`} highlight />
      ) : null}
      <Row label="Shipping" value={totals?.shipping} />
      {/* Shown only when there is tax. A book's price is its printed MRP, which
          is inclusive of all taxes, so this is zero for printed stock. */}
      {totals && Number(totals.tax) > 0 ? <Row label="Tax" value={totals.tax} /> : null}
      <div className="flex items-center justify-between border-t border-bookvuk-border pt-3 text-base font-bold text-bookvuk-navy">
        <span>Total</span>
        <span>{totals ? formatPrice(totals.total) : "—"}</span>
      </div>
      <div className="text-xs font-normal text-bookvuk-muted">MRP, inclusive of all taxes</div>

      {creditToApply > 0 ? (
        <>
          <Row label="BookVuk credit" value={`-${creditToApply.toFixed(2)}`} highlight />
          <div className="flex items-center justify-between border-t border-bookvuk-border pt-3 text-base font-bold text-bookvuk-navy">
            <span>To pay now</span>
            <span>{formatPrice(Number(totals?.total ?? 0) - creditToApply)}</span>
          </div>
        </>
      ) : null}

      {wallet && wallet.balance > 0 ? (
        <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl bg-bookvuk-cream p-3">
          <input
            type="checkbox"
            checked={useCredit}
            onChange={(e) => onUseCreditChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-bookvuk-purple"
          />
          <span className="text-xs leading-relaxed text-bookvuk-navy">
            <span className="font-semibold">
              Use {formatPrice(wallet.maxRedeemableNow)} of your credit
            </span>
            <span className="block text-bookvuk-muted">
              You have {formatPrice(wallet.balance)}. Up to {wallet.maxRedemptionPercent}% of an
              order can be paid with credit.
            </span>
          </span>
        </label>
      ) : null}
    </div>
  </aside>
);

export default OrderSummary;
