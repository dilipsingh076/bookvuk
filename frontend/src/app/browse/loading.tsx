import BookCardSkeleton from "@/components/BookCardSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/* Shown while the catalogue is fetched on the server.
 *
 * Shaped like the page it stands in for — same grid, same card proportions — so
 * the layout does not jump when the books arrive. A centred spinner would be
 * less work and a worse answer: it tells the visitor nothing about what is
 * coming. Only routes that actually fetch on the server get one of these; on a
 * static page it would never render. */
const Loading = () => (
  <div className="pb-20 pt-6" aria-busy="true">
    <Skeleton className="h-9 w-72" />
    <div className="mt-8 grid grid-cols-1 gap-7 lg:grid-cols-[minmax(260px,280px)_1fr] lg:gap-8">
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-5 sm:gap-6 md:grid-cols-4">
        <BookCardSkeleton count={8} />
      </div>
    </div>
  </div>
);

export default Loading;
