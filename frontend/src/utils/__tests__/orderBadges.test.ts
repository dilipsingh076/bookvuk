import { describe, expect, it } from "vitest";

import { canCancelOrder, paymentBadge, statusBadge } from "../orderBadges";

/**
 * The order pages each carried their own copy of this mapping and both had fallen
 * behind the backend's status list, so `pending`, `paid` and `packed` all rendered
 * as "Processing" — an order the shop had already packed told the customer nothing
 * had happened yet.
 */

// Must match ORDER_STATUSES in backend/app/core/order_status.py.
const BACKEND_STATUSES = [
  "processing",
  "pending",
  "paid",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
];

describe("statusBadge", () => {
  it("has distinct wording for every status the backend can set", () => {
    const labels = BACKEND_STATUSES.map((s) => statusBadge(s).text);
    expect(new Set(labels).size).toBe(BACKEND_STATUSES.length);
  });

  it.each(BACKEND_STATUSES)("does not fall back to Processing for %s", (status) => {
    if (status === "processing") return;
    expect(statusBadge(status).text).not.toBe("Processing");
  });

  it("says Packed for a packed order", () => {
    expect(statusBadge("packed").text).toBe("Packed");
  });

  it("distinguishes awaiting payment from processing", () => {
    expect(statusBadge("pending").text).toBe("Awaiting payment");
    expect(statusBadge("processing").text).toBe("Processing");
  });

  it("shows an unknown status rather than silently relabelling it", () => {
    expect(statusBadge("teleported").text).toBe("teleported");
  });

  it("copes with an empty status", () => {
    expect(statusBadge("").text).toBe("Unknown");
  });

  it("always supplies styling", () => {
    for (const status of [...BACKEND_STATUSES, "nonsense", ""]) {
      expect(statusBadge(status).className).toBeTruthy();
    }
  });
});

describe("paymentBadge", () => {
  it("tells the customer their payment landed", () => {
    expect(paymentBadge("paid")?.text).toBe("Paid");
  });

  it("covers both refund states", () => {
    expect(paymentBadge("refunded")?.text).toBe("Refunded");
    expect(paymentBadge("refund_pending")?.text).toBe("Refund on the way");
  });

  it("reports a failed payment", () => {
    expect(paymentBadge("failed")?.text).toBe("Payment failed");
  });

  it("stays quiet for a pending payment, where the status badge already says enough", () => {
    expect(paymentBadge("pending")).toBeNull();
  });

  it("stays quiet when there is no payment status at all", () => {
    expect(paymentBadge(undefined)).toBeNull();
    expect(paymentBadge(null)).toBeNull();
  });
});

describe("canCancelOrder", () => {
  it("allows cancelling an order that has not moved yet", () => {
    expect(canCancelOrder({ status: "processing", payment_status: "pending" })).toBe(true);
  });

  it("allows cancelling a paid order, which is then refunded", () => {
    expect(canCancelOrder({ status: "processing", payment_status: "paid" })).toBe(true);
  });

  it.each(["packed", "shipped", "delivered", "cancelled"])(
    "does not offer to cancel a %s order",
    (status) => {
      expect(canCancelOrder({ status })).toBe(false);
    },
  );

  it("hides cancel while a refund is already in flight", () => {
    expect(canCancelOrder({ status: "processing", payment_status: "refund_pending" })).toBe(false);
    expect(canCancelOrder({ status: "processing", payment_status: "refunded" })).toBe(false);
  });
});
