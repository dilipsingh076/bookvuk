"use client";

/**
 * Waiting for a second-hand copy.
 *
 * The actionable list, and the reason this page exists: the shop can go and buy
 * these titles back from readers who already own them, and everyone counted here
 * will be told the moment a copy is shelved.
 */

import { LoaderBlock } from "../../../components/ui";
import { formatMoney } from "./types";
import type { UseDemand } from "./useDemand";

type UsedDemandTableProps = {
  rows: UseDemand["usedRows"];
  loading: boolean;
};

const UsedDemandTable = ({ rows, loading }: UsedDemandTableProps) => (
  <div className="rounded-2xl border bg-white p-6">
    <h2 className="text-lg font-bold text-bookvuk-navy">Waiting for a second-hand copy</h2>
    <p className="mt-1 text-sm text-bookvuk-muted">
      Everyone here asked to be told when a used copy appears, and will be notified the moment one is
      shelved. This is the buyback shopping list.
    </p>

    {loading ? (
      <LoaderBlock size="md" height="panel" caption="Loading…" />
    ) : rows.length === 0 ? (
      <p className="mt-4 text-sm text-bookvuk-muted">Nobody is waiting for a used copy right now.</p>
    ) : (
      <div className="mt-4 overflow-hidden rounded-xl border">
        <div className="grid grid-cols-12 bg-bookvuk-lilac px-4 py-3 text-xs font-semibold text-bookvuk-muted">
          <div className="col-span-6">Title</div>
          <div className="col-span-2 text-right">New price</div>
          <div className="col-span-2 text-right">They will pay up to</div>
          <div className="col-span-2 text-right">Waiting</div>
        </div>
        <div className="divide-y bg-white">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3.5 text-sm">
              <div className="col-span-6 min-w-0">
                <div className="truncate font-semibold text-bookvuk-navy">{r.title}</div>
                {r.author ? (
                  <div className="truncate text-xs text-bookvuk-muted">{r.author}</div>
                ) : null}
              </div>
              <div className="col-span-2 text-right tabular-nums text-bookvuk-navy">
                {formatMoney(r.new_price)}
              </div>
              {/* What the keenest buyer capped themselves at — the number that
                  says what the shop can pay a seller and still sell. */}
              <div className="col-span-2 text-right tabular-nums text-bookvuk-muted">
                {r.lowest_ceiling == null ? "any price" : formatMoney(r.lowest_ceiling)}
              </div>
              <div className="col-span-2 text-right">
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-800">
                  {r.waiting}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default UsedDemandTable;
