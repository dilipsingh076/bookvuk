"use client";

/** The commerce rules, editable without a deploy. */

import { Button, LoaderBlock } from "../../../components/ui";
import SamplePricing from "./SamplePricing";
import SettingRow from "./SettingRow";
import { useStoreSettings } from "./useStoreSettings";
import { FIELDS } from "./types";

const StoreSettingsView = () => {
  const s = useStoreSettings();

  return (
    <div className="space-y-6 py-8">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-bookvuk-navy">Store settings</h1>
            <p className="mt-1 max-w-2xl text-sm text-bookvuk-muted">
              What the shop charges. Changes take effect within a few seconds — no deploy. Keys, the
              database and gateway credentials are not here and cannot be changed from a browser.
            </p>
          </div>
          {s.data?.updated_by ? (
            <div className="shrink-0 text-xs text-bookvuk-muted">
              Last changed by{" "}
              <span className="font-semibold text-bookvuk-navy">{s.data.updated_by}</span>
              {s.data.updated_at ? (
                <>
                  <br />
                  {new Date(s.data.updated_at).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {s.loading ? (
          <LoaderBlock size="md" height="panel" caption="Loading settings…" />
        ) : s.loadError ? (
          <div className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
            {(s.loadError as { message?: string } | undefined)?.message ||
              "Failed to load settings"}
          </div>
        ) : (
          <>
            {s.error ? (
              <div className="mt-5 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                {s.error}
              </div>
            ) : null}
            {s.saved && !s.dirty ? (
              <div className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                Saved. New orders use these figures from now on.
              </div>
            ) : null}

            <div className="mt-6 divide-y divide-bookvuk-border">
              {FIELDS.map((f) => (
                <SettingRow
                  key={f.key}
                  field={f}
                  overridden={s.isOverridden(f.key)}
                  value={s.draft[f.key] ?? ""}
                  onValue={(value) => s.setDraftField(f.key, value)}
                  cod={s.cod}
                  onCod={s.setCod}
                  onClearOverride={() => s.clearOverride(f.key)}
                  busy={s.busy}
                />
              ))}
            </div>

            {s.data ? <SamplePricing preview={s.preview} /> : null}

            <div className="mt-6 flex items-center gap-3">
              <Button
                variant="primary"
                radius="lg"
                disabled={s.busy || !s.dirty}
                onClick={s.save}
              >
                {s.busy ? "Saving…" : "Save changes"}
              </Button>
              {s.dirty ? <span className="text-sm text-bookvuk-muted">Unsaved changes.</span> : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StoreSettingsView;
