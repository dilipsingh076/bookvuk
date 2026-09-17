/**
 * Placeholder shaped like a BookCard, shown while the shelf is loading.
 *
 * The sections that use it previously rendered `null` until the data arrived, so a
 * heading sat above empty space and then books appeared all at once. That reads as
 * "nothing is happening" and then as a jolt — the same wait feels considerably
 * slower than one where the layout is already there.
 *
 * The aspect ratio matches the real cover box, so nothing moves when the books
 * replace it.
 */
type BookCardSkeletonProps = {
  /** How many placeholders to draw — match the grid the real cards will fill. */
  count?: number;
};

const BookCardSkeleton = ({ count = 4 }: BookCardSkeletonProps) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="flex h-full flex-col" aria-hidden>
        <div className="aspect-[4/5] w-full animate-pulse rounded-lg bg-bookvuk-lilac/50" />
        <div className="mt-3 space-y-2 px-2">
          <div className="h-2.5 w-1/3 animate-pulse rounded bg-bookvuk-lilac/40" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-bookvuk-lilac/50" />
          <div className="h-2.5 w-2/5 animate-pulse rounded bg-bookvuk-lilac/40" />
          <div className="flex items-center justify-between pt-2">
            <div className="h-3.5 w-14 animate-pulse rounded bg-bookvuk-lilac/50" />
            <div className="h-7 w-16 animate-pulse rounded-md bg-bookvuk-lilac/40" />
          </div>
        </div>
      </div>
    ))}
  </>
);

export default BookCardSkeleton;
