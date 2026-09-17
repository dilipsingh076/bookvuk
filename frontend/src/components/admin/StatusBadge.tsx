"use client";

/**
 * A status pill for the admin queues.
 *
 * One component rather than three: the orders, returns and buyback screens each
 * had their own identical copy, which is how two of them ended up with different
 * padding.
 *
 * The tone is passed in rather than derived from the status, because the same
 * word means different things on different screens — and because these pills
 * carry more than statuses (payment state, "test mode", "needs title").
 */

import type { ReactNode } from "react";

type StatusBadgeProps = {
  /** Tailwind classes for the pill's colours. */
  tone: string;
  children: ReactNode;
};

const StatusBadge = ({ tone, children }: StatusBadgeProps) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
    {children}
  </span>
);

export default StatusBadge;
