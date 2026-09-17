"use client";

/**
 * The cart's shape while it loads.
 *
 * Cart-line shaped rather than a centred spinner: the visitor already knows
 * roughly what is in their cart, so showing its shape is more reassuring than a
 * spinner that could equally mean "empty".
 */

import { Skeleton } from "../../components/ui/Skeleton";

const CartSkeleton = () => (
  <div className="py-10" aria-busy="true">
    <Skeleton className="h-8 w-44" />
    <div className="mt-8 space-y-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-2xl border border-bookvuk-border/80 bg-white p-4"
        >
          <Skeleton className="h-20 w-16 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-8 w-24 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  </div>
);

export default CartSkeleton;
