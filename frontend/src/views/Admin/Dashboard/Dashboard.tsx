"use client";

/** The shop at a glance: what needs doing, then what is merely true. */

import { Card } from "../../../components/ui";
import { LoaderBlock } from "../../../components/ui/Loader";
import NeedsYou from "./NeedsYou";
import RestockQueue from "./RestockQueue";
import SalesTrendChart from "./SalesTrendChart";
import { useDashboard } from "./useDashboard";

const Dashboard = () => {
  const d = useDashboard();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-6">
        <NeedsYou waiting={d.waiting} clear={d.clear} nothingWaiting={d.nothingWaiting} />

        <Card radius="2xl" padding="sm" elevation="none" bordered={false} hairline="strong">
          {/* Deliberately quieter than the queue above. These two blocks used to
              look identical — same tile, same fill, same size — so a number you
              must act on and a number that is merely true were indistinguishable.
              This one is a strip of small figures; that one is a list of links. */}
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-bookvuk-muted">
            Store overview
          </h2>

          {d.loading ? (
            <LoaderBlock size="md" height="panel" label="Loading store overview" />
          ) : d.error ? (
            <div className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
              {(d.error as { message?: string } | undefined)?.message || "Failed to load overview"}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {d.overview.map((o) => (
                <div key={o.title}>
                  <div className="text-2xl font-extrabold tabular-nums text-bookvuk-navy">
                    {o.value}
                  </div>
                  <div className="mt-0.5 text-sm text-bookvuk-navy">{o.title}</div>
                  <div className="mt-0.5 text-xs text-bookvuk-muted">{o.sub}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <aside className="space-y-6">
        <SalesTrendChart trend={d.trend} loading={d.trendLoading} />
        <RestockQueue demand={d.demand} />
      </aside>
    </div>
  );
};

export default Dashboard;
