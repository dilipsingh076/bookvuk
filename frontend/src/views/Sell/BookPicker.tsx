"use client";

/**
 * Step one: which book.
 *
 * Two ways in, because the catalogue does not have everything. Searching is the
 * fast path; typing it in by hand is the one that has to exist, or a seller with
 * a title we do not stock has no way to sell it at all.
 */

import { formatPrice } from "../../utils/formatPrice";
import { Input, SectionHeading } from "../../components/ui";
import { Skeleton } from "../../components/ui/Skeleton";
import IsbnScanner from "./IsbnScanner";
import type { Mode } from "./types";
import type { UseSellFlow } from "./useSellFlow";

type BookPickerProps = { flow: UseSellFlow };

const MODES: Array<[Mode, string]> = [
  ["search", "It's in your store"],
  ["manual", "Enter it myself"],
];

const BookPicker = ({ flow: f }: BookPickerProps) => (
  <section className="rounded-3xl border border-bookvuk-border/80 bg-white p-6 shadow-bookvuk-card sm:p-7">
    <SectionHeading title="1. Which book?" />

    <div className="mt-4 flex gap-2">
      {MODES.map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => f.switchMode(value)}
          aria-pressed={f.mode === value}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:text-[13px] ${
            f.mode === value
              ? "bg-bookvuk-lilac text-bookvuk-navy"
              : "bg-zinc-100 text-bookvuk-muted hover:bg-zinc-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>

    {f.mode === "search" ? (
      <div className="mt-5">
        <label htmlFor="sell-search" className="text-sm font-semibold text-bookvuk-navy">
          Search our catalogue
        </label>
        <Input
          id="sell-search"
          type="search"
          value={f.search}
          onChange={(e) => {
            f.setSearch(e.target.value);
            f.setPicked(null);
          }}
          placeholder="Title or author…"
          className="mt-2"
        />

        {f.picked ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-bookvuk-purple/30 bg-bookvuk-lilac/40 p-3.5">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-bookvuk-navy">{f.picked.title}</div>
              <div className="mt-0.5 text-xs text-bookvuk-muted">
                {f.picked.author} · printed price {formatPrice(f.picked.price)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => f.setPicked(null)}
              className="shrink-0 text-xs font-semibold text-bookvuk-purple hover:underline"
            >
              Change
            </button>
          </div>
        ) : f.searching ? (
          <div className="mt-4 space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : f.results.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {f.results.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => f.setPicked(b)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-bookvuk-border bg-white p-3 text-left transition hover:border-bookvuk-purple/30 hover:bg-bookvuk-lilac/20"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-bookvuk-navy">
                      {b.title}
                    </span>
                    <span className="block truncate text-xs text-bookvuk-muted">{b.author}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-bookvuk-navy">
                    {formatPrice(b.price)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : f.debounced.length >= 2 ? (
          <p className="mt-4 text-sm text-bookvuk-muted">
            Nothing matched.{" "}
            <button
              type="button"
              onClick={() => f.switchMode("manual")}
              className="font-semibold text-bookvuk-purple hover:underline"
            >
              Enter the book yourself
            </button>{" "}
            instead.
          </p>
        ) : null}
      </div>
    ) : (
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="m-title" className="text-sm font-semibold text-bookvuk-navy">
            Title
          </label>
          <Input
            id="m-title"
            value={f.manualTitle}
            onChange={(e) => f.setManualTitle(e.target.value)}
            className="mt-2"
          />
        </div>
        <div>
          <label htmlFor="m-author" className="text-sm font-semibold text-bookvuk-navy">
            Author <span className="font-normal text-bookvuk-muted">(optional)</span>
          </label>
          <Input
            id="m-author"
            value={f.manualAuthor}
            onChange={(e) => f.setManualAuthor(e.target.value)}
            className="mt-2"
          />
        </div>
        <div>
          <label htmlFor="m-isbn" className="text-sm font-semibold text-bookvuk-navy">
            ISBN <span className="font-normal text-bookvuk-muted">(optional)</span>
          </label>
          <Input
            id="m-isbn"
            value={f.manualIsbn}
            onChange={(e) => f.setManualIsbn(e.target.value)}
            className="mt-2"
          />
          {/* Typing is the whole cost of this form, and it is what makes
              somebody stop after two books. Renders nothing on a browser with no
              barcode decoder, so the field is simply typed there. */}
          <IsbnScanner onFound={f.setManualIsbn} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="m-price" className="text-sm font-semibold text-bookvuk-navy">
            Printed price (MRP)
          </label>
          <Input
            id="m-price"
            type="number"
            min="1"
            inputMode="decimal"
            value={f.manualPrice}
            onChange={(e) => f.setManualPrice(e.target.value)}
            className="mt-2"
          />
          {/* The offer is a share of this, so it is worth saying where to find it
              — and that it gets checked, which keeps guesses honest. */}
          <p className="mt-1.5 text-xs leading-relaxed text-bookvuk-muted">
            It is printed on the back cover. We check it against the book when it arrives.
          </p>
        </div>
      </div>
    )}

    <div className="mt-6 border-t border-bookvuk-border/70 pt-5">
      <label htmlFor="qty" className="text-sm font-semibold text-bookvuk-navy">
        How many copies?
      </label>
      <Input
        id="qty"
        type="number"
        min={1}
        max={20}
        value={f.quantity}
        onChange={(e) => f.setQuantity(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
        className="mt-2 w-24"
      />
    </div>
  </section>
);

export default BookPicker;
