/* The single place every colour, font and elevation in the app is defined.
 *
 * Both `tailwind.config.ts` and the components import from here, so a token has
 * one value rather than one per file. Before this existed the brand purple was
 * written out as `#6C47FF` in twelve places, which is how a palette quietly
 * drifts: someone adjusts the token, and the eleven literals stay behind.
 *
 * Every value below is the value the app already renders. This module was
 * introduced as a pure refactor — nothing here is a new design decision.
 */

/** Brand palette. Exposed to Tailwind as `bookvuk-*`. */
export const colors = {
  navy: "#1A1D2E",
  purple: "#6C47FF",
  "purple-hover": "#5a3ad4",
  muted: "#71717A",
  cream: "#FDF8F8",
  lilac: "#F5F3FF",
  border: "#E4E4E7",
  ring: "rgba(26, 29, 46, 0.06)",
} as const;

/* The home page's three gradients, previously arbitrary values long enough to
 * hide a typo (`bg-[linear-gradient(148deg,#FFFFFF_0%,...)]`). Exposed to
 * Tailwind as `bg-bookvuk-hero`, `bg-bookvuk-hero-glow` and `bg-bookvuk-quote`.
 *
 * `#4a32c4` and `#5b3dff` are a darker and a brighter neighbour of `purple`,
 * used only to give the pull-quote its sheen. */
export const backgroundImage = {
  "bookvuk-hero":
    "linear-gradient(148deg, #FFFFFF 0%, #FDF8F8 26%, #F5F3FF 55%, rgba(108, 71, 255, 0.09) 88%, #FDF8F8 100%)",
  "bookvuk-hero-glow":
    "radial-gradient(ellipse 85% 60% at 100% 0%, rgba(108, 71, 255, 0.07) 0%, transparent 55%)",
  "bookvuk-quote":
    "linear-gradient(135deg, #6C47FF 0%, #4a32c4 38%, #1A1D2E 68%, #5b3dff 100%)",
} as const;

/* Colours used only by the hand-drawn empty-state illustrations. SVG paints via
 * `fill` / `stroke` attributes, which Tailwind classes cannot reach, so these
 * are imported directly by the components that draw them. Keeping them named
 * and separate stops them being mistaken for part of the UI palette. */
export const illustration = {
  /** Tints of the brand purple, from Tailwind's violet ramp. */
  violet100: "#EDE9FE",
  violet300: "#C4B5FD",
  violet400: "#A78BFA",
  /** Warm off-whites for paper and page shapes. */
  paper: "#FFFBFE",
  paperWarm: "#FFFBFC",
  blush: "#FDF2F4",
  /** The heart in the empty wishlist. */
  rose300: "#FDA4AF",
} as const;

/** The stack `body` has always used.
 *
 * Inter is now self-hosted by `next/font` in the root layout, which generates
 * the family name and publishes it as `--font-sans`. The variable comes first so
 * the same face is used; the fallbacks below it are unchanged. */
export const fontFamily = {
  sans: [
    // `next/font` resolves this to its self-hosted Inter plus a metric-matched
    // "Inter Fallback", so naming Inter again here only duplicated it.
    "var(--font-sans)",
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Helvetica",
    "Arial",
    "Apple Color Emoji",
    "Segoe UI Emoji",
  ],
} as const;

/* Elevation. These were arbitrary values (`shadow-[0_20px_60px_-24px_...]`)
 * scattered across pages; naming them is what makes them reviewable.
 *
 * Worth knowing: `raised`/`lift` and the three `glow`s differ only in blur
 * spread and alpha — they are almost certainly meant to be one step each. They
 * are kept distinct here because collapsing them would change how those pages
 * look, which is a design call rather than part of this refactor.
 */
export const boxShadow = {
  /** The navbar's bottom hairline. */
  "bookvuk-hairline": "0 1px 0 rgba(26, 29, 46, 0.04)",
  /** The default card. By far the most used. */
  "bookvuk-card": "0 4px 24px rgba(26, 29, 46, 0.06)",
  "bookvuk-panel": "0 8px 40px -12px rgba(26, 29, 46, 0.12)",
  "bookvuk-raised": "0 12px 40px -24px rgba(26, 29, 46, 0.12)",
  "bookvuk-lift": "0 12px 40px -18px rgba(26, 29, 46, 0.12)",
  /** Empty-state and modal-weight surfaces. */
  "bookvuk-float": "0 20px 60px -24px rgba(26, 29, 46, 0.15)",
  "bookvuk-overlay": "0 20px 60px -28px rgba(26, 29, 46, 0.18)",
  /** Purple-tinted hover states. */
  "bookvuk-glow": "0 12px 40px -16px rgba(108, 71, 255, 0.18)",
  "bookvuk-glow-md": "0 12px 40px -16px rgba(108, 71, 255, 0.15)",
  "bookvuk-glow-sm": "0 12px 40px -20px rgba(108, 71, 255, 0.12)",
  /** The green halo on the "in stock" dot in the cart. */
  "bookvuk-in-stock": "0 0 0 3px rgba(16, 185, 129, 0.2)",
} as const;
