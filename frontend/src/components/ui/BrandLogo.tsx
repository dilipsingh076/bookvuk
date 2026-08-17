/**
 * Single logo used everywhere:
 * - Icon: `public/favicon.svg`
 * - Wordmark: rendered as text (`BookNest`) for crisp scaling
 */
export const LOGO_ICON_SRC = "/favicon.svg";

const iconWrap = {
  nav: "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-booknest-border/60 sm:h-11 sm:w-11",
  lg: "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-booknest-border/60 sm:h-14 sm:w-14 md:h-16 md:w-16",
} as const;

const iconImg = {
  nav: "h-[72%] w-[72%] object-contain",
  lg: "h-[74%] w-[74%] object-contain",
} as const;

type BrandLogoProps = {
  className?: string;
  wordmarkClassName?: string;
  /** Default true (navbar). */
  showWordmark?: boolean;
  size?: "nav" | "lg";
};

const defaultWordmark =
  "text-xs font-bold tracking-tight text-booknest-purple sm:text-2xl italic";

const BrandLogo = ({
  className = "",
  wordmarkClassName = defaultWordmark,
  showWordmark = true,
  size = "nav",
}: BrandLogoProps) => {
  return (
    <span className={`inline-flex items-center gap-1.5 sm:gap-2 ${className}`}>
      <span className={iconWrap[size]} aria-hidden>
        <img
          src={LOGO_ICON_SRC}
          alt=""
          width={32}
          height={32}
          className={iconImg[size]}
          decoding="async"
        />
      </span>
      {showWordmark ? (
        <span className={wordmarkClassName}>booknest.ie</span>
      ) : null}
    </span>
  );
};

export default BrandLogo;
