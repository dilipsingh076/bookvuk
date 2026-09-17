import type { Metadata } from "next";
import { notFound } from "next/navigation";

import AuthorDetail from "@/views/AuthorDetail";
import JsonLd from "@/components/JsonLd";
import { collectionSchema } from "@/lib/schema";
import { bookCoverSrc, fetchAuthorBySlug, fetchAuthors } from "@/api/index";
import { SITE_URL } from "@/lib/site";


type Params = { params: Promise<{ slug: string }> };

/* One page per author, prerendered.
 *
 * 97 authors, so 97 pages that can rank for "books by <name>" — the search a
 * shopper actually makes. Prerendered for the same reason the book pages are: a
 * streamed route emits its metadata into the body, where link-preview scrapers
 * never look.
 */
export const revalidate = 1800;

/* `false`, and this is the only way to get a real 404 here.
 *
 * With `dynamicParams: true` an unknown slug was generated on demand, and
 * `notFound()` inside that path does not set the status — measured: HTTP 200 with
 * an empty body, which invites a crawler to index unlimited blank author pages.
 * `false` makes Next reject any slug that is not in `generateStaticParams`
 * before rendering, which is a clean 404.
 *
 * The cost is real and worth stating: `generateStaticParams` runs at build time,
 * so an author added through the admin panel has no page until the next build.
 * The catalogue changes without a deploy, so this wants a scheduled rebuild or a
 * deploy hook — otherwise `/authors` will list a name whose page 404s. */
export const dynamicParams = false;

export const generateStaticParams = async () => {
  try {
    const authors = await fetchAuthors();
    return authors.filter((a) => a.slug).map((a) => ({ slug: a.slug }));
  } catch {
    // A failed catalogue fetch must not fail the build; these render on first
    // request instead.
    return [];
  }
};

export const generateMetadata = async ({ params }: Params): Promise<Metadata> => {
  const { slug } = await params;
  try {
    const author = await fetchAuthorBySlug(slug);
    const count = author.total;
    const titles = author.items
      .slice(0, 3)
      .map((b) => b.title)
      .join(", ");

    return {
      title: `Books by ${author.name} — ${count} ${count === 1 ? "Title" : "Titles"}`,
      // Naming actual titles makes each of the 97 descriptions different, which
      // is the mistake the book pages made: a shared sentence reads as duplicate
      // content and only one page survives it.
      description: `Buy books by ${author.name} online in India. ${count} ${
        count === 1 ? "title" : "titles"
      } in stock${titles ? ` including ${titles}` : ""}. Delivered across India from BookVuk.`,
      keywords: [
        `books by ${author.name}`,
        `${author.name} books`,
        `${author.name} book list`,
        "buy books online india",
      ],
      alternates: { canonical: `/authors/${author.slug}` },
      openGraph: {
        type: "profile",
        siteName: "BookVuk",
        title: `Books by ${author.name} · BookVuk`,
        description: `${count} ${count === 1 ? "title" : "titles"} by ${
          author.name
        }, in stock at BookVuk.`,
        url: `/authors/${author.slug}`,
        /* Declaring `openGraph` replaces the root block outright rather than
           merging into it, so leaving `images` out did not fall back to the site
           card — it removed the image entirely, and all 97 author pages shared
           to WhatsApp or Slack as bare text. A cover from this author's own
           shelf is the better picture anyway. */
        images: [
          author.items[0]
            ? { url: bookCoverSrc(author.items[0]), alt: `${author.items[0].title} by ${author.name}` }
            : { url: "/assets/og-card.jpg", width: 1200, height: 630, alt: `Books by ${author.name}` },
        ],
      },
      /* Twitter is a separate block and inherits separately: without this, X and
         every client using its tags showed the site's generic title over this
         author's page. */
      twitter: {
        /* `summary`, not `summary_large_image`. The wide card crops whatever it
           is given to 1.91:1, and a book cover is portrait at roughly 0.66 — so
           the wide card showed a thin horizontal slice through the middle of the
           artwork. `summary` puts the cover beside the text as a thumbnail,
           which is the shape it actually is. */
        card: "summary",
        title: `Books by ${author.name} · BookVuk`,
        description: `${count} ${count === 1 ? "title" : "titles"} by ${author.name}, in stock at BookVuk.`,
        images: [author.items[0] ? bookCoverSrc(author.items[0]) : "/assets/og-card.jpg"],
      },
    };
  } catch {
    /* The catalogue was unreachable — during a build, or during a revalidation.
       That is not evidence the author is missing, so this must not 404; but it
       must not be indexed either, or a transient outage gets a thin "Author"
       page into the index in place of the real one. */
    return { title: "Author", robots: { index: false, follow: true } };
  }
};

const Page = async ({ params }: Params) => {
  const { slug } = await params;
  const author = await fetchAuthorBySlug(slug).catch(() => null);

  // A real 404 rather than an empty shell, so a mistyped slug does not become an
  // indexable page that says nothing.
  if (!author) notFound();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Person",
              "@id": `${SITE_URL}/authors/${author.slug}#person`,
              name: author.name,
              url: `${SITE_URL}/authors/${author.slug}`,
            },
            collectionSchema({
              siteUrl: SITE_URL,
              path: `/authors/${author.slug}`,
              name: `Books by ${author.name}`,
              description: `Every title by ${author.name} stocked at BookVuk.`,
              items: author.items.map((book) => ({
                name: book.title,
                url: `/books/${book.id}`,
              })),
            }).mainEntity,
          ],
        }}
      />
      <AuthorDetail author={author} />
    </>
  );
};

export default Page;
