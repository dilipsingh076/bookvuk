import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

import Browse from "@/views/Browse";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";
import { fetchBooksPaged, fetchCatalogFacets, fetchCategories } from "@/api/index";
import JsonLd from "@/components/JsonLd";
import { collectionSchema } from "@/lib/schema";
import { SITE_URL } from "@/lib/site";


type Search = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/* The catalogue's metadata depends on which catalogue you asked for.
 *
 * Every filtered URL used to serve the same title and canonical away to
 * `/browse`, which told search engines that `?category=Hindi Literature` is a
 * duplicate of the whole shop — so the seven pages best placed to answer
 * "buy hindi literature books online" were folded into one that answers nothing
 * in particular. A category is a real, stable, linkable collection of this shop's
 * books, and it now says so.
 *
 * The other three filters keep canonicalising to `/browse`, because they are not:
 *
 *  - `?q=` is a search result. Google asks that these stay out of the index, and
 *    the space of queries is unbounded — every typo would be a crawlable URL.
 *    This one also gets `noindex`, since a canonical is a hint and crawl budget
 *    spent on `?q=hary+poter` is spent either way.
 *  - `?sort=` reorders the same books. Nothing new to index.
 *
 * `?page=` is the exception among the exceptions: it self-canonicalises, which is
 * what Google asks for. Page two is not a duplicate of page one — it holds
 * different books — and pointing it at page one invites a crawler to treat
 * everything past the first screen as a copy. It combines with a category, so
 * "Hindi Literature, page 3" is its own address.
 */
export const generateMetadata = async ({ searchParams }: Search): Promise<Metadata> => {
  const sp = await searchParams;
  const categoryId = first(sp.category);
  const isSearch = Boolean(first(sp.q));

  const category =
    categoryId && categoryId !== "all"
      ? (await fetchCategories().catch(() => null))?.find((c) => c.id === categoryId) ?? null
      : null;

  /* The page number is part of the address when there is one. Page one is the
     bare URL — "?page=1" and no page at all are the same collection, and serving
     both as canonical would be the duplicate this is meant to avoid. */
  const page = Math.max(1, Number(first(sp.page) ?? 1) || 1);
  const withPage = (base: string) =>
    page > 1 ? `${base}${base.includes("?") ? "&" : "?"}page=${page}` : base;
  const pageSuffix = page > 1 ? ` \u2014 Page ${page}` : "";

  if (category) {
    const name = category.name;
    const lower = name.toLowerCase();
    return pageMetadata({
      title: `${name} Books \u2014 Buy Online in India${pageSuffix}`,
      description: `Buy ${lower} books online in India, new and second-hand. Browse the ${lower} shelf at BookVuk and filter by rating and price \u2014 delivered nationwide.`,
      // Self-canonical: this collection is its own page, not a view of another.
      path: withPage(`/browse?category=${category.id}`),
      keywords: [
        `buy ${lower} books online`,
        `${lower} books india`,
        `second hand ${lower} books`,
        "buy books online india",
      ],
    });
  }

  const base = pageMetadata({
    title: `Buy Books Online \u2014 English & Hindi Titles${pageSuffix}`,
    description:
      "Shop new and second-hand books online in India. Fiction, business, history, self growth, sci-fi and Hindi literature \u2014 filter by category, rating and price.",
    path: withPage("/browse"),
    keywords: [
      "buy books online india",
      "buy hindi books online",
      "second hand books online",
      "cheap books online india",
      "english books online",
    ],
  });

  return isSearch ? { ...base, robots: { index: false, follow: true } } : base;
};

/* Rendered per request because the filters live in the query string, and the
 * catalogue that comes back has to match the URL a visitor shared or a crawler
 * followed. `/browse?category=…` is the link every category points at. */
// Must match the client's page size or the first paint would show a different
// number of books than the second.
const PAGE_SIZE = 24;

const Page = async ({ searchParams }: Search) => {
  const sp = await searchParams;
  const page = Math.max(1, Number(first(sp.page) ?? 1) || 1);
  const category = first(sp.category);
  const rating = first(sp.rating);

  // Three requests in parallel rather than in series: the slowest one sets the
  // wait, not the sum.
  const [initialPage, initialCategories, initialFacets] = await Promise.all([
    fetchBooksPaged({
      page,
      page_size: PAGE_SIZE,
      q: first(sp.q) || undefined,
      category_id: category && category !== "all" ? category : undefined,
      min_rating: rating ? Number(rating) : undefined,
      sort: (first(sp.sort) as never) || undefined,
    }).catch(() => null),
    fetchCategories().catch(() => null),
    fetchCatalogFacets().catch(() => null),
  ]);

  const shownCategory =
    category && category !== "all"
      ? initialCategories?.find((c) => c.id === category) ?? null
      : null;

  return (
    <RoleRouteGuard variant="redirectAdminsOnUserRoutes">
      {initialPage?.items?.length ? (
        <JsonLd
          data={collectionSchema({
            siteUrl: SITE_URL,
            /* Matches the canonical above. A CollectionPage that claims to be
               `/browse` while the page is the Hindi Literature shelf describes
               the wrong collection, and the two would disagree about which page
               a crawler is looking at. */
            path: shownCategory ? `/browse?category=${shownCategory.id}` : "/browse",
            name: shownCategory
              ? `${shownCategory.name} books at BookVuk`
              : "Buy books online — the BookVuk catalogue",
            description: shownCategory
              ? `New and second-hand ${shownCategory.name.toLowerCase()} books, delivered across India.`
              : "New and second-hand books in English and Hindi, delivered across India.",
            startPosition: (page - 1) * PAGE_SIZE + 1,
            items: initialPage.items.map((book) => ({
              name: book.title,
              url: `/books/${book.id}`,
            })),
          })}
        />
      ) : null}
      <Browse
        initialPage={initialPage}
        initialCategories={initialCategories}
        initialFacets={initialFacets}
      />
    </RoleRouteGuard>
  );
};

export default Page;
