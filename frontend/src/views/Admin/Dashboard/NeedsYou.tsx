"use client";

/**
 * What is waiting on somebody, before anything that is merely true.
 *
 * The dashboard used to open with totals — a number that is the same tomorrow
 * whatever you do today. Only the queues with work in them get a tile: a row of
 * zeroes reads as four things to do and is four things not to do, so the empty
 * ones move to one quiet line of chips underneath.
 */

import Link from "next/link";
import { Card } from "../../../components/ui";
import type { TodoTile } from "./types";

type NeedsYouProps = {
  waiting: TodoTile[];
  clear: TodoTile[];
  nothingWaiting: boolean;
};

const NeedsYou = ({ waiting, clear, nothingWaiting }: NeedsYouProps) => (
  <Card radius="2xl" padding="sm" elevation="none" bordered={false} hairline="strong">
    <h2 className="text-lg font-extrabold text-bookvuk-navy">Needs you</h2>
    {nothingWaiting ? (
      <div className="mt-2 text-sm text-bookvuk-muted">
        Nothing waiting. Every order is on its way and every buyback request has an answer.
      </div>
    ) : (
      <>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {waiting.map((t) => (
            <Link
              key={t.label}
              href={t.to}
              className="group flex items-center justify-between gap-3 rounded-xl border-l-4 border-bookvuk-purple bg-bookvuk-lilac p-4 transition hover:bg-bookvuk-lilac/70"
            >
              <span className="text-sm font-semibold text-bookvuk-navy">{t.label}</span>
              <span className="flex items-center gap-2">
                <span className="text-3xl font-extrabold leading-none tabular-nums text-bookvuk-purple">
                  {t.count}
                </span>
                <span aria-hidden className="text-bookvuk-muted transition group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>
        {/* "Clear" is a thing you scan for, not read: with six queues the prose
            version ran to a paragraph nobody finishes. */}
        {clear.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-bookvuk-muted">Clear</span>
            {clear.map((t) => (
              <span
                key={t.label}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
              >
                <span aria-hidden>✓</span>
                {t.label}
              </span>
            ))}
          </div>
        ) : null}
      </>
    )}
  </Card>
);

export default NeedsYou;
