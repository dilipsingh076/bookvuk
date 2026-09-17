"use client";

import { cn } from "../../lib/cn";

/* The − / n / + control for a cart line.
 *
 * Two things brought this into existence.
 *
 * A book already in the cart showed a flat "In cart (2)" label on its card, with
 * no way to change the amount: to buy a second copy you had to leave the
 * catalogue, open the cart, and come back. The control existed only on the cart
 * page, written inline.
 *
 * And that inline version had no stock ceiling. Pressing + past what the shop has
 * fired a request the API answers with 409, and the optimistic update rolled
 * back — so the number climbed, dropped again, and said nothing about why.
 * Here the button is disabled at the limit and carries the reason.
 */

type QuantityStepperProps = {
  qty: number;
  /** Called with the new quantity. Zero is expected to remove the line. */
  /** The press, as a delta: -1 or +1.
   *
   *  It used to report an absolute quantity, which meant this component had to
   *  know the current one — and it only knows what its last render was given. Two
   *  presses in one frame therefore reported the same target, so the second did
   *  nothing and a run of taps appeared to stick. A press is a delta; the cart is
   *  the only thing that knows what it lands on. */
  onAdjust: (delta: number) => void;
  /** Units the shop actually has. Omit when it does not apply. */
  stock?: number | null;
  /** Hard ceiling per line, matching the cart's own limit. */
  max?: number;
  /** What is being counted, for the button labels a screen reader reads out. */
  label: string;
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
};

const SIZES = {
  sm: { button: "px-2.5 py-1.5 text-xs", value: "min-w-[1.75rem] px-1.5 py-1.5 text-xs" },
  md: { button: "px-3.5 py-2 text-sm", value: "min-w-[2.25rem] px-2 py-2 text-sm" },
} as const;

const QuantityStepper = ({
  qty,
  onAdjust,
  stock = null,
  max = 99,
  label,
  size = "md",
  className,
  disabled = false,
}: QuantityStepperProps) => {
  // The shop's stock is the real ceiling; `max` only stops an absurd line.
  const ceiling = stock === null ? max : Math.min(max, Math.max(0, stock));
  const atCeiling = qty >= ceiling;
  const s = SIZES[size];

  return (
    <div
      className={cn(
        "inline-flex items-center overflow-hidden rounded-xl border border-bookvuk-border bg-bookvuk-cream/50",
        disabled && "opacity-60",
        className,
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          // Cards are wrapped in a link to the product page.
          e.stopPropagation();
          onAdjust(-1);
        }}
        /* At one, this removes the line. Saying so is the difference between a
           deliberate action and a vanished row. */
        aria-label={qty <= 1 ? `Remove ${label} from your cart` : `One fewer ${label}`}
        title={qty <= 1 ? "Remove from cart" : "One fewer"}
        className={cn(
          s.button,
          "font-semibold text-bookvuk-navy transition hover:bg-bookvuk-lilac disabled:cursor-not-allowed",
        )}
      >
        −
      </button>

      {/* `aria-live` so the new amount is announced; without it a screen-reader
          user presses + and hears nothing. `tabular-nums` stops the control
          resizing between 9 and 10. */}
      <div
        aria-live="polite"
        className={cn(s.value, "text-center font-semibold tabular-nums text-bookvuk-navy")}
      >
        {qty}
      </div>

      <button
        type="button"
        disabled={disabled || atCeiling}
        onClick={(e) => {
          e.stopPropagation();
          onAdjust(1);
        }}
        aria-label={
          atCeiling
            ? `No more ${label} available`
            : `One more ${label}`
        }
        title={
          atCeiling
            ? stock !== null && stock <= max
              ? `Only ${stock} in stock`
              : `Limit of ${max} per book`
            : "One more"
        }
        className={cn(
          s.button,
          "font-semibold text-bookvuk-navy transition hover:bg-bookvuk-lilac disabled:cursor-not-allowed disabled:hover:bg-transparent",
        )}
      >
        +
      </button>
    </div>
  );
};

export default QuantityStepper;
