"use client";

/**
 * Browse by category.
 *
 * This was a four-column grid of bordered rows, each with its book count. Three
 * things were wrong with it on a shopfront. It read like a table rather than a
 * bookshop. Seven items in a four-column grid left a ragged half-empty second
 * row. And the counts advertised the shop's thin spots — "Technology 2" is the
 * first thing a visitor learned about us, which is a strange thing to lead with.
 *
 * Pills instead: they wrap evenly at any width, they scan in one glance, and the
 * honest scale of the catalogue is stated once in the link at the end rather
 * than category by category. Still plain links, so a crawler still walks them.
 */

import Link from "next/link";
import type { CategoryShelf } from "./types";

type CategoryPillsProps = {
  shelves: CategoryShelf[];
  /** The catalogue's size for the trailing link, or null while unknown. */
  total: number | null;
};

const CategoryPills = ({ shelves, total }: CategoryPillsProps) => {
  if (shelves.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-extrabold text-bookvuk-navy">Browse by category</h2>
      <ul className="mt-4 flex flex-wrap items-center gap-2.5">
        {shelves.map((shelf) => (
          <li key={shelf.id}>
            <Link
              href={`/browse?category=${encodeURIComponent(shelf.id)}`}
              className="inline-flex items-center rounded-full border border-bookvuk-border bg-white px-4 py-2 text-sm font-semibold text-bookvuk-navy transition hover:border-bookvuk-purple/40 hover:bg-bookvuk-lilac hover:text-bookvuk-purple"
            >
              {shelf.name}
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/browse"
            className="inline-flex items-center gap-1 rounded-full bg-bookvuk-lilac px-4 py-2 text-sm font-bold text-bookvuk-purple transition hover:bg-bookvuk-purple hover:text-white"
          >
            All {total === null ? "" : total.toLocaleString("en-IN")} titles
            <span aria-hidden>&rarr;</span>
          </Link>
        </li>
      </ul>
    </section>
  );
};

export default CategoryPills;
