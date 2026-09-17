"use client";

/**
 * "You could pay less for two of these."
 *
 * The used block lives on the product page — a page somebody has already left by
 * the time they are deciding whether to pay. The saving belongs where the money
 * is about to go, and the cart never mentioned it.
 *
 * Deliberately a swap, not an upsell: it replaces the new copy rather than
 * adding to the basket, because the customer already said they want this book
 * and the only question left is which copy.
 */

import { useCallback, useEffect, useState } from "react";
import { fetchCartUsedSavings, type CartSaving } from "../../api/discovery";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { formatPrice } from "../../utils/formatPrice";
import { CONDITION_BLURBS, CONDITION_LABELS, isCondition } from "../../lib/conditions";
import { Button } from "../../components/ui";

type CartUsedSavingsProps = {
  /** Bumped by the cart whenever its contents change, so the offers re-read. */
  refreshKey?: number;
};

const CartUsedSavings = ({ refreshKey = 0 }: CartUsedSavingsProps) => {
  const { getToken, isAuthenticated } = useAuth();
  const { addToCart, removeFromCart } = useCart();
  const [rows, setRows] = useState<CartSaving[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setRows([]);
      return;
    }
    setRows(await fetchCartUsedSavings(getToken()));
  }, [isAuthenticated, getToken]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (rows.length === 0) return null;

  const total = rows.reduce((sum, r) => sum + r.saving, 0);

  const swap = async (row: CartSaving) => {
    /* Signed-in only, and not just because the offers are fetched that way.
     *
     * `addToCart` here passes an id with no book snapshot, which is fine for an
     * account — the context re-reads the cart and the server embeds the book. A
     * guest line has no such rescue: it would sit in the cart with no title or
     * price, counted by the navbar badge and hidden by the cart page, which
     * filters lines that have no book. */
    if (!isAuthenticated) return;
    setBusy(row.usedBookId);
    try {
      // Add first, then drop the new one: if the add fails the customer still
      // has the book they chose, rather than an empty line where it was.
      await addToCart({ id: row.usedBookId });
      await removeFromCart(row.cartBookId);
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-bookvuk-navy">
          {rows.length === 1
            ? "There is a used copy of one of these"
            : `There are used copies of ${rows.length} of these`}
        </h2>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
          SAVE UP TO {formatPrice(total)}
        </span>
      </div>

      <ul className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <li
            key={r.usedBookId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3.5"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-bookvuk-navy">{r.title}</div>
              <div className="mt-0.5 text-xs text-bookvuk-muted">
                {isCondition(r.condition) ? (
                  <>
                    <span className="font-semibold text-bookvuk-navy">
                      {CONDITION_LABELS[r.condition]}
                    </span>{" "}
                    — {CONDITION_BLURBS[r.condition]}
                  </>
                ) : (
                  r.condition
                )}
                {r.stock <= 2 ? (
                  <span className="ml-1 font-semibold text-amber-700">
                    only {r.stock} left
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-extrabold tabular-nums text-bookvuk-navy">
                  {formatPrice(r.usedPrice)}
                </div>
                <div className="text-[11px] text-bookvuk-muted line-through">
                  {formatPrice(r.newPrice)}
                </div>
              </div>
              <Button
                variant="primary-fade"
                size="sm"
                radius="lg"
                disabled={busy === r.usedBookId}
                onClick={() => swap(r)}
              >
                {busy === r.usedBookId ? "Swapping…" : `Save ${formatPrice(r.saving)}`}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-emerald-900">
        Every used copy is checked by hand: all pages present and readable, no water
        damage, binding intact.
      </p>
    </section>
  );
};

export default CartUsedSavings;
