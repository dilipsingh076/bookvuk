/**
 * The buyback API client.
 *
 * Every number here is money, so the tests are mostly about the client not
 * inventing, dropping or mistyping one. A quote rendered as `NaN` or a balance that
 * silently reads 0 are the two failures that would actually cost someone.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchConditions,
  fetchQuote,
  fetchUsedCopies,
  fetchWallet,
  submitSellRequest,
  WALLET_KIND_LABELS,
} from "../buyback";

const respond = (body: unknown, ok = true) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
  } as Response);

beforeEach(() => {
  vi.restoreAllMocks();
});

// ----- quoting -----

const quoteBody = (over: Record<string, unknown> = {}) => ({
  title: "Course Text",
  listed_price: "600.00",
  quantity: 1,
  can_sell: true,
  message: null,
  options: [
    { condition: "like_new", label: "Like new", description: "d1", offer: "180.00", resale_price: "420.00" },
    { condition: "good", label: "Good", description: "d2", offer: "150.00", resale_price: "390.00" },
    { condition: "fair", label: "Fair", description: "d3", offer: "120.00", resale_price: "360.00" },
  ],
  ...over,
});

describe("fetchQuote", () => {
  it("turns the API's decimal strings into numbers", async () => {
    respond(quoteBody());
    const q = await fetchQuote({ listedPrice: 600 });

    expect(q.listedPrice).toBe(600);
    expect(q.options[0].offer).toBe(180);
    expect(q.options[0].resalePrice).toBe(420);
    expect(q.options.every((o) => Number.isFinite(o.offer))).toBe(true);
  });

  it("keeps every condition, in the order the server sent", async () => {
    respond(quoteBody());
    const q = await fetchQuote({ listedPrice: 600 });
    expect(q.options.map((o) => o.condition)).toEqual(["like_new", "good", "fair"]);
  });

  it("reports when a book is not worth buying", async () => {
    respond(quoteBody({ can_sell: false, message: "Too cheap to buy." }));
    const q = await fetchQuote({ listedPrice: 40 });
    expect(q.canSell).toBe(false);
    expect(q.message).toBe("Too cheap to buy.");
  });

  it("never yields NaN for a missing amount", async () => {
    respond(quoteBody({
      options: [{ condition: "good", label: "Good", description: "", offer: null, resale_price: undefined }],
    }));
    const q = await fetchQuote({ listedPrice: 600 });
    expect(q.options[0].offer).toBe(0);
    expect(q.options[0].resalePrice).toBe(0);
  });

  it("sends the catalogue book id when there is one", async () => {
    const spy = respond(quoteBody());
    await fetchQuote({ bookId: "book-1", quantity: 3 });
    const body = JSON.parse(String((spy.mock.calls[0][1] as RequestInit).body));
    expect(body).toMatchObject({ book_id: "book-1", quantity: 3 });
  });

  it("surfaces the server's message on a rejection", async () => {
    respond({ detail: "That printed price looks wrong." }, false);
    await expect(fetchQuote({ listedPrice: 99999 })).rejects.toThrow(/printed price/i);
  });
});

describe("fetchConditions", () => {
  it("maps the buyback percentage", async () => {
    respond({
      conditions: [
        { value: "good", label: "Good", description: "Light wear", buyback_percent: 25 },
      ],
      minimum_amount: "20.00",
    });
    const { conditions, minimumAmount } = await fetchConditions();
    expect(conditions[0]).toMatchObject({ value: "good", buybackPercent: 25 });
    expect(minimumAmount).toBe(20);
  });
});

// ----- submitting -----

describe("submitSellRequest", () => {
  const created = {
    id: "req-1",
    status: "submitted",
    title: "Course Text",
    listed_price: "600.00",
    condition: "good",
    quantity: 1,
    quoted_amount: "150.00",
    final_amount: null,
    created_at: "2026-08-20T00:00:00Z",
  };

  it("returns the created request with numbers parsed", async () => {
    respond(created);
    const r = await submitSellRequest("token", {
      condition: "good",
      quantity: 1,
      payoutMethod: "wallet",
      listedPrice: 600,
      title: "Course Text",
    });
    expect(r.quotedAmount).toBe(150);
    expect(r.finalAmount).toBeNull();
    expect(r.status).toBe("submitted");
  });

  it("does not send a request without a token", async () => {
    const spy = respond(created);
    await expect(
      submitSellRequest(null, { condition: "good", quantity: 1, payoutMethod: "wallet" }),
    ).rejects.toThrow(/sign in/i);
    expect(spy).not.toHaveBeenCalled();
  });

  it("maps camelCase fields onto the API's snake_case", async () => {
    const spy = respond(created);
    await submitSellRequest("token", {
      condition: "fair",
      quantity: 2,
      payoutMethod: "bank",
      payoutUpi: "me@upi",
      listedPrice: 500,
      title: "T",
      sellerNote: "cover is creased",
    });
    const body = JSON.parse(String((spy.mock.calls[0][1] as RequestInit).body));
    expect(body).toMatchObject({
      condition: "fair",
      quantity: 2,
      payout_method: "bank",
      payout_upi: "me@upi",
      listed_price: 500,
      seller_note: "cover is creased",
    });
  });

  it("distinguishes a zero final amount from an absent one", async () => {
    // 0 is a real outcome (a rejected book graded worthless); null means not yet
    // decided, and the two must not collapse into each other.
    respond({ ...created, final_amount: "0.00" });
    const r = await submitSellRequest("token", {
      condition: "good", quantity: 1, payoutMethod: "wallet", listedPrice: 600, title: "T",
    });
    expect(r.finalAmount).toBe(0);
  });
});

// ----- the wallet -----

describe("fetchWallet", () => {
  const walletBody = {
    balance: "152.25",
    max_redeemable_now: "100.00",
    max_redemption_percent: 50,
    entries: [
      { id: "e1", amount: "152.25", kind: "buyback_payout", note: "Sold a book", created_at: "2026-08-20T00:00:00Z" },
      { id: "e2", amount: "-52.25", kind: "order_redemption", note: "Applied to an order", created_at: "2026-08-20T01:00:00Z" },
    ],
  };

  it("parses the balance and the cap", async () => {
    respond(walletBody);
    const w = await fetchWallet("token", 200);
    expect(w.balance).toBe(152.25);
    expect(w.maxRedeemableNow).toBe(100);
    expect(w.maxRedemptionPercent).toBe(50);
  });

  it("keeps debits negative", async () => {
    // The sign is what tells the history which way the money went.
    respond(walletBody);
    const w = await fetchWallet("token");
    expect(w.entries[1].amount).toBe(-52.25);
  });

  it("asks about the subtotal it was given", async () => {
    const spy = respond(walletBody);
    await fetchWallet("token", 333.86);
    expect(String(spy.mock.calls[0][0])).toContain("subtotal=333.86");
  });

  it("reads a missing balance as 0 rather than NaN", async () => {
    respond({ entries: [] });
    const w = await fetchWallet("token");
    expect(w.balance).toBe(0);
    expect(w.entries).toEqual([]);
  });

  it("refuses to ask without a token", async () => {
    const spy = respond(walletBody);
    await expect(fetchWallet(null)).rejects.toThrow(/sign in/i);
    expect(spy).not.toHaveBeenCalled();
  });

  it("has customer-readable wording for every ledger kind", async () => {
    respond(walletBody);
    const w = await fetchWallet("token");
    for (const entry of w.entries) {
      expect(WALLET_KIND_LABELS[entry.kind]).toBeTruthy();
    }
  });
});

// ----- used copies -----

describe("fetchUsedCopies", () => {
  it("normalises each copy so a card can render it", async () => {
    respond([
      { id: "u1", title: "Course Text", price: "390.00", stock: 1, condition: "good", parent_book_id: "b1" },
    ]);
    const copies = await fetchUsedCopies("b1");
    expect(copies[0]).toMatchObject({ id: "u1", price: 390, stock: 1, condition: "good" });
    expect(copies[0].parentBookId).toBe("b1");
  });

  it("yields an empty list rather than throwing when the strip fails", async () => {
    // A dead cross-sell strip must never break the product page around it.
    respond({ detail: "nope" }, false);
    expect(await fetchUsedCopies("b1")).toEqual([]);
  });

  it("copes with a malformed body", async () => {
    respond({ not: "an array" });
    expect(await fetchUsedCopies("b1")).toEqual([]);
  });
});
