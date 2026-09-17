import Link from "next/link";

import BookCard from "@/components/BookCard";
import { PageHeader } from "@/components/ui";
import type { AuthorDetailProps } from "./types";

/* An author's shelf.
 *
 * A server component on purpose: everything on it comes from the server, and the
 * interactive parts — the cards' wishlist and add-to-cart — are client components
 * of their own. So this page ships no JavaScript for itself.
 *
 * `/authors` used to send every name to `/browse?q=<name>`, a search results page
 * with no title, description or identity. "Books by Premchand" is a real search;
 * this is a page that can answer it.
 */
const AuthorDetail = ({ author }: AuthorDetailProps) => {
  const count = author.total;

  return (
    <div className="pb-20 pt-8">
      <PageHeader
        title={`Books by ${author.name}`}
        offsetTitle={false}
        descriptionSize="sm"
        description={`${count} ${count === 1 ? "title" : "titles"} in stock at BookVuk.`}
        actions={
          <Link
            href="/authors"
            className="shrink-0 text-sm font-semibold text-bookvuk-purple hover:underline"
          >
            All authors &rarr;
          </Link>
        }
      />

      {author.items.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-5 sm:gap-6 md:grid-cols-4">
          {author.items.map((book) => (
            <BookCard key={book.id} book={book} variant="trending" />
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-bookvuk-muted">
          Nothing by this author is in stock right now.{" "}
          <Link href="/browse" className="font-semibold text-bookvuk-purple hover:underline">
            Browse the catalogue
          </Link>
        </p>
      )}
    </div>
  );
};

export default AuthorDetail;
