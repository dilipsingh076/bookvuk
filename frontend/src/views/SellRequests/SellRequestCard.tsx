"use client";

/**
 * One book you offered us.
 *
 * The card is organised around the one question a seller has — what happens
 * next — so the status, the instruction that follows from it, and the control
 * that acts on it sit together rather than in three separate regions.
 */

import PhotoUploader from "../../components/PhotoUploader";
import { formatPrice } from "../../utils/formatPrice";
import type { SellRequest } from "../../api/buyback";
import type { Carrier } from "../../api/publicCarriers";
import DispatchForm from "./DispatchForm";
import {
  CONDITION_LABELS,
  PHOTO_LABELS,
  STATUS_LABELS,
  UNKNOWN_STATUS,
  daysLeft,
  fmtDate,
  type DispatchDraft,
} from "./types";

type SellRequestCardProps = {
  request: SellRequest;
  /** The shop's postal address, or null while it is unconfigured. */
  shipTo: string[] | null;
  carriers: Carrier[];
  draft: DispatchDraft | undefined;
  onDispatchField: (field: keyof DispatchDraft, value: string) => void;
  onMarkPosted: () => void;
  onAddPhoto: (file: File, kind: "cover" | "spine" | "damage") => void;
  onRemovePhoto: (photoId: string) => void;
  onWithdraw: () => void;
  /** An upload or dispatch is in flight for *this* request. */
  busy: boolean;
  withdrawing: boolean;
};

/** The next photo we do not have: cover, then spine, then damage. */
const nextPhotoKind = (r: SellRequest): "cover" | "spine" | "damage" => {
  if (!r.photos.some((p) => p.kind === "cover")) return "cover";
  if (!r.photos.some((p) => p.kind === "spine")) return "spine";
  return "damage";
};

const SellRequestCard = ({
  request: r,
  shipTo,
  carriers,
  draft,
  onDispatchField,
  onMarkPosted,
  onAddPhoto,
  onRemovePhoto,
  onWithdraw,
  busy,
  withdrawing,
}: SellRequestCardProps) => {
  const st = STATUS_LABELS[r.status] ?? UNKNOWN_STATUS(r.status);
  const left = daysLeft(r.quoteExpiresAt);
  const regraded = r.receivedCondition !== null && r.receivedCondition !== r.condition;
  const amount = r.finalAmount ?? r.quotedAmount;
  const kind = nextPhotoKind(r);

  return (
    <li className="rounded-3xl border border-bookvuk-border/80 bg-white p-5 shadow-bookvuk-card sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-bookvuk-navy">{r.title}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${st.className}`}
            >
              {st.text}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-bookvuk-muted">
            {CONDITION_LABELS[r.condition] ?? r.condition}
            {r.quantity > 1 ? ` · ${r.quantity} copies` : ""} · offered {fmtDate(r.createdAt)}
          </p>
          {st.next ? (
            <p className="mt-2 text-sm leading-relaxed text-bookvuk-navy/80">{st.next}</p>
          ) : null}

          {/* How long the offer stands. The amount is fixed at the moment of the
              quote so a rate change cannot move it — but that only works if the
              offer also ends, and a seller who is not told the date cannot act
              on it. Shown only while it can still be acted on. */}
          {r.status === "submitted" && left !== null ? (
            <p
              className={`mt-2 text-xs font-semibold ${
                left <= 3 ? "text-amber-800" : "text-bookvuk-muted"
              }`}
            >
              {left <= 0
                ? "This offer has run out."
                : left === 1
                  ? "This offer holds until tomorrow."
                  : `This offer holds for ${left} more days.`}
            </p>
          ) : null}

          {/* The address, next to the instruction that needs it. "Post it to us"
              was the one physical step the whole flow turns on, and nothing
              anywhere said where — so a seller who got this far had no way to
              finish. Until an address is configured this says so plainly instead
              of issuing an instruction it cannot complete. */}
          {r.status === "approved" ? (
            shipTo ? (
              <div className="mt-2 rounded-lg bg-sky-50/70 px-3 py-2 text-xs leading-relaxed text-sky-900">
                <div className="font-semibold">Post it to</div>
                <address className="mt-1 not-italic">
                  {shipTo.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </address>
                <div className="mt-1.5 text-sky-900/80">
                  Write your request id on the parcel: {String(r.id).slice(0, 8)}
                </div>
              </div>
            ) : (
              <p className="mt-2 rounded-lg bg-sky-50/70 px-3 py-2 text-xs leading-relaxed text-sky-900">
                We will email you the postal address and a reference for the parcel. Nothing to do
                until then.
              </p>
            )
          ) : null}

          {/* Photographs, while the shop has not yet decided. Without them the
              grade is taken on trust, re-checked when the book arrives, and the
              payout moves — which is the complaint sellers actually make, and it
              is structural rather than anybody's mistake. */}
          {r.status === "submitted" || r.photos.length > 0 ? (
            <div className="mt-3">
              <div className="text-xs font-semibold text-bookvuk-navy">Photos of your copy</div>
              <div className="mt-2">
                <PhotoUploader
                  photos={r.photos.map((p) => ({
                    id: p.id,
                    url: p.url,
                    label: PHOTO_LABELS[p.kind] ?? "Photo",
                  }))}
                  max={4}
                  busy={busy}
                  kindLabel={PHOTO_LABELS[kind]}
                  onAdd={r.status === "submitted" ? (file) => onAddPhoto(file, kind) : undefined}
                  onRemove={r.status === "submitted" ? onRemovePhoto : undefined}
                  hint="Cover, spine, and anything worn. Photos let us confirm the grade before you post it, so the amount does not change later."
                />
              </div>
            </div>
          ) : null}

          {r.status === "approved" ? (
            r.dispatchedAt ? (
              <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
                <span className="font-semibold">You posted this on {fmtDate(r.dispatchedAt)}.</span>
                {r.trackingNumber ? (
                  <>
                    {" "}
                    {r.trackingCarrierLabel} {r.trackingNumber}
                    {r.trackingUrl ? (
                      <>
                        {" · "}
                        <a
                          href={r.trackingUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="font-semibold underline"
                        >
                          Track it
                        </a>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : (
              <DispatchForm
                carriers={carriers}
                draft={draft}
                onField={onDispatchField}
                onSubmit={onMarkPosted}
                busy={busy}
              />
            )
          ) : null}

          {/* A changed grade changes the money, so it is stated rather than left
              for the seller to notice from the number. */}
          {regraded ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              We graded it <strong>{CONDITION_LABELS[r.receivedCondition!]}</strong> rather than{" "}
              {CONDITION_LABELS[r.condition]}, so the amount changed from{" "}
              {formatPrice(r.quotedAmount)} to {formatPrice(amount)}.
            </p>
          ) : null}
          {r.rejectionReason ? (
            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-800">
              {r.rejectionReason}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <div className="text-lg font-extrabold tabular-nums text-bookvuk-navy">
            {formatPrice(amount)}
          </div>
          <div className="text-xs text-bookvuk-muted">
            {r.status === "paid"
              ? r.payoutMethod === "wallet"
                ? "paid as credit"
                : "sent to your UPI"
              : r.payoutMethod === "wallet"
                ? "as store credit"
                : "to your UPI"}
          </div>
          {["submitted", "approved"].includes(r.status) ? (
            <button
              type="button"
              onClick={onWithdraw}
              disabled={withdrawing}
              className="rounded-lg border border-bookvuk-border bg-white px-3 py-1.5 text-xs font-semibold text-bookvuk-muted transition hover:bg-zinc-50 disabled:opacity-60"
            >
              {withdrawing ? "Withdrawing…" : "Withdraw"}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
};

export default SellRequestCard;
