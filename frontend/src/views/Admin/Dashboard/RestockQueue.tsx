"use client";

/**
 * Out of stock, with people who asked to be told when it is back.
 *
 * The endpoint has existed since the wishlist did and nothing showed it — so the
 * one number that says what to reorder was invisible.
 */

import Link from "next/link";
import { Card } from "../../../components/ui";
import { LoaderBlock } from "../../../components/ui/Loader";
import type { UseDashboard } from "./useDashboard";

type RestockQueueProps = { demand: UseDashboard["demand"] };

const RestockQueue = ({ demand }: RestockQueueProps) => (
  <Card radius="2xl" padding="sm" elevation="none" bordered={false} hairline="strong">
    <div className="text-sm font-extrabold text-bookvuk-navy">Waiting to be restocked</div>
    <div className="mt-1 text-sm text-bookvuk-muted">
      Out of stock, with people who asked to be told when it is back.
    </div>
    {!demand ? (
      <LoaderBlock size="md" caption="Loading…" className="mt-4 h-[120px] py-0" />
    ) : demand.items.length === 0 ? (
      <div className="mt-4 text-sm text-bookvuk-muted">
        Nothing is out of stock that anybody is waiting for.
      </div>
    ) : (
      <ul className="mt-4 space-y-2.5">
        {demand.items.map((b) => (
          <li key={b.id} className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-bookvuk-navy">{b.title}</div>
              {b.author ? (
                <div className="truncate text-xs text-bookvuk-muted">{b.author}</div>
              ) : null}
            </div>
            {/* The number that decides the reorder: everyone counted here is
                already subscribed to the back-in-stock notice. */}
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-800">
              {b.waiting} waiting
            </span>
          </li>
        ))}
      </ul>
    )}
    <Link
      href="/admin/inventory"
      className="mt-4 inline-block text-sm font-semibold text-bookvuk-purple hover:underline"
    >
      Open inventory →
    </Link>
  </Card>
);

export default RestockQueue;
