"use client";

/**
 * One request in full.
 *
 * The photographs come first on purpose: they are the whole reason a grade can
 * be given to a book nobody has held yet. Before they existed the decision was
 * taken on the seller's word, re-taken on arrival, and the payout moved.
 */

import { CONDITION_LABELS, type AdminBuyback } from "../../../api/admin";
import PhotoUploader from "../../../components/PhotoUploader";
import BuybackActions from "./BuybackActions";
import { PHOTO_LABELS, formatMoney, formatWhen } from "./types";
import type { UseBuyback } from "./useBuyback";

type BuybackDetailProps = {
  detail: AdminBuyback;
  queue: UseBuyback;
};

const BuybackDetail = ({ detail, queue: q }: BuybackDetailProps) => {
  const timeline: Array<[string, string | null]> = [
    ["Submitted", detail.created_at],
    ["Approved", detail.approved_at],
    ["Received", detail.received_at],
    ["Paid", detail.paid_at],
  ];

  return (
    <div className="space-y-5 p-6">
      {q.actionError ? (
        <div className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {q.actionError}
        </div>
      ) : null}

      {detail.photos.length > 0 ? (
        <div>
          <div className="text-sm font-semibold text-bookvuk-navy">
            What the seller photographed
          </div>
          <div className="mt-2">
            <PhotoUploader
              photos={detail.photos.map((p) => ({
                id: p.id,
                url: p.url,
                label: PHOTO_LABELS[p.kind] ?? "Photo",
              }))}
              max={detail.photos.length}
            />
          </div>
        </div>
      ) : detail.status === "submitted" ? (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          No photos. You are grading this on the seller&apos;s description alone — expect to
          re-grade it on arrival.
        </div>
      ) : null}

      {/* Whether it is actually on its way, which "approved" alone could not say. */}
      {detail.status === "approved" ? (
        <div
          className={`rounded-xl p-3 text-sm ${
            detail.dispatched_at
              ? "bg-emerald-50 text-emerald-900"
              : "bg-zinc-100 text-bookvuk-navy"
          }`}
        >
          {detail.dispatched_at ? (
            <>
              <span className="font-semibold">
                Posted{" "}
                {new Date(detail.dispatched_at).toLocaleDateString("en-IN", {
                  dateStyle: "medium",
                })}
              </span>
              {detail.seller_tracking_number ? (
                <>
                  {" · "}
                  {detail.seller_tracking_carrier_label} {detail.seller_tracking_number}
                  {detail.seller_tracking_url ? (
                    <>
                      {" · "}
                      <a
                        href={detail.seller_tracking_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-semibold underline"
                      >
                        Track
                      </a>
                    </>
                  ) : null}
                </>
              ) : (
                " — no consignment number given"
              )}
            </>
          ) : (
            "The seller has not said they posted it yet."
          )}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-bookvuk-lilac p-4">
          <div className="text-sm font-semibold text-bookvuk-navy">Seller</div>
          <div className="mt-2 text-sm text-bookvuk-navy">{detail.seller_name || "Seller"}</div>
          <div className="mt-1 text-xs text-bookvuk-muted">{detail.seller_email}</div>
          {detail.payout_upi ? (
            <div className="mt-2 text-xs text-bookvuk-muted">
              UPI <span className="font-semibold text-bookvuk-navy">{detail.payout_upi}</span>
            </div>
          ) : null}
          {detail.seller_note ? (
            <div className="mt-2 rounded-lg bg-white p-2 text-xs text-bookvuk-navy">
              “{detail.seller_note}”
            </div>
          ) : null}
        </div>

        <div className="rounded-xl bg-bookvuk-lilac p-4">
          <div className="text-sm font-semibold text-bookvuk-navy">The book</div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
            <span className="text-bookvuk-muted">Printed price</span>
            <span className="text-right tabular-nums text-bookvuk-navy">
              {formatMoney(detail.listed_price)}
            </span>
            <span className="text-bookvuk-muted">Claimed</span>
            <span className="text-right text-bookvuk-navy">
              {CONDITION_LABELS[detail.condition]}
            </span>
            {detail.received_condition ? (
              <>
                <span className="text-bookvuk-muted">Graded</span>
                <span className="text-right font-semibold text-bookvuk-navy">
                  {CONDITION_LABELS[detail.received_condition]}
                </span>
              </>
            ) : null}
            <span className="text-bookvuk-muted">Copies</span>
            <span className="text-right tabular-nums text-bookvuk-navy">{detail.quantity}</span>
            <span className="mt-1 border-t border-white/70 pt-1 font-semibold text-bookvuk-navy">
              Payout
            </span>
            <span className="mt-1 border-t border-white/70 pt-1 text-right font-semibold tabular-nums text-bookvuk-navy">
              {formatMoney(detail.final_amount ?? detail.quoted_amount)}
            </span>
          </div>
          {detail.isbn ? (
            <div className="mt-2 text-xs text-bookvuk-muted">ISBN {detail.isbn}</div>
          ) : null}
        </div>
      </div>

      <BuybackActions detail={detail} queue={q} />

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-bookvuk-muted">
        {timeline
          .filter(([, when]) => Boolean(when))
          .map(([label, when]) => (
            <span key={label}>
              <span className="font-semibold text-bookvuk-navy">{label}</span> {formatWhen(when)}
            </span>
          ))}
      </div>
    </div>
  );
};

export default BuybackDetail;
