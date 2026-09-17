import type { MetadataRoute } from "next";

import { fetchAuthors, fetchCategories, fetchSitemapBooks } from "@/api/index";
import { SITE_URL } from "@/lib/site";


/* Every page worth indexing, generated from the catalogue.
 *
 * `/authors` matters more than its position suggests: it is the one page linking
 * to every author, so it is how a crawler discovers them.
 */
const STATIC_PATHS = [
  "/",
  "/browse",
  "/authors",
  "/sell",
  "/about",
  "/contact",
  "/help",
  "/terms",
  "/privacy",
  "/shipping-returns",
];

// Rebuilt from the catalogue rather than frozen at build time, so a book added
// today is listed today.
export const revalidate = 1800;

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const staticEntries = STATIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: (path === "/browse" ? "daily" : "weekly") as "daily" | "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));

  /* One entry per category shelf.
   *
   * These became worth listing the moment they stopped canonicalising to
   * `/browse`: a self-canonical page that nothing points a crawler at is a page
   * nobody finds. They are also the pages best placed to answer "buy hindi
   * literature books online", which is a query no single book page can win.
   *
   * Ranked above the author pages and below the shopfront: seven shelves of a
   * two-hundred-book shop are a large share of it. */
  const categories = await fetchCategories().catch(() => []);
  const categoryEntries = categories.map((c) => ({
    url: `${SITE_URL}/browse?category=${c.id}`,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // One entry per author page. These are how a crawler reaches "books by X",
  // and they were missing because the pages did not exist.
  const authors = await fetchAuthors().catch(() => []);
  const authorEntries = authors
    .filter((a) => a.slug)
    .map((a) => ({
      url: `${SITE_URL}/authors/${a.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  let books: Awaited<ReturnType<typeof fetchSitemapBooks>> = [];
  try {
    books = await fetchSitemapBooks();
  } catch {
    // A sitemap missing its books is recoverable; a 500 on /sitemap.xml teaches
    // a crawler the file is broken and it backs off the whole site.
    return [...staticEntries, ...categoryEntries, ...authorEntries];
  }

  return [
    ...staticEntries,
    ...categoryEntries,
    ...authorEntries,
    ...books.map((book) => ({
      url: `${SITE_URL}/books/${book.id}`,
      lastModified: book.updatedAt ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
};

export default sitemap;
