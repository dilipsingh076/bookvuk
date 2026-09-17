"use client";

/**
 * One claim, and the action its stage allows.
 *
 * The photographs come first: the argument about a damage claim is visual, and
 * deciding it from the written reason is how a shop refunds things it should not
 * and refuses things it should.
 */

import PhotoUploader from "../../../components/PhotoUploader";
import { Button, Input, Select, Textarea } from "../../../components/ui";
import { RETURN_REASON_LABELS, type ReturnReason } from "../../../api/returns";
import type { AdminReturn } from "../../../api/admin";
import { RESOLUTION_HELP, formatMoney, formatWhen, type Resolution } from "./types";
import type { UseReturns } from "./useReturns";

type ReturnDetailProps = {
  detail: AdminReturn;
  q: UseReturns;
};

const ReturnDetail = ({ detail, q }: ReturnDetailProps) => {
  const timeline: Array<[string, string | null]> = [
    ["Raised", detail.created_at],
    ["Decided", detail.decided_at],
    ["Resolved", detail.resolved_at],
  ];

  return (
    <div className="space-y-5 p-6">
      {q.actionError ? (
        <div className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {q.actionError}
        </div>
      ) : null}

      {detail.photos.length > 0 ? (
        <PhotoUploader
          photos={detail.photos.map((p) => ({ id: p.id, url: p.url }))}
          max={detail.photos.length}
        />
      ) : (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          No photo. You are deciding this on the description alone.
        </div>
      )}

      {/* An order can reach `delivered` without ever being paid for, and
          refunding one sends out money that never came in. The server refuses
          the money either way; this is so the admin knows why before they try. */}
      {detail.order_payment_status && detail.order_payment_status !== "paid" ? (
        <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
          <span className="font-semibold">This order was never paid for</span> — payment is{" "}
          {detail.order_payment_status}
          {detail.order_payment_method === "cod" ? " (cash on delivery)" : ""}. There is nothing to
          refund. A replacement, or closing it with nothing owed, still works.
        </div>
      ) : null}

      <div className="rounded-xl bg-bookvuk-lilac p-4">
        <div className="text-sm font-semibold text-bookvuk-navy">
          {RETURN_REASON_LABELS[detail.reason as ReturnReason] ?? detail.reason}
        </div>
        {detail.detail ? (
          <p className="mt-2 rounded-lg bg-white p-2 text-sm text-bookvuk-navy">
            “{detail.detail}”
          </p>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-1 text-sm">
          <span className="text-bookvuk-muted">Quantity</span>
          <span className="text-right text-bookvuk-navy">{detail.quantity}</span>
          <span className="text-bookvuk-muted">Line total</span>
          <span className="text-right tabular-nums font-semibold text-bookvuk-navy">
            {formatMoney(detail.line_total)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-bookvuk-muted">
        {timeline
          .filter(([, when]) => Boolean(when))
          .map(([label, when]) => (
            <span key={label}>
              <span className="font-semibold text-bookvuk-navy">{label}</span>{" "}
              {formatWhen(when)}
            </span>
          ))}
      </div>

      {/* Stage one: accept or refuse. Deliberately moves no money. */}
      {detail.status === "requested" ? (
        <div className="space-y-3 border-t border-bookvuk-border pt-4">
          <Button
            variant="primary"
            radius="lg"
            disabled={q.busy}
            onClick={() => q.accept(detail.id)}
          >
            {q.busy ? "Working…" : "Accept the return"}
          </Button>
          <div>
            <Textarea
              value={q.rejectReason}
              onChange={(e) => q.setRejectReason(e.target.value)}
              rows={2}
              placeholder="Why you cannot accept it — the customer reads this"
            />
            <Button
              className="mt-2"
              variant="danger"
              size="sm"
              radius="lg"
              disabled={q.busy || !q.rejectReason.trim()}
              onClick={() => q.decline(detail.id)}
            >
              Decline
            </Button>
            {/* The server refuses a rejection with no reason, so the button says
                so rather than letting it 422. */}
            <span className="ml-2 text-xs text-bookvuk-muted">A reason is required.</span>
          </div>
        </div>
      ) : null}

      {/* Stage two: pay it, and say how. */}
      {detail.status === "approved" ? (
        <div className="space-y-3 border-t border-bookvuk-border pt-4">
          <label className="block text-sm font-semibold text-bookvuk-navy" htmlFor="res">
            How was it settled?
          </label>
          <Select
            id="res"
            value={q.resolution}
            onChange={(e) => q.setResolution(e.target.value as Resolution)}
          >
            {detail.order_payment_status === "paid" ? (
              <>
                <option value="wallet">Store credit</option>
                <option value="source">Back to how they paid</option>
              </>
            ) : null}
            <option value="replacement">Send a replacement</option>
            <option value="none">Nothing owed</option>
          </Select>
          <p className="text-xs text-bookvuk-muted">{RESOLUTION_HELP[q.resolution]}</p>

          {q.resolution === "wallet" || q.resolution === "source" ? (
            <div>
              <label className="block text-sm font-semibold text-bookvuk-navy" htmlFor="amt">
                Amount
              </label>
              <Input
                id="amt"
                type="number"
                min={0}
                value={q.amount}
                onChange={(e) => q.setAmount(e.target.value)}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-bookvuk-muted">
                Defaults to the whole line ({formatMoney(detail.line_total)}).
              </p>
            </div>
          ) : null}

          <Button
            variant="primary"
            radius="lg"
            disabled={q.busy}
            onClick={() => q.resolve(detail.id)}
          >
            {q.busy ? "Working…" : "Mark resolved"}
          </Button>
        </div>
      ) : null}

      {detail.status === "refunded" || detail.status === "rejected" ? (
        <div className="border-t border-bookvuk-border pt-4 text-sm text-bookvuk-muted">
          This return is <span className="font-semibold">{detail.status}</span> and can no longer be
          changed.
          {detail.rejection_reason ? (
            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {detail.rejection_reason}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default ReturnDetail;
