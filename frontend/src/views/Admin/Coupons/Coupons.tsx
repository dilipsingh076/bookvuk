"use client";

/**
 * Discount codes.
 *
 * The API and the checkout have both worked all along — one code sat in the
 * database, put there by hand — so this screen is not new capability, it is the
 * ability to see and change what is already live.
 */

import { ConfirmDialog, LoaderBlock } from "../../../components/ui";
import CouponForm from "./CouponForm";
import CouponRow from "./CouponRow";
import { useCoupons } from "./useCoupons";

const Coupons = () => {
  const c = useCoupons();
  const target = c.pendingDelete;

  return (
    <>
      <div className="space-y-6 py-8">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-extrabold text-bookvuk-navy">Discount codes</div>
              <div className="mt-1 text-sm text-bookvuk-muted">
                What shoppers can type at checkout, and what it costs you.
              </div>
            </div>
            <button
              type="button"
              onClick={c.refresh}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-bookvuk-navy"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-12 bg-bookvuk-lilac px-4 py-3 text-xs font-semibold text-bookvuk-muted">
              <div className="col-span-3">Code</div>
              <div className="col-span-2">Takes off</div>
              <div className="col-span-3">Conditions</div>
              <div className="col-span-2">Used</div>
              <div className="col-span-2">State</div>
            </div>
            <div className="divide-y bg-white">
              {c.loading ? (
                <LoaderBlock size="md" height="panel" caption="Loading codes…" />
              ) : c.error ? (
                <div className="px-4 py-6 text-sm text-rose-700">
                  {(c.error as { message?: string } | undefined)?.message || "Failed to load codes"}
                </div>
              ) : c.rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-bookvuk-muted">
                  No discount codes yet. Create one below.
                </div>
              ) : (
                c.rows.map((row) => (
                  <CouponRow key={row.id} coupon={row} onDelete={() => c.askDelete(row)} />
                ))
              )}
            </div>
          </div>
        </div>

        <CouponForm
          form={c.form}
          set={c.set}
          busy={c.busy}
          formError={c.formError}
          submit={c.submit}
        />
      </div>

      <ConfirmDialog
        open={!!target}
        title={`Delete ${target?.code}?`}
        body={
          target ? (
            <>
              {target.times_redeemed > 0 ? (
                <>
                  It has been used <strong>{target.times_redeemed}</strong>{" "}
                  {target.times_redeemed === 1 ? "time" : "times"}. Those orders keep the discount
                  they were given; the code simply stops working.
                </>
              ) : (
                <>It has never been used. Anyone who has the code will stop being able to use it.</>
              )}
            </>
          ) : null
        }
        confirmLabel="Delete code"
        busy={c.busy}
        onConfirm={c.confirmDelete}
        onCancel={c.cancelDelete}
      />
    </>
  );
};

export default Coupons;
