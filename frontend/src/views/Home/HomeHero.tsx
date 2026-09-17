"use client";

/** The banner: where to go next, and something to read while deciding. */

import { Button } from "../../components/ui";

type HomeHeroProps = {
  onBrowse: () => void;
  onWishlist: () => void;
};

const SparkleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5 shrink-0 opacity-90"
    fill="currentColor"
    aria-hidden
  >
    <path d="M12 2l1.09 6.26L20 9l-6.91.74L12 16l-1.09-6.26L4 9l6.91-.74L12 2z" />
  </svg>
);

const HomeHero = ({ onBrowse, onWishlist }: HomeHeroProps) => (
  <section className="relative overflow-hidden rounded-[28px] bg-bookvuk-cream shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.08]">
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
      <div className="absolute inset-0 bg-bookvuk-hero" aria-hidden />
      <div className="absolute inset-0 bg-bookvuk-hero-glow" aria-hidden />
      <div
        className="absolute -right-8 -top-24 h-64 w-64 rounded-full bg-bookvuk-purple/[0.08] blur-3xl"
        aria-hidden
      />
      <div
        className="absolute -bottom-16 left-1/4 h-48 w-48 rounded-full bg-bookvuk-lilac blur-2xl"
        aria-hidden
      />
    </div>

    <div className="relative z-10 grid grid-cols-1 gap-10 px-7 py-10 sm:px-10 sm:py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-12 lg:py-11 xl:gap-14">
      <div className="min-w-0">
        <div className="inline-flex items-center gap-2 rounded-full bg-bookvuk-lilac px-3.5 py-1.5 text-xs font-semibold text-bookvuk-purple ring-1 ring-bookvuk-border/80">
          <SparkleIcon />
          <span>Your BookVuk home</span>
        </div>
        <h1 className="mt-5 text-3xl font-bold leading-[1.15] tracking-tight text-bookvuk-navy sm:text-4xl md:text-[2.35rem]">
          Welcome back—here’s your reading snapshot.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-bookvuk-muted sm:text-[15px]">
          Cart, wishlist, and a few hand-picked highlights. When you’re ready to search or filter the
          full store, open the catalogue and use the search field on the Browse page.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={onBrowse}
            variant="primary"
            radius="xl"
            className="px-6 py-3 shadow-sm"
          >
            Open catalogue
          </Button>
          <button
            type="button"
            onClick={onWishlist}
            className="rounded-xl border border-bookvuk-border bg-white px-6 py-3 text-sm font-semibold text-bookvuk-navy shadow-sm transition-colors hover:bg-bookvuk-lilac/60"
          >
            Wishlist
          </button>
        </div>
      </div>

      <aside className="flex min-w-0 flex-col justify-center border-t border-bookvuk-border/50 pt-10 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0 xl:pl-14">
        <blockquote className="m-0">
          <p className="bg-bookvuk-quote bg-clip-text font-serif text-lg italic leading-[1.55] text-transparent sm:text-xl lg:text-[1.35rem] lg:leading-[1.5] xl:text-4xl xl:leading-snug [&::selection]:bg-bookvuk-lilac [&::selection]:text-bookvuk-navy">
            “A reader lives a thousand lives before he dies. The man who never reads lives only
            once.”
          </p>
          <footer className="mt-5 text-sm font-medium leading-snug text-bookvuk-muted">
            — George R. R. Martin
          </footer>
        </blockquote>
      </aside>
    </div>
  </section>
);

export default HomeHero;
