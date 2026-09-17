"use client";

/**
 * A confirmation step for something that cannot be undone.
 *
 * Not `window.confirm`: that dialog cannot say *what* is about to go, which is
 * the only part that matters. "Delete this book?" and "Delete 'गोदान' — it
 * appears in 3 past orders" are different questions, and only the second one can
 * actually be answered.
 *
 * Deliberately not used for everything. A confirm on a reversible action trains
 * people to click through confirms, which is how the irreversible one gets
 * clicked through too.
 */

import Modal from "./Modal";
import Button from "./Button";

type ConfirmDialogProps = {
  open: boolean;
  /** What is about to happen, as a question. */
  title: string;
  /** The specific thing at stake — the name, the count, what else it touches. */
  body?: React.ReactNode;
  /** Says what will happen, not "OK". */
  confirmLabel?: string;
  /** Destructive by default; this is what the component is for. */
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmDialog = ({
  open,
  title,
  body,
  confirmLabel = "Delete",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <Modal isOpen={open} onClose={onCancel} panelClassName="max-w-md">
    <div className="p-6">
      <h2 className="text-lg font-bold text-bookvuk-navy">{title}</h2>
      {body ? <div className="mt-2 text-sm text-bookvuk-muted">{body}</div> : null}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {/* Cancel first in the DOM so it takes focus, and last visually on wide
            screens: the safe choice should be the easy one to reach and the hard
            one to hit by accident. */}
        <Button variant="secondary" radius="lg" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant={tone} radius="lg" onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </div>
  </Modal>
);

export default ConfirmDialog;
