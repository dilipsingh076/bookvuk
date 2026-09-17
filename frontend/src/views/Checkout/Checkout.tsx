"use client";

/**
 * The checkout page.
 *
 * Three states before the form is worth drawing — the order is already placed,
 * the cart is still loading, or there is nothing to buy — then the form on the
 * left and the summary on the right. All of the deciding lives in
 * `useCheckout`; this file only arranges it.
 */

import { useRouter } from "next/navigation";
import { formatPrice } from "../../utils/formatPrice";
import { LoaderBlock } from "../../components/ui/Loader";
import { Button } from "../../components/ui";
import AddressFields from "./AddressFields";
import OrderSummary from "./OrderSummary";
import PaymentChoice from "./PaymentChoice";
import { useCheckout } from "./useCheckout";

const Checkout = () => {
  const router = useRouter();
  const c = useCheckout();

  if (c.placedOrder) {
    return (
      <div className="py-16 text-center">
        <div className="rounded-2xl border border-bookvuk-border bg-white p-8 shadow-bookvuk-card">
          <div className="text-2xl font-extrabold text-bookvuk-navy">
            {c.placedOrder.paid
              ? "Payment received"
              : c.placedOrder.cod
                ? "Order confirmed"
                : "Order placed"}
          </div>
          <div className="mt-2 text-sm text-bookvuk-muted">
            Reference <span className="font-semibold">{c.placedOrder.id}</span>
          </div>
          {c.paymentNotice ? (
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              {c.paymentNotice}
            </div>
          ) : null}
          <div className="mt-6 flex justify-center gap-3">
            <Button
              type="button"
              onClick={() => router.push(`/orders/${c.placedOrder!.id}`)}
              variant="primary"
              size="lg"
            >
              View order
            </Button>
            <button
              type="button"
              onClick={() => router.push("/browse")}
              className="rounded-lg border border-bookvuk-border px-5 py-2.5 text-sm font-semibold text-bookvuk-navy hover:bg-bookvuk-lilac"
            >
              Keep shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (c.cartLoading) return <LoaderBlock caption="Loading your cart…" />;

  if (c.lineItems.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="text-xl font-bold text-bookvuk-navy">Your cart is empty</div>
        <button
          type="button"
          onClick={() => router.push("/browse")}
          className="mt-5 rounded-lg bg-bookvuk-purple px-5 py-2.5 text-sm font-semibold text-white hover:bg-bookvuk-purple-hover"
        >
          Browse the shop
        </button>
      </div>
    );
  }

  return (
    <div className="py-10">
      <h1 className="text-2xl font-extrabold text-bookvuk-navy">Checkout</h1>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <form
          onSubmit={c.submit}
          className="rounded-2xl border border-bookvuk-border bg-white p-6 shadow-bookvuk-card"
        >
          <AddressFields
            addresses={c.addresses}
            selectedAddressId={c.selectedAddressId}
            onSelect={c.selectAddress}
            usingSaved={c.usingSaved}
            form={c.form}
            onFieldChange={c.setAddressField}
            saveAddress={c.saveAddress}
            onSaveAddressChange={c.setSaveAddress}
          />

          <PaymentChoice
            method={c.paymentMethod}
            onChange={c.setPaymentMethod}
            codOffered={c.codOffered}
            codUnavailableReason={c.codUnavailableReason}
          />

          {c.couponError ? (
            <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {c.couponError}
            </div>
          ) : null}
          {c.error ? (
            <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {c.error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={c.placing}
            className="mt-6 w-full rounded-lg bg-bookvuk-purple py-3 text-sm font-semibold text-white hover:bg-bookvuk-purple-hover disabled:opacity-60"
          >
            {c.placing
              ? "Placing order…"
              : c.codChosen
                ? `Place order · ${c.totals ? formatPrice(c.totals.total) : ""} on delivery`
                : `Pay ${c.totals ? formatPrice(c.totals.total) : ""}`}
          </button>
        </form>

        <OrderSummary
          lineItems={c.lineItems}
          totals={c.totals}
          couponInput={c.couponInput}
          onCouponInput={c.setCouponInput}
          onApplyCoupon={c.applyCoupon}
          appliedCoupon={c.appliedCoupon}
          wallet={c.wallet}
          useCredit={c.useCredit}
          onUseCreditChange={c.setUseCredit}
          creditToApply={c.creditToApply}
        />
      </div>
    </div>
  );
};

export default Checkout;
