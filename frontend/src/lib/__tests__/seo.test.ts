import { describe, expect, it } from "vitest";
import { bookLocale, pageMetadata } from "../seo";

describe("bookLocale", () => {
  /* The field the type says to use is absent from the live payload, so these pin
     the two signals that are actually there. */
  it("trusts an explicit language when the API ever sends one", () => {
    expect(bookLocale({ bookId: "en-017", title: "Anything", language: "hi" })).toBe("hi_IN");
    expect(bookLocale({ bookId: "hi-082", title: "कुछ", language: "en" })).toBe("en_IN");
  });

  it("reads the catalogue id's language prefix", () => {
    expect(bookLocale({ bookId: "hi-082", title: "Transliterated Title" })).toBe("hi_IN");
    expect(bookLocale({ bookId: "en-017", title: "The God of Small Things" })).toBe("en_IN");
  });

  it("falls back to the script the title is written in", () => {
    // The real case, checked against the live API: bookId hi-082, title
    // हिंदी कहानियाँ, no language field at all.
    expect(bookLocale({ bookId: "", title: "हिंदी कहानियाँ" })).toBe("hi_IN");
    expect(bookLocale({ bookId: "", title: "Sapiens" })).toBe("en_IN");
  });

  it("defaults to English rather than guessing", () => {
    expect(bookLocale({ bookId: "", title: "" })).toBe("en_IN");
  });
});

describe("pageMetadata", () => {
  /* The bug this builder exists to prevent: Next replaces a segment's openGraph
     block instead of merging it, and derives none of it from `title`. Ten pages
     shipped the root's og:title, og:description and og:url as a result. */
  it("gives the link preview the page's own title, description and URL", () => {
    const m = pageMetadata({
      title: "Sell Old Books Online — Get an Instant Quote",
      description: "Tell us which book you have and see the price straight away.",
      path: "/sell",
    });
    expect(m.openGraph.title).toBe("Sell Old Books Online — Get an Instant Quote · BookVuk");
    expect(m.openGraph.description).toBe(m.description);
    expect(m.openGraph.url).toBe("/sell");
    expect(m.alternates.canonical).toBe("/sell");
  });

  it("keeps the Twitter card in step with Open Graph", () => {
    const m = pageMetadata({ title: "Help & Support", description: "Answers.", path: "/help" });
    expect(m.twitter.title).toBe(m.openGraph.title);
    expect(m.twitter.description).toBe(m.openGraph.description);
  });

  it("names the brand once, not twice", () => {
    const shopfront = pageMetadata({
      title: "Buy & Sell Books Online in India — English & Hindi | BookVuk",
      description: "…",
      path: "/",
      absoluteTitle: true,
    });
    // Already carries the brand, so the suffix must not be appended again.
    expect(shopfront.openGraph.title).not.toMatch(/BookVuk.*BookVuk/);
    expect(shopfront.title).toEqual({ absolute: expect.stringContaining("BookVuk") });
  });

  it("declares the preview image's dimensions so a first share renders", () => {
    const m = pageMetadata({ title: "About", description: "…", path: "/about" });
    expect(m.openGraph.images[0]).toMatchObject({ width: 1200, height: 630 });
  });

  it("uses a page's own image when it has one", () => {
    const m = pageMetadata({
      title: "A book", description: "…", path: "/books/1", image: "/static/books/en-017.jpg",
    });
    expect(m.openGraph.images[0]).toMatchObject({ url: "/static/books/en-017.jpg" });
    expect(m.twitter.images).toEqual(["/static/books/en-017.jpg"]);
  });
});
