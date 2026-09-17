"use client";

/**
 * "Posted it? Tell us."
 *
 * `approved` used to be the whole story, so "awaiting arrival" covered both "in
 * the post" and "never sent" and neither side could find out which. Both fields
 * are optional — a seller who used the post office counter has no docket, and
 * refusing the update over a missing number would lose the one fact that
 * matters.
 */

import type { Carrier } from "../../api/publicCarriers";
import type { DispatchDraft } from "./types";

type DispatchFormProps = {
  carriers: Carrier[];
  draft: DispatchDraft | undefined;
  onField: (field: keyof DispatchDraft, value: string) => void;
  onSubmit: () => void;
  busy: boolean;
};

const DispatchForm = ({ carriers, draft, onField, onSubmit, busy }: DispatchFormProps) => (
  <div className="mt-2 rounded-lg border border-bookvuk-border px-3 py-2.5">
    <div className="text-xs font-semibold text-bookvuk-navy">Posted it? Tell us.</div>
    <p className="mt-0.5 text-xs text-bookvuk-muted">
      Then we know to expect it — and you can stop wondering whether we got it.
    </p>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select
        value={draft?.carrier ?? ""}
        onChange={(e) => onField("carrier", e.target.value)}
        className="rounded-lg border border-bookvuk-border px-2 py-1.5 text-xs text-bookvuk-navy"
        aria-label="Courier"
      >
        <option value="">Courier (optional)</option>
        {carriers.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        value={draft?.number ?? ""}
        onChange={(e) => onField("number", e.target.value)}
        placeholder="Consignment number"
        aria-label="Consignment number"
        className="min-w-[10rem] flex-1 rounded-lg border border-bookvuk-border px-2 py-1.5 text-xs text-bookvuk-navy"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy}
        className="rounded-lg bg-bookvuk-purple px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "I have posted it"}
      </button>
    </div>
    <p className="mt-1.5 text-[11px] text-bookvuk-muted">
      No docket? Leave both blank — telling us it is on its way still helps.
    </p>
  </div>
);

export default DispatchForm;
