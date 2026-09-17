"use client";

/**
 * Nothing saved yet.
 *
 * A panel rather than a line of grey text: an empty wishlist is the normal first
 * state, not a failure, and this is the page's one chance to say what the heart
 * on a book card is for.
 */

import Link from "next/link";
import { colors, illustration } from "../../theme/tokens";

/** Heart + stacked books, in rose and brand tones. */
const EmptyWishlistArt = () => (
  <svg
    viewBox="0 0 320 200"
    className="mx-auto h-40 w-full max-w-[300px] sm:h-48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <defs>
      <linearGradient id="wlHeart" x1="80" y1="40" x2="240" y2="180" gradientUnits="userSpaceOnUse">
        <stop stopColor={illustration.rose300} stopOpacity="0.35" />
        <stop offset="1" stopColor={colors.purple} stopOpacity="0.12" />
      </linearGradient>
    </defs>
    <ellipse cx="160" cy="188" rx="100" ry="10" fill={colors.lilac} opacity="0.9" />
    <path
      d="M160 36c-18-22-48-24-62-6-14 18-10 42 8 58l54 48 54-48c18-16 22-40 8-58-14-18-44-16-62 6z"
      stroke="url(#wlHeart)"
      strokeWidth="2.5"
      fill={illustration.paperWarm}
      strokeLinejoin="round"
    />
    <path
      d="M160 52c-12-14-32-15-42-4-10 11-7 28 6 38l36 32 36-32c13-10 16-27 6-38-10-11-30-10-42 4z"
      fill={illustration.blush}
      opacity="0.85"
    />
    <g transform="translate(200 120)">
      <rect
        x="0"
        y="0"
        width="56"
        height="72"
        rx="4"
        fill={colors.lilac}
        stroke={illustration.violet300}
        strokeWidth="1.2"
      />
      <path
        d="M8 12h40M8 24h28"
        stroke={illustration.violet400}
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </g>
    <g transform="translate(64 128)">
      <rect
        x="0"
        y="0"
        width="52"
        height="64"
        rx="4"
        fill={colors.cream}
        stroke={colors.purple}
        strokeOpacity="0.25"
        strokeWidth="1.2"
      />
    </g>
  </svg>
);

const EmptyWishlist = () => (
  <div className="relative mt-10">
    <div
      className="relative overflow-hidden rounded-3xl border border-bookvuk-border/80 bg-white/95 p-8 shadow-bookvuk-float ring-1 ring-bookvuk-navy/[0.04] sm:p-12"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-rose-100/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-bookvuk-lilac/80 blur-3xl" />

      <div className="relative text-center">
        <EmptyWishlistArt />
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-bookvuk-navy sm:text-3xl">
          No saved books yet
        </h2>
        <p className="mt-3 text-base leading-relaxed text-bookvuk-muted sm:text-[17px]">
          Tap the heart on any book while you browse—we’ll keep your list here for when you are ready
          to buy.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            href="/browse"
            className="inline-flex items-center justify-center rounded-2xl bg-bookvuk-purple px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-bookvuk-purple/25 transition hover:bg-bookvuk-purple-hover hover:shadow-xl active:scale-[0.98]"
          >
            Browse the shop
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl border border-bookvuk-border bg-white px-8 py-3.5 text-sm font-semibold text-bookvuk-navy transition hover:border-bookvuk-purple/30 hover:bg-bookvuk-lilac/50"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  </div>
);

export default EmptyWishlist;
