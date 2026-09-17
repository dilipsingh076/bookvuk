/**
 * The three claims made on the shopfront.
 *
 * Data rather than markup, so the section that renders them is a loop instead of
 * three near-identical blocks — and a `.tsx` rather than `.ts` because each
 * carries its own icon.
 */

import type { Feature } from "./types";

export const FEATURES: Feature[] = [
  {
    title: "Massive Collection",
    sub: "Explore the whole catalogue in a clean, fast experience.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4z" opacity="0.2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 12h7M7 17h10" />
      </svg>
    ),
  },
  {
    title: "Personalized Wishlist",
    sub: "Save favorites and continue your reading later.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21s-7-4.4-9.5-9A5.7 5.7 0 0 1 12 6a5.7 5.7 0 0 1 9.5 6c-2.5 4.6-9.5 9-9.5 9Z"
        />
      </svg>
    ),
  },
  {
    title: "Swift Delivery",
    sub: "Smooth checkout with instant confirmation and updates.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h6l2 3h10v7H3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 17a2 2 0 1 0 4 0a2 2 0 0 0-4 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 17a2 2 0 1 0 4 0a2 2 0 0 0-4 0Z" />
      </svg>
    ),
  },
];
