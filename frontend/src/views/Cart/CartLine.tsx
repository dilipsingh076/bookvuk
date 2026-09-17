"use client";

/** One book you are buying: cover, details, and the three things you can do to it. */

import { bookCoverSrc } from "../../api/index";
import { formatPrice } from "../../utils/formatPrice";
import { QuantityStepper } from "../../components/ui";
import Img from "../../components/ui/Img";
import { HeartIcon, TrashIcon } from "./icons";
import type { LineItem } from "./types";

type CartLineProps = {
  line: LineItem;
  onAdjust: (delta: number) => void;
  onRemove: () => void;
  /** Move it to the wishlist and out of the order — the two halves of "later". */
  onSaveForLater: () => void;
  wishlisted: boolean;
};

const CartLine = ({ line: it, onAdjust, onRemove, onSaveForLater, wishlisted }: CartLineProps) => (
  <div className="py-6 first:pt-0 last:pb-0">
    <div className="grid grid-cols-[100px_1fr_auto] items-start gap-4 sm:grid-cols-[120px_1fr_auto] sm:gap-5">
      <div className="relative h-28 w-24 overflow-hidden rounded-xl bg-bookvuk-lilac shadow-inner ring-1 ring-bookvuk-border/60">
        {/* `alt=""` on purpose: the title is the next thing read out, so
            announcing the cover as well is noise. */}
        <Img
          src={bookCoverSrc(it.book)}
          alt=""
          fill
          className="object-cover"
          onError={(e) => {
            // Kept from the cover-loading investigation: a broken cart cover is
            // silent otherwise, and the useful part is *which* book and which URL.
            const img = e.currentTarget;
            console.warn("Cart cover failed to load", {
              bookId: it.book.bookId ?? it.book.id,
              src: img.currentSrc || img.src,
              coverImage: (it.book as { coverImage?: string | null }).coverImage,
            });
          }}
        />
      </div>

      <div className="min-w-0">
        <div className="text-sm font-semibold leading-snug text-bookvuk-navy">{it.book.title}</div>
        <div className="mt-1 text-xs font-semibold text-bookvuk-muted">{it.book.author}</div>
        <div className="mt-2 text-xs text-bookvuk-muted">
          {it.book.format} • {it.book.stockStatus}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Shared with the book cards. The inline version this replaces had no
              stock ceiling, so pressing + past what the shop has fired a request
              the API refuses and the number silently rolled back. */}
          <QuantityStepper
            qty={it.qty}
            onAdjust={onAdjust}
            stock={Number(it.book.stock ?? 0)}
            label={it.book.title}
          />

          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-bookvuk-muted transition hover:text-rose-600"
          >
            <TrashIcon /> Remove
          </button>
          {/* Had no handler at all, so it promised to save the book and did
              nothing. The wishlist is what "later" means here. */}
          <button
            type="button"
            onClick={onSaveForLater}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-bookvuk-muted transition hover:text-bookvuk-navy"
          >
            <HeartIcon /> {wishlisted ? "Move to wishlist" : "Save for later"}
          </button>
        </div>
      </div>

      <div className="text-right text-sm font-bold tabular-nums text-bookvuk-navy">
        {formatPrice(it.book.price)}
      </div>
    </div>
  </div>
);

export default CartLine;
