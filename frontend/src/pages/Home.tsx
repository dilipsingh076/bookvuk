import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useFetch from "../hooks/useFetch";
import { fetchBooks, type Book } from "../api/index";
import BookCard from "../components/BookCard";
import Loader from "../components/ui/Loader";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 opacity-90" fill="currentColor" aria-hidden>
    <path d="M12 2l1.09 6.26L20 9l-6.91.74L12 16l-1.09-6.26L4 9l6.91-.74L12 2z" />
  </svg>
);

const fmtCount = (n: number) => n.toLocaleString("en-IN");

const SPOTLIGHT_PER_SLIDE = 6;
const MAX_SPOTLIGHT_SLIDES = 5;
const SPOTLIGHT_AUTO_MS = 3400;

type SpotlightCarouselProps = {
  slides: Book[][];
  onOpenBook: (book: Book) => void;
};

const SpotlightCarousel = ({ slides, onOpenBook }: SpotlightCarouselProps) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (slides.length <= 1 || paused || reduceMotion) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, SPOTLIGHT_AUTO_MS);
    return () => window.clearInterval(id);
  }, [slides.length, paused, reduceMotion]);

  if (slides.length === 0) return null;

  if (slides.length === 1 || reduceMotion) {
    const list = slides[0];
    return (
      <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-6 lg:grid-cols-6">
        {list.map((b) => (
          <BookCard key={b.id} book={b} variant="dashboard" onOpen={onOpenBook} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="mt-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="overflow-hidden rounded-2xl pb-1">
        <div
          className="flex transition-transform duration-300 ease-in-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, slideIdx) => (
            <div
              key={slideIdx}
              className="w-full shrink-0 px-0.5"
              aria-hidden={slideIdx !== index}
            >
              <div className="grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-6 lg:grid-cols-6">
                {slide.map((b) => (
                  <BookCard key={b.id} book={b} variant="dashboard" onOpen={onOpenBook} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show spotlight slide ${i + 1} of ${slides.length}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all duration-200 ${
                i === index ? "w-8 bg-booknest-purple" : "w-2 bg-booknest-border hover:bg-booknest-muted/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const { data: books, loading } = useFetch(() => fetchBooks(), []);
  const { totalQty } = useCart();
  const { wishlistCount } = useWishlist();

  const allBooks = books || [];

  /** Spotlight carousel: chunks of highly rated books (Browse has the full grid). */
  const spotlightSlides = useMemo(() => {
    const sorted = [...allBooks].sort((a, b) => b.rating - a.rating);
    const slides: Book[][] = [];
    for (let i = 0; i < sorted.length && slides.length < MAX_SPOTLIGHT_SLIDES; i += SPOTLIGHT_PER_SLIDE) {
      const chunk = sorted.slice(i, i + SPOTLIGHT_PER_SLIDE);
      if (chunk.length > 0) slides.push(chunk);
    }
    return slides;
  }, [allBooks]);

  const openBook = (book: Book) => {
    navigate(`/books/${book.id}`);
  };

  if (loading) {
    return (
      <div className="py-12">
        <Loader />
      </div>
    );
  }

  return (
    <div className="-mx-4 min-h-[calc(100vh-4rem)] bg-booknest-cream px-4 pb-16 pt-6">
      {/* Hero — BookNest gradient */}
      <section className="relative overflow-hidden rounded-[28px] bg-booknest-cream shadow-booknest-card ring-1 ring-booknest-navy/[0.08]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
          <div
            className="absolute inset-0 bg-[linear-gradient(148deg,#FFFFFF_0%,#FDF8F8_26%,#F5F3FF_55%,rgba(108,71,255,0.09)_88%,#FDF8F8_100%)]"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_85%_60%_at_100%_0%,rgba(108,71,255,0.07)_0%,transparent_55%)]"
            aria-hidden
          />
          <div
            className="absolute -right-8 -top-24 h-64 w-64 rounded-full bg-booknest-purple/[0.08] blur-3xl"
            aria-hidden
          />
          <div
            className="absolute -bottom-16 left-1/4 h-48 w-48 rounded-full bg-booknest-lilac blur-2xl"
            aria-hidden
          />
        </div>

        <div className="relative z-10 grid grid-cols-1 gap-10 px-7 py-10 sm:px-10 sm:py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-12 lg:py-11 xl:gap-14">
          <div className="min-w-0 max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-booknest-lilac px-3.5 py-1.5 text-xs font-semibold text-booknest-purple ring-1 ring-booknest-border/80">
              <SparkleIcon />
              <span>Your BookNest home</span>
            </div>
            <h1 className="mt-5 text-3xl font-bold leading-[1.15] tracking-tight text-booknest-navy sm:text-4xl md:text-[2.35rem]">
              Welcome back—here’s your reading snapshot.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-booknest-muted sm:text-[15px]">
              Cart, wishlist, and a few hand-picked highlights. When you’re ready to search or filter the
              full store, open the catalogue and use the search field on the Browse page.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/browse")}
                className="rounded-xl bg-booknest-purple px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-booknest-purple-hover"
              >
                Open catalogue
              </button>
              <button
                type="button"
                onClick={() => navigate("/wishlist")}
                className="rounded-xl border border-booknest-border bg-white px-6 py-3 text-sm font-semibold text-booknest-navy shadow-sm transition-colors hover:bg-booknest-lilac/60"
              >
                Wishlist
              </button>
            </div>
          </div>

          <aside className="flex min-w-0 flex-col justify-center border-t border-booknest-border/50 pt-10 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0 xl:pl-14">
            <blockquote className="m-0">
              <p className="bg-[linear-gradient(135deg,#6C47FF_0%,#4a32c4_38%,#1A1D2E_68%,#5b3dff_100%)] bg-clip-text font-serif text-lg italic leading-[1.55] text-transparent sm:text-xl lg:text-[1.35rem] lg:leading-[1.5] xl:text-4xl xl:leading-snug [&::selection]:bg-booknest-lilac [&::selection]:text-booknest-navy">
                “A reader lives a thousand lives before he dies. The man who never reads lives only once.”
              </p>
              <footer className="mt-5 text-sm font-medium leading-snug text-booknest-muted">
                — George R. R. Martin
              </footer>
            </blockquote>
          </aside>
        </div>
      </section>

      {/* At-a-glance stats — catalogue count is informational only (Browse link lives in hero) */}
      <section className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-[20px] bg-white p-6 text-left shadow-booknest-card ring-1 ring-booknest-navy/[0.06]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-booknest-muted">
            Titles in store
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-booknest-navy">
            {fmtCount(allBooks.length)}
          </div>
          <p className="mt-3 text-sm leading-snug text-booknest-muted">
            Growing catalogue—explore anytime from the banner above.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/cart")}
          className="rounded-[20px] bg-white p-6 text-left shadow-booknest-card ring-1 ring-booknest-navy/[0.06] transition-colors hover:bg-zinc-50/80"
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-booknest-muted">
            In your cart
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-booknest-navy">
            {fmtCount(totalQty)}
          </div>
          <div className="mt-3 text-sm font-semibold text-booknest-purple">View cart →</div>
        </button>
        <button
          type="button"
          onClick={() => navigate("/wishlist")}
          className="rounded-[20px] bg-white p-6 text-left shadow-booknest-card ring-1 ring-booknest-navy/[0.06] transition-colors hover:bg-zinc-50/80"
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-booknest-muted">
            Saved for later
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-booknest-navy">
            {fmtCount(wishlistCount)}
          </div>
          <div className="mt-3 text-sm font-semibold text-booknest-purple">Open wishlist →</div>
        </button>
      </section>

      {/* Tips — Browse page has catalogue search */}
      <section className="mt-8 rounded-[24px] bg-white p-6 shadow-booknest-card ring-1 ring-booknest-navy/[0.06] sm:p-8">
        <h2 className="text-lg font-bold tracking-tight text-booknest-navy sm:text-xl">
          Make the most of BookNest
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-booknest-muted">
          Shortcuts that work from any page—no need to hunt for the same button twice.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-booknest-lilac/60 p-5 ring-1 ring-booknest-navy/[0.06]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-booknest-purple shadow-sm">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="mt-4 text-sm font-bold text-booknest-navy">Search the catalogue</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-booknest-muted">
              On Browse, use the search box to filter by title, author, category, or keyword—results update
              as you type.
            </p>
          </div>
          <div className="rounded-2xl bg-booknest-cream/80 p-5 ring-1 ring-booknest-navy/[0.06]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-booknest-purple shadow-sm">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 21s-7-4.4-9.5-9A5.7 5.7 0 0 1 12 6a5.7 5.7 0 0 1 9.5 6c-2.5 4.6-9.5 9-9.5 9Z"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-sm font-bold text-booknest-navy">Heart what you like</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-booknest-muted">
              Save books to your wishlist while you decide—pick them up later from the heart icon.
            </p>
          </div>
          <div className="rounded-2xl bg-booknest-lilac/40 p-5 ring-1 ring-booknest-navy/[0.06]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-booknest-purple shadow-sm">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h15l-1.6 8.2a2 2 0 0 1-2 1.6H9.1a2 2 0 0 1-2-1.6L5 3H2" />
              </svg>
            </div>
            <h3 className="mt-4 text-sm font-bold text-booknest-navy">Cart when ready</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-booknest-muted">
              Add from any card, review in Cart, then checkout—your counts show in the tiles above.
            </p>
          </div>
        </div>
      </section>

      {/* Small spotlight — not a second Browse */}
      <section className="mt-10 rounded-[24px] bg-white p-6 shadow-booknest-card ring-1 ring-booknest-navy/[0.06] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-booknest-navy sm:text-xl">
              Spotlight picks
            </h2>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-booknest-muted">
              Six titles per slide, rotating automatically—open a cover for details. Filters and the full
              catalogue are in the banner above.
            </p>
          </div>
        </div>

        <SpotlightCarousel slides={spotlightSlides} onOpenBook={openBook} />
      </section>
    </div>
  );
};

export default Home;
