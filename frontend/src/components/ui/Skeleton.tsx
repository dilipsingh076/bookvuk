/**
 * The one placeholder primitive.
 *
 * The app had five different ways of saying "loading": a full-page spinner, a
 * card skeleton, the bare text "Loading orders...", an unstyled `<p>Loading
 * order...</p>`, and in a couple of places nothing at all. Same wait, five
 * different impressions of the product.
 *
 * `Skeleton` is a shaped block; `SkeletonText` is a few lines of one. Between
 * these and `BookCardSkeleton` (product grids), that is the whole vocabulary.
 *
 * Always `aria-hidden`: a screen reader should hear the region's `aria-busy`
 * state, not a description of grey rectangles.
 */
type SkeletonProps = {
  /** Tailwind sizing/shape classes — this deliberately has no opinion on size. */
  className?: string;
};

export const Skeleton = ({ className = "" }: SkeletonProps) => (
  <div
    className={`animate-pulse rounded bg-bookvuk-lilac/50 ${className}`}
    aria-hidden
  />
);

type SkeletonTextProps = {
  lines?: number;
  className?: string;
};

/** Stand-in for a paragraph. The last line is short, the way real text ends. */
export const SkeletonText = ({ lines = 3, className = "" }: SkeletonTextProps) => (
  <div className={`space-y-2 ${className}`} aria-hidden>
    {Array.from({ length: lines }, (_, i) => (
      <Skeleton
        key={i}
        className={`h-3 ${i === lines - 1 ? "w-2/5" : i % 2 ? "w-4/5" : "w-full"}`}
      />
    ))}
  </div>
);

