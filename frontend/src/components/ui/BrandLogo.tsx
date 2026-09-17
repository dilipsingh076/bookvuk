import Img from "./Img";

/**
 * Single logo used everywhere.
 *
 * The source artwork lives in `design/bookvuklogo-source.png` (1254px, ~1MB) and
 * is deliberately *not* under `public/` — anything there is served to the world
 * and copied into every deploy, and a master file is neither of those things.
 *
 * What ships is a 192px JPEG, 8KB. Three decisions behind that:
 *
 * * **192px**, because the largest this ever renders is 64px, and 3x covers the
 *   densest phone screens. The old 256px derivative was oversized for its job.
 * * **JPEG, not PNG.** The artwork has no alpha — it carries its own cream
 *   background — so PNG was paying for transparency nobody used: 66KB against
 *   8KB for the same picture.
 * * It is worth the care because this is the one image on *every* page in the
 *   site, so every visitor pays for it wherever they land.
 *
 * Rendered full-bleed inside the rounded tile; padding it would show a cream
 * square floating on a white one.
 */
export const LOGO_ICON_SRC = "/assets/logo/bookvuklogo-192.jpg";

const iconWrap = {
  nav: "inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-bookvuk-border/60 sm:h-11 sm:w-11",
  lg: "inline-flex h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-bookvuk-border/60 sm:h-14 sm:w-14 md:h-16 md:w-16",
} as const;

const iconImg = "h-full w-full object-cover";

/** The largest the tile ever gets: `lg` at the md breakpoint. */
const RENDERED_PX = { nav: 44, lg: 64 } as const;

type BrandLogoProps = {
  className?: string;
  wordmarkClassName?: string;
  /** Default true (navbar). */
  showWordmark?: boolean;
  size?: "nav" | "lg";
};

const defaultWordmark =
  "text-xs font-bold tracking-tight text-bookvuk-purple sm:text-2xl italic";

const BrandLogo = ({
  className = "",
  wordmarkClassName = defaultWordmark,
  showWordmark = true,
  size = "nav",
}: BrandLogoProps) => {
  return (
    <span className={`inline-flex items-center gap-1.5 sm:gap-2 ${className}`}>
      {/* The mark is decorative while the wordmark is visible — describing both
          would make a screen reader announce "bookvuk" twice. With the wordmark
          hidden it becomes the only content, so it has to carry the name itself,
          or the link wrapping it ends up unnamed. */}
      <span className={iconWrap[size]} aria-hidden={showWordmark || undefined}>
        {/* The 256px derivative ships as-is now — a 66KB PNG rather than the
            ~2KB AVIF the optimiser used to produce. It is requested on every
            page, so this is the one image where losing the transform is felt;
            re-exporting the source at 64px would win it back.

            `eager` for the navbar: the mark belongs in the first paint, so
            lazy-loading it is wrong. The `lg` variant sits in the footer and on
            auth pages, below the fold, so it keeps the default lazy behaviour. */}
        <Img
          src={LOGO_ICON_SRC}
          alt={showWordmark ? "" : "bookvuk"}
          width={RENDERED_PX[size]}
          height={RENDERED_PX[size]}
          className={iconImg}
          loading={size === "nav" ? "eager" : "lazy"}
        />
      </span>
      {showWordmark ? (
        <span className={wordmarkClassName}>bookvuk</span>
      ) : null}
    </span>
  );
};

export default BrandLogo;
