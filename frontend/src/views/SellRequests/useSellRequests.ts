"use client";

/**
 * The seller's requests, their credit, and the four things they can do to a
 * request: add a photo, remove one, say they have posted it, or withdraw it.
 *
 * `working` and `cancelling` hold an id rather than a boolean so only the card
 * being acted on disables — a seller clearing a shelf has several open at once,
 * and freezing the whole page for one upload is a poor trade.
 */

import { useCallback, useEffect, useState } from "react";
import {
  fetchConditions,
  cancelSellRequest,
  deleteSellPhoto,
  fetchMySellRequests,
  fetchWallet,
  markSellDispatched,
  uploadSellPhoto,
  type SellRequest,
  type Wallet,
} from "../../api/buyback";
import { listCarriers, type Carrier } from "../../api/publicCarriers";
import { useAuth } from "../../context/AuthContext";
import type { DispatchDraft } from "./types";

export const useSellRequests = () => {
  const { getToken } = useAuth();
  const [requests, setRequests] = useState<SellRequest[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  /* Where an approved book should be posted. Comes from the server so the shop's
     address is configured in one place rather than written into the UI. */
  const [shipTo, setShipTo] = useState<string[] | null>(null);
  /* The list is paginated — nothing ever leaves it, so an account that sells
     regularly accumulates hundreds. */
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<{ page: number; pages: number; total: number } | null>(null);
  /* Which request has an upload or a dispatch in flight, so only that card's
     controls disable rather than the whole page. */
  const [working, setWorking] = useState<string | null>(null);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  /* The dispatch form's fields, per request. Kept keyed rather than as one pair
     because two approved books can be posted in the same sitting. */
  const [dispatchForm, setDispatchForm] = useState<Record<string, DispatchDraft>>({});

  useEffect(() => {
    listCarriers()
      .then(setCarriers)
      .catch(() => setCarriers([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchConditions()
      .then((c) => {
        if (!cancelled) setShipTo(c.shipTo);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, w] = await Promise.all([
        fetchMySellRequests(getToken(), { page }),
        fetchWallet(getToken()).catch(() => null),
      ]);
      setRequests(rows.items);
      setMeta(rows.meta);
      setWallet(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your requests");
    } finally {
      setLoading(false);
    }
  }, [getToken, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const replaceRow = (updated: SellRequest) =>
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

  const addPhoto = async (id: string, file: File, kind: "cover" | "spine" | "damage") => {
    setWorking(id);
    setError(null);
    try {
      replaceRow(await uploadSellPhoto(getToken(), id, file, kind));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload that photo");
    } finally {
      setWorking(null);
    }
  };

  const dropPhoto = async (id: string, photoId: string) => {
    setWorking(id);
    setError(null);
    try {
      replaceRow(await deleteSellPhoto(getToken(), id, photoId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove that photo");
    } finally {
      setWorking(null);
    }
  };

  const markPosted = async (id: string) => {
    const form = dispatchForm[id];
    setWorking(id);
    setError(null);
    try {
      // Both fields or neither — the server refuses half a shipment, because a
      // number with no courier cannot be turned into a link and a courier with
      // no number identifies no parcel.
      const tracking =
        form?.carrier && form?.number.trim()
          ? { carrier: form.carrier, trackingNumber: form.number.trim() }
          : undefined;
      replaceRow(await markSellDispatched(getToken(), id, tracking));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the dispatch");
    } finally {
      setWorking(null);
    }
  };

  const withdraw = async (id: string) => {
    setCancelling(id);
    try {
      const updated = await cancelSellRequest(getToken(), id);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not withdraw that request");
    } finally {
      setCancelling(null);
    }
  };

  /** Set one field of one request's dispatch form, leaving the other alone. */
  const setDispatchField = (id: string, field: keyof DispatchDraft, value: string) =>
    setDispatchForm((f) => ({
      ...f,
      [id]: { carrier: f[id]?.carrier ?? "", number: f[id]?.number ?? "", [field]: value },
    }));

  return {
    requests,
    wallet,
    loading,
    error,
    shipTo,
    carriers,
    meta,
    working,
    cancelling,
    dispatchForm,
    setDispatchField,
    addPhoto,
    dropPhoto,
    markPosted,
    withdraw,
    prevPage: () => setPage((p) => Math.max(1, p - 1)),
    nextPage: () => setPage((p) => p + 1),
  };
};

type UseSellRequests = ReturnType<typeof useSellRequests>;
