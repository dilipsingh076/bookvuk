"use client";

import { createContext, useCallback, useContext, useMemo, useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { reportLoadError } from "@/lib/loadError";
import { getBaseUrl, type Book } from "../api/index";
import type { CartTotals } from "../api/commerce";
import { useAuth } from "./AuthContext";

/**
 * A cart line. `book` carries what the cart needs to render itself:
 *  - signed in: embedded by the API in the cart response
 *  - guest: a snapshot captured when the visitor clicked "add to cart"
 *
 * Either way the pages read `item.book` and never have to fetch the catalogue to
 * look up a title or a price.
 */
export type CartItem = { bookId: string; qty: number; book?: Book };

type CartContextValue = {
  items: CartItem[];
  totalQty: number;
  /** Subtotal from the line snapshots — used for the guest cart, which cannot call the priced endpoint. */
  subtotal: number;
  /**
   * What the server says the cart costs, before any discount code.
   *
   * Arrives embedded in the cart response rather than from a second request.
   * Fetching it separately repeated the identical three queries and doubled the
   * wait — around 1.2s each against the Tokyo database — and cost a third call
   * on every quantity change. Because it now travels with the lines, it can
   * never describe a different cart than the `items` beside it.
   *
   * Null for a guest, who has no server cart to price, and until the first
   * response lands.
   */
  serverTotals: CartTotals | null;
  /** Increments once a change has landed on the server. Anything the *server*
   *  prices — the cart totals — has to wait for this rather than for the
   *  optimistic line update, or it describes the cart as it was before. */
  revision: number;
  /** True while a change is still on its way to the server, so anything the
   *  server prices is known to be behind. */
  syncing: boolean;
  addToCart: (book: Book | { id: string }) => Promise<void>;
  removeFromCart: (bookId: string) => Promise<void>;
  setQty: (bookId: string, qty: number) => Promise<void>;
  /** Move a line by `delta`, measured against the newest local quantity.
   *
   *  What a + or − press actually means. `setQty` takes an absolute target,
   *  which forces the caller to know the current quantity — and a stepper reads
   *  that from a prop, so several presses in one frame all compute the same
   *  target and only one of them changes anything. */
  adjustQty: (bookId: string, delta: number) => Promise<void>;
  clearCart: () => Promise<void>;
  /** True while the visitor has no account and the cart lives in this browser. */
  isGuestCart: boolean;
  loading: boolean;
  /**
   * A discount code the shopper has applied, validated against the server.
   *
   * Held here because it belongs to the cart's price, and because two pages need
   * the same answer: the cart, where it is entered, and the checkout, where it is
   * charged. It used to live in `Checkout`'s own state, so a code applied in the
   * cart — had the cart's field worked at all — would have been forgotten one
   * click later.
   */
  coupon: string | null;
  setCoupon: (code: string | null) => void;
};

const CartContext = createContext<CartContextValue | null>(null);
type CartProviderProps = { children: ReactNode };

// A guest's cart lives here until they sign in, at which point it is merged into
// their account cart. Losing it at sign-in is the thing this prevents.
const GUEST_KEY = "bookvuk_guest_cart";
const MAX_GUEST_LINES = 100;
const MAX_LINE_QTY = 99;

const readGuestCart = (): CartItem[] => {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((i) => i && typeof i.bookId === "string" && Number(i.qty) > 0)
      .slice(0, MAX_GUEST_LINES)
      .map((i) => ({
        bookId: String(i.bookId),
        qty: Math.min(MAX_LINE_QTY, Math.max(1, Number(i.qty))),
        book: i.book,
      }));
  } catch {
    return [];
  }
};

const writeGuestCart = (items: CartItem[]) => {
  try {
    if (items.length === 0) localStorage.removeItem(GUEST_KEY);
    else localStorage.setItem(GUEST_KEY, JSON.stringify(items.slice(0, MAX_GUEST_LINES)));
  } catch {
    // Private browsing or a full quota: the cart just does not persist.
  }
};

export const CartProvider = ({ children }: CartProviderProps) => {
  const { getToken, isAuthenticated, loading: authLoading, logout, user } = useAuth();
  const [cartItems, setCartItemsState] = useState<CartItem[]>([]);

  /* The lines, readable synchronously.
   *
   * React does not run a `setState` updater at call time, so a mutation that
   * needs to know the *current* quantity cannot get it from `setCartItems`'s
   * callback and cannot get it from the render closure either — the closure is
   * one render behind whenever two presses land in the same frame.
   *
   * This ref is written in the same breath as the state, so it is always the
   * newest value. `setQty` measures its delta against it, which is the whole
   * reason it can send one change per press rather than one per stale render.
   */
  const itemsRef = useRef<CartItem[]>([]);

  const setCartItems = (next: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    const value = typeof next === "function" ? next(itemsRef.current) : next;
    itemsRef.current = value;
    setCartItemsState(value);
  };
  const [loading, setLoading] = useState(true);
  const [coupon, setCouponState] = useState<string | null>(null);
  /* Mirrored into a ref because the cart fetchers carry the code on every
     request and must see the current one. `fetchCartApi` is a `useCallback`
     the bootstrap effect depends on — listing `coupon` there would re-run that
     effect on every code change — and reading it from the render closure would
     send the code the component last rendered with. */
  const couponRef = useRef<string | null>(null);
  const setCoupon = (code: string | null) => {
    couponRef.current = code;
    setCouponState(code);
  };

  /** `?coupon_code=` for a cart request, or nothing when no code is applied. */
  const couponQuery = () =>
    couponRef.current ? `?coupon_code=${encodeURIComponent(couponRef.current)}` : "";
  // Guards against merging twice if the auth effect re-runs.
  const mergeDone = useRef(false);
  /* Counts local changes to the cart, so a slow read cannot undo a fast write.
   *
   * `addToCart` finishes by re-reading the cart, to pick up the server's own
   * quantity merging and stock caps. That GET is issued before any later change
   * exists, so when it resolves it describes a cart that has since moved on —
   * and assigning it wholesale threw away the newer quantity. Measured on the
   * catalogue: add a book, press + about two seconds later, and the stepper sat
   * at 1 while the server held 2, staying wrong until a reload. Intermittent,
   * because it depends on which of the two requests answers first.
   *
   * Each mutation bumps this; a read only applies if nothing changed while it
   * was in flight. */
  const mutationId = useRef(0);

  /* Bumped once a change has actually landed on the server.
   *
   * The lines update optimistically, which is right — a quantity should move the
   * instant it is clicked. But anything *priced by the server* must wait for the
   * server to know: the cart totals were being fetched the moment the local
   * quantity changed, so they arrived describing the cart as it was before the
   * click and every figure sat one step behind. */
  const [revision, setRevision] = useState(0);
  /* The server's price for the cart, as it arrived with the lines. */
  const [serverTotals, setServerTotals] = useState<CartTotals | null>(null);

  /* How many writes are still in flight.
   *
   * Server-priced figures cannot be right while the server is still being told
   * what changed. A burst of presses serialises on the row lock, so for a second
   * or two the lines show what the customer just did and the total still shows
   * what the server last confirmed — and a stale total presented as fact is the
   * complaint this whole area started with. Knowing a write is outstanding lets
   * the cart say "working on it" instead of quoting a number it does not have. */
  const [pendingWrites, setPendingWrites] = useState(0);

  /* Take the server's word for what is in the cart.
   *
   * Used wherever local state may have drifted. Guarded by the mutation stamp so
   * a slow recovery cannot overwrite a newer change the customer has since made.
   */
  /* Take the cart a write just answered with.
   *
   * Every cart write returns the whole cart now, so a change costs one request
   * instead of two: a `+` used to be a PATCH answering with the single line it
   * touched, then a GET for everything else — 2.6s and 1.2s in sequence against
   * the Tokyo database, for one tap.
   *
   * Guarded by the mutation stamp like `resync`, because a slow answer can land
   * after a newer press and would otherwise put the older cart back.
   */
  const applyServerCart = async (res: Response, stamp: number) => {
    const data = await res.json().catch(() => null);
    if (!data || mutationId.current !== stamp) return;
    setServerTotals((data.totals as CartTotals | undefined) ?? null);
    setCartItems(mapServerCart(data));
  };

  const resync = async (stamp: number) => {
    const fresh = await fetchCartApi().catch(() => null);
    if (fresh && mutationId.current === stamp) setCartItems(fresh);
  };

  /* Every write to the server cart goes through here.
   *
   * Bumping the revision by hand in each mutation is how this broke twice:
   * `setQty` had it and `removeFromCart` did not, so deleting a line left the
   * total describing a cart that still contained it. A helper that always bumps
   * means the only way to get it wrong is to not use the helper, which is
   * visible in a diff — where a missing one-line call was not.
   *
   * `finally`, not the success path: a failed write still leaves the component
   * showing a rolled-back cart, and the totals have to be re-read for that too.
   */
  const cartWrite = async (path: string, init: RequestInit): Promise<Response> => {
    setPendingWrites((n) => n + 1);
    try {
      /* The applied code goes with the write, so the cart that comes back is
         priced with it. Without this a press with a code on cost three
         requests: a `/cart/totals` before the write and another after. */
      return await fetch(`${getBaseUrl()}${path}${couponQuery()}`, {
        ...init,
        headers: authHeaders(),
      });
    } finally {
      setRevision((r) => r + 1);
      setPendingWrites((n) => Math.max(0, n - 1));
    }
  };

  const isAdmin = user?.role === "admin";
  const isGuestCart = !authLoading && !isAuthenticated;

  const readErrorMessage = async (res: Response, fallback: string) => {
    const payload = await res.json().catch(() => null);
    if (payload && typeof payload === "object" && "detail" in payload) {
      return String((payload as { detail?: unknown }).detail || fallback);
    }
    return fallback;
  };

  /* Memoised so the two fetchers below can name it as a dependency rather than
     omitting it. The token is still read at call time — `getToken` goes to
     storage every time — so this being stable does not staleness-trap a session
     that changed. */
  const authHeaders = useCallback(() => {
    const token = getToken();
    if (!token) throw new Error("Please sign in to continue.");
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  }, [getToken]);

  const mapServerCart = (data: any): CartItem[] =>
    (data?.items ?? []).map((i: any) => ({
      bookId: String(i.book_id),
      qty: Number(i.quantity),
      book: i.book ? normalizeEmbeddedBook(i.book) : undefined,
    }));

  const fetchCartApi = useCallback(async (signal?: AbortSignal): Promise<CartItem[]> => {
    const res = await fetch(`${getBaseUrl()}/api/customer/cart${couponQuery()}`, {
      headers: authHeaders(),
      signal,
    });
    if (res.status === 401) {
      logout();
      throw new Error("Session expired. Please sign in again.");
    }
    if (!res.ok) throw new Error("Failed to fetch cart");
    const data = await res.json();
    /* Recorded here rather than by each caller, because every path that reads
       the cart — the sign-in bootstrap, a resync after a write, an add — goes
       through this one function, and each of them wants the price to follow. */
    setServerTotals((data?.totals as CartTotals | undefined) ?? null);
    return mapServerCart(data);
  }, [authHeaders, logout]);

  /** Fold the guest cart into the account cart, then drop the local copy. */
  const mergeGuestCart = useCallback(async (signal?: AbortSignal): Promise<CartItem[] | null> => {
    const guest = readGuestCart();
    if (guest.length === 0) return null;

    const res = await fetch(`${getBaseUrl()}/api/customer/cart/merge`, {
      method: "POST",
      headers: authHeaders(),
      signal,
      body: JSON.stringify({
        items: guest.map((i) => ({ book_id: i.bookId, quantity: i.qty })),
      }),
    });
    if (!res.ok) {
      // Keep the local cart so the merge can be retried rather than silently lost.
      throw new Error(await readErrorMessage(res, "Could not merge your cart"));
    }
    writeGuestCart([]);
    /* The one write that cannot go through `cartWrite`: this is a `useCallback`
       declared above it and carries an abort signal through the auth bootstrap.
       It still has to bump, or signing in on the cart page leaves the totals
       describing the cart from before the merge. */
    setRevision((r) => r + 1);
    return mapServerCart(await res.json());
  }, [authHeaders]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      mergeDone.current = false;
      // A code is validated per account (some are one-per-customer), so it must
      // not survive a sign-out into the next person's cart.
      setCoupon(null);
      // The signed-out visitor has no server cart, so the last account's price
      // must not be left standing over their guest lines.
      setServerTotals(null);
      setCartItems(readGuestCart());
      setLoading(false);
      return;
    }

    if (isAdmin) {
      setCartItems([]);
      setServerTotals(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    /* Cancel the request when this effect is torn down. See reportLoadError for
       why the signal, not the error, decides whether this is worth logging. */
    const controller = new AbortController();
    (async () => {
      try {
        let items: CartItem[] | null = null;
        if (!mergeDone.current) {
          mergeDone.current = true;
          try {
            items = await mergeGuestCart(controller.signal);
          } catch (e) {
            /* The guest cart is deliberately still in localStorage — see
               mergeGuestCart — so the merge is retryable. It was not, because
               this flag stayed set and no later run would try again. Clearing it
               is what makes the promise in that comment true. */
            mergeDone.current = false;
            throw e;
          }
        }
        if (items === null) items = await fetchCartApi(controller.signal);
        if (!cancelled) setCartItems(items);
      } catch (e) {
        reportLoadError("Cart load error:", e, controller.signal);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authLoading, isAuthenticated, isAdmin, fetchCartApi, mergeGuestCart]);

  // ----- mutations: local for a guest, server-backed once signed in -----

  const addToCart = async (book: Book | { id: string }) => {
    const bookId = String((book as { id?: string })?.id ?? "");
    if (!bookId) return;
    /* Stamped at the start, not before the re-read.
     *
     * Taking it later was the whole bug: this call awaits its POST for a second
     * or two, and a `+` pressed in that window bumps the counter before the
     * stamp is even taken — so the comparison could not fail and the stale read
     * was applied anyway. Recorded from the browser:
     *
     *   PATCH sent, screen shows 2   (optimistic, right)
     *   GET issued by this function, after that PATCH
     *   GET answers qty=1            (it raced the PATCH on the server)
     *   screen shows 1               (clobbered)
     *   PATCH completes, server holds 2
     */
    const stamp = (mutationId.current += 1);
    const snapshot = "title" in (book as Book) ? (book as Book) : undefined;

    const optimistic = (prev: CartItem[]): CartItem[] => {
      const existing = prev.find((i) => i.bookId === bookId);
      if (existing) {
        return prev.map((i) =>
          i.bookId === bookId
            ? { ...i, qty: Math.min(MAX_LINE_QTY, i.qty + 1), book: i.book ?? snapshot }
            : i,
        );
      }
      return [...prev, { bookId, qty: 1, book: snapshot }];
    };

    if (isGuestCart) {
      setCartItems((prev) => {
        const next = optimistic(prev);
        writeGuestCart(next);
        return next;
      });
      return;
    }

    setCartItems(optimistic);
    try {
      const res = await cartWrite("/api/customer/cart/items", {
        method: "POST",
        body: JSON.stringify({ book_id: bookId, quantity: 1 }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to add to cart"));
      // The server's own quantity merging and stock caps are in the response it
      // just gave us; this used to be a second GET to go and ask for them.
      await applyServerCart(res, stamp);
    } catch (e) {
      /* Labelled, and quiet when the page is going away: this used to be a bare
         `console.error(e)`, so a genuine add-to-cart failure and a request the
         browser killed on unload were the same unattributed
         "TypeError: Failed to fetch". */
      reportLoadError("Add to cart failed:", e);
      /* The optimistic line has to go back to whatever the server actually holds.
         Same guard: a newer change wins over this recovery read.

         `resync` rather than `.catch(() => [])`: falling back to an empty array
         meant a network blip during the recovery *emptied the displayed cart*,
         turning a failed add into the appearance of a lost basket. If the server
         cannot be reached, the right thing is to leave the screen alone. */
      await resync(stamp);
    }
  };

  const removeFromCart = async (bookId: string) => {
    const stamp = (mutationId.current += 1);
    if (isGuestCart) {
      setCartItems((prev) => {
        const next = prev.filter((i) => i.bookId !== bookId);
        writeGuestCart(next);
        return next;
      });
      return;
    }

    setCartItems((prev) => prev.filter((i) => i.bookId !== bookId));
    try {
      const res = await cartWrite(`/api/customer/cart/items/${bookId}`, {
        method: "DELETE",
      });
      // Already gone — emptied in another tab, or by a checkout. The customer
      // asked for it to not be there and it is not there; that is a success.
      if (res.status !== 404 && !res.ok && res.status !== 204) {
        throw new Error("remove failed");
      }
      // The price changes when a line leaves, and the delete answers with both
      // the remaining lines and the new total. A 404 carries no body — the line
      // was already gone, and the optimistic removal is already right.
      if (res.ok) await applyServerCart(res, stamp);
    } catch (e) {
      /* Was a bare `catch {}`: a genuine failure removed the line from the
         screen, put it back, and said nothing anywhere. */
      reportLoadError("Cart remove failed:", e);
      await resync(stamp);
    }
  };

  const setQty = async (bookId: string, qty: number) => {
    const stamp = (mutationId.current += 1);
    const clamped = Math.min(MAX_LINE_QTY, Math.max(0, qty));

    if (isGuestCart) {
      setCartItems((prev) => {
        const next = prev
          .map((i) => (i.bookId === bookId ? { ...i, qty: clamped } : i))
          .filter((i) => i.qty > 0);
        writeGuestCart(next);
        return next;
      });
      return;
    }

    /* The delta is measured against `itemsRef`, which is current now.
     *
     * `quantity_change` is a *relative* change and the server applies it to its
     * own count, so the local figure it is measured from has to be the newest
     * one. Read from the render closure, two presses in a frame both measured
     * against the pre-press value and sent the same delta twice — the server
     * ended up somewhere the screen never showed. Reading it inside a
     * `setCartItems` updater is no better: React does not run the updater at
     * call time, so the values came back unset and nothing was sent at all. */
    const current = itemsRef.current.find((i) => i.bookId === bookId);
    if (!current) return;
    const change = clamped - current.qty;
    if (change === 0) return;

    setCartItems((prev) =>
      prev.map((i) => (i.bookId === bookId ? { ...i, qty: clamped } : i)).filter((i) => i.qty > 0),
    );

    try {
      const res = await cartWrite(`/api/customer/cart/items/${bookId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity_change: change }),
      });
      // 204 is how the API reports "quantity hit zero, line removed".
      if (res.status === 404) {
        /* The line is not there any more — emptied in another tab, on a phone,
         * or by a checkout. Not a failure: this page is just looking at an older
         * version of the cart.
         *
         * Re-read and say nothing. It used to `throw`, which surfaced as
         * "Item not in cart" in the console (and Next's error overlay in
         * development) for a situation the customer caused legitimately and the
         * app can recover from completely.
         */
        await resync(stamp);
        return;
      }
      if (!res.ok && res.status !== 204) {
        throw new Error(await readErrorMessage(res, "Failed to update quantity"));
      }
      /* The line moved optimistically; the price is the server's, and the
         write answered with both. This was a follow-up GET — so a press cost
         two sequential round trips, which is what made `+` feel slow. */
      await applyServerCart(res, stamp);
    } catch (e) {
      reportLoadError("Cart quantity update failed:", e);
      /* Re-read rather than restore what was on screen.
       *
       * The old recovery put the previous local value back — which is the value
       * that had already drifted from the server, so the next press sent another
       * doomed delta and the customer got "Item not in cart" again and again.
       * The server is the only thing that knows what is in the cart, so ask it. */
      await resync(stamp);
    }
  };

  /* Each press is its own decrement, measured when it happens.
   *
   * Five taps on − used to travel as five copies of "set this line to 4",
   * because the stepper computed the target from a prop that had not re-rendered
   * yet. The first did something and the rest were no-ops, so the line went from
   * 5 to 4 and looked stuck. Delegating to `setQty` with a freshly read
   * quantity makes the fifth tap mean the fifth decrement. */
  const adjustQty = async (bookId: string, delta: number) => {
    const current = itemsRef.current.find((i) => i.bookId === bookId);
    if (!current) return;
    await setQty(bookId, current.qty + delta);
  };

  const clearCart = async () => {
    const stamp = (mutationId.current += 1);
    if (isGuestCart) {
      writeGuestCart([]);
      setCartItems([]);
      return;
    }

    setCartItems([]);
    try {
      const res = await cartWrite("/api/customer/cart/cartClear", {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) throw new Error("clear failed");
      // Zeroed by the server rather than assumed here, and it comes back with
      // the same request that did the clearing.
      await applyServerCart(res, stamp);
    } catch (e) {
      reportLoadError("Cart clear failed:", e);
      await resync(stamp);
    }
  };

  /* A code applied or removed changes the price of a cart whose lines have not
     moved, so the cart is re-read — one request, which also validates the code
     and reports back through `totals.coupon_error`. */
  const firstCouponRun = useRef(true);
  useEffect(() => {
    if (firstCouponRun.current) {
      firstCouponRun.current = false;
      return;
    }
    if (isGuestCart) return;
    const stamp = (mutationId.current += 1);
    void resync(stamp);
    // `resync` is rebuilt every render; listing it would re-read the cart on
    // every render rather than on every change of code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupon, isGuestCart]);

  const totalQty = useMemo(() => cartItems.reduce((sum, i) => sum + i.qty, 0), [cartItems]);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, i) => sum + Number(i.book?.price ?? 0) * i.qty, 0),
    [cartItems],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items: cartItems,
      revision,
      syncing: pendingWrites > 0,
      totalQty,
      subtotal,
      serverTotals,
      addToCart,
      removeFromCart,
      setQty,
      adjustQty,
      clearCart,
      isGuestCart,
      loading,
      coupon,
      setCoupon,
    }),
    /* The handlers are deliberately absent.
       
       They are plain functions, rebuilt on every render, so listing them would
       make this memo produce a new object every render — which is exactly the
       thing a memo here exists to prevent, and would re-render every consumer of
       this context on every render of the provider.
       
       It is sound because their only meaningful dependency is already listed:
       each one closes over the state above, so whenever that state changes the
       memo recomputes and captures the current versions. Between those changes
       the cached handlers close over the same values they would if rebuilt.
       
       The proper fix is `useCallback` on each handler with hand-written
       dependency lists. That is a real refactor and a risky one — a wrong list
       there reintroduces exactly the kind of stale-closure bug this file has
       already had — so it is not being done as a lint cleanup. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cartItems, revision, pendingWrites, totalQty, subtotal, serverTotals, isGuestCart, loading, coupon],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

/** The API returns snake_case book fields; the UI type is camelCase.
 *
 * Exported for its tests: it is the seam every cart line passes through, so a
 * mistake here shows up as a missing price or a wrong stock badge everywhere.
 */
export const normalizeEmbeddedBook = (raw: any): Book =>
  ({
    ...raw,
    id: String(raw.id ?? ""),
    bookId: String(raw.catalog_id ?? raw.bookId ?? raw.id ?? ""),
    price: Number(raw.price ?? 0),
    rating: Number(raw.rating ?? 0),
    ratingCount: Number(raw.rating_count ?? raw.ratingCount ?? 0),
    stock: Number(raw.stock ?? 0),
    coverImage: raw.cover_image ?? raw.coverImage ?? undefined,
    stockStatus: raw.stock_status ?? raw.stockStatus ?? (Number(raw.stock ?? 0) > 0 ? "In stock" : "Out of stock"),
  }) as Book;

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};

/* `checkoutCart` used to live here and was removed rather than fixed.
 *
 * Nothing called it — the checkout goes through `api/commerce.ts` — and it
 * POSTed an empty body to `/api/customer/checkout`: no address, no discount
 * code, no payment method. Wiring it up would have placed an order against
 * whatever default address the server picked and silently dropped the coupon the
 * customer had applied. An unused path that quietly loses money is worse than no
 * path.
 */
