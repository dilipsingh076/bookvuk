import Link from "next/link";

/* A segment-level not-found.
 *
 * `notFound()` renders the nearest `not-found.tsx` in the route hierarchy. With
 * only the root one, an unknown author slug was answered with HTTP 200 and an
 * empty page — an invitation to index infinitely many blank author pages.
 */
const AuthorNotFound = () => (
  <div className="mx-auto max-w-md py-20 text-center">
    <h1 className="text-2xl font-bold tracking-tight text-bookvuk-navy">
      We do not stock that author
    </h1>
    <p className="mt-3 text-sm leading-relaxed text-bookvuk-muted">
      They may have been spelled differently, or we may not carry them yet.
    </p>
    <div className="mt-7 flex justify-center gap-4 text-sm font-semibold">
      <Link href="/authors" className="text-bookvuk-purple hover:underline">
        All authors
      </Link>
      <Link href="/browse" className="text-bookvuk-purple hover:underline">
        Browse the catalogue
      </Link>
    </div>
  </div>
);

export default AuthorNotFound;
