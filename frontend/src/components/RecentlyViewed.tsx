"use client";

/**
 * The books you looked at last time.
 *
 * Browsing a bookshop is not a single decision — people look at four or five
 * titles, leave, and come back. Nothing remembered that, so every visit started
 * from an empty catalogue and the four books they had already shortlisted were
 * gone.
 *
 * Kept in `localStorage` rather than on the server, deliberately. It is a
 * convenience for one person on one device, it needs no account to work (most
 * browsing here is signed out), and a browsing history is the kind of thing a
 * shop should not hold unless it has a reason to.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { bookCoverSrc, type Book } from "../api/index";
import { formatPrice } from "../utils/formatPrice";
import Img from "./ui/Img";

const KEY = "bookvuk_recent";
const MAX = 8;

type Seen = {
  id: string;
  title: string;
  author: string | null;
  price: number;
  cover: string | null;
};

const read = (): Seen[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Seen[]) : [];
  } catch {
    // A private window, cleared site data, or a value somebody else wrote.
    return [];
  }
};

/** Record a visit. Called by the product page; safe to call on every render. */
export const rememberBook = (book: Book) => {
  try {
    const seen = read().filter((b) => b.id !== String(book.id));
    seen.unshift({
      id: String(book.id),
      title: book.title,
      author: book.author || null,
      price: Number(book.price) || 0,
      cover: (book as { coverImage?: string | null }).coverImage ?? null,
    });
    localStorage.setItem(KEY, JSON.stringify(seen.slice(0, MAX)));
  } catch {
    // Storage is full or blocked. Losing the history is not worth an error.
  }
};

type RecentlyViewedProps = {
  /** The page you are on, so it does not offer you the book you are reading. */
  excludeId?: string;
  heading?: string;
};

const RecentlyViewed = ({ excludeId, heading = "You were looking at" }: RecentlyViewedProps) => {
  const [items, setItems] = useState<Seen[]>([]);

  // Read after mount: `localStorage` does not exist while this renders on the
  // server, and reading it during render would make the two disagree.
  useEffect(() => {
    setItems(read().filter((b) => b.id !== excludeId));
  }, [excludeId]);

  if (items.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="recently-viewed-heading">
      <h2 id="recently-viewed-heading" className="text-lg font-bold text-bookvuk-navy">
        {heading}
      </h2>
      <ul className="mt-4 flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((b) => (
          <li key={b.id} className="w-36 shrink-0">
            <Link href={`/books/${b.id}`} className="group block">
              <div className="overflow-hidden rounded-xl border border-bookvuk-border/80 bg-white">
                <Img
                  src={bookCoverSrc({ coverImage: b.cover } as Book)}
                  alt={b.title}
                  className="h-44 w-full object-cover transition group-hover:scale-[1.02]"
                />
              </div>
              <div className="mt-2 truncate text-sm font-semibold text-bookvuk-navy">
                {b.title}
              </div>
              {b.author ? (
                <div className="truncate text-xs text-bookvuk-muted">{b.author}</div>
              ) : null}
              <div className="mt-0.5 text-sm font-bold tabular-nums text-bookvuk-navy">
                {formatPrice(b.price)}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default RecentlyViewed;
