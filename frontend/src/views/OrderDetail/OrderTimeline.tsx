"use client";

/**
 * Where the parcel has got to.
 *
 * A vertical timeline rather than a status word, because the question people
 * open this page with is not "what state is it in" but "has it gone yet, and
 * when". The consignment number lives on the Shipped step and nowhere else: it
 * is the answer to that question, and it only means anything once the parcel has
 * actually gone.
 */

import { fmtDate, type Order, type Step } from "./types";

type OrderTimelineProps = {
  steps: Step[];
  order: Order;
};

const OrderTimeline = ({ steps, order }: OrderTimelineProps) => (
  <section
    className="mt-10 rounded-3xl border border-bookvuk-border/80 bg-white p-6 shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.04] sm:p-8"
    aria-labelledby="timeline-heading"
  >
    <h2 id="timeline-heading" className="text-lg font-bold text-bookvuk-navy">
      Status
    </h2>
    <ol className="relative mt-8 space-y-0">
      {steps.map((step, idx) => (
        <li key={step.key} className="relative flex gap-4 pb-10 last:pb-0">
          {idx < steps.length - 1 ? (
            <div
              className={`absolute left-[15px] top-8 h-[calc(100%-0.5rem)] w-0.5 ${
                step.done ? "bg-bookvuk-purple/40" : "bg-bookvuk-border"
              }`}
              aria-hidden
            />
          ) : null}
          <div className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-white text-xs font-bold tabular-nums shadow-sm ring-2 ring-white">
            {step.done ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bookvuk-purple text-white">
                ✓
              </span>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-bookvuk-border bg-bookvuk-cream text-bookvuk-muted">
                {idx + 1}
              </span>
            )}
          </div>
          <div className="min-w-0 pt-0.5">
            <p
              className={`font-semibold ${step.done ? "text-bookvuk-navy" : "text-bookvuk-muted"}`}
            >
              {step.label}
            </p>
            <p className="mt-1 text-sm text-bookvuk-muted">{fmtDate(step.at)}</p>
            {step.key === "shipped" && step.done && order.trackingNumber ? (
              <div className="mt-2 rounded-xl bg-bookvuk-lilac px-3 py-2 text-sm">
                <span className="font-semibold text-bookvuk-navy">
                  {order.trackingCarrierLabel}
                </span>{" "}
                <span className="tabular-nums text-bookvuk-navy">{order.trackingNumber}</span>
                {order.trackingUrl ? (
                  <>
                    <br />
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-semibold text-bookvuk-purple underline"
                    >
                      Track your parcel
                    </a>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  </section>
);

export default OrderTimeline;
