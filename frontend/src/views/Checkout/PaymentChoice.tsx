"use client";

/**
 * How they would like to pay.
 *
 * Radios, not a dropdown: two options that the shopper should be able to
 * compare at a glance, and one of them can be unavailable with a reason worth
 * reading.
 */

import type { PaymentMethod } from "../../api/commerce";

type PaymentChoiceProps = {
  method: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  /** Whether cash on delivery is available for *this* order. */
  codOffered: boolean;
  /** The server's reason when it is not, which says what to do next. */
  codUnavailableReason: string | null;
};

const PaymentChoice = ({ method, onChange, codOffered, codUnavailableReason }: PaymentChoiceProps) => (
  <div className="mt-8 border-t border-bookvuk-border pt-6">
    <div className="text-lg font-bold text-bookvuk-navy">Payment</div>

    <fieldset className="mt-4 space-y-3">
      <legend className="sr-only">How would you like to pay?</legend>

      <label
        htmlFor="pay-online"
        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
          method === "online"
            ? "border-bookvuk-purple bg-bookvuk-lilac"
            : "border-bookvuk-border bg-white hover:bg-bookvuk-cream"
        }`}
      >
        <input
          id="pay-online"
          type="radio"
          name="payment-method"
          value="online"
          checked={method === "online"}
          onChange={() => onChange("online")}
          className="mt-1 accent-bookvuk-purple"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-bookvuk-navy">Pay online</span>
          <span className="mt-1 block text-sm text-bookvuk-muted">
            Card, UPI or netbanking. Details are entered in the payment
            provider&rsquo;s secure window, never on this page — so your card number
            never reaches our servers.
          </span>
        </span>
      </label>

      <label
        htmlFor="pay-cod"
        aria-disabled={!codOffered}
        className={`flex items-start gap-3 rounded-xl border p-4 transition ${
          !codOffered
            ? "cursor-not-allowed border-bookvuk-border bg-bookvuk-cream opacity-60"
            : method === "cod"
              ? "cursor-pointer border-bookvuk-purple bg-bookvuk-lilac"
              : "cursor-pointer border-bookvuk-border bg-white hover:bg-bookvuk-cream"
        }`}
      >
        <input
          id="pay-cod"
          type="radio"
          name="payment-method"
          value="cod"
          disabled={!codOffered}
          checked={method === "cod"}
          onChange={() => onChange("cod")}
          className="mt-1 accent-bookvuk-purple"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-bookvuk-navy">Cash on delivery</span>
          <span className="mt-1 block text-sm text-bookvuk-muted">
            {codOffered
              ? "Pay the courier when your books arrive."
              : codUnavailableReason ?? "Not available for this order."}
          </span>
        </span>
      </label>
    </fieldset>
  </div>
);

export default PaymentChoice;
