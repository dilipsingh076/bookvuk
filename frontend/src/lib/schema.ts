/* schema.org graphs for the pages that publish them.
 *
 * Pure functions, deliberately in no-React module: they are called from server
 * components (`app/page.tsx`, `app/books/[bookId]/page.tsx`) and rendered through
 * `<JsonLd>`. They used to live beside a `useStructuredData` hook that appended
 * the script from an effect — which put the graph out of reach of every crawler
 * that does not run JavaScript, and made these builders client-only.
 */

import { bookLocale, isBoilerplate } from "./seo";

export type BookForSchema = {
  id: string;
  title: string;
  author?: string;
  description?: string;
  price: number;
  stock: number;
  rating?: number;
  ratingCount?: number;
  format?: string;
  category?: string;
  /** The catalogue id ("hi-082"), which is what says the book's language. */
  bookId?: string;
};

/**
 * Schema.org graph for one book.
 *
 * Modelled as a `Book` with an `offers` block rather than a bare `Product`,
 * because the type carries author and format and is what Google expects for a
 * bookshop. `aggregateRating` is omitted entirely when nothing has rated the book
 * — an invented or zero rating is worse than no rating, and Google penalises
 * markup that does not match the page.
 */
export const bookSchema = (book: BookForSchema, siteUrl: string, coverUrl: string) => {
  const origin = siteUrl.replace(/\/$/, "");
  const url = `${origin}/books/${book.id}`;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    url,
    /* Absolute, like every other URL in the graph.
     *
     * `coverUrl` is normally already absolute (Supabase Storage), but stays
     * tolerant of a site-relative value because
     * that is what the page needs for its own <img>. Structured data is read off
     * the site, by a crawler that has no base to resolve it against, so a
     * relative image is one it drops. This was the only relative URL left in the
     * whole graph, and it is the one a product result draws the picture from. */
    image: /^https?:\/\//.test(coverUrl) ? coverUrl : `${origin}${coverUrl.startsWith("/") ? "" : "/"}${coverUrl}`,
    ...(book.author ? { author: { "@type": "Person", name: book.author } } : {}),
    /* The blurb, but only when it says something about *this* book.
     *
     * The catalogue repeats one seed sentence — "Popular English title widely
     * read across India — Fiction." — across fifty-four titles, so emitting it
     * raw gave those books an identical structured description. The meta
     * description already refuses that sentence; this refuses it too.
     *
     * Omitted rather than replaced. The page's meta description substitutes the
     * book's facts (price, rating) because a search result needs *something*,
     * but schema.org `description` means the book's own blurb, and a missing
     * field is more honest than a marketing line standing in for one. */
    ...(book.description && !isBoilerplate(book.description)
      ? { description: book.description.slice(0, 500) }
      : {}),
    ...(book.format ? { bookFormat: schemaBookFormat(book.format) } : {}),
    ...(book.category ? { genre: book.category } : {}),
    /* Half the catalogue is Hindi. Saying which language a book is in is a fact
       a search engine can act on — and the only place it is recorded is the
       catalogue id and the script of the title. See `bookLocale`. */
    inLanguage: bookLocale({ bookId: book.bookId, title: book.title }).slice(0, 2),
    offers: {
      "@type": "Offer",
      url,
      price: book.price.toFixed(2),
      priceCurrency: "INR",
      availability:
        book.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  if (book.ratingCount && book.ratingCount > 0 && book.rating) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: book.rating.toFixed(1),
      ratingCount: book.ratingCount,
      bestRating: "5",
      worstRating: "1",
    };
  }

  return schema;
};

/** Map our free-text format onto the controlled vocabulary schema.org accepts. */
const schemaBookFormat = (format: string): string => {
  const f = format.toLowerCase();
  if (f.includes("hard")) return "https://schema.org/Hardcover";
  if (f.includes("ebook") || f.includes("digital")) return "https://schema.org/EBook";
  if (f.includes("audio")) return "https://schema.org/AudiobookFormat";
  return "https://schema.org/Paperback";
};

/** Breadcrumb trail, so search results show `bookvuk › Fiction › Title`. */
export const breadcrumbSchema = (
  trail: Array<{ name: string; path: string }>,
  siteUrl: string,
) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: trail.map((crumb, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: crumb.name,
    item: `${siteUrl.replace(/\/$/, "")}${crumb.path}`,
  })),
});

/**
 * The shop itself, for the home page.
 *
 * Two things a storefront homepage should say and this one did not. `Organization`
 * is what lets a search engine treat BookVuk as an entity rather than a string of
 * words — the name, the logo and the support address in one place it trusts.
 * `WebSite` with a `SearchAction` is what offers the search box directly in the
 * results page, so somebody looking for a title can jump straight to it instead
 * of landing on the home page and starting again.
 *
 * `potentialAction` has to point at a real, crawlable search URL. `/browse?q=`
 * is exactly that: the catalogue page reads `q` from the query string.
 */
export const storeSchema = ({
  siteUrl,
  name,
  description,
  logoPath,
  supportEmail,
}: {
  siteUrl: string;
  name: string;
  description: string;
  logoPath: string;
  supportEmail?: string;
}) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      /* `OnlineStore` as well as `Organization`. Both are schema.org types and
         Google documents `OnlineStore` for exactly this: a retailer that trades
         online with no premises to visit. `Organization` alone says "a company
         exists here"; this says what kind, without claiming the physical address
         that `LocalBusiness`/`BookStore` would require and this shop does not
         have. The plain type stays in the array so anything that only understands
         `Organization` still reads it. */
      "@type": ["Organization", "OnlineStore"],
      "@id": `${siteUrl}/#organization`,
      name,
      /* The same sentence the page's meta description carries. A search engine
         building an entity for "BookVuk" had the name and the logo but nothing
         saying what the shop is for — and buying books back is the half of it
         that no general marketplace offers. */
      description,
      url: `${siteUrl}/`,
      logo: {
        "@type": "ImageObject",
        url: logoPath.startsWith("http") ? logoPath : `${siteUrl}${logoPath}`,
      },
      ...(supportEmail
        ? {
            contactPoint: {
              "@type": "ContactPoint",
              contactType: "customer support",
              email: supportEmail,
              availableLanguage: ["en", "hi"],
            },
          }
        : {}),
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name,
      description,
      url: `${siteUrl}/`,
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: ["en", "hi"],
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${siteUrl}/browse?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
});

/**
 * A listing page: what it collects, and the books on it in order.
 *
 * A product page can say "I am a Book"; a catalogue page had no way to say what
 * it was, so it read as prose with links. `CollectionPage` plus an `ItemList`
 * states the page's job and its contents, which is what lets a listing appear as
 * a set of results rather than a single blue link.
 *
 * Positions are 1-based and absolute within the page, so page 2 does not claim to
 * start at item 1.
 */
export const collectionSchema = ({
  siteUrl,
  path,
  name,
  description,
  items,
  startPosition = 1,
}: {
  siteUrl: string;
  path: string;
  name: string;
  description: string;
  items: Array<{ name: string; url: string }>;
  startPosition?: number;
}) => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": `${siteUrl}${path}#page`,
  name,
  description,
  url: `${siteUrl}${path}`,
  isPartOf: { "@id": `${siteUrl}/#website` },
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: startPosition + i,
      name: item.name,
      url: item.url.startsWith("http") ? item.url : `${siteUrl}${item.url}`,
    })),
  },
});

/**
 * The buyback, described as a service.
 *
 * "Sell old books" is a search for something to be done, not something to read,
 * and a page that only says it is a WebPage competes poorly for it. `Service`
 * with an area served and a provider is what matches that intent.
 */
export const buybackServiceSchema = ({
  siteUrl,
  areaServed = "IN",
}: {
  siteUrl: string;
  areaServed?: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${siteUrl}/sell#service`,
  name: "Sell your old books",
  serviceType: "Used book buyback",
  description:
    "Get an instant quote for any book, post it to us, and take store credit or payment to your UPI once we have graded it on arrival.",
  provider: { "@id": `${siteUrl}/#organization` },
  areaServed,
  url: `${siteUrl}/sell`,
  // Quoted from the book's own price rather than a fixed rate, so no figure is
  // claimed here that the quote form might contradict.
  offers: {
    "@type": "Offer",
    priceCurrency: "INR",
    description: "Instant per-title quote; final amount confirmed after grading.",
  },
});
