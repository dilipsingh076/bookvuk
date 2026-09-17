"use client";

/**
 * Three figures: the shop's size, and the visitor's own two counts.
 *
 * The catalogue tile is informational — the Browse link lives in the hero — but
 * the other two are buttons, because a count of things you own is a thing you
 * want to open.
 */

import { formatCount } from "./types";

type HomeStatsProps = {
  /** Null while unknown: "0" is a claim about the shop, an em dash is not. */
  titlesInStore: number | null;
  cartQty: number;
  wishlistCount: number;
  onCart: () => void;
  onWishlist: () => void;
};

const HomeStats = ({
  titlesInStore,
  cartQty,
  wishlistCount,
  onCart,
  onWishlist,
}: HomeStatsProps) => (
  <section className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-3">
    <div className="rounded-[20px] bg-white p-6 text-left shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.06]">
      <div className="text-[11px] font-bold uppercase tracking-wider text-bookvuk-muted">
        Titles in store
      </div>
      {/* The real catalogue total, from the facets endpoint. This was
          `allBooks.length` — the size of the eight-item spotlight page — so a
          200-book store reported "8". */}
      <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-bookvuk-navy">
        {titlesInStore === null ? "—" : formatCount(titlesInStore)}
      </div>
      <p className="mt-3 text-sm leading-snug text-bookvuk-muted">
        Growing catalogue—explore anytime from the banner above.
      </p>
    </div>
    <button
      type="button"
      onClick={onCart}
      className="rounded-[20px] bg-white p-6 text-left shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.06] transition-colors hover:bg-zinc-50/80"
    >
      <div className="text-[11px] font-bold uppercase tracking-wider text-bookvuk-muted">
        In your cart
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-bookvuk-navy">
        {formatCount(cartQty)}
      </div>
      <div className="mt-3 text-sm font-semibold text-bookvuk-purple">View cart →</div>
    </button>
    <button
      type="button"
      onClick={onWishlist}
      className="rounded-[20px] bg-white p-6 text-left shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.06] transition-colors hover:bg-zinc-50/80"
    >
      <div className="text-[11px] font-bold uppercase tracking-wider text-bookvuk-muted">
        Saved for later
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-bookvuk-navy">
        {formatCount(wishlistCount)}
      </div>
      <div className="mt-3 text-sm font-semibold text-bookvuk-purple">Open wishlist →</div>
    </button>
  </section>
);

export default HomeStats;
