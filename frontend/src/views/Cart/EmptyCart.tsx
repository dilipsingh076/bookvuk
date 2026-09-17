"use client";

/**
 * Nothing in the cart.
 *
 * A panel rather than a line of grey text: an empty cart is where most visits
 * start, and it is the page's one chance to send somebody back to the shop.
 */

import Link from "next/link";
import { colors, illustration } from "../../theme/tokens";

const EmptyCartArt = () => (
  <svg
    viewBox="0 0 320 220"
    className="mx-auto h-44 w-full max-w-[320px] sm:h-52"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <defs>
      <linearGradient id="cartGrad" x1="40" y1="20" x2="280" y2="200" gradientUnits="userSpaceOnUse">
        <stop stopColor={colors.lilac} />
        <stop offset="1" stopColor={illustration.violet100} />
      </linearGradient>
      <linearGradient id="cartStroke" x1="0" y1="0" x2="320" y2="220" gradientUnits="userSpaceOnUse">
        <stop stopColor={colors.purple} stopOpacity="0.35" />
        <stop offset="1" stopColor={colors.purple} stopOpacity="0.08" />
      </linearGradient>
    </defs>
    <ellipse cx="160" cy="200" rx="120" ry="12" fill="url(#cartGrad)" opacity="0.9" />
    <path
      d="M88 148h144v36a8 8 0 01-8 8H96a8 8 0 01-8-8v-36z"
      stroke="url(#cartStroke)"
      strokeWidth="2"
      fill={illustration.paper}
    />
    <path
      d="M96 148V112a8 8 0 018-8h92a8 8 0 018 8v36"
      stroke="url(#cartStroke)"
      strokeWidth="2"
      fill="none"
    />
    <path
      d="M112 120h96M112 132h72"
      stroke={illustration.violet400}
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.6"
    />
    <g transform="translate(118 52)">
      <path
        d="M42 8L84 28v56L42 104 0 84V28L42 8z"
        fill={colors.cream}
        stroke={colors.purple}
        strokeWidth="1.8"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <path
        d="M42 8v96M0 28l42 20M84 28L42 48"
        stroke={colors.purple}
        strokeWidth="1.2"
        strokeOpacity="0.35"
      />
    </g>
    <circle cx="248" cy="64" r="6" fill={colors.purple} opacity="0.2" />
    <circle cx="72" cy="88" r="4" fill={colors.purple} opacity="0.15" />
  </svg>
);

const EmptyCart = () => (
  <div className="relative mt-10">
    <div
      className="relative overflow-hidden rounded-3xl border border-bookvuk-border/80 bg-white/95 p-8 shadow-bookvuk-float ring-1 ring-bookvuk-navy/[0.04] sm:p-12"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-rose-100/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-bookvuk-lilac/80 blur-3xl" />

      <div className="relative text-center">
        <EmptyCartArt />
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-bookvuk-navy sm:text-3xl">
          Nothing in your cart yet
        </h2>
        <p className="mt-3 text-base leading-relaxed text-bookvuk-muted sm:text-[17px]">
          Browse the shop and add titles—your bag stays here until you are ready to pay.
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

export default EmptyCart;
