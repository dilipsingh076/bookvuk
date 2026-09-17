"use client";

/**
 * "Tell me when a second-hand copy appears."
 *
 * This is what the used-book side was missing. The machinery is built — the
 * block on this page, the browse filter, the price comparison — and 2 of 200
 * titles have a copy, so on nearly every product page it correctly shows
 * nothing and the visitor leaves.
 *
 * That visitor is the most useful person in the shop: they wanted a cheap copy
 * of a specific book. Recording them closes the loop in both directions — they
 * hear when one arrives, and the shop learns which titles are worth paying a
 * seller for. Without it the used catalogue has no reason to grow.
 */

import { useCallback, useEffect, useState } from "react";
import {
  clearUsedAlert,
  fetchUsedAlerts,
  setUsedAlert,
  type UsedAlert,
} from "../api/discovery";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";
import { formatPrice } from "../utils/formatPrice";
import { Button, Input } from "./ui";

type UsedCopyAlertProps = {
  bookId: string;
  title: string;
  /** The new price, so the ceiling field can suggest something sensible. */
  newPrice: number;
};

const UsedCopyAlert = ({ bookId, title, newPrice }: UsedCopyAlertProps) => {
  const { isAuthenticated, getToken } = useAuth();
  const { requireAuth } = useAuthModal();
  const [mine, setMine] = useState<UsedAlert | null>(null);
  const [open, setOpen] = useState(false);
  const [ceiling, setCeiling] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(0);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const all = await fetchUsedAlerts(getToken());
      const found = all.find((a) => a.bookId === bookId) ?? null;
      setMine(found);
      setWaiting(found?.waiting ?? 0);
    } catch {
      // An alert that cannot be read must not break the product page.
      setMine(null);
    }
  }, [isAuthenticated, getToken, bookId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const max = ceiling.trim() ? Number(ceiling) : undefined;
      const res = await setUsedAlert(getToken(), bookId, max && max > 0 ? max : undefined);
      setWaiting(res.waiting);
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set that alert");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await clearUsedAlert(getToken(), bookId);
      setMine(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove that alert");
    } finally {
      setBusy(false);
    }
  };

  /* The gate sits here, after they have seen what is on offer — asking someone
     to sign in before telling them what the alert is for loses most of them. */
  const start = () => {
    if (!isAuthenticated) {
      requireAuth(() => setOpen(true));
      return;
    }
    setOpen(true);
  };

  if (mine && !open) {
    return (
      <section className="mt-6 rounded-2xl border border-bookvuk-border/80 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-bookvuk-navy">
              We will tell you when a used copy arrives
            </div>
            <p className="mt-1 text-sm text-bookvuk-muted">
              {mine.maxPrice
                ? `At ${formatPrice(mine.maxPrice)} or under.`
                : "At any price."}{" "}
              {waiting > 1 ? `${waiting} people are waiting for this one.` : null}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" radius="lg" onClick={() => setOpen(true)} disabled={busy}>
              Change
            </Button>
            <Button variant="secondary" size="sm" radius="lg" onClick={remove} disabled={busy}>
              {busy ? "…" : "Remove"}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-bookvuk-border/80 bg-white p-5">
      <h2 className="text-sm font-bold text-bookvuk-navy">Want it cheaper?</h2>
      <p className="mt-1 text-sm leading-relaxed text-bookvuk-muted">
        We have no second-hand copy of {title} right now. Used copies come from
        readers selling theirs back — tell us and you will hear the moment one is
        on the shelf.
      </p>

      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}

      {open ? (
        <div className="mt-4">
          <label className="block text-sm font-semibold text-bookvuk-navy" htmlFor="ceiling">
            Only tell me under (optional)
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Input
              id="ceiling"
              type="number"
              min="1"
              inputMode="decimal"
              value={ceiling}
              onChange={(e) => setCeiling(e.target.value)}
              placeholder={newPrice > 0 ? String(Math.round(newPrice * 0.5)) : "Any price"}
              className="w-40"
            />
            <Button variant="primary" radius="lg" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Tell me"}
            </Button>
            <Button variant="secondary" radius="lg" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
          {/* A ceiling is a promise not to waste their attention: somebody who
              would pay ₹200 should not be told about a ₹400 copy, because that
              notice teaches them to ignore the next one. */}
          <p className="mt-2 text-xs text-bookvuk-muted">
            Leave it blank and we will tell you about any used copy.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" radius="xl" onClick={start}>
            Tell me when there is one
          </Button>
          {waiting > 0 ? (
            <span className="text-xs text-bookvuk-muted">
              {waiting} {waiting === 1 ? "person is" : "people are"} already waiting
            </span>
          ) : null}
        </div>
      )}
    </section>
  );
};

export default UsedCopyAlert;
