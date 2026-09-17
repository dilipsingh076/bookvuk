/**
 * The one spinner.
 *
 * The previous version was a single fixed shape — `h-8 w-8`, `border-blue-500`,
 * `inline-flex` — and every call site wrapped it in a different ad-hoc box. Three
 * things were wrong with that:
 *
 * 1. **It was blue.** Nothing else in the app is; the brand is `bookvuk-purple`.
 * 2. **It never centred itself.** `inline-flex` in a bare `<div className="py-16">`
 *    puts the spinner hard against the left edge, which is why the home page
 *    appeared to load from its top-left corner. Only the admin dashboard had
 *    remembered to add `flex justify-center`.
 * 3. **One size for every job.** The same 32px circle stood next to "Login to
 *    BookVuk" inside a button and stood alone as a whole-page fallback.
 *
 * So there are two exports, matching the two things call sites actually do:
 *
 * - `Loader` — the glyph. Inline, sized, no opinion about the space around it.
 *   Use it *beside* something: inside a button, next to a row of text.
 * - `LoaderBlock` — the glyph centred in a region it fills, with an optional
 *   caption. Use it *instead* of something: a route fallback, a guard, a panel
 *   waiting on its data.
 *
 * Accessibility: the circle is `aria-hidden` — a screen reader gains nothing from
 * a description of a rotating border — and the wrapper is a `role="status"` live
 * region carrying the wait. It needs *both* an `aria-label` and a text node:
 * `status` is not a name-from-content role, so text alone leaves the region
 * unnamed, while a label alone leaves it with nothing to announce when it
 * appears. `decorative` drops the whole apparatus, for when the surrounding
 * control already says it.
 */
import { cn } from "../../lib/cn";

type LoaderSize = "xs" | "sm" | "md" | "lg";
type LoaderTone = "brand" | "inverse" | "muted";

/* Border width scales with the circle: a 2px ring on a 48px disc reads as a hair,
 * and a 3px ring on a 14px one closes the hole in the middle. */
const SIZES: Record<LoaderSize, string> = {
  /** Inside a small/xs button, beside its label. */
  xs: "h-3.5 w-3.5 border-2",
  /** Inside a standard button. */
  sm: "h-5 w-5 border-2",
  /** Beside a line of text, or a small panel. */
  md: "h-8 w-8 border-2",
  /** Alone, standing in for a page. */
  lg: "h-12 w-12 border-[3px]",
};

/* The track is the same hue as the head, dropped to a tint — that is what makes
 * it read as one rotating ring rather than a dot chasing a grey circle. */
const TONES: Record<LoaderTone, string> = {
  /** On cream, white or lilac — the default. */
  brand: "border-bookvuk-purple/25 border-t-bookvuk-purple",
  /** On a filled purple button or any dark ground. */
  inverse: "border-white/40 border-t-white",
  /** When the wait is secondary and shouldn't pull the eye. */
  muted: "border-bookvuk-border border-t-bookvuk-muted",
};

type LoaderProps = {
  size?: LoaderSize;
  tone?: LoaderTone;
  /** Announced by screen readers while the spinner is up. */
  label?: string;
  /**
   * Hide from assistive tech entirely. For spinners inside a control that
   * already announces the wait — a disabled submit button — where a second
   * "Loading" is noise.
   */
  decorative?: boolean;
  className?: string;
};

/** The spinning circle on its own. Inline: it does not centre itself. */
const Loader = ({
  size = "md",
  tone = "brand",
  label = "Loading",
  decorative = false,
  className,
}: LoaderProps) => (
  <span
    {...(decorative
      ? { "aria-hidden": true as const }
      : { role: "status" as const, "aria-label": label })}
    className={cn("inline-flex items-center justify-center", className)}
  >
    <span
      aria-hidden
      className={cn(
        "block rounded-full animate-spin",
        /* Stopping outright would read as a broken spinner, so reduced motion
         * gets a slower turn rather than none. */
        "motion-reduce:animate-[spin_1.6s_linear_infinite]",
        SIZES[size],
        TONES[tone],
      )}
    />
    {decorative ? null : <span className="sr-only">{label}</span>}
  </span>
);

/* Vertical room the block takes. `page` is sized so a route-level fallback does
 * not collapse the footer up under the navbar and then shove it back down. */
const HEIGHTS = {
  /** Inside a card or a section that is already on screen. */
  panel: "py-10",
  /** A slice of a page. */
  section: "py-16",
  /** Standing in for the whole page. */
  page: "min-h-[60vh] py-16",
} as const;

type LoaderBlockProps = Omit<LoaderProps, "decorative"> & {
  /** Shown under the spinner, and used as the announcement in place of `label`. */
  caption?: string;
  height?: keyof typeof HEIGHTS;
};

/** The centred, region-filling form. This is what a route fallback wants. */
export const LoaderBlock = ({
  size = "lg",
  tone = "brand",
  label = "Loading",
  caption,
  height = "section",
  className,
}: LoaderBlockProps) => (
  <div
    role="status"
    aria-label={caption ?? label}
    className={cn(
      "flex w-full flex-col items-center justify-center gap-4",
      HEIGHTS[height],
      className,
    )}
  >
    {/* Decorative: the wrapper is the live region, so the glyph must not be a
        second one — otherwise the caption is announced twice. */}
    <Loader size={size} tone={tone} decorative />
    {caption ? (
      <p className="text-sm font-medium text-bookvuk-muted">{caption}</p>
    ) : (
      <span className="sr-only">{label}</span>
    )}
  </div>
);

export default Loader;
