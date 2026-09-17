"use client";

/**
 * The form that turns "mark it shipped" into a shipment.
 *
 * Marking an order shipped used to be one option in a dropdown, and that was the
 * entire record: the customer got an e-mail saying something had left, with no
 * courier and no consignment number, and the reply was a support message asking
 * where it is. Asking for the parcel at the moment it is dispatched is the only
 * point at which whoever packed it still has the label in their hand.
 *
 * The courier list comes from the server, which is what actually validates it.
 * A copy here would drift into a dropdown offering couriers every save rejects.
 */

import { useEffect, useState } from "react";
import { Button, Input, Modal, Select } from "../ui";
import { listCarriers, type Carrier } from "../../api/admin";

type ShipDialogProps = {
  open: boolean;
  /** Shown in the heading so it is obvious which parcel is being recorded. */
  orderLabel: string;
  /** Pre-fills when correcting a shipment rather than creating one. */
  initialCarrier?: string | null;
  initialNumber?: string | null;
  /** "Mark shipped" the first time; "Save" when fixing a number afterwards. */
  mode: "ship" | "edit";
  busy?: boolean;
  error?: string | null;
  onSubmit: (tracking: { carrier: string; number: string }) => void;
  /** Only offered in edit mode: the parcel turned out not to have gone. */
  onClear?: () => void;
  onCancel: () => void;
};

const ShipDialog = ({
  open,
  orderLabel,
  initialCarrier,
  initialNumber,
  mode,
  busy = false,
  error,
  onSubmit,
  onClear,
  onCancel,
}: ShipDialogProps) => {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [carrier, setCarrier] = useState(initialCarrier ?? "");
  const [number, setNumber] = useState(initialNumber ?? "");

  useEffect(() => {
    if (!open) return;
    // Reset from props on open rather than on mount: the dialog instance is
    // reused for the next order, and a stale consignment number pre-filled from
    // the previous one is the worst possible default here.
    setCarrier(initialCarrier ?? "");
    setNumber(initialNumber ?? "");
  }, [open, initialCarrier, initialNumber]);

  useEffect(() => {
    if (!open || carriers.length) return;
    listCarriers()
      .then(setCarriers)
      // A failed list is not a reason to block the dispatch: the field below
      // stays empty and the admin is told, rather than being handed a dialog
      // that cannot be completed.
      .catch(() => setCarriers([]));
  }, [open, carriers.length]);

  const ready = carrier.trim() !== "" && number.trim() !== "";

  return (
    <Modal isOpen={open} onClose={onCancel} panelClassName="max-w-md">
      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !busy) onSubmit({ carrier, number: number.trim() });
        }}
      >
        <h2 className="text-lg font-bold text-bookvuk-navy">
          {mode === "ship" ? "Mark shipped" : "Edit the shipment"}
        </h2>
        <div className="mt-1 text-sm text-bookvuk-muted">
          {mode === "ship" ? (
            <>
              Order {orderLabel}. The courier and number go out to the customer, so
              they can follow the parcel themselves.
            </>
          ) : (
            <>Order {orderLabel}. Correcting this does not e-mail the customer again.</>
          )}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <label className="mt-4 block text-sm font-semibold text-bookvuk-navy" htmlFor="ship-carrier">
          Courier
        </label>
        <Select
          id="ship-carrier"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          disabled={busy}
          className="mt-1"
        >
          <option value="">Choose a courier…</option>
          {carriers.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </Select>
        {carriers.length === 0 ? (
          <div className="mt-1 text-xs text-bookvuk-muted">
            Could not load the courier list. Reopen this dialog to try again.
          </div>
        ) : null}

        <label className="mt-4 block text-sm font-semibold text-bookvuk-navy" htmlFor="ship-number">
          Consignment number
        </label>
        <Input
          id="ship-number"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          disabled={busy}
          placeholder="As printed on the label"
          className="mt-1 rounded-lg border-gray-200 px-3 py-2"
        />
        <div className="mt-1 text-xs text-bookvuk-muted">
          Spaces and case do not matter — they are tidied up on save.
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" radius="lg" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          {mode === "edit" && onClear ? (
            <Button
              type="button"
              variant="secondary"
              radius="lg"
              onClick={onClear}
              disabled={busy}
            >
              It never went
            </Button>
          ) : null}
          <Button type="submit" variant="primary" radius="lg" disabled={!ready || busy}>
            {busy ? "Saving…" : mode === "ship" ? "Mark shipped" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ShipDialog;
