/**
 * Structured data for a book page.
 *
 * The site emitted none, so a product page told Google only what its <title> said.
 * These tests are mostly about not lying to a search engine: markup that claims a
 * rating the page does not show, or an in-stock price for something sold out, is
 * penalised rather than ignored.
 */

import { describe, expect, it } from "vitest";

import { bookSchema, breadcrumbSchema, type BookForSchema } from "../../lib/schema";

const SITE = "https://bookvuk.example";
const COVER = "https://bookvuk.example/assets/books/x.jpg";

const book = (over: Partial<BookForSchema> = {}): BookForSchema => ({
  id: "abc-123",
  title: "The Test Book",
  author: "A Writer",
  description: "A book for testing.",
  price: 349.5,
  stock: 4,
  rating: 4.3,
  ratingCount: 88,
  format: "Paperback",
  category: "Fiction",
  ...over,
});

describe("bookSchema", () => {
  it("declares itself a Book", () => {
    const s = bookSchema(book(), SITE, COVER) as any;
    expect(s["@context"]).toBe("https://schema.org");
    expect(s["@type"]).toBe("Book");
    expect(s.name).toBe("The Test Book");
  });

  it("points at the canonical product URL", () => {
    const s = bookSchema(book(), SITE, COVER) as any;
    expect(s.url).toBe(`${SITE}/books/abc-123`);
    expect(s.offers.url).toBe(`${SITE}/books/abc-123`);
  });

  it("does not double the slash when the site URL has a trailing one", () => {
    const s = bookSchema(book(), "https://bookvuk.example/", COVER) as any;
    expect(s.url).toBe("https://bookvuk.example/books/abc-123");
  });

  it("prices in paise-free rupees with a currency", () => {
    const s = bookSchema(book({ price: 349.5 }), SITE, COVER) as any;
    expect(s.offers.price).toBe("349.50");
    expect(s.offers.priceCurrency).toBe("INR");
  });

  it("reports availability from real stock", () => {
    const inStock = bookSchema(book({ stock: 3 }), SITE, COVER) as any;
    const out = bookSchema(book({ stock: 0 }), SITE, COVER) as any;
    expect(inStock.offers.availability).toBe("https://schema.org/InStock");
    expect(out.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("includes an aggregate rating when the book has been rated", () => {
    const s = bookSchema(book({ rating: 4.3, ratingCount: 88 }), SITE, COVER) as any;
    expect(s.aggregateRating).toMatchObject({ ratingValue: "4.3", ratingCount: 88 });
  });

  it("omits the rating entirely when nothing has rated it", () => {
    // A zero or invented rating in markup is worse than no markup: Google treats
    // a claim the page cannot support as a reason to distrust the rest.
    const s = bookSchema(book({ rating: 0, ratingCount: 0 }), SITE, COVER) as any;
    expect(s.aggregateRating).toBeUndefined();
  });

  it("omits the author rather than naming an empty one", () => {
    const s = bookSchema(book({ author: undefined }), SITE, COVER) as any;
    expect(s.author).toBeUndefined();
  });

  it("maps our free-text format onto schema.org's vocabulary", () => {
    const paperback = bookSchema(book({ format: "Paperback" }), SITE, COVER) as any;
    const hardback = bookSchema(book({ format: "Hardcover" }), SITE, COVER) as any;
    const ebook = bookSchema(book({ format: "eBook" }), SITE, COVER) as any;
    expect(paperback.bookFormat).toBe("https://schema.org/Paperback");
    expect(hardback.bookFormat).toBe("https://schema.org/Hardcover");
    expect(ebook.bookFormat).toBe("https://schema.org/EBook");
  });

  it("truncates a long description rather than emitting the whole page", () => {
    const s = bookSchema(book({ description: "x".repeat(900) }), SITE, COVER);
    expect((s.description as string).length).toBe(500);
  });

  /* The seed catalogue repeats one sentence across fifty-four titles. Emitting it
     gave all of them the same structured description; the field is dropped
     instead, because schema.org `description` means the book's own blurb and a
     missing one is better than a shared one. */
  it("omits a description the catalogue repeats across dozens of books", () => {
    const s = bookSchema(
      book({ description: "Popular English title widely read across India — Fiction." }),
      SITE,
      COVER,
    );
    expect(s.description).toBeUndefined();
  });

  it("keeps a description that is actually about this book", () => {
    const s = bookSchema(book({ description: "A family saga set in Kerala." }), SITE, COVER);
    expect(s.description).toBe("A family saga set in Kerala.");
  });

  /* Structured data is read off the site by a crawler with no base URL to resolve
     against, so the one relative field in the graph was the one a product result
     draws its picture from. */
  it("makes the cover absolute, however it arrives", () => {
    expect(bookSchema(book(), SITE, "/static/books/en-017.jpg").image)
      .toBe(`${SITE}/static/books/en-017.jpg`);
    expect(bookSchema(book(), SITE, "https://cdn.example.com/x.jpg").image)
      .toBe("https://cdn.example.com/x.jpg");
  });

  it("declares the book's language", () => {
    expect(bookSchema(book({ bookId: "hi-082" }), SITE, COVER).inLanguage).toBe("hi");
    expect(bookSchema(book({ bookId: "en-017" }), SITE, COVER).inLanguage).toBe("en");
  });

  it("serialises to valid JSON", () => {
    expect(() => JSON.parse(JSON.stringify(bookSchema(book(), SITE, COVER)))).not.toThrow();
  });
});

describe("breadcrumbSchema", () => {
  it("numbers the trail from 1", () => {
    const s = breadcrumbSchema(
      [
        { name: "Books", path: "/browse" },
        { name: "Fiction", path: "/browse?category=1" },
        { name: "The Test Book", path: "/books/abc-123" },
      ],
      SITE,
    ) as any;

    expect(s["@type"]).toBe("BreadcrumbList");
    expect(s.itemListElement.map((i: any) => i.position)).toEqual([1, 2, 3]);
    expect(s.itemListElement[2].item).toBe(`${SITE}/books/abc-123`);
  });

  it("handles a trail with no category", () => {
    const s = breadcrumbSchema([{ name: "Books", path: "/browse" }], SITE) as any;
    expect(s.itemListElement).toHaveLength(1);
  });
});
