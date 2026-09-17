"use client";

/** The order page's shape while it loads. Was a bare, unstyled `<p>Loading order...</p>`. */

import { Skeleton } from "../../components/ui/Skeleton";

const OrderDetailSkeleton = () => (
  <div className="py-10" aria-busy="true">
    <Skeleton className="h-4 w-24" />
    <div className="mt-6 space-y-3">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-5 w-32 rounded-full" />
    </div>
    <div className="mt-10 rounded-3xl border border-bookvuk-border/80 bg-white p-6 sm:p-8">
      <Skeleton className="h-5 w-20" />
      <div className="mt-8 space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default OrderDetailSkeleton;
