"use client";

/**
 * The action for whichever stage this request is at.
 *
 * Exactly one of these renders. Offering a later stage's action early is how a
 * shop pays for a book it has not seen.
 */

import {
  CONDITION_LABELS,
  isTerminalBuyback,
  needsCatalogueParent,
  type AdminBuyback,
} from "../../../api/admin";
import { Button, Input } from "../../../components/ui";
import { GRADES, formatMoney, quoteAt } from "./types";
import type { UseBuyback } from "./useBuyback";

type BuybackActionsProps = {
  detail: AdminBuyback;
  queue: UseBuyback;
};

const BuybackActions = ({ detail, queue: q }: BuybackActionsProps) => (
  <>
    {detail.status === "submitted" ? (
      <div className="rounded-xl border border-bookvuk-border p-4">
        <div className="text-sm font-semibold text-bookvuk-navy">Decide</div>
        <p className="mt-1 text-sm text-bookvuk-muted">
          Approving tells the seller to post the book. Nothing is paid until it arrives and is
          graded.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            radius="lg"
            disabled={q.busy}
            onClick={() => q.approve(detail.id)}
          >
            {q.busy ? "Working…" : `Approve · ${formatMoney(detail.quoted_amount)}`}
          </Button>
        </div>
        <div className="mt-4 border-t border-bookvuk-border pt-3">
          {/* The server refuses a rejection with no reason, so the seller never
              gets a silent no. The form asks for it rather than surfacing that
              refusal as an error. */}
          <label htmlFor="reject-reason" className="text-xs font-semibold text-bookvuk-navy">
            Reason for rejecting — the seller sees this
          </label>
          <Input
            id="reject-reason"
            value={q.rejectReason}
            onChange={(e) => q.setRejectReason(e.target.value)}
            placeholder="e.g. we already hold enough copies of this title"
            className="mt-1.5 rounded-lg border-gray-200 px-3 py-2"
          />
          <Button
            variant="danger"
            size="sm"
            radius="lg"
            className="mt-2"
            disabled={q.busy || !q.rejectReason.trim()}
            onClick={() => q.reject(detail.id)}
          >
            Reject
          </Button>
        </div>
      </div>
    ) : null}

    {detail.status === "approved" ? (
      <div className="rounded-xl border border-bookvuk-border p-4">
        <div className="text-sm font-semibold text-bookvuk-navy">Grade what arrived</div>
        <p className="mt-1 text-sm text-bookvuk-muted">
          The seller claimed{" "}
          <span className="font-semibold text-bookvuk-navy">
            {CONDITION_LABELS[detail.condition]}
          </span>
          . Grade the copy in front of you — a downgrade lowers the payout, and the seller is told
          the new figure.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {GRADES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => q.setGrade(c)}
              aria-pressed={q.grade === c}
              className={`rounded-xl border p-3 text-left transition ${
                q.grade === c
                  ? "border-bookvuk-purple bg-bookvuk-lilac"
                  : "border-bookvuk-border bg-white hover:bg-bookvuk-cream"
              }`}
            >
              <span className="block text-sm font-semibold text-bookvuk-navy">
                {CONDITION_LABELS[c]}
              </span>
              {/* The cost of the grade, before it is committed. */}
              <span className="mt-0.5 block text-sm tabular-nums text-bookvuk-muted">
                {formatMoney(quoteAt(detail, c))}
              </span>
            </button>
          ))}
        </div>
        {q.grade !== detail.condition ? (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Payout changes from {formatMoney(detail.quoted_amount)} to{" "}
            <span className="font-semibold">{formatMoney(quoteAt(detail, q.grade))}</span>.
          </div>
        ) : null}
        <Button
          variant="primary"
          size="sm"
          radius="lg"
          className="mt-3"
          disabled={q.busy}
          onClick={() => q.receive(detail.id)}
        >
          {q.busy ? "Working…" : "Record as received"}
        </Button>
      </div>
    ) : null}

    {detail.status === "received" ? (
      <div className="rounded-xl border border-bookvuk-border p-4">
        <div className="text-sm font-semibold text-bookvuk-navy">
          Pay {formatMoney(detail.final_amount ?? detail.quoted_amount)}
        </div>
        <p className="mt-1 text-sm text-bookvuk-muted">
          Credits the seller&rsquo;s wallet and puts the copy on the shelf.
        </p>

        <label htmlFor="payout-ref" className="mt-3 block text-xs font-semibold text-bookvuk-navy">
          Payout reference — the UTR is the proof the money moved
        </label>
        <Input
          id="payout-ref"
          value={q.payoutRef}
          onChange={(e) => q.setPayoutRef(e.target.value)}
          placeholder="UTR / transaction id"
          className="mt-1.5 rounded-lg border-gray-200 px-3 py-2"
        />

        {needsCatalogueParent(detail) ? (
          <>
            <label
              htmlFor="parent-book"
              className="mt-3 block text-xs font-semibold text-bookvuk-navy"
            >
              Catalogue title to file this copy under — required
            </label>
            <Input
              id="parent-book"
              value={q.parentBookId}
              onChange={(e) => q.setParentBookId(e.target.value)}
              placeholder="Book id from the Books screen"
              className="mt-1.5 rounded-lg border-gray-200 px-3 py-2"
            />
            <p className="mt-1 text-xs text-bookvuk-muted">
              The seller typed this book in by hand, so it has no catalogue row yet. A used copy
              without a parent is a listing nothing can find.
            </p>
          </>
        ) : null}

        <Button
          variant="primary"
          size="sm"
          radius="lg"
          className="mt-3"
          disabled={q.busy || (needsCatalogueParent(detail) && !q.parentBookId.trim())}
          onClick={() => q.pay(detail.id)}
        >
          {q.busy ? "Working…" : "Pay and shelve"}
        </Button>
      </div>
    ) : null}

    {isTerminalBuyback(detail.status) ? (
      <div className="rounded-xl bg-bookvuk-cream p-4 text-sm text-bookvuk-muted">
        This request is <span className="font-semibold">{detail.status}</span> and can no longer be
        changed.
        {detail.rejection_reason ? (
          <div className="mt-2 text-bookvuk-navy">Reason given: {detail.rejection_reason}</div>
        ) : null}
        {detail.payout_reference ? (
          <div className="mt-2 text-bookvuk-navy">
            Paid with reference {detail.payout_reference}
          </div>
        ) : null}
      </div>
    ) : null}
  </>
);

export default BuybackActions;
