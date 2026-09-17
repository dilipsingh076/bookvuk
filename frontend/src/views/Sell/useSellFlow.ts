"use client";

/**
 * Everything the sell flow keeps track of.
 *
 * Lifted out of `Sell.tsx`, which held 25 pieces of state and six effects above
 * 450 lines of markup — so reading either half meant scrolling past the other.
 * The component below is now only the shape of the page; every decision about
 * what the page is doing is here.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchBookById, fetchBooksPaged, type Book } from "../../api/index";
import {
  fetchConditions,
  fetchMySellRequests,
  fetchQuote,
  fetchWallet,
  submitSellRequest,
  type BookCondition,
  type ConditionInfo,
  type Quote,
  type Wallet,
} from "../../api/buyback";
import { useAuth } from "../../context/AuthContext";
import { useAuthModal } from "../../context/AuthModalContext";
import type { BasketEntry, Mode, SubmittedRequest } from "./types";

export const useSellFlow = () => {
  const router = useRouter();
  const { isAuthenticated, getToken } = useAuth();
  const { requireAuth } = useAuthModal();

  const [mode, setMode] = useState<Mode>("search");

  // Catalogue path
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<Book[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Book | null>(null);

  // Hand-entered path
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualIsbn, setManualIsbn] = useState("");
  const [manualPrice, setManualPrice] = useState("");

  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<BookCondition | null>(null);
  const [payoutMethod, setPayoutMethod] = useState<"wallet" | "bank">("wallet");
  const [payoutUpi, setPayoutUpi] = useState("");
  const [sellerNote, setSellerNote] = useState("");

  const [conditions, setConditions] = useState<ConditionInfo[]>([]);
  /* What the shop will and will not take from this seller right now.
   *
   * The submit used to be the first place either of these surfaced. A seller at
   * the cap searched the catalogue, graded the book, chose a payout, pressed
   * "Sell it to BookVuk" — and only then read that the shop already had ten of
   * their requests. All of that work, then a refusal, for a fact that was knowable
   * before they started. */
  const [maxOpen, setMaxOpen] = useState(0);
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<SubmittedRequest | null>(null);
  /* Everything offered in this sitting. Somebody clearing a shelf has five to
     fifteen books, and the flow took one and then forgot it — so there was no
     way to see how far through the pile you were or what it had come to. */
  const [basket, setBasket] = useState<BasketEntry[]>([]);

  /* Arriving from "Sell it back" on an order, with the book already chosen.
     Typing the title and reading the price off the cover is the step that loses
     people, and the shop already knows both — so when it does, skip it. */
  const params = useSearchParams();
  const preselected = params.get("book");
  useEffect(() => {
    if (!preselected) return;
    let cancelled = false;
    fetchBookById(preselected)
      .then((b) => {
        if (!cancelled) {
          setPicked(b);
          setMode("search");
        }
      })
      // A stale or deleted id just leaves the normal empty form.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [preselected]);

  useEffect(() => {
    fetchConditions()
      .then((c) => {
        setConditions(c.conditions);
        setMaxOpen(c.maxOpenRequests);
      })
      .catch(() => setConditions([]));
  }, []);

  /* A signed-in seller's standing with the shop: how many requests are already
     open, and what credit they have. Guests have neither, and the quote is
     deliberately available without an account, so this only runs once signed in.
     Both are best-effort — a failure here must not stop someone selling a book. */
  useEffect(() => {
    if (!isAuthenticated) {
      setOpenCount(null);
      setWallet(null);
      return;
    }
    let cancelled = false;
    const token = getToken();
    void fetchMySellRequests(token)
      .then((rs) => {
        // From the server: the list is paginated, so counting the rows on page
        // one would undercount anybody with more than a page of requests.
        if (!cancelled) setOpenCount(rs.openCount);
      })
      .catch(() => {});
    void fetchWallet(token)
      .then((w) => {
        if (!cancelled) setWallet(w);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, getToken, done]);

  /* At the cap, and how many more the shop will take. `openCount === null` means
     a guest or a failed lookup — neither is grounds for blocking a sale, so both
     read as "no objection" and the server stays the authority either way. */
  const atCap = openCount !== null && maxOpen > 0 && openCount >= maxOpen;
  const slotsLeft = openCount !== null && maxOpen > 0 ? maxOpen - openCount : null;

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 350);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (mode !== "search" || debounced.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    fetchBooksPaged({ page: 1, page_size: 6, q: debounced })
      .then((page) => {
        if (!cancelled) setResults(page.items);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, mode]);

  // What the quote is based on: a catalogue price, or the MRP off the cover.
  const priceBasis = useMemo(() => {
    if (mode === "search") return picked ? picked.price : null;
    const n = Number(manualPrice);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [mode, picked, manualPrice]);

  useEffect(() => {
    if (priceBasis === null) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    setError(null);
    fetchQuote(
      mode === "search"
        ? { bookId: picked!.id, quantity }
        : { listedPrice: priceBasis, quantity },
    )
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch((e) => {
        if (!cancelled) {
          setQuote(null);
          setError(e instanceof Error ? e.message : "Could not price that book");
        }
      })
      .finally(() => {
        if (!cancelled) setQuoting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [priceBasis, quantity, mode, picked]);

  const chosenOffer = quote?.options.find((o) => o.condition === condition) ?? null;
  const ready =
    priceBasis !== null &&
    condition !== null &&
    (chosenOffer?.offer ?? 0) > 0 &&
    (payoutMethod === "wallet" || payoutUpi.trim().length > 0) &&
    (mode === "search" ? picked !== null : manualTitle.trim().length > 0);

  /** Send it. Assumes the visitor is signed in — the gate is `submit` below.
   *
   * Split from the gate deliberately. When these were one function, the replay
   * after sign-in called it again, and the replayed closure still saw the
   * `isAuthenticated` value from before the login — so it asked for a sign-in a
   * second time instead of submitting, and the book was never offered.
   */
  const send = async () => {
    if (!ready || !condition) return;

    setSubmitting(true);
    setError(null);
    try {
      const created = await submitSellRequest(getToken(), {
        bookId: mode === "search" ? picked!.id : undefined,
        title: mode === "manual" ? manualTitle.trim() : undefined,
        author: mode === "manual" ? manualAuthor.trim() || undefined : undefined,
        isbn: mode === "manual" ? manualIsbn.trim() || undefined : undefined,
        listedPrice: mode === "manual" ? priceBasis! : undefined,
        condition,
        quantity,
        payoutMethod,
        payoutUpi: payoutMethod === "bank" ? payoutUpi.trim() : undefined,
        sellerNote: sellerNote.trim() || undefined,
      });
      setDone({ amount: created.quotedAmount, title: created.title, id: created.id });
      setBasket((prev) => [
        ...prev,
        { id: created.id, title: created.title, amount: created.quotedAmount },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit your book");
    } finally {
      setSubmitting(false);
    }
  };

  /** The gate: quoting is public, selling is not. The prompt appears here — once
   *  the seller already knows what the book is worth. */
  const submit = () => {
    if (!ready) return;
    if (!isAuthenticated) {
      requireAuth(() => void send());
      return;
    }
    void send();
  };

  /** Switch between the catalogue and hand-entered paths.
   *
   * An action rather than a bare `setMode`, because changing the path invalidates
   * the price it was based on: the quote and the chosen grade both have to go, or
   * the page shows a figure worked out from the other path's price. Exposing
   * `setQuote` to the markup would have made that the markup's job to remember. */
  const switchMode = (next: Mode) => {
    setMode(next);
    setQuote(null);
    setCondition(null);
  };

  /** Clear the form for the next book, keeping the sitting's basket. */
  const startAnother = () => {
    setDone(null);
    setPicked(null);
    setSearch("");
    setManualTitle("");
    setManualPrice("");
    setCondition(null);
  };

  return {
    router,
    isAuthenticated,
    mode,
    switchMode,
    debounced,
    search,
    setSearch,
    results,
    searching,
    picked,
    setPicked,
    manualTitle,
    setManualTitle,
    manualAuthor,
    setManualAuthor,
    manualIsbn,
    setManualIsbn,
    manualPrice,
    setManualPrice,
    quantity,
    setQuantity,
    condition,
    setCondition,
    payoutMethod,
    setPayoutMethod,
    payoutUpi,
    setPayoutUpi,
    sellerNote,
    setSellerNote,
    conditions,
    maxOpen,
    openCount,
    wallet,
    quote,
    quoting,
    error,
    submitting,
    done,
    basket,
    atCap,
    slotsLeft,
    priceBasis,
    chosenOffer,
    ready,
    submit,
    startAnother,
  };
};

export type UseSellFlow = ReturnType<typeof useSellFlow>;
