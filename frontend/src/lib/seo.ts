import type { Book } from "@/api/index";

/* Search-facing copy, built from what the catalogue actually knows.
 *
 * The problem this solves is measurable: of 200 books, only 106 had a distinct
 * description. Fifty-four of them shared the exact sentence "Popular English
 * title widely read across India — Fiction." — so fifty-four product pages
 * carried the same meta description and the same link preview. A search engine
 * treats that as near-duplicate content, picks one page and suppresses the rest,
 * which is the opposite of what a catalogue wants.
 *
 * The fix is not inventing prose. It is putting the facts that differ — the
 * author, the category, the price, what readers rated it — into the description,
 * so every page describes its own book and a searcher can see the price before
 * they click. The catalogue's own blurb still goes in, after those, when it adds
 * anything.
 */

const rupees = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? `₹${Math.round(n).toLocaleString("en-IN")}` : null;
};

/** Descriptions the seed data repeats across dozens of books. */
export const isBoilerplate = (text: string) =>
  /^Popular (English|Hindi) title widely read across India/i.test(text.trim());

/**
 * A meta description for a book page: unique, useful, and honest.
 *
 * Google truncates around 160 characters, so the facts a shopper decides on —
 * author, price, rating — come first, and the blurb takes whatever room is left.
 */
/* Typed by what it reads rather than by `Book`, so the schema.org builder — whose
   input is a deliberately smaller shape — can call it without a cast. */
type BookForDescription = Pick<Book, "title"> &
  Partial<Pick<Book, "author" | "category" | "price" | "rating" | "ratingCount" | "description">>;

export const bookMetaDescription = (book: BookForDescription): string => {
  const parts: string[] = [];

  parts.push(`${book.title} by ${book.author || "an unknown author"}`);
  if (book.category) parts.push(book.category);

  const price = rupees(book.price);
  if (price) parts.push(price);

  const rating = Number(book.rating);
  const count = Number(book.ratingCount ?? 0);
  if (Number.isFinite(rating) && rating > 0 && count > 0) {
    parts.push(`rated ${rating.toFixed(1)}/5 by ${count.toLocaleString("en-IN")} readers`);
  }

  let out = `Buy ${parts.join(" · ")}.`;

  const blurb = (book.description || "").trim();
  // The repeated seed sentence adds nothing and is what made these pages
  // duplicates in the first place.
  if (blurb && !isBoilerplate(blurb) && out.length < 130) {
    out = `${out} ${blurb}`;
  }
  if (out.length < 150) {
    out = `${out} Delivered across India from BookVuk.`;
  }

  // Cut on a word boundary rather than mid-word.
  if (out.length > 300) out = `${out.slice(0, 297).replace(/\s+\S*$/, "")}…`;
  return out;
};

/**
 * A page title for a book.
 *
 * Author included because that is what people search — "the god of small things
 * arundhati roy" far more often than the title alone — and "Buy" because the
 * intent being competed for is a purchase, not a definition.
 */
export const bookMetaTitle = (book: Book): string =>
  book.author ? `${book.title} by ${book.author}` : book.title;

/** Keywords a book page can honestly claim, from its own attributes. */
export const bookKeywords = (book: Book): string[] =>
  [
    book.title,
    book.author,
    book.category,
    book.author ? `books by ${book.author}` : null,
    book.category ? `buy ${book.category.toLowerCase()} books online` : null,
    "buy books online india",
  ].filter((k): k is string => Boolean(k));

/* ─────────────────────────── page metadata ───────────────────────────
 *
 * Next does not derive `openGraph` from `title`. A page that sets its own title
 * and description inherits the root layout's openGraph block *unchanged*, and
 * measured on the built site that is exactly what happened: ten pages — the
 * shopfront, /browse, /authors, /sell, /about, /contact, /help, /terms, /privacy
 * and /shipping-returns — all served
 *
 *     og:title       BookVuk - The universe of books
 *     og:description Browse thousands of titles in English and Hindi…
 *     og:url         https://…/            ← the site root, on every one of them
 *
 * So a link to /sell pasted into WhatsApp previewed as the homepage, under the
 * homepage's title, and clicking the preview could take the reader somewhere
 * other than the page that was shared. The two dynamic routes escaped it only
 * because they hand-write their own openGraph.
 *
 * The root cause is that the same three strings had to be repeated in three
 * shapes, so this builds all of them from one. A page states what it is once,
 * and the title, description, canonical URL, link preview and Twitter card
 * cannot disagree afterwards.
 */

/* The site's own preview card, for pages with no picture of their own.
 *
 * 1200x630 because that is the size Facebook, LinkedIn, X and Slack all state.
 * The hero photo was being used directly at 1184x864 — a 1.37 ratio against the
 * 1.91 they expect — so every preview was centre-cropped, losing the top and
 * bottom of the image.
 *
 * The width and height are declared alongside it. A scraper that is told the
 * dimensions renders the card straight away; one that is not has to fetch and
 * measure the file first, which is why the first share of a new link so often
 * appears with no image and only fills in later. */
const OG_IMAGE = { url: "/assets/og-card.jpg", width: 1200, height: 630 } as const;

type PageMetaInput = {
  /** The `<title>`, without the brand — the template appends "· BookVuk". */
  title: string;
  description: string;
  /** Site-relative. Becomes both the canonical URL and `og:url`. */
  path: string;
  /**
   * Kept for the pages that already carry them, and passed straight through.
   *
   * Worth being honest about: Google has ignored `<meta name="keywords">` since
   * 2009 and says so publicly. These cost nothing and Bing gives them a sliver
   * of weight, but nothing here is ranking because of them — the title, the
   * description and the page's own text are what do the work.
   */
  keywords?: string[];
  /** A site-relative image for the link preview. Falls back to the site card. */
  image?: string;
  imageAlt?: string;
  /** Set on the shopfront, which states the brand itself rather than inheriting it. */
  absoluteTitle?: boolean;
};

/**
 * Everything a public page needs to be found and to preview correctly.
 *
 * `og:title` carries the brand explicitly. The `<title>` gets it from the root
 * template, but a link preview arrives with no other context — "Sell Old Books
 * Online" alone does not say whose site it is.
 */
export const pageMetadata = ({
  title,
  description,
  path,
  keywords,
  image,
  imageAlt,
  absoluteTitle = false,
}: PageMetaInput) => {
  const shareTitle = absoluteTitle || title.includes("BookVuk") ? title : `${title} · BookVuk`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    ...(keywords?.length ? { keywords } : {}),
    alternates: { canonical: path },
    openGraph: {
      type: "website" as const,
      siteName: "BookVuk",
      title: shareTitle,
      description,
      url: path,
      locale: "en_IN",
      alternateLocale: ["hi_IN"],
      images: [
        image
          ? { url: image, alt: imageAlt ?? shareTitle }
          : { ...OG_IMAGE, alt: imageAlt ?? shareTitle },
      ],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: shareTitle,
      description,
      images: [image ?? OG_IMAGE.url],
    },
  };
};

/**
 * Which language a book is in, for `og:locale`.
 *
 * The `Book` type declares `language?: "en" | "hi"`, but the catalogue endpoint
 * does not return it — checked against the live API, a book titled
 * "हिंदी कहानियाँ" by मुंशी प्रेमचंद comes back with no language field at all. So
 * reading that field looks right and silently labels every Hindi book English.
 *
 * Two signals are actually present. The catalogue's own identifier is prefixed
 * by language (`hi-082`, `en-017`), and where that is missing the title itself
 * settles it: a title written in Devanagari is not an English book. Neither
 * requires a schema change, and both are already in every payload.
 */
export const bookLocale = (
  book: Partial<Pick<Book, "bookId" | "title" | "language">>,
): string => {
  if (book.language === "hi") return "hi_IN";
  if (book.language === "en") return "en_IN";
  if (/^hi[-_]/i.test(book.bookId ?? "")) return "hi_IN";
  // Devanagari, the block Hindi is written in.
  if (/[ऀ-ॿ]/.test(book.title ?? "")) return "hi_IN";
  return "en_IN";
};
