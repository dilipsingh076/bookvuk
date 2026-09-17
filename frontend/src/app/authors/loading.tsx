import { Skeleton } from "@/components/ui/Skeleton";

const Loading = () => (
  <div className="pb-20 pt-8" aria-busy="true">
    <Skeleton className="h-9 w-64" />
    <Skeleton className="mt-3 h-4 w-80" />
    <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  </div>
);

export default Loading;
