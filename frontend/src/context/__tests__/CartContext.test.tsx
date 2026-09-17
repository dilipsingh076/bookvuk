/**
 * The guest cart and the merge into an account.
 *
 * This is the most business-critical code in the browser and it had no tests: if
 * the guest cart is lost at sign-in, the visitor who was about to buy something
 * has an empty cart at exactly the wrong moment.
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CartProvider, normalizeEmbeddedBook, useCart } from "../CartContext";
import type { Book } from "../../api/index";

const GUEST_KEY = "bookvuk_guest_cart";

// The cart provider asks useAuth() who the visitor is; these tests drive that
// directly rather than standing up a real session.
const authState = {
  getToken: () => "test-token",
  isAuthenticated: false,
  loading: false,
  logout: vi.fn(),
  user: null as { role?: string } | null,
};

vi.mock("../AuthContext", () => ({
  useAuth: () => authState,
}));

const book = (over: Partial<Book> = {}): Book =>
  ({
    id: "book-1",
    bookId: "cat-1",
    title: "A Test Book",
    author: "Someone",
    price: 250,
    rating: 4.5,
    ratingCount: 10,
    stock: 5,
    stockStatus: "In stock",
    ...over,
  }) as Book;

/** Exposes the context to the test without rendering a whole page. */
let cart: ReturnType<typeof useCart>;
const Probe = () => {
  cart = useCart();
  return <div data-testid="qty">{cart.totalQty}</div>;
};

const renderCart = async () => {
  render(
    <CartProvider>
      <Probe />
    </CartProvider>,
  );
  await waitFor(() => expect(cart.loading).toBe(false));
};

const stored = (): Array<{ bookId: string; qty: number }> =>
  JSON.parse(localStorage.getItem(GUEST_KEY) || "[]");

beforeEach(() => {
  authState.isAuthenticated = false;
  authState.user = null;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("the guest cart", () => {
  it("keeps what a visitor added, in localStorage", async () => {
    await renderCart();
    await act(async () => cart.addToCart(book()));

    expect(stored()).toEqual([{ bookId: "book-1", qty: 1, book: expect.anything() }]);
    expect(cart.isGuestCart).toBe(true);
  });

  it("adds to the quantity when the same book is added again", async () => {
    await renderCart();
    await act(async () => cart.addToCart(book()));
    await act(async () => cart.addToCart(book()));

    expect(cart.totalQty).toBe(2);
    expect(stored()[0].qty).toBe(2);
  });

  it("keeps separate lines for different books", async () => {
    await renderCart();
    await act(async () => cart.addToCart(book()));
    await act(async () => cart.addToCart(book({ id: "book-2", title: "Another" })));

    expect(stored()).toHaveLength(2);
    expect(cart.totalQty).toBe(2);
  });

  it("restores the cart on the next visit", async () => {
    localStorage.setItem(GUEST_KEY, JSON.stringify([{ bookId: "book-9", qty: 3 }]));
    await renderCart();

    expect(cart.totalQty).toBe(3);
    expect(screen.getByTestId("qty")).toHaveTextContent("3");
  });

  it("removes a line", async () => {
    await renderCart();
    await act(async () => cart.addToCart(book()));
    await act(async () => cart.removeFromCart("book-1"));

    expect(cart.items).toHaveLength(0);
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();
  });

  it("treats a quantity of zero as a removal", async () => {
    await renderCart();
    await act(async () => cart.addToCart(book()));
    await act(async () => cart.setQty("book-1", 0));

    expect(cart.items).toHaveLength(0);
  });

  it("caps a line at 99 so a typo cannot order a thousand books", async () => {
    await renderCart();
    await act(async () => cart.addToCart(book()));
    await act(async () => cart.setQty("book-1", 5000));

    expect(cart.items[0].qty).toBe(99);
  });

  it("ignores a negative quantity rather than storing one", async () => {
    await renderCart();
    await act(async () => cart.addToCart(book()));
    await act(async () => cart.setQty("book-1", -5));

    expect(cart.items).toHaveLength(0);
  });

  it("empties completely on clear", async () => {
    await renderCart();
    await act(async () => cart.addToCart(book()));
    await act(async () => cart.clearCart());

    expect(cart.items).toEqual([]);
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();
  });

  it("does not call the API at all", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await renderCart();
    await act(async () => cart.addToCart(book()));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("the guest subtotal", () => {
  it("adds up the line snapshots", async () => {
    await renderCart();
    await act(async () => cart.addToCart(book({ id: "a", price: 250 })));
    await act(async () => cart.addToCart(book({ id: "a", price: 250 })));
    await act(async () => cart.addToCart(book({ id: "b", price: 100 })));

    expect(cart.subtotal).toBe(600); // 2 x 250 + 1 x 100
  });

  it("counts a line with no price snapshot as zero rather than NaN", async () => {
    await renderCart();
    await act(async () => cart.addToCart({ id: "no-snapshot" }));

    expect(cart.subtotal).toBe(0);
    expect(Number.isNaN(cart.subtotal)).toBe(false);
  });
});

describe("a corrupt stored cart", () => {
  it("is ignored rather than crashing the app", async () => {
    localStorage.setItem(GUEST_KEY, "{not json at all");
    await renderCart();

    expect(cart.items).toEqual([]);
  });

  it("drops lines with no book id", async () => {
    localStorage.setItem(
      GUEST_KEY,
      JSON.stringify([{ qty: 2 }, { bookId: "good", qty: 1 }]),
    );
    await renderCart();

    expect(cart.items.map((i) => i.bookId)).toEqual(["good"]);
  });

  it("drops lines with a zero or negative quantity", async () => {
    localStorage.setItem(
      GUEST_KEY,
      JSON.stringify([{ bookId: "a", qty: 0 }, { bookId: "b", qty: -3 }, { bookId: "c", qty: 2 }]),
    );
    await renderCart();

    expect(cart.items.map((i) => i.bookId)).toEqual(["c"]);
  });

  it("caps how many lines it will read back", async () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ bookId: `b${i}`, qty: 1 }));
    localStorage.setItem(GUEST_KEY, JSON.stringify(many));
    await renderCart();

    expect(cart.items).toHaveLength(100);
  });
});

describe("merging into an account at sign-in", () => {
  const mergeResponse = {
    items: [{ book_id: "book-1", quantity: 2, book: { id: "book-1", title: "A Test Book", price: "250.00" } }],
  };

  it("sends the guest cart once and then drops the local copy", async () => {
    localStorage.setItem(GUEST_KEY, JSON.stringify([{ bookId: "book-1", qty: 2 }]));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mergeResponse,
    } as Response);

    authState.isAuthenticated = true;
    await renderCart();

    const mergeCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/cart/merge"),
    );
    expect(mergeCalls).toHaveLength(1);
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();
    expect(cart.totalQty).toBe(2);
  });

  it("sends the quantities the guest actually chose", async () => {
    localStorage.setItem(
      GUEST_KEY,
      JSON.stringify([{ bookId: "book-1", qty: 3 }, { bookId: "book-2", qty: 1 }]),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mergeResponse,
    } as Response);

    authState.isAuthenticated = true;
    await renderCart();

    const [, init] = fetchSpy.mock.calls.find(([url]) =>
      String(url).includes("/cart/merge"),
    )!;
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      items: [
        { book_id: "book-1", quantity: 3 },
        { book_id: "book-2", quantity: 1 },
      ],
    });
  });

  it("keeps the local cart when the merge fails, so nothing is lost", async () => {
    localStorage.setItem(GUEST_KEY, JSON.stringify([{ bookId: "book-1", qty: 2 }]));
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: "boom" }),
    } as Response);
    vi.spyOn(console, "error").mockImplementation(() => {});

    authState.isAuthenticated = true;
    await renderCart();

    // The whole point: a failed merge must be retryable, not a silently emptied cart.
    expect(stored()).toEqual([{ bookId: "book-1", qty: 2 }]);
  });

  it("does not call merge when there was no guest cart", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    } as Response);

    authState.isAuthenticated = true;
    await renderCart();

    expect(
      fetchSpy.mock.calls.filter(([url]) => String(url).includes("/cart/merge")),
    ).toHaveLength(0);
  });

  it("leaves an admin without a cart", async () => {
    authState.isAuthenticated = true;
    authState.user = { role: "admin" };
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await renderCart();

    expect(cart.items).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("normalizeEmbeddedBook", () => {
  it("maps the API's snake_case onto the UI's camelCase", () => {
    const result = normalizeEmbeddedBook({
      id: "abc",
      catalog_id: "cat-9",
      title: "T",
      price: "349.50",
      rating: "4.2",
      rating_count: "88",
      stock: "3",
      cover_image: "/covers/t.jpg",
    });

    expect(result).toMatchObject({
      id: "abc",
      bookId: "cat-9",
      price: 349.5,
      rating: 4.2,
      ratingCount: 88,
      stock: 3,
      coverImage: "/covers/t.jpg",
    });
  });

  it("derives a stock status when the API does not send one", () => {
    expect(normalizeEmbeddedBook({ id: "a", stock: 4 }).stockStatus).toBe("In stock");
    expect(normalizeEmbeddedBook({ id: "a", stock: 0 }).stockStatus).toBe("Out of stock");
  });

  it("turns missing numbers into 0, not NaN", () => {
    const result = normalizeEmbeddedBook({ id: "a" });
    expect(result.price).toBe(0);
    expect(result.rating).toBe(0);
    expect(result.stock).toBe(0);
  });
});

/**
 * The signed-in cart's failure and drift handling.
 *
 * Every one of these was a real defect. The cart is the last screen before money
 * moves, so "it recovers" is not a nicety — a cart that shows the wrong lines or
 * the wrong total after a hiccup is a cart that charges the wrong amount or loses
 * the sale.
 */
describe("the signed-in cart, when things go wrong", () => {
  /** A signed-in provider whose every request is answered by `handler`. */
  const renderSignedIn = async (handler: (url: string, init?: RequestInit) => Response) => {
    authState.isAuthenticated = true;
    authState.user = { role: "customer" };
    vi.stubGlobal(
      "fetch",
      vi.fn((u: RequestInfo | URL, i?: RequestInit) =>
        Promise.resolve(handler(String(u), i)),
      ),
    );
    await renderCart();
  };

  const cartBody = (items: Array<{ id: string; qty: number }>) =>
    new Response(
      JSON.stringify({
        items: items.map((i) => ({
          book_id: i.id,
          quantity: i.qty,
          book: { id: i.id, title: "A Test Book", price: 250, stock: 5, format: "Paperback" },
        })),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  it("takes one decrement from one press, not one per stale render", async () => {
    /* `setQty` used to read the current quantity from the render closure, so
       several presses in a frame all measured against the pre-press value and
       each sent the same delta — the server ended up somewhere the screen never
       showed. */
    const sent: unknown[] = [];
    await renderSignedIn((url, init) => {
      if (init?.method === "PATCH") {
        sent.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 200 });
      }
      return cartBody([{ id: "book-1", qty: 3 }]);
    });

    await act(async () => {
      void cart.setQty("book-1", 2);
      void cart.setQty("book-1", 2);
      void cart.setQty("book-1", 2);
    });

    // The second and third presses see a quantity that is already 2, so there is
    // nothing left to change and nothing to send.
    expect(sent).toEqual([{ quantity_change: -1 }]);
  });

  it("re-reads rather than restoring a stale line when a change is refused", async () => {
    /* The old recovery put the previous *local* value back — the value that had
       already drifted — so the next press sent another doomed delta and the
       customer saw the same failure again and again. */
    let serverHas = [{ id: "book-1", qty: 3 }];
    await renderSignedIn((url, init) => {
      if (init?.method === "PATCH") {
        // Emptied elsewhere between the page loading and this press.
        serverHas = [];
        return new Response(JSON.stringify({ detail: "Item not in cart" }), { status: 404 });
      }
      return cartBody(serverHas);
    });

    await act(async () => {
      await cart.setQty("book-1", 2);
    });

    await waitFor(() => expect(cart.items).toHaveLength(0));
  });

  it("does not log an error when the line has simply moved on", async () => {
    /* A 404 means this page is looking at an older version of the cart — the
       customer emptied it in another tab. That is a resync, not a failure, and it
       used to `throw`, surfacing as "Item not in cart" in the console. */
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await renderSignedIn((url, init) => {
      if (init?.method === "PATCH") return new Response(null, { status: 404 });
      return cartBody([{ id: "book-1", qty: 3 }]);
    });

    await act(async () => {
      await cart.setQty("book-1", 2);
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it("treats removing an already-gone line as done, not as an error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    /* The cart reads empty because that is *why* the delete 404s: the line was
       removed in another tab. A server that 404s the delete and still lists the
       line on the next read cannot exist, and the removal path now takes the
       server's word — it re-reads the cart to pick up the new price. */
    await renderSignedIn((url, init) => {
      if (init?.method === "DELETE") return new Response(null, { status: 404 });
      return cartBody([]);
    });

    await act(async () => {
      await cart.removeFromCart("book-1");
    });

    // The customer asked for it not to be there, and it is not there.
    expect(cart.items).toHaveLength(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("says something when a remove genuinely fails", async () => {
    /* It used to be a bare `catch {}`: the line vanished from the screen, came
       back, and nothing was reported anywhere. */
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await renderSignedIn((url, init) => {
      if (init?.method === "DELETE") return new Response(null, { status: 500 });
      return cartBody([{ id: "book-1", qty: 1 }]);
    });

    await act(async () => {
      await cart.removeFromCart("book-1");
    });

    expect(spy).toHaveBeenCalled();
  });

  it("leaves the cart alone when the recovery read itself fails", async () => {
    /* `addToCart` recovered with `.catch(() => [])`, so a network blip during the
       recovery emptied the displayed cart — turning a failed add into the
       appearance of a lost basket. */
    let allowReads = true;
    await renderSignedIn((url, init) => {
      if (init?.method === "POST") return new Response(null, { status: 500 });
      if (!allowReads) throw new Error("network down");
      return cartBody([{ id: "book-1", qty: 2 }]);
    });

    await waitFor(() => expect(cart.items).toHaveLength(1));
    allowReads = false;
    vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      await cart.addToCart({ id: "book-2" });
    });

    // Still showing something, rather than an empty cart the customer never emptied.
    expect(cart.items.length).toBeGreaterThan(0);
  });

  it("bumps the revision on every server write, so priced totals refetch", async () => {
    /* The totals are a server figure. They were keyed off the optimistic line
       update, so they described the cart as it was before the click; then the
       bump was added to `setQty` and missed on `removeFromCart`, so deleting a
       line left the total counting it. */
    await renderSignedIn((url, init) =>
      init?.method ? new Response(null, { status: 200 }) : cartBody([{ id: "book-1", qty: 2 }]),
    );

    const before = cart.revision;
    await act(async () => {
      await cart.setQty("book-1", 1);
    });
    const afterQty = cart.revision;
    await act(async () => {
      await cart.removeFromCart("book-1");
    });
    const afterRemove = cart.revision;

    expect(afterQty).toBeGreaterThan(before);
    expect(afterRemove).toBeGreaterThan(afterQty);
  });
});
