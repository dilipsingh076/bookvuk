"use client";

/** One rule: what it does, where its value came from, and the box to change it. */

import { Input } from "../../../components/ui";
import type { SettingField } from "./types";

type SettingRowProps = {
  field: SettingField;
  /** Whether somebody set this here, as opposed to it coming from deployment. */
  overridden: boolean;
  value: string;
  onValue: (value: string) => void;
  cod: boolean | null;
  onCod: (on: boolean) => void;
  onClearOverride: () => void;
  busy: boolean;
};

const SettingRow = ({
  field: f,
  overridden,
  value,
  onValue,
  cod,
  onCod,
  onClearOverride,
  busy,
}: SettingRowProps) => (
  <div className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-6">
    <div className="min-w-0">
      <label
        htmlFor={`set-${f.key}`}
        className="flex flex-wrap items-center gap-2 text-sm font-semibold text-bookvuk-navy"
      >
        {f.label}
        {/* A default nobody chose and a decision somebody made must not look
            the same. */}
        {overridden ? (
          <span className="inline-flex items-center rounded-full bg-bookvuk-lilac px-2 py-0.5 text-[11px] font-semibold text-bookvuk-purple">
            set here
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-bookvuk-cream px-2 py-0.5 text-[11px] font-semibold text-bookvuk-muted">
            from deployment
          </span>
        )}
      </label>
      <p className="mt-1 max-w-xl text-sm text-bookvuk-muted">{f.help}</p>
      {overridden ? (
        <button
          type="button"
          disabled={busy}
          onClick={onClearOverride}
          className="mt-1.5 text-xs font-semibold text-bookvuk-purple hover:underline disabled:opacity-60"
        >
          Reset to the deployment value
        </button>
      ) : null}
    </div>

    <div className="flex items-center gap-2 sm:justify-end">
      {f.kind === "toggle" ? (
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-bookvuk-navy">
          <input
            id={`set-${f.key}`}
            type="checkbox"
            checked={Boolean(cod)}
            onChange={(e) => onCod(e.target.checked)}
            className="h-4 w-4 accent-bookvuk-purple"
          />
          {cod ? "Offered at checkout" : "Not offered"}
        </label>
      ) : (
        <>
          {f.unit === "₹" ? <span className="text-sm text-bookvuk-muted">₹</span> : null}
          <Input
            id={`set-${f.key}`}
            type="number"
            min={0}
            step={f.kind === "percent" ? 0.5 : 1}
            value={value}
            onChange={(e) => onValue(e.target.value)}
            className="w-32 rounded-lg border-gray-200 px-3 py-2 text-right tabular-nums"
          />
          {f.unit === "%" ? <span className="text-sm text-bookvuk-muted">%</span> : null}
        </>
      )}
    </div>
  </div>
);

export default SettingRow;
