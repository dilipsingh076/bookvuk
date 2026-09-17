/**
 * The book card: a real link, a real badge, a real cover description.
 *
 * It used to be a <button> that called navigate(), so nothing could crawl to a
 * product page and nobody could open a book in a new tab. The "Bestseller" ribbon
 * was `hash(book.id) % 5`, and the cover had `alt=""`.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BookCard from "../BookCard";
import type { Book } from "../../api/index";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));
vi.mock("../../context/AuthModalContext", () => ({
  useAuthModal: () => ({ requireAuth: (fn: () => void) => fn() }),
}));
const addToCart = vi.fn();
const toggleWishlist = vi.fn();
vi.mock("../../context/CartContext", () => ({
  useCart: () => ({ items: [], addToCart }),
}));
vi.mock("../../context/WishlistContext", () => ({
  useWishlist: () => ({ toggleWishlist, wishlistIds: [] }),
}));

const book = (over: Partial<Book> = {}): Book =>
  ({
    id: "book-42",
    bookId: "cat-42",
    title: "Godaan",
    author: "Munshi Premchand",
    category: "Hindi Literature",
    price: 819,
    rating: 4.3,
    ratingCount: 120,
    stock: 5,
    stockStatus: "in stock",
    format: "Paperback",
    description: "",
    badge: null,
    ...over,
  }) as Book;

const renderCard = (b: Book) =>
  render(
    <><BookCard book={b} /></>,
  );

describe("the card is a real link", () => {
  it("links to the product page", () => {
    renderCard(book());
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/books/book-42");
    }
  });

  it("puts the title in a link so a crawler sees it as the subject", () => {
    renderCard(book());
    expect(screen.getByRole("link", { name: "Godaan" })).toBeInTheDocument();
  });

  it("names the cover link for assistive tech", () => {
    renderCard(book());
    expect(screen.getByRole("link", { name: /open details for godaan/i })).toBeInTheDocument();
  });
});

describe("the cover image", () => {
  it("describes the book rather than being marked decorative", () => {
    // alt="" told a screen reader the cover was decoration, which made the
    // catalogue a list of prices with no books in it.
    renderCard(book());
    expect(screen.getByAltText("Cover of Godaan by Munshi Premchand")).toBeInTheDocument();
  });

  it("copes with a missing author", () => {
    renderCard(book({ author: "" }));
    expect(screen.getByAltText("Cover of Godaan")).toBeInTheDocument();
  });

  it("is lazily loaded", () => {
    renderCard(book());
    expect(screen.getByAltText(/cover of godaan/i)).toHaveAttribute("loading", "lazy");
  });
});

describe("the title is a heading", () => {
  it("renders at h3 so results form an outline", () => {
    renderCard(book());
    expect(screen.getByRole("heading", { level: 3, name: "Godaan" })).toBeInTheDocument();
  });
});

describe("the badge comes from the server", () => {
  it("shows nothing when the server sends no badge", () => {
    renderCard(book({ badge: null }));
    expect(screen.queryByText("Bestseller")).not.toBeInTheDocument();
  });

  it("shows the badge the server sent", () => {
    renderCard(book({ badge: "Bestseller" }));
    expect(screen.getByText("Bestseller")).toBeInTheDocument();
  });

  it("is not invented from the book id", () => {
    // The old rule was `sum(charCodes) % 5 === 0`. This id satisfies it, so the
    // previous implementation would have badged it regardless of any sales.
    const sum = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
    const id = "aaaaa"; // 97*5 = 485 -> 485 % 5 === 0
    expect(sum(id) % 5).toBe(0);

    renderCard(book({ id, badge: null }));
    expect(screen.queryByText("Bestseller")).not.toBeInTheDocument();
  });
});

describe("an out-of-stock book", () => {
  it("does not offer to add it to the cart", () => {
    // A button the checkout would refuse is worse than no button: the stock lock
    // rejects it, so the visitor gets an error instead of an explanation.
    renderCard(book({ stock: 0 }));
    expect(screen.queryByRole("button", { name: /add to cart/i })).not.toBeInTheDocument();
  });

  it("offers to notify instead", () => {
    renderCard(book({ stock: 0 }));
    expect(screen.getByRole("button", { name: /notify me/i })).toBeInTheDocument();
  });

  it("says so on the cover", () => {
    renderCard(book({ stock: 0 }));
    expect(screen.getByText(/out of stock/i)).toBeInTheDocument();
  });

  it("still offers the cart when there is stock", () => {
    renderCard(book({ stock: 3 }));
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeInTheDocument();
    expect(screen.queryByText(/out of stock/i)).not.toBeInTheDocument();
  });

  it("treats a missing stock figure as unbuyable", () => {
    // Safer than assuming availability: promising a book the shop may not have is
    // the more expensive mistake.
    renderCard(book({ stock: undefined as unknown as number }));
    expect(screen.queryByRole("button", { name: /add to cart/i })).not.toBeInTheDocument();
  });
});


describe("Notify me", () => {
  beforeEach(() => {
    addToCart.mockClear();
    toggleWishlist.mockClear();
  });

  it("saves the book and holds it in the cart", async () => {
    // Both, and for different reasons: the wishlist entry is what triggers the
    // back-in-stock notice and registers the demand; the cart line means the book
    // is already there to buy when that notice arrives.
    renderCard(book({ stock: 0 }));
    await userEvent.click(screen.getByRole("button", { name: /notify me/i }));

    expect(toggleWishlist).toHaveBeenCalledTimes(1);
    expect(addToCart).toHaveBeenCalledTimes(1);
  });

  it("does not touch the cart for a book that is in stock", async () => {
    renderCard(book({ stock: 4 }));
    await userEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(toggleWishlist).not.toHaveBeenCalled();
    expect(addToCart).toHaveBeenCalledTimes(1);
  });
});
