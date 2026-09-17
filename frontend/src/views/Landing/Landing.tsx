"use client";

/** The shopfront: what a visitor without an account sees first. */

import BookCard from "../../components/BookCard";
import BookCardSkeleton from "../../components/BookCardSkeleton";
import CategoryPills from "./CategoryPills";
import LandingCta from "./LandingCta";
import LandingHero from "./LandingHero";
import { FEATURES } from "./features";
import { useLanding } from "./useLanding";
import { SHELF_SIZE, type LandingProps } from "./types";

const Landing = (props: LandingProps) => {
  const l = useLanding(props);

  return (
    <div className="min-h-screen bg-bookvuk-cream">
      <div className="w-full px-4 py-14">
        <LandingHero
          heroSrc={l.heroSrc}
          onHeroError={l.onHeroError}
          facets={l.facets}
          onSignUp={l.goBrowseOrRegister}
          onBrowse={l.goBrowse}
        />

        {/* Costs no extra request — both lists are already fetched by the hook
            and shared with Browse through the same cache keys. */}
        <CategoryPills shelves={l.shelves} total={l.facets ? l.facets.total : null} />

        <section className="mt-14">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-extrabold text-bookvuk-navy">
              {l.loading ? "Trending this week" : l.trendingHeading}
            </h2>
            <button
              type="button"
              onClick={l.goBrowse}
              className="text-sm font-semibold text-bookvuk-purple hover:underline"
            >
              View all
            </button>
          </div>

          {/* The grid is always rendered, with placeholders while the shelf loads.
              Returning null until the data arrived left a heading over empty space
              and then popped four books in — the wait felt far longer than it was
              and the page jumped when it ended. */}
          <div className="mt-6 grid grid-cols-2 gap-5 sm:gap-6 md:grid-cols-4" aria-busy={l.loading}>
            {l.loading ? (
              <BookCardSkeleton count={SHELF_SIZE} />
            ) : (
              l.trending.map((b) => (
                <BookCard key={b.id} book={b} variant="trending" onOpen={l.openTrendingBook} />
              ))
            )}
          </div>
          {!l.loading && l.trending.length === 0 ? (
            <p className="mt-6 text-sm text-bookvuk-muted">
              Nothing to show here yet — browse the full catalogue instead.
            </p>
          ) : null}
        </section>

        <section className="mt-14">
          <h2 className="text-center text-xl font-extrabold text-bookvuk-navy">
            Everything a reader needs
          </h2>
          <div className="mt-7 grid grid-cols-1 gap-6 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-3xl border border-bookvuk-border bg-white p-7 shadow-bookvuk-card"
              >
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-bookvuk-lilac text-bookvuk-purple">
                    {f.icon}
                  </span>
                  <div>
                    <div className="text-sm font-extrabold text-bookvuk-navy">{f.title}</div>
                    <div className="mt-2 text-sm leading-relaxed text-bookvuk-muted">{f.sub}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <LandingCta onRegister={l.openRegisterModal} onLogin={l.openLoginModal} />
      </div>
    </div>
  );
};

export default Landing;
