"use client";

/** Units sold per day over the last week. */

import { Card } from "../../../components/ui";
import { LoaderBlock } from "../../../components/ui/Loader";
import type { SalesTrend } from "../../../api/admin";

type SalesTrendChartProps = {
  trend: SalesTrend | null | undefined;
  loading: boolean;
};

const SalesTrendChart = ({ trend, loading }: SalesTrendChartProps) => (
  <Card radius="2xl" padding="sm" elevation="none" bordered={false} hairline="strong">
    <div className="text-sm font-extrabold text-bookvuk-navy">Sales trend</div>
    <div className="mt-1 text-sm text-bookvuk-muted">Units sold per day over the last week.</div>
    {loading ? (
      <LoaderBlock size="md" caption="Loading sales trend…" className="mt-4 h-[160px] py-0" />
    ) : !trend || trend.total === 0 ? (
      <div className="mt-4 flex h-[160px] items-center text-sm text-bookvuk-muted">
        No sales in this period yet.
      </div>
    ) : (
      <div className="mt-4 flex h-[160px] items-end gap-2">
        {trend.series.map((point) => {
          const peak = Math.max(...trend.series.map((p) => p.units), 1);
          // Percentage height so the tallest bar always fills the chart.
          const pct = Math.round((point.units / peak) * 100);
          return (
            <div key={point.date} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-[120px] w-full items-end">
                <div
                  className="w-full rounded-t bg-bookvuk-purple"
                  style={{ height: `${Math.max(pct, point.units > 0 ? 6 : 2)}%` }}
                  title={`${point.units} on ${point.date}`}
                />
              </div>
              <div className="text-[10px] font-semibold text-bookvuk-muted">{point.label}</div>
              <div className="text-[10px] tabular-nums text-bookvuk-navy">{point.units}</div>
            </div>
          );
        })}
      </div>
    )}
  </Card>
);

export default SalesTrendChart;
