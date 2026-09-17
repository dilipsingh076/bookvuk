"use client";

/**
 * What people wanted and the shop could not sell them.
 *
 * Two lists, one job: this is the buying list. Everything else in the admin
 * panel is about orders that happened; this is about the ones that did not.
 *
 * It exists because the used-book side has stock for 2 of 200 titles and nothing
 * told the shop which titles to go and pay a seller for. Every row here is
 * somebody who said, in the plainest terms available, what to buy.
 */

import SearchMissList from "./SearchMissList";
import UsedDemandTable from "./UsedDemandTable";
import { useDemand } from "./useDemand";

const Demand = () => {
  const d = useDemand();

  return (
    <div className="py-8 space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-2xl font-extrabold text-bookvuk-navy">What to buy</div>
            <div className="mt-1 text-sm text-bookvuk-muted">
              Books people came for and left without. The rest of the panel is about orders that
              happened; this is the ones that did not.
            </div>
          </div>
          <button
            type="button"
            onClick={d.refresh}
            className="rounded-lg border px-4 py-2 text-sm font-semibold text-bookvuk-navy"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Used demand first: it is the actionable one. */}
      <UsedDemandTable rows={d.usedRows} loading={d.usedLoading} />
      <SearchMissList
        rows={d.missRows}
        loading={d.missLoading}
        busyId={d.busy}
        onResolve={d.resolve}
      />
    </div>
  );
};

export default Demand;
