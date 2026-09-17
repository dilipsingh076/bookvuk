"use client";

/**
 * Searched for, not found.
 *
 * Every one of these used to be thrown away: somebody typed it into the search
 * box and the shop had nothing. The list is a to-do, not an archive — without a
 * way to clear a term it only grows and stops being read.
 */

import { Button, LoaderBlock } from "../../../components/ui";
import { formatDate } from "./types";
import type { UseDemand } from "./useDemand";

type SearchMissListProps = {
  rows: UseDemand["missRows"];
  loading: boolean;
  busyId: string | null;
  onResolve: (id: string) => void;
};

const SearchMissList = ({ rows, loading, busyId, onResolve }: SearchMissListProps) => (
  <div className="rounded-2xl border bg-white p-6">
    <h2 className="text-lg font-bold text-bookvuk-navy">Searched for, not found</h2>
    <p className="mt-1 text-sm text-bookvuk-muted">
      Every one of these used to be thrown away. Somebody typed it into the search box and the shop
      had nothing.
    </p>

    {loading ? (
      <LoaderBlock size="md" height="panel" caption="Loading…" />
    ) : rows.length === 0 ? (
      <p className="mt-4 text-sm text-bookvuk-muted">Every search so far has found something.</p>
    ) : (
      <ul className="mt-4 divide-y overflow-hidden rounded-xl border bg-white">
        {rows.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-bookvuk-navy">“{m.term}”</div>
              <div className="mt-0.5 text-xs text-bookvuk-muted">
                last asked {formatDate(m.last_seen)}
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-bookvuk-lilac px-2.5 py-1 text-xs font-bold tabular-nums text-bookvuk-purple">
              {m.hits}×
            </span>
            <Button
              variant="secondary"
              size="sm"
              radius="lg"
              disabled={busyId === m.id}
              onClick={() => onResolve(m.id)}
            >
              {busyId === m.id ? "…" : "Dealt with"}
            </Button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default SearchMissList;
