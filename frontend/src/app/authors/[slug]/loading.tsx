import BookCardSkeleton from "@/components/BookCardSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

const Loading = () => (
  <div className="pb-20 pt-8" aria-busy="true">
    <Skeleton className="h-9 w-80" />
    <Skeleton className="mt-3 h-4 w-48" />
    <div className="mt-8 grid grid-cols-2 gap-5 sm:gap-6 md:grid-cols-4">
      <BookCardSkeleton count={8} />
    </div>
  </div>
);

export default Loading;
