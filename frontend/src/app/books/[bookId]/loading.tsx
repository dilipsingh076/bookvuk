import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

/* Mirrors the product page: cover on the left, details on the right. */
const Loading = () => (
  <div className="pb-20 pt-6" aria-busy="true">
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
      <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-28" />
        <SkeletonText lines={4} />
        <Skeleton className="h-11 w-44 rounded-xl" />
      </div>
    </div>
  </div>
);

export default Loading;
