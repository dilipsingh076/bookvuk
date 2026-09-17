"use client";

/**
 * Raising and following a return, from the order it belongs to.
 *
 * Put here rather than on its own page because that is where somebody is when
 * they realise there is a problem: they have opened the order to look at what
 * arrived. A separate "returns" section would mean finding the order, leaving
 * it, and identifying it again from a list.
 */

import { useCallback, useEffect, useState } from "react";
import {
  RETURN_REASON_LABELS,
  fetchMyReturns,
  openReturn,
  uploadReturnPhoto,
  withdrawReturn,
  type ReturnReason,
  type ReturnRequest,
} from "../api/returns";
import { useAuth } from "../context/AuthContext";
import { formatPrice } from "../utils/formatPrice";
import { Alert, Button, Select, Textarea } from "./ui";
import PhotoUploader from "./PhotoUploader";

type ReturnPanelItem = {
  /** `order_items.id` — the claim is against one line, not the order. */
  id: string;
  title: string;
};

type ReturnPanelProps = {
  orderId: string;
  /** Lines on this order, so a claim can name which book. */
  items: ReturnPanelItem[];
  /** Returns only open on a delivered order; before that, cancelling is the move. */
  delivered: boolean;
};

const STATUS_COPY: Record<string, { label: string; className: string; note: string }> = {
  requested: {
    label: "With us",
    className: "bg-amber-50 text-amber-900 ring-amber-200/80",
    note: "We are looking at it. Adding a photo helps us decide faster.",
  },
  approved: {
    label: "Accepted",
    className: "bg-sky-50 text-sky-800 ring-sky-200/80",
    note: "We have accepted it. The refund is next.",
  },
  rejected: {
    label: "Declined",
    className: "bg-rose-50 text-rose-700 ring-rose-200/80",
    note: "",
  },
  refunded: {
    label: "Refunded",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
    note: "",
  },
};

const RESOLUTION_COPY: Record<string, string> = {
  wallet: "added to your store credit",
  source: "sent back the way you paid",
  replacement: "a replacement is on its way",
  none: "closed with nothing owed",
};

const ReturnPanel = ({ orderId, items, delivered }: ReturnPanelProps) => {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [reason, setReason] = useState<ReturnReason>("damaged");
  const [detail, setDetail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchMyReturns(getToken());
      setRows(all.filter((r) => r.orderId === orderId));
    } catch {
      // A returns list that cannot load must not take the order page with it —
      // the order itself is what the visitor came for.
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = (updated: ReturnRequest) =>
    setRows((prev) => {
      const seen = prev.some((r) => r.id === updated.id);
      return seen ? prev.map((r) => (r.id === updated.id ? updated : r)) : [updated, ...prev];
    });

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      replace(await openReturn(getToken(), { orderItemId: itemId, reason, detail: detail || undefined }));
      setOpen(false);
      setDetail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open that return");
    } finally {
      setBusy(false);
    }
  };

  const addPhoto = async (id: string, file: File) => {
    setBusy(true);
    setError(null);
    try {
      replace(await uploadReturnPhoto(getToken(), id, file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload that photo");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      replace(await withdrawReturn(getToken(), id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not withdraw that return");
    } finally {
      setBusy(false);
    }
  };

  // Lines that already have a live claim cannot take another, so offering them
  // again would only produce a 409 the customer has to interpret.
  const claimed = new Set(
    rows.filter((r) => r.status === "requested" || r.status === "approved").map((r) => r.orderItemId),
  );
  const claimable = items.filter((i) => !claimed.has(i.id));

  /* Keep the chosen item among the ones that can still be claimed.
   *
   * `itemId` was set once from `items[0]` and never reconciled. On a two-book
   * order with one claim already open, the dropdown listed only the second book
   * while the state still held the first — so submitting sent the *claimed* id
   * and the server answered "you already have an open return for this item"
   * about a book the customer had not selected. */
  useEffect(() => {
    if (claimable.length === 0) return;
    if (!claimable.some((i) => i.id === itemId)) setItemId(claimable[0].id);
  }, [claimable, itemId]);

  if (!delivered && rows.length === 0) return null;
  if (loading) return null;

  return (
    <section className="mt-6 rounded-3xl border border-bookvuk-border/80 bg-white p-6 shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.04] sm:p-8">
      <h2 className="text-lg font-bold text-bookvuk-navy">Something wrong with it?</h2>

      {error ? (
        <Alert tone="error" className="mt-3">
          {error}
        </Alert>
      ) : null}

      {rows.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => {
            const st = STATUS_COPY[r.status] ?? STATUS_COPY.requested;
            return (
              <li key={r.id} className="rounded-2xl border border-bookvuk-border/80 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-bookvuk-navy">{r.bookTitle}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${st.className}`}
                  >
                    {st.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-bookvuk-muted">
                  {RETURN_REASON_LABELS[r.reason]}
                  {r.detail ? ` — ${r.detail}` : ""}
                </p>
                {st.note ? (
                  <p className="mt-1.5 text-sm text-bookvuk-navy/80">{st.note}</p>
                ) : null}
                {r.rejectionReason ? (
                  <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-800">
                    {r.rejectionReason}
                  </p>
                ) : null}
                {r.status === "refunded" && r.resolution ? (
                  <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
                    {r.refundAmount ? `${formatPrice(r.refundAmount)} ` : ""}
                    {RESOLUTION_COPY[r.resolution]}.
                  </p>
                ) : null}

                <div className="mt-3">
                  <PhotoUploader
                    photos={r.photos.map((p) => ({ id: p.id, url: p.url }))}
                    max={4}
                    busy={busy}
                    kindLabel="Add photo"
                    onAdd={r.status === "requested" ? (f) => addPhoto(r.id, f) : undefined}
                    hint="A photo of the damage is the fastest way for us to say yes."
                  />
                </div>

                {r.status === "requested" ? (
                  <button
                    type="button"
                    onClick={() => withdraw(r.id)}
                    disabled={busy}
                    className="mt-3 rounded-lg border border-bookvuk-border px-3 py-1.5 text-xs font-semibold text-bookvuk-muted hover:bg-zinc-50 disabled:opacity-60"
                  >
                    Never mind, withdraw it
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {delivered && claimable.length > 0 ? (
        open ? (
          <div className="mt-4 rounded-2xl border border-bookvuk-border/80 p-4">
            <label className="block text-sm font-semibold text-bookvuk-navy" htmlFor="ret-item">
              Which book?
            </label>
            <Select
              id="ret-item"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="mt-1"
            >
              {claimable.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </Select>

            <label className="mt-4 block text-sm font-semibold text-bookvuk-navy" htmlFor="ret-reason">
              What went wrong?
            </label>
            <Select
              id="ret-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReturnReason)}
              className="mt-1"
            >
              {(Object.keys(RETURN_REASON_LABELS) as ReturnReason[]).map((k) => (
                <option key={k} value={k}>
                  {RETURN_REASON_LABELS[k]}
                </option>
              ))}
            </Select>

            <label className="mt-4 block text-sm font-semibold text-bookvuk-navy" htmlFor="ret-detail">
              Tell us a little more{reason === "other" ? "" : " (optional)"}
            </label>
            <Textarea
              id="ret-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              className="mt-1"
              placeholder="The spine was cracked when the parcel arrived."
            />

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" radius="lg" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="primary"
                radius="lg"
                onClick={submit}
                disabled={busy || !itemId || (reason === "other" && !detail.trim())}
              >
                {busy ? "Sending…" : "Raise a return"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <Button variant="secondary" radius="xl" onClick={() => setOpen(true)}>
              Raise a return
            </Button>
            <p className="mt-2 text-xs text-bookvuk-muted">
              Within 14 days of delivery. Photos help — we can usually decide the same day.
            </p>
          </div>
        )
      ) : null}
    </section>
  );
};

export default ReturnPanel;
