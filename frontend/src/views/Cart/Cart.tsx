"use client";

/**
 * The cart page.
 *
 * What it *does* lives in `useCartPage`; this is only its shape.
 */

import CartLine from "./CartLine";
import CartSkeleton from "./CartSkeleton";
import CartSummary from "./CartSummary";
import CartUsedSavings from "./CartUsedSavings";
import EmptyCart from "./EmptyCart";
import WaitingForStock from "./WaitingForStock";
import { useCartPage } from "./useCartPage";

const Cart = () => {
  const c = useCartPage();

  if (c.loading) return <CartSkeleton />;

  return (
    <div className="relative pb-16 pt-6">
      <div className="mx-auto">
        <main className="relative min-w-0">
          {c.isEmpty ? (
            <div
              className="pointer-events-none absolute inset-x-0 -top-4 h-56 bg-gradient-to-b from-rose-50/80 via-bookvuk-lilac/30 to-transparent"
              aria-hidden
            />
          ) : null}

          <div className="relative">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="bg-gradient-to-r from-bookvuk-navy to-bookvuk-purple bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
                  Shopping Cart
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      c.isEmpty
                        ? "bg-bookvuk-border/60 text-bookvuk-muted"
                        : "bg-bookvuk-lilac text-bookvuk-purple ring-1 ring-bookvuk-purple/15"
                    }`}
                  >
                    {c.lineItems.length} item{c.lineItems.length === 1 ? "" : "s"}
                  </span>
                  <span className="text-sm text-bookvuk-muted">
                    {c.isEmpty ? "Add books from the shop to checkout" : "Review before checkout"}
                  </span>
                </div>
              </div>
              {!c.isEmpty ? (
                <button
                  type="button"
                  onClick={() => c.clearCart()}
                  className="self-start rounded-xl border border-bookvuk-border bg-white px-4 py-2.5 text-sm font-semibold text-bookvuk-purple shadow-sm transition hover:border-rose-200  hover:bg-rose-50/80 hover:text-rose-700"
                >
                  Clear cart
                </button>
              ) : null}
            </div>

            {c.isEmpty ? (
              <EmptyCart />
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_minmax(280px,380px)] lg:items-start">
                <div className="rounded-3xl bg-white p-5 shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.06] sm:p-7">
                  <div className="divide-y divide-bookvuk-border">
                    {c.lineItems.map((it) => (
                      <CartLine
                        key={it.bookId}
                        line={it}
                        onAdjust={(d) => void c.adjustQty(it.bookId, d)}
                        onRemove={() => c.removeFromCart(it.bookId)}
                        wishlisted={c.wishlistIds.includes(String(it.book.id))}
                        onSaveForLater={() =>
                          /* A book already wishlisted only needs removing from the
                             cart, or the toggle would take it back off the list the
                             shopper is trying to move it onto. */
                          c.requireAuth(async () => {
                            if (!c.wishlistIds.includes(String(it.book.id))) {
                              await c.toggleWishlist(it.book);
                            }
                            await c.removeFromCart(it.bookId);
                          })
                        }
                      />
                    ))}
                  </div>

                  <WaitingForStock lines={c.waitingLines} onRemove={c.removeFromCart} />

                  {/* The saving, where the money is about to be spent. The used
                      block lives on the product page, which is a page they have
                      already left by the time they are deciding whether to pay. */}
                  <CartUsedSavings refreshKey={c.items.length} />
                </div>

                <CartSummary cart={c} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Cart;
