"use client";

/**
 * Books you have offered the shop, and the credit they earned.
 */

import Link from "next/link";
import { Alert, ButtonLink, PageHeader } from "../../components/ui";
import { Skeleton } from "../../components/ui/Skeleton";
import CreditSummary from "./CreditSummary";
import SellRequestCard from "./SellRequestCard";
import { useSellRequests } from "./useSellRequests";

const SellRequests = () => {
  const s = useSellRequests();

  return (
    <div className="pb-20 pt-8">
      <PageHeader
        title="Books you are selling"
        description="Everything you have offered us, and what happens next."
        offsetTitle={false}
        descriptionSize="sm"
        gap="sm"
        actions={
          // `justify-start` keeps the label where it is today: on mobile this
          // button stretches to full width and its text sits at the left padding.
          // Centring it is a one-word change, but a visible one.
          <ButtonLink
            href="/sell"
            variant="primary-fade"
            size="lg"
            radius="xl"
            className="shrink-0 justify-start"
          >
            Sell another book
          </ButtonLink>
        }
      />

      <CreditSummary wallet={s.wallet} loading={s.loading} />

      {s.error ? (
        <Alert tone="error" className="mt-6">
          {s.error}
        </Alert>
      ) : null}

      {s.loading ? (
        <ul className="mt-8 space-y-4" aria-busy="true">
          {[0, 1].map((i) => (
            <li key={i} className="rounded-3xl border border-bookvuk-border/80 bg-white p-5 sm:p-6">
              <div className="space-y-2.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
                <Skeleton className="h-3 w-40" />
              </div>
            </li>
          ))}
        </ul>
      ) : s.requests.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-bookvuk-border/80 bg-white p-8 text-center">
          <p className="text-sm text-bookvuk-muted">You have not offered us any books yet.</p>
          <Link
            href="/sell"
            className="mt-4 inline-block text-sm font-semibold text-bookvuk-purple hover:underline"
          >
            See what your books are worth →
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {s.requests.map((r) => (
            <SellRequestCard
              key={r.id}
              request={r}
              shipTo={s.shipTo}
              carriers={s.carriers}
              draft={s.dispatchForm[r.id]}
              onDispatchField={(field, value) => s.setDispatchField(r.id, field, value)}
              onMarkPosted={() => s.markPosted(r.id)}
              onAddPhoto={(file, kind) => s.addPhoto(r.id, file, kind)}
              onRemovePhoto={(photoId) => s.dropPhoto(r.id, photoId)}
              onWithdraw={() => s.withdraw(r.id)}
              busy={s.working === r.id}
              withdrawing={s.cancelling === r.id}
            />
          ))}
        </ul>
      )}

      {s.meta && s.meta.pages > 1 ? (
        <div className="mt-6 flex items-center justify-between gap-3 text-sm">
          <div className="tabular-nums text-bookvuk-muted">
            Page {s.meta.page} of {s.meta.pages} · {s.meta.total} books offered
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={s.meta.page <= 1 || s.loading}
              onClick={s.prevPage}
              className="rounded-lg border border-bookvuk-border px-3 py-1.5 text-xs font-semibold text-bookvuk-navy disabled:opacity-50"
            >
              Newer
            </button>
            <button
              type="button"
              disabled={s.meta.page >= s.meta.pages || s.loading}
              onClick={s.nextPage}
              className="rounded-lg border border-bookvuk-border px-3 py-1.5 text-xs font-semibold text-bookvuk-navy disabled:opacity-50"
            >
              Older
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SellRequests;
