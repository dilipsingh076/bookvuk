import { describe, expect, it } from "vitest";

import { CUSTOMER_NAV, navLinkIsActive, type NavLink } from "../navLinks";

const link = (href: string): NavLink => {
  const found = CUSTOMER_NAV.find((l) => l.href === href);
  if (!found) throw new Error(`no nav link for ${href}`);
  return found;
};

describe("which nav link is lit", () => {
  it("lights the page you are on", () => {
    expect(navLinkIsActive(link("/sell"), "/sell")).toBe(true);
    expect(navLinkIsActive(link("/help"), "/help")).toBe(true);
  });

  it("keeps a section lit on its sub-pages", () => {
    expect(navLinkIsActive(link("/sell"), "/sell/requests")).toBe(true);
  });

  it("does not light Home on every page", () => {
    /* `/home` is exact. Without that the prefix rule would be harmless here,
       but the same rule on `/` would light it everywhere. */
    expect(navLinkIsActive(link("/home"), "/home")).toBe(true);
    expect(navLinkIsActive(link("/home"), "/homework")).toBe(false);
  });

  it("keeps Shop lit while reading a book", () => {
    /* A book's page is part of the shop as far as a visitor is concerned, and it
       is not under /browse — so it takes an explicit rule rather than falling
       out of the prefix match. */
    expect(navLinkIsActive(link("/browse"), "/books/abc-123")).toBe(true);
    expect(navLinkIsActive(link("/browse"), "/browse")).toBe(true);
  });

  it("does not light two links at once", () => {
    for (const path of ["/home", "/about", "/browse", "/sell", "/help", "/contact", "/books/x"]) {
      const lit = CUSTOMER_NAV.filter((l) => navLinkIsActive(l, path)).map((l) => l.href);
      expect(lit, `on ${path}`).toHaveLength(1);
    }
  });

  it("offers every link the drawer and the row both render", () => {
    // The point of the shared list: one place to add a destination.
    expect(CUSTOMER_NAV.map((l) => l.label)).toEqual([
      "Home",
      "About us",
      "Shop",
      "Sell books",
      "Help",
      "Contact",
    ]);
  });
});
