"use client";

/**
 * What it comes to, and the way out.
 *
 * The one rule worth knowing: figures the *server* prices are dimmed while a
 * change is still reaching it, because a stale total shown as fact is what made
 * this page look broken.
 */

import Link from "next/link";
import { formatPrice } from "../../utils/formatPrice";
import { Alert, Button, Input } from "../../components/ui";
import type { UseCartPage } from "./useCartPage";

type CartSummaryProps = { cart: UseCartPage };

const CartSummary = ({ cart: c }: CartSummaryProps) => (
  <aside className="lg:sticky lg:top-24">
    <div className="rounded-3xl bg-white p-6 shadow-bookvuk-lift ring-1 ring-bookvuk-navy/[0.06]">
      <div className="text-lg font-extrabold text-bookvuk-navy">Order summary</div>

      <div className="mt-5 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-bookvuk-muted">Subtotal</span>
          <span className="font-semibold tabular-nums text-bookvuk-navy">
            {formatPrice(c.subtotal)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-bookvuk-muted">{c.priced ? "Shipping" : "Shipping estimate"}</span>
          <span className={`font-semibold tabular-nums text-bookvuk-navy ${c.behind}`}>
            {formatPrice(c.shippingEstimate)}
          </span>
        </div>
        {c.discount > 0 ? (
          <div className="flex items-center justify-between">
            <span className="text-bookvuk-muted">Discount</span>
            <span className="font-semibold tabular-nums text-emerald-700">
              −{formatPrice(c.discount)}
            </span>
          </div>
        ) : null}
        {/* Only when there is tax to show.
            
            The price on a book is the MRP from its cover, which is declared
            inclusive of all taxes — so on a shop selling printed books this is
            zero, and a line reading "Tax ₹0.00" makes a shopper wonder what it
            is for. The line returns by itself if a taxable item is ever priced
            with a rate. */}
        {c.estimatedTax > 0 ? (
          <div className="flex items-center justify-between">
            <span className="text-bookvuk-muted">{c.priced ? "Tax" : "Estimated tax"}</span>
            <span className={`font-semibold tabular-nums text-bookvuk-navy ${c.behind}`}>
              {formatPrice(c.estimatedTax)}
            </span>
          </div>
        ) : null}
        <div className="border-t border-bookvuk-border/80 pt-4">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-bookvuk-navy">Total</span>
            <span className={`text-xl font-extrabold tabular-nums text-bookvuk-navy ${c.behind}`}>
              {formatPrice(c.total)}
            </span>
          </div>
          {/* Said plainly while a change is still reaching the server. A burst of
              presses serialises behind a row lock, so for a second or two these
              figures describe the cart as the server last confirmed it — and a
              stale total shown as fact is the thing that looked broken. */}
          {c.settling ? (
            <div className="mt-1.5 text-xs font-semibold text-bookvuk-muted" role="status">
              Updating your total…
            </div>
          ) : null}
          {/* What an Indian shopper checks for, and what the MRP declaration on
              the cover already says. */}
          <div className="mt-1.5 text-xs text-bookvuk-muted">
            MRP, inclusive of all taxes
          </div>
        </div>
      </div>

      {/* This box used to be decoration: the field held no value, the button had
          no handler, and pressing Apply fired no request at all. Someone with a
          real code typed it here, watched nothing happen, and had every reason to
          conclude the code was dead — one step before the checkout, where the
          same code worked. */}
      <div className="mt-5 rounded-2xl bg-gradient-to-br from-bookvuk-lilac to-bookvuk-lilac/70 p-4 text-sm ring-1 ring-bookvuk-purple/10">
        <label htmlFor="coupon" className="font-semibold text-bookvuk-navy">
          Gift card or discount code
        </label>
        {c.coupon ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3.5 py-2.5 ring-1 ring-bookvuk-purple/15">
            <span className="min-w-0 truncate">
              <span className="font-bold text-bookvuk-navy">{c.coupon}</span>
              {c.discount > 0 ? (
                <span className="text-bookvuk-muted"> — {formatPrice(c.discount)} off</span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={c.clearCoupon}
              className="shrink-0 text-xs font-semibold text-bookvuk-purple hover:underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void c.applyCoupon();
            }}
          >
            <Input
              id="coupon"
              value={c.couponInput}
              onChange={(e) => c.typeCoupon(e.target.value)}
              placeholder="Enter code"
              autoComplete="off"
              spellCheck={false}
              invalid={Boolean(c.couponError)}
              className="px-3 py-2.5 uppercase transition placeholder:normal-case"
            />
            {/* A form, so Enter applies the code — typing one and pressing
                return is what people actually do. */}
            <Button
              type="submit"
              disabled={c.couponBusy || c.couponInput.trim().length === 0}
              variant="primary"
              size="lg"
              radius="xl"
              className="shrink-0 active:scale-[0.98]"
            >
              {c.couponBusy ? "Checking…" : "Apply"}
            </Button>
          </form>
        )}
        {c.couponError ? (
          <Alert tone="error" className="mt-3">
            {c.couponError}
          </Alert>
        ) : null}
      </div>

      <button
        type="button"
        disabled={c.nothingToBuy}
        onClick={() => c.requireAuth(() => c.router.push("/checkout"))}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-bookvuk-purple py-3.5 text-sm font-semibold text-white shadow-md shadow-bookvuk-purple/20 transition hover:bg-bookvuk-purple-hover hover:shadow-lg hover:shadow-bookvuk-purple/25 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
      >
        {/* Everything is waiting for stock, so there is nothing to check out —
            the server would refuse this, and saying so here is better than
            sending them to find out. */}
        {c.nothingToBuy
          ? "Nothing available to check out yet"
          : c.isGuestCart
            ? "Sign in to checkout"
            : "Proceed to checkout"}
        {c.nothingToBuy ? null : <span aria-hidden>→</span>}
      </button>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-bookvuk-muted">
        <span
          className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-bookvuk-in-stock"
          aria-hidden
        />
        Secure checkout guarantee
      </div>

      <div className="mt-6 border-t border-bookvuk-border/80 pt-5 text-center">
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 text-sm font-semibold text-bookvuk-purple transition hover:underline"
        >
          ← Continue shopping
        </Link>
      </div>
    </div>
  </aside>
);

export default CartSummary;
