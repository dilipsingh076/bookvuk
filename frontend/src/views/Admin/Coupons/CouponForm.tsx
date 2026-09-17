"use client";

/**
 * A new code.
 *
 * Every limit is optional, and every one of them is a way to stop a code costing
 * more than intended — which is why each field says what happens without it
 * rather than only what it is.
 */

import { Button, Input, Select } from "../../../components/ui";
import type { UseCoupons } from "./useCoupons";

type CouponFormProps = Pick<UseCoupons, "form" | "set" | "busy" | "formError" | "submit">;

const CouponForm = ({ form, set, busy, formError, submit }: CouponFormProps) => (
  <form onSubmit={submit} className="rounded-2xl border bg-white p-6">
    <div className="text-lg font-bold text-bookvuk-navy">New code</div>
    <p className="mt-1 text-sm text-bookvuk-muted">
      Every limit below is optional, and every one of them is a way to stop a code costing more than
      you meant.
    </p>

    {formError ? (
      <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
        {formError}
      </div>
    ) : null}

    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block">
        <span className="text-xs font-semibold text-bookvuk-navy">Code</span>
        <Input
          required
          value={form.code}
          onChange={(e) => set("code", e.target.value)}
          placeholder="MONSOON20"
          className="mt-1.5 rounded-lg border-gray-200 px-3 py-2 font-mono uppercase"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-bookvuk-navy">Type</span>
        <Select
          value={form.discount_type}
          onChange={(e) => set("discount_type", e.target.value as "percent" | "fixed")}
          className="mt-1.5 rounded-lg border-gray-200 px-3 py-2"
        >
          <option value="percent">Percentage off</option>
          <option value="fixed">Fixed ₹ off</option>
        </Select>
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-bookvuk-navy">
          {form.discount_type === "percent" ? "Percent off" : "Rupees off"}
        </span>
        <Input
          required
          type="number"
          min={1}
          value={form.value}
          onChange={(e) => set("value", Number(e.target.value))}
          className="mt-1.5 rounded-lg border-gray-200 px-3 py-2"
        />
      </label>

      <label className="block sm:col-span-2 lg:col-span-3">
        <span className="text-xs font-semibold text-bookvuk-navy">
          Description — for you, not the shopper
        </span>
        <Input
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Monsoon sale, shared on Instagram"
          className="mt-1.5 rounded-lg border-gray-200 px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-bookvuk-navy">Minimum order (₹)</span>
        <Input
          type="number"
          min={0}
          value={form.min_subtotal ?? ""}
          onChange={(e) => set("min_subtotal", Number(e.target.value) || undefined)}
          placeholder="0"
          className="mt-1.5 rounded-lg border-gray-200 px-3 py-2"
        />
      </label>

      {form.discount_type === "percent" ? (
        <label className="block">
          <span className="text-xs font-semibold text-bookvuk-navy">Cap the discount (₹)</span>
          <Input
            type="number"
            min={1}
            value={form.max_discount ?? ""}
            onChange={(e) => set("max_discount", Number(e.target.value) || undefined)}
            placeholder="no cap"
            className="mt-1.5 rounded-lg border-gray-200 px-3 py-2"
          />
          {/* The one that bites: 20% off is unbounded until it isn't. */}
          <span className="mt-1 block text-xs text-bookvuk-muted">
            Without this, {Number(form.value) || 0}% comes off any order however large.
          </span>
        </label>
      ) : null}

      <label className="block">
        <span className="text-xs font-semibold text-bookvuk-navy">Total uses</span>
        <Input
          type="number"
          min={1}
          value={form.max_redemptions ?? ""}
          onChange={(e) => set("max_redemptions", Number(e.target.value) || undefined)}
          placeholder="unlimited"
          className="mt-1.5 rounded-lg border-gray-200 px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-bookvuk-navy">Starts</span>
        <Input
          type="date"
          value={form.starts_at?.slice(0, 10) ?? ""}
          onChange={(e) =>
            set("starts_at", e.target.value ? `${e.target.value}T00:00:00Z` : undefined)
          }
          className="mt-1.5 rounded-lg border-gray-200 px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-bookvuk-navy">Expires</span>
        <Input
          type="date"
          value={form.expires_at?.slice(0, 10) ?? ""}
          onChange={(e) =>
            set("expires_at", e.target.value ? `${e.target.value}T23:59:59Z` : undefined)
          }
          className="mt-1.5 rounded-lg border-gray-200 px-3 py-2"
        />
      </label>
    </div>

    <Button type="submit" variant="primary" radius="lg" className="mt-5" disabled={busy}>
      {busy ? "Creating…" : "Create code"}
    </Button>
  </form>
);

export default CouponForm;
