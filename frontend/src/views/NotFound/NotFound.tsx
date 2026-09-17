"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A real 404.
 *
 * Unknown URLs used to `Navigate` silently to the landing page. That hid broken
 * links from us and confused visitors — a mistyped or stale URL looked like the
 * site had simply decided to show them something else. Crawlers read it as a soft
 * 404 and keep the dead URL indexed.
 */
const NotFound = () => {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-16">
      {/* No width cap: pages here fill the column `<main>` gives them, and the
          text is centred rather than boxed. */}
      <div className="w-full text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-bookvuk-purple">404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-bookvuk-navy sm:text-4xl">
          We could not find that page
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-bookvuk-muted sm:text-[15px]">
          <span className="break-all font-medium text-bookvuk-navy">{pathname}</span> does not
          exist. It may have moved, or the link that brought you here may be out of date.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/browse"
            className="rounded-xl bg-bookvuk-purple px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Browse all books
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-bookvuk-border bg-white px-5 py-2.5 text-sm font-semibold text-bookvuk-navy transition hover:bg-zinc-50"
          >
            Go to the homepage
          </Link>
        </div>

        <p className="mt-8 text-sm text-bookvuk-muted">
          Looking for something specific?{" "}
          <Link href="/browse" className="font-semibold text-bookvuk-purple hover:underline">
            Search the catalogue
          </Link>
          , or{" "}
          <Link href="/help" className="font-semibold text-bookvuk-purple hover:underline">
            visit help
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

export default NotFound;
