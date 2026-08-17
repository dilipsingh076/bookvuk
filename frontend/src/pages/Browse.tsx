import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useFetch from "../hooks/useFetch";
import { fetchBooks, fetchCategories, type Book, type Category } from "../api/index";
import BookCard from "../components/BookCard";
import Loader from "../components/ui/Loader";

type BrowseLocationState = {
  search?: string;
};

type BrowseCategoryKey = "all" | string;

/** Dropdown sort: relevance keeps catalogue order; price uses numeric `Book.price`. */
type SortMode = "relevance" | "price-asc" | "price-desc";

const fmtCount = (n: number) => n.toLocaleString("en-IN");
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Inline art: search + open book (brand lilac / purple). */
const BrowseEmptyIllustration = () => (
  <svg
    viewBox="0 0 280 180"
    className="mx-auto h-36 w-full max-w-[280px] sm:h-40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <ellipse cx="140" cy="168" rx="90" ry="8" fill="#F5F3FF" />
    <circle cx="88" cy="72" r="36" stroke="#C4B5FD" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.9" />
    <path
      d="M88 52v40M72 72h32"
      stroke="#6C47FF"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.35"
    />
    <path
      d="M118 48h84a6 6 0 016 6v72a6 6 0 01-6 6h-84a6 6 0 01-6-6V54a6 6 0 016-6z"
      fill="#FFFBFE"
      stroke="#6C47FF"
      strokeWidth="1.4"
      strokeOpacity="0.25"
    />
    <path d="M130 64h56M130 78h40" stroke="#A78BFA" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
    <path
      d="M168 100l12 12 20-20"
      stroke="#6C47FF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.4"
    />
  </svg>
);

const Browse = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as BrowseLocationState | undefined;

  const initialSearch = state?.search || "";
  const [category, setCategory] = useState<BrowseCategoryKey>("all");
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [sortChipIdx, setSortChipIdx] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [page, setPage] = useState<number>(1);
  const pageSize = 8;
  const categoryBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [minRating, setMinRating] = useState<number | null>(null);

  const { data: categoriesData } = useFetch<Category[]>(() => fetchCategories(), []);
  const categories = categoriesData ?? [];

  // We intentionally do client-side filtering/pagination here.
  // The backend `/api/catalog/books/paged` expects `category_id` as a UUID,
  // but this UI uses category labels (e.g. "Fiction"), so server-side category filtering 422s.
  const { data: allBooksData, loading } = useFetch(() => fetchBooks(), []);
  const allBooks = allBooksData ?? [];

  const categoryRows = useMemo(() => {
    const rows = categories
      .map((c) => ({ key: String(c.id), label: String(c.name) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ key: "all" as const, label: "All categories" }, ...rows];
  }, [categories]);

  const filteredAll = useMemo(() => {
    let rows = allBooks;

    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((b) => {
        const hay = `${b.title ?? ""} ${b.author ?? ""} ${b.category ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (category !== "all") {
      rows = rows.filter((b) => String(b.category_id ?? "") === String(category));
    }

    if (minRating != null) {
      rows = rows.filter((b) => (b.rating ?? 0) >= minRating);
    }

    if (sortMode === "price-asc") {
      rows = [...rows].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else if (sortMode === "price-desc") {
      rows = [...rows].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    }

    return rows;
  }, [allBooks, debouncedSearch, category, minRating, sortMode]);

  const totalItems = filteredAll.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAll.slice(start, start + pageSize);
  }, [filteredAll, safePage, pageSize]);

  const shouldShowPagination = totalItems > pageSize;

  useEffect(() => {
    setSearch(initialSearch);
    setDebouncedSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [category, debouncedSearch, sortMode, minRating]);

  const openDetails = (book: Book) => {
    navigate(`/books/${book.id}`, { state: { background: location } });
  };

  const countFor = (key: BrowseCategoryKey) => {
    if (allBooks.length === 0) return 0;
    if (key === "all") return allBooks.length;
    return allBooks.filter((b) => String(b.category_id ?? "") === String(key)).length;
  };

  const searchTrimmed = search.trim();
  const noResults = pagedRows.length === 0;

  const isInitialLoad = loading && allBooks.length === 0;
  if (isInitialLoad) {
    return (
      <div className="py-12">
        <Loader />
      </div>
    );
  }

  return (
    <div className="pb-16 pt-6">
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(260px,280px)_1fr] lg:gap-8">
        <aside>
          <div className="rounded-[24px] bg-white p-6 shadow-booknest-card ring-1 ring-booknest-navy/[0.06]">
            <div className="text-[15px] font-bold tracking-tight text-booknest-navy" id="browse-category-heading">
              Browse by category
            </div>
            <div
              className="mt-4 space-y-1.5"
              role="group"
              aria-labelledby="browse-category-heading"
            >
              {categoryRows.map((c, i) => {
                const active = category === c.key;
                const last = categoryRows.length - 1;
                return (
                  <button
                    key={c.label}
                    ref={(el) => {
                      categoryBtnRefs.current[i] = el;
                    }}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                        e.preventDefault();
                        categoryBtnRefs.current[Math.min(i + 1, last)]?.focus();
                      }
                      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                        e.preventDefault();
                        categoryBtnRefs.current[Math.max(i - 1, 0)]?.focus();
                      }
                      if (e.key === "Home") {
                        e.preventDefault();
                        categoryBtnRefs.current[0]?.focus();
                      }
                      if (e.key === "End") {
                        e.preventDefault();
                        categoryBtnRefs.current[last]?.focus();
                      }
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                      active
                        ? "bg-booknest-lilac text-booknest-purple"
                        : "text-booknest-navy hover:bg-zinc-50"
                    }`}
                  >
                    <span>{c.label}</span>
                    <span
                      className={`text-xs tabular-nums ${active ? "text-booknest-purple/80" : "text-booknest-muted"}`}
                    >
                      {fmtCount(countFor(c.key))}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 border-t border-booknest-navy/10 pt-6">
              <div className="text-[15px] font-bold tracking-tight text-booknest-navy">Rating</div>
              <div className="mt-4 space-y-1">
                {[
                  { label: "4.5 and above", v: 4.5 },
                  { label: "4.0 and above", v: 4.0 },
                  { label: "3.5 and above", v: 3.5 }
                ].map(({ label, v }) => {
                  const active = minRating === v;
                  return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setMinRating((cur) => (cur === v ? null : v))}
                    className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                      active ? "bg-booknest-lilac text-booknest-purple" : "text-booknest-navy hover:bg-zinc-50"
                    }`}
                  >
                    <span>{label}</span>
                    {active ? <span className="text-xs font-semibold">✓</span> : null}
                  </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        <main>
          <section
            className="rounded-[24px] bg-white p-6 shadow-booknest-card ring-1 ring-booknest-navy/[0.06] sm:p-7"
            aria-label="Book catalogue"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-lg font-bold tracking-tight text-booknest-navy sm:text-xl">
                  Explore the complete catalogue
                </h1>
                <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-booknest-muted">
                  Discover every title in the store. Search below, filter by category, and sort the way you
                  like.
                </p>
              </div>
              <div className="shrink-0 rounded-xl border border-booknest-border bg-booknest-cream/80 px-4 py-2 text-center sm:text-left">
                <div className="text-xs font-semibold uppercase tracking-wide text-booknest-muted">
                  Results
                </div>
                <div className="text-sm font-bold tabular-nums text-booknest-navy">
                  {fmtCount(totalItems)} books
                </div>
              </div>
            </div>

            <div className="relative mt-5" role="search">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-booknest-muted" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, author, category, or keyword…"
                aria-label="Search catalogue"
                className={`w-full rounded-xl border border-booknest-border bg-white py-3 pl-11 text-sm text-booknest-navy shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-booknest-purple/40 focus:ring-2 focus:ring-booknest-purple/15 ${
                  search.trim() ? "pr-16" : "pr-3.5"
                }`}
              />
              {search.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-booknest-muted transition hover:bg-zinc-100 hover:text-booknest-navy"
                  aria-label="Clear search"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {["Popular", "Newest", "Low to high", "Top rated"].map((label, idx) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setSortChipIdx(idx)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:text-[13px] ${
                      idx === sortChipIdx
                        ? "bg-booknest-lilac text-booknest-navy"
                        : "bg-zinc-100 text-booknest-muted hover:bg-zinc-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                aria-label="Sort books"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="w-full min-w-[12rem] cursor-pointer rounded-xl border border-booknest-border bg-white px-3.5 py-2.5 text-sm font-semibold text-booknest-navy shadow-sm outline-none transition hover:border-booknest-purple/30 focus:border-booknest-purple/40 focus:ring-2 focus:ring-booknest-purple/15 sm:w-auto"
              >
                <option value="relevance">Sort by relevance</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
            </div>

            {noResults ? (
              <div
                className="relative mt-10 overflow-hidden rounded-2xl border border-booknest-border/70 bg-gradient-to-b from-booknest-lilac/35 via-white to-booknest-cream/40 px-5 py-12 text-center ring-1 ring-booknest-purple/[0.06] sm:px-8 sm:py-14"
                role="status"
                aria-live="polite"
              >
                <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-booknest-purple/10 blur-3xl" aria-hidden />
                <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-rose-100/40 blur-3xl" aria-hidden />
                <div className="relative mx-auto max-w-md">
                  <BrowseEmptyIllustration />
                  <h2 className="mt-4 text-xl font-bold tracking-tight text-booknest-navy sm:text-2xl">
                    No books found
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-booknest-muted sm:text-[15px]">
                    {searchTrimmed && category !== "all" ? (
                      <>
                        Nothing matches <span className="font-semibold text-booknest-navy">“{searchTrimmed}”</span> in{" "}
                        <span className="font-semibold text-booknest-navy">{category}</span>. Try another keyword or
                        category.
                      </>
                    ) : searchTrimmed ? (
                      <>
                        We couldn’t find anything for{" "}
                        <span className="font-semibold text-booknest-navy">“{searchTrimmed}”</span>. Check spelling or
                        try a shorter term.
                      </>
                    ) : category !== "all" ? (
                      <>There are no books in <span className="font-semibold text-booknest-navy">{category}</span> right now. Pick another category or search the full catalogue.</>
                    ) : (
                      <>The catalogue has no books to show yet.</>
                    )}
                  </p>
                  <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:justify-center">
                    {searchTrimmed ? (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="inline-flex items-center justify-center rounded-2xl bg-booknest-purple px-6 py-3 text-sm font-semibold text-white shadow-md shadow-booknest-purple/20 transition hover:bg-booknest-purple-hover active:scale-[0.99]"
                      >
                        Clear search
                      </button>
                    ) : null}
                    {category !== "all" ? (
                      <button
                        type="button"
                        onClick={() => setCategory("all")}
                        className={`inline-flex items-center justify-center rounded-2xl border border-booknest-border bg-white px-6 py-3 text-sm font-semibold text-booknest-navy transition hover:border-booknest-purple/30 hover:bg-booknest-lilac/50 ${
                          !searchTrimmed ? "sm:mx-auto" : ""
                        }`}
                      >
                        Show all categories
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-4 md:gap-6">
                {pagedRows.map((b) => (
                  <BookCard key={b.id} book={b} variant="dashboard" onOpen={openDetails} />
                ))}
              </div>
            )}

            {shouldShowPagination && !noResults ? (
              <div className="mt-10 flex items-center justify-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="rounded-xl border border-booknest-border bg-white px-3.5 py-2 font-semibold text-booknest-muted transition-colors hover:bg-zinc-50 disabled:opacity-40"
                >
                  ‹
                </button>
                <span className="min-w-[2.5rem] rounded-xl bg-booknest-purple px-3 py-2 text-center text-sm font-bold text-white">
                  {safePage}
                </span>
                <span className="px-1 text-sm font-medium text-booknest-muted">of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="rounded-xl border border-booknest-border bg-white px-3.5 py-2 font-semibold text-booknest-muted transition-colors hover:bg-zinc-50 disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
};

export default Browse;

