"use client";

/** The shopfront's opening: what this is, and the two ways in. */

import Img from "../../components/ui/Img";
import type { CatalogFacets } from "../../api/index";

type LandingHeroProps = {
  heroSrc: string;
  onHeroError: () => void;
  facets: CatalogFacets | null;
  onSignUp: () => void;
  onBrowse: () => void;
};

const LandingHero = ({ heroSrc, onHeroError, facets, onSignUp, onBrowse }: LandingHeroProps) => (
  <section className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] rounded-[20px] bg-white py-7">
    <div className="ml-7">
      <div className="text-xs font-bold tracking-wide text-bookvuk-purple">Welcome to BookVuk</div>
      <h1 className="mt-3 text-4xl font-extrabold leading-tight text-bookvuk-navy md:text-5xl">
        Your infinite digital library awaits.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-bookvuk-muted">
        Browse your next favorite read, build a wishlist, and manage your cart in one smooth
        experience.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onSignUp}
          className="inline-flex items-center justify-center rounded-md bg-bookvuk-purple px-6 py-3 text-sm font-semibold text-white hover:bg-bookvuk-purple-hover"
        >
          Sign up and read
        </button>
        <button
          type="button"
          onClick={onBrowse}
          className="inline-flex items-center justify-center rounded-md border border-bookvuk-border bg-white px-6 py-3 text-sm font-semibold text-bookvuk-navy hover:bg-bookvuk-lilac"
        >
          Explore collection
        </button>
      </div>
    </div>

    <div className="relative pr-7">
      {/* The shopfront's LCP element: the first thing a visitor who has never
          seen the site looks at. The source JPEG is 393KB, which was three
          quarters of the page's image weight on its own; served as a
          width-appropriate AVIF it is a fraction of that.

          `priority` because it is the hero — this is the one image on the site
          that earns a preload. */}
      <div className="relative h-[300px] overflow-hidden rounded-3xl shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.06]">
        <Img
          src={heroSrc}
          alt="Book shelves"
          fill
          className="object-cover"
          priority
          onError={onHeroError}
        />
      </div>
      {/* Real catalogue numbers from the facets endpoint. This used to read
          "10k+ Consumer" — hardcoded, with no basis, on a shop with a handful of
          accounts. The size of the catalogue is both true and the thing a shopper
          actually wants to know. */}
      {facets ? (
        <div className="absolute left-5 top-5 rounded-2xl bg-white/90 px-4 py-3 shadow-sm ring-1 ring-bookvuk-border backdrop-blur">
          <div className="text-xs font-bold text-bookvuk-purple">
            {facets.total.toLocaleString("en-IN")} titles
          </div>
          <div className="text-sm font-semibold text-bookvuk-navy">
            across {Object.keys(facets.categories).length} categories
          </div>
        </div>
      ) : null}
    </div>
  </section>
);

export default LandingHero;
