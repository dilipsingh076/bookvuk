"use client";

/**
 * Browse by author.
 *
 * The footer promised this page and it did not exist. It matters beyond fixing a
 * dead link: a bookshop is browsed by author as much as by category, and each name
 * here is a crawlable link into the catalogue that search engines had no way to
 * reach before.
 */

import Link from "next/link";
import { Alert, Input, PageHeader } from "../../components/ui";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuthors } from "./useAuthors";
import type { AuthorsProps } from "./types";

const Authors = (props: AuthorsProps) => {
  const a = useAuthors(props);

  return (
    <div className="pb-20 pt-8">
      <PageHeader
        title="Browse by author"
        offsetTitle={false}
        descriptionSize="sm"
        descriptionClassName="leading-relaxed"
        description={
          a.loading
            ? "Everyone we stock, and how many of their books we carry."
            : `${a.total} authors, and how many of their books we carry.`
        }
        actions={
          <Link
            href="/browse"
            className="shrink-0 text-sm font-semibold text-bookvuk-purple hover:underline"
          >
            Browse everything →
          </Link>
        }
      />

      <div className="mt-6 max-w-md">
        <Input
          type="search"
          value={a.filter}
          onChange={(e) => a.setFilter(e.target.value)}
          placeholder="Find an author…"
          aria-label="Find an author"
          className="px-4 transition"
        />
      </div>

      {a.error ? (
        <Alert tone="error" className="mt-6">
          Could not load the authors just now.
        </Alert>
      ) : null}

      {a.loading ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : a.shown.length === 0 ? (
        <p className="mt-8 text-sm text-bookvuk-muted">
          No author matched “{a.filter}”.{" "}
          <button
            type="button"
            onClick={a.clearFilter}
            className="font-semibold text-bookvuk-purple hover:underline"
          >
            Show all
          </button>
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {a.shown.map((author) => (
            <li key={author.name}>
              {/* A real link into the author's own page: crawlable, with a title,
                  description and schema of its own. It was `/browse?q=<name>` — a
                  search results page with none of those. */}
              <Link
                href={`/authors/${author.slug}`}
                className="flex h-full flex-col justify-between rounded-2xl border border-bookvuk-border/80 bg-white p-4 transition hover:border-bookvuk-purple/30 hover:shadow-bookvuk-card"
              >
                <span className="text-sm font-bold leading-snug text-bookvuk-navy">
                  {author.name}
                </span>
                <span className="mt-2 text-xs text-bookvuk-muted">
                  {author.books} {author.books === 1 ? "book" : "books"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Authors;
