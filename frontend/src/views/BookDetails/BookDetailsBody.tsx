"use client";

/**
 * The cover, the details, and the buying controls.
 *
 * Shared by the full page and the quick-look dialog, which differ in two ways
 * that matter to a crawler rather than to a shopper: the dialog omits the
 * breadcrumbs (they would point at the page it is covering) and drops to an
 * `<h2>`, because the catalogue underneath owns the `<h1>`.
 */

import Link from "next/link";
import { formatPrice } from "../../utils/formatPrice";
import { Button, QuantityStepper } from "../../components/ui";
import Img from "../../components/ui/Img";
import { Skeleton, SkeletonText } from "../../components/ui/Skeleton";
import UsedCopies from "../../components/UsedCopies";
import {
  CONDITION_BLURBS,
  CONDITION_LABELS,
  USED_GUARANTEE,
  isCondition,
} from "../../lib/conditions";
import type { UseBookDetails } from "./useBookDetails";

type BookDetailsBodyProps = {
  details: UseBookDetails;
  isModal: boolean;
};

const BookDetailsBody = ({ details: d, isModal }: BookDetailsBodyProps) => {
  const { book } = d;

  if (d.loading) {
    /* Mirrors the cover + details columns below, so the page does not reflow
       when the book lands. Was the centred text "Loading...". */
    return (
      <div className="p-6">
        <div
          className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-8"
          aria-busy="true"
        >
          <Skeleton className="aspect-[4/5] w-full max-w-[280px] rounded-2xl" />
          <div className="min-w-0 space-y-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-3 w-40" />
            <SkeletonText lines={3} className="pt-2" />
            <Skeleton className="mt-4 h-11 w-40 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (d.error) {
    return (
      <div className="p-6">
        <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          {(d.error as { message?: string } | undefined)?.message || "Could not load book"}
        </div>
      </div>
    );
  }

  if (!book) return <div className="p-6" />;

  const Heading = isModal ? "h2" : "h1";

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-8">
        <div className="mx-auto w-full max-w-[280px] shrink-0 rounded-2xl border border-bookvuk-border/80 bg-white p-3 md:mx-0">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-bookvuk-lilac">
            {/* The product page's largest image, and therefore its LCP element.
                `priority` because it is above the fold on every book page —
                lazy-loading the one image the page is about only delays it.
                `sizes` is the real rendered width so a phone does not fetch a
                280px-wide cover at desktop resolution. */}
            <Img
              src={d.coverSrc}
              alt={`Cover of ${book.title}${book.author ? ` by ${book.author}` : ""}`}
              fill
              className="object-cover"
              priority
              onError={d.onCoverError}
            />
            <div className="pointer-events-none absolute bottom-3 left-1/2 max-w-[calc(100%-1.5rem)] -translate-x-1/2">
              <span className="inline-block rounded-full bg-white/95 px-4 py-1.5 text-center text-xs font-semibold text-bookvuk-navy shadow-sm ring-1 ring-black/5">
                {book.format}
              </span>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              {/* Breadcrumbs: navigable, and they let search results show
                  `bookvuk › Fiction › Title` instead of a bare URL. Links, so a
                  crawler can follow them back up into the category.

                  Not in the dialog, for two reasons. The dialog is opened over
                  the catalogue, so "Books" points at the page it is already
                  covering — asking to go where you already are. And measured,
                  that link only navigated about one time in four: the push
                  competes with the intercepted route the dialog is rendered
                  from. Shipping a link that works a quarter of the time is
                  worse than not offering it, and the full page — which is what
                  crawlers and shared links get, and where breadcrumbs earn
                  their keep — still has them. Escape or the backdrop is how you
                  get back to the catalogue from here. */}
              {!isModal ? (
                <nav aria-label="Breadcrumb">
                  <ol className="flex flex-wrap items-center gap-1.5 text-xs text-bookvuk-muted">
                    <li>
                      <Link href="/browse" className="font-semibold hover:text-bookvuk-purple">
                        Books
                      </Link>
                    </li>
                    {book.category ? (
                      <>
                        <li aria-hidden>›</li>
                        <li>
                          <Link
                            href={`/browse?category=${encodeURIComponent(book.category_id ?? "")}`}
                            className="font-semibold text-bookvuk-navy hover:text-bookvuk-purple"
                          >
                            {book.category}
                          </Link>
                        </li>
                      </>
                    ) : null}
                  </ol>
                </nav>
              ) : null}
              {/* An <h1> on a page that is about one book. It was an <h2>, so
                  every product page shipped without a top-level heading. */}
              <Heading className="mt-2 text-2xl font-extrabold text-bookvuk-navy md:text-3xl">
                {book.title}
              </Heading>
              <div className="mt-2 text-sm text-bookvuk-muted">by {book.author}</div>
            </div>

            <button
              type="button"
              onClick={d.toggleSaved}
              className="rounded-full border border-bookvuk-border px-3 py-2 text-sm font-semibold text-bookvuk-navy hover:bg-bookvuk-lilac"
            >
              <span className={d.wished ? "text-rose-600" : ""}>♥</span>{" "}
              {d.wished ? "Saved" : "Save"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {(book.ratingCount ?? 0) > 0 ? (
              <>
                <div className="flex items-center gap-1 text-sm font-semibold text-amber-500">
                  <span>★</span>
                  <span>{book.rating.toFixed(1)}</span>
                </div>
                <div className="text-sm text-bookvuk-muted">({book.ratingCount})</div>
              </>
            ) : (
              <div className="text-sm text-bookvuk-muted">No ratings yet</div>
            )}
            <div className="text-sm font-semibold text-bookvuk-navy">
              {formatPrice(book.price)}
              {/* The declaration that goes with an MRP. Indian shoppers read
                  this before the number means anything to them. */}
              <span className="ml-1.5 font-normal text-xs text-bookvuk-muted">
                MRP, incl. of all taxes
              </span>
            </div>
          </div>

          <p className="mt-4 break-words text-sm leading-relaxed text-bookvuk-muted">
            {book.description}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {/* Out of stock offers something different rather than a button the
                checkout would refuse: saving it subscribes the visitor to the
                back-in-stock notice and puts the title on the shop's restock
                queue, ranked by how many people are waiting. */}
            {d.soldOut ? (
              <button
                type="button"
                onClick={d.notifyMe}
                className={`shrink-0 rounded-lg px-5 py-3 text-sm font-semibold transition ${
                  d.wished
                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                    : "bg-bookvuk-purple text-white hover:bg-bookvuk-purple-hover"
                }`}
              >
                {d.wished ? "We'll email you when it's back" : "Notify me when it's back"}
              </button>
            ) : d.cartQty ? (
              <QuantityStepper
                qty={d.cartQty}
                onAdjust={d.adjust}
                stock={Number(book.stock ?? 0)}
                label={book.title}
              />
            ) : (
              <Button
                type="button"
                onClick={d.addToCart}
                variant="primary"
                size="lg"
                className="shrink-0 py-3"
              >
                Add to Cart
              </Button>
            )}
            {/* Shown once the book is in the cart, which is when it is useful —
                and to guests too. It was gated on being signed in, but a guest
                has a cart and `/cart` serves them, so the one visitor who most
                needs the link was the one who could not see it. */}
            {d.cartQty ? (
              <button
                type="button"
                onClick={d.goToCart}
                className="shrink-0 rounded-lg border border-bookvuk-border px-5 py-3 text-sm font-semibold text-bookvuk-navy hover:bg-bookvuk-lilac"
              >
                Go to Cart
              </button>
            ) : null}
          </div>

          <div
            className={`mt-6 rounded-xl p-4 text-sm text-bookvuk-navy ${
              d.soldOut ? "bg-amber-50" : "bg-bookvuk-lilac"
            }`}
          >
            <div className="font-semibold">Availability</div>
            <div className="mt-1 break-words">
              {d.soldOut ? "Out of stock right now" : book.stockStatus}
            </div>
            {d.soldOut ? (
              <div className="mt-1.5 text-xs leading-relaxed text-bookvuk-muted">
                {d.wished
                  ? "You are on the list, and it is waiting in your cart — we will email you the moment it arrives."
                  : "Ask us to tell you when it is back, and we will prioritise restocking it."}
              </div>
            ) : null}
            {/* Was "Shipping and taxes are calculated during checkout", which
                stopped being true: the price is the MRP from the cover and that
                is inclusive of all taxes. Only delivery is still added. */}
            <div className="mt-3 text-xs leading-snug text-bookvuk-muted">
              Delivery is added at checkout. Taxes are already included in the price.
            </div>
          </div>

          {/* Only on a catalogue listing: a used copy's own page shows its
              siblings via the same endpoint, but nesting the block inside itself
              would be confusing. */}
          {(book.condition ?? "new") === "new" ? (
            <UsedCopies bookId={String(book.id)} newPrice={book.price} title={book.title} />
          ) : /* A used copy's own page. Reachable directly now that the browse
               filter exists, and previously it showed a condition badge with
               nothing saying what the word entitled the buyer to. */
          isCondition(book.condition) ? (
            <section className="mt-8 rounded-2xl border border-bookvuk-border/80 bg-white p-5">
              <h2 className="text-base font-bold text-bookvuk-navy">
                This copy: {CONDITION_LABELS[book.condition]}
              </h2>
              <p className="mt-1 text-sm text-bookvuk-muted">{CONDITION_BLURBS[book.condition]}</p>
              <p className="mt-3 rounded-xl bg-emerald-50/70 px-3 py-2.5 text-xs leading-relaxed text-emerald-900">
                {USED_GUARANTEE}
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default BookDetailsBody;
