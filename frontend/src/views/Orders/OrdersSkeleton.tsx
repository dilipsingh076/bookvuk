"use client";

/** Shaped like the order cards it stands in for, so the list does not jump when
 *  they arrive. Was the bare text "Loading orders...". */

import { Skeleton } from "../../components/ui/Skeleton";

const OrdersSkeleton = () => (
  <ul className="mt-10 space-y-4" aria-busy="true">
    {[0, 1, 2].map((i) => (
      <li
        key={i}
        className="rounded-3xl border border-bookvuk-border/80 bg-white p-5 shadow-bookvuk-card sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-6 w-20 shrink-0" />
        </div>
      </li>
    ))}
  </ul>
);

export default OrdersSkeleton;
