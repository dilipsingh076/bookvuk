import type { Metadata } from "next";
import Link from "next/link";

import BookDetails from "@/views/BookDetails";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";
import { bookCoverSrc, fetchBookById, fetchSitemapBooks } from "@/api/index";
import JsonLd from "@/components/JsonLd";
import { bookSchema, breadcrumbSchema } from "@/lib/schema";
import { bookKeywords, bookLocale, bookMetaDescription, bookMetaTitle } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";


type Params = { params: Promise<{ bookId: string }> };

/* Every book is prerendered, and this is not an optimisation — it is what puts
 * the metadata in `<head>`.
 *
 * Left dynamic, the route streams, and Next emits the title and og: tags into
 * the *body* as they resolve. A browser hoists them into the head; a link-preview
 * scraper reading the raw HTML does not, and finds nothing — which is the exact
 * bug this migration set out to fix. Prerendering writes a complete document,
 * head included.
 *
 * `revalidate` keeps it current: a book edited today is regenerated within the
 * half hour without a redeploy, and one added today is rendered on first request
 * because of `dynamicParams`. */
export const revalidate = 1800;
export const dynamicParams = true;

export const generateStaticParams = async () => {
  try {
    const books = await fetchSitemapBooks();
    return books.map((book) => ({ bookId: book.id }));
  } catch {
    // A failed catalogue fetch must not fail the build; these pages then render
    // on first request instead.
    return [];
  }
};

/* The one page this whole migration was for.
 *
 * The title, description and cover are resolved on the server and rendered into
 * the HTML, so the scrapers that build link previews — WhatsApp, Twitter/X,
 * Slack, LinkedIn, iMessage — see the actual book. None of them run JavaScript,
 * which is why the client-side hook this replaces could never reach them: every
 * one of 200 book links previewed as the generic storefront.
 *
 * A failed fetch falls back to the layout's defaults rather than throwing. A
 * missing preview is a bad share; a 500 on a product page is a lost sale.
 */
export const generateMetadata = async ({ params }: Params): Promise<Metadata> => {
  const { bookId } = await params;
  try {
    const book = await fetchBookById(bookId);
    const title = bookMetaTitle(book);
    // Built from the book's own facts. The catalogue's blurb is repeated across
    // dozens of titles — fifty-four books shared one sentence — so using it alone
    // gave those pages identical descriptions and identical link previews.
    const description = bookMetaDescription(book);
    const cover = bookCoverSrc(book);

    return {
      title,
      description,
      keywords: bookKeywords(book),
      alternates: { canonical: `/books/${book.id}` },
      openGraph: {
        /* `book`, not `article`: Open Graph has a type for this, and it carries
           the author alongside the title instead of leaving a bookshop's central
           page described as a blog post. */
        type: "book",
        ...(book.author ? { authors: [book.author] } : {}),
        /* `siteName` is lost here rather than inherited — declaring `openGraph`
           replaces the root block outright — so every book and author page was
           previewing without the shop's name on the card. */
        siteName: "BookVuk",
        /* Half the catalogue is Hindi. Saying which language this particular book
           is in is the whole point of stocking both — see bookLocale for why the
           `language` field cannot be trusted to answer that. */
        locale: bookLocale(book),
        title,
        description,
        url: `/books/${book.id}`,
        images: [{ url: cover, alt: `Cover of ${book.title}` }],
      },
      twitter: {
        /* `summary`, not `summary_large_image`. The wide card crops whatever it
           is given to 1.91:1, and a book cover is portrait at roughly 0.66 — so
           the wide card showed a thin horizontal slice through the middle of the
           artwork. `summary` puts the cover beside the text as a thumbnail,
           which is the shape it actually is. */
        card: "summary",
        title,
        description,
        images: [cover],
      },
    };
  } catch {
    // Unknown id: nothing to describe, and nothing that should be indexed.
    return { title: "Book not found", robots: { index: false, follow: false } };
  }
};

/** Shown for an id that matches no book. */
const MissingBook = () => (
  <div className="mx-auto max-w-md py-20 text-center">
    <h1 className="text-2xl font-bold tracking-tight text-bookvuk-navy">
      We could not find that book
    </h1>
    <p className="mt-3 text-sm leading-relaxed text-bookvuk-muted">
      The link may be out of date, or the title may no longer be stocked.
    </p>
    <div className="mt-7 flex justify-center gap-4 text-sm font-semibold">
      <Link href="/browse" className="text-bookvuk-purple hover:underline">
        Browse the catalogue
      </Link>
      <Link href="/authors" className="text-bookvuk-purple hover:underline">
        Browse by author
      </Link>
    </div>
  </div>
);

/* The Book and BreadcrumbList graphs, resolved on the server. The star rating
 * and price that can appear beside a search result come from these, so they have
 * to be in the HTML rather than appended by an effect. */
const Page = async ({ params }: Params) => {
  const { bookId } = await params;
  const book = await fetchBookById(bookId).catch(() => null);

  /* A book that does not exist.
   *
   * Deliberately not `dynamicParams: false` here, unlike the author pages: books
   * are added through the admin panel between builds, and a brand-new product
   * page returning 404 would be far worse than this. And `notFound()` cannot
   * help — in an on-demand ISR render it does not set the status, so the response
   * would be HTTP 200 either way.
   *
   * So: say so on the page, and — the part that matters for search — mark it
   * `noindex` in `generateMetadata`, so a made-up id can never be indexed. */
  if (!book) return <MissingBook />;

  return (
    <RoleRouteGuard variant="redirectAdminsOnUserRoutes">
      <JsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [
              bookSchema(book, SITE_URL, bookCoverSrc(book)),
              breadcrumbSchema(
                [
                  { name: "Books", path: "/browse" },
                  ...(book.category
                    ? [{ name: book.category, path: `/browse?category=${book.category_id ?? ""}` }]
                    : []),
                  { name: book.title, path: `/books/${book.id}` },
                ],
                SITE_URL,
              ),
            ],
          }}
      />
      <BookDetails initialBook={book} />
    </RoleRouteGuard>
  );
};

export default Page;
