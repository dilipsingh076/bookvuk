"use client";

/**
 * The signed-in home page.
 *
 * No full-page loader. It used to hide the hero, the stats and every shortcut
 * behind one catalogue request, so a signed-in visitor saw a spinner instead of
 * their own page — and everything they might want to click was already known
 * without waiting for that fetch. Only the shelf waits now.
 */

import BookCardSkeleton from "../../components/BookCardSkeleton";
import HomeHero from "./HomeHero";
import HomeStats from "./HomeStats";
import HomeTips from "./HomeTips";
import SpotlightCarousel from "./SpotlightCarousel";
import { useHome } from "./useHome";

const Home = () => {
  const h = useHome();

  return (
    <div className="-mx-4 min-h-[calc(100vh-4rem)] bg-bookvuk-cream px-4 pb-16 pt-6">
      <HomeHero onBrowse={() => h.go("/browse")} onWishlist={() => h.go("/wishlist")} />

      <HomeStats
        titlesInStore={h.titlesInStore}
        cartQty={h.totalQty}
        wishlistCount={h.wishlistCount}
        onCart={() => h.go("/cart")}
        onWishlist={() => h.go("/wishlist")}
      />

      <HomeTips />

      {/* Small spotlight — not a second Browse */}
      <section className="mt-10 rounded-[24px] bg-white p-6 shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.06] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-bookvuk-navy sm:text-xl">
              Spotlight picks
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-bookvuk-muted">
              Six titles per slide, rotating automatically—open a cover for details. Filters and the
              full catalogue are in the banner above.
            </p>
          </div>
        </div>

        {/* Only this waits, and it holds its own space while it does. */}
        {h.loading ? (
          <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6" aria-busy="true">
            <BookCardSkeleton count={6} />
          </div>
        ) : h.spotlightSlides.length > 0 ? (
          <SpotlightCarousel slides={h.spotlightSlides} onOpenBook={h.openBook} />
        ) : (
          <p className="mt-6 text-sm text-bookvuk-muted">
            No titles to spotlight yet.{" "}
            <button
              type="button"
              onClick={() => h.go("/browse")}
              className="font-semibold text-bookvuk-purple hover:underline"
            >
              Browse the catalogue
            </button>
            .
          </p>
        )}
      </section>
    </div>
  );
};

export default Home;
