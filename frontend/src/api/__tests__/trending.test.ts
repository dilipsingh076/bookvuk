/**
 * `fetchTrending` decides what the home page's shelf claims to be.
 *
 * The heading is driven by `basis`: "sales" prints "Trending this week", anything
 * else prints "Highly rated right now". So a malformed or hostile response must
 * never resolve to "sales" — that is how the section ends up claiming books are
 * trending when nothing has sold, which is the bug this replaced.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTrending } from "../index";

const respond = (body: unknown, ok = true) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response);

const shelf = (over: Record<string, unknown> = {}) => ({
  basis: "sales",
  window_days: 7,
  items: [{ id: "b1", title: "A Book", price: "199.00", stock: 3, category: "Fiction" }],
  ...over,
});

// Block body, not a concise arrow: returning `restoreAllMocks()`'s value makes
// TypeScript read it as a hook cleanup callback.
beforeEach(() => {
  vi.restoreAllMocks();
});

describe("what the shelf claims to be", () => {
  it("reports sales when the server says so", async () => {
    respond(shelf({ basis: "sales" }));
    expect((await fetchTrending()).basis).toBe("sales");
  });

  it("reports rating when the server says so", async () => {
    respond(shelf({ basis: "rating" }));
    expect((await fetchTrending()).basis).toBe("rating");
  });

  it.each([undefined, null, "", "SALES", "trending", 1, {}, []])(
    "never claims sales for a basis of %p",
    async (basis) => {
      respond(shelf({ basis }));
      expect((await fetchTrending()).basis).toBe("rating");
    },
  );

  it("falls back to rating when the field is missing entirely", async () => {
    respond({ items: [], window_days: 7 });
    expect((await fetchTrending()).basis).toBe("rating");
  });
});

describe("the window", () => {
  it("uses what the server reports", async () => {
    respond(shelf({ window_days: 30 }));
    expect((await fetchTrending(4, 30)).windowDays).toBe(30);
  });

  it("falls back to the requested window when the server omits it", async () => {
    respond(shelf({ window_days: undefined }));
    expect((await fetchTrending(4, 14)).windowDays).toBe(14);
  });
});

describe("the items", () => {
  it("normalises each book so a card can render it", async () => {
    respond(shelf());
    const { items } = await fetchTrending();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "b1", title: "A Book", price: 199, stock: 3 });
  });

  it("keeps the category name the server sent", async () => {
    // Clients used to fetch the whole category list separately to resolve this.
    respond(shelf());
    expect((await fetchTrending()).items[0].category).toBe("Fiction");
  });

  it("treats a badge as absent unless the server sends one", async () => {
    respond(shelf());
    expect((await fetchTrending()).items[0].badge).toBeNull();
  });

  it.each([undefined, null, "not an array", 42, {}])(
    "yields an empty shelf for items of %p rather than throwing",
    async (items) => {
      respond(shelf({ items }));
      expect((await fetchTrending()).items).toEqual([]);
    },
  );
});

describe("failure", () => {
  it("throws on a non-OK response so the caller can show its own state", async () => {
    respond({}, false);
    await expect(fetchTrending()).rejects.toThrow(/trending/i);
  });

  it("asks for the limit and window it was given", async () => {
    const spy = respond(shelf());
    await fetchTrending(6, 30);
    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain("limit=6");
    expect(url).toContain("days=30");
  });
});
