"use client";

/**
 * The order history, and cancelling one from it.
 *
 * `cancellingOrderId` and `confirmOrderId` hold ids rather than booleans because
 * the list shows many orders at once: a shared flag would disable every card's
 * button and confirm the wrong order.
 */

import { useCallback, useEffect, useState } from "react";
import { getBaseUrl } from "../../api";
import { useAuth } from "../../context/AuthContext";
import type { Order } from "./types";

const readError = async (res: Response, fallback: string) => {
  const err = await res.json().catch(() => null);
  if (err && typeof err === "object" && "detail" in err) {
    return String((err as { detail?: unknown }).detail || fallback);
  }
  return fallback;
};

export const useOrders = () => {
  const { getToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error("User not authenticated");

      const res = await fetch(`${getBaseUrl()}/api/customer/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(await readError(res, "Failed to fetch orders"));

      const data: Order[] = await res.json();
      setOrders(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const cancelOrder = async (orderId: string) => {
    const token = getToken();
    if (!token) {
      setError("User not authenticated");
      return;
    }

    setCancellingOrderId(orderId);
    setError(null);
    try {
      const res = await fetch(`${getBaseUrl()}/api/customer/orders/${orderId}/cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await readError(res, "Failed to cancel order"));

      // Take the server's payment_status rather than assuming: cancelling a paid
      // order changes it to refunded or refund_pending, and the badge has to say so.
      const updated = await res.json().catch(() => null);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: updated?.status ?? "cancelled",
                payment_status: updated?.payment_status ?? o.payment_status,
              }
            : o,
        ),
      );
    } catch (err: any) {
      setError(err.message || "Failed to cancel order");
    } finally {
      setCancellingOrderId(null);
      setConfirmOrderId(null);
    }
  };

  return {
    orders,
    loading,
    error,
    cancellingOrderId,
    confirmOrderId,
    askToCancel: setConfirmOrderId,
    dismissConfirm: () => setConfirmOrderId(null),
    /** Whether money comes back, which changes what the dialog is agreeing to. */
    confirmOrderPaid: orders.find((o) => o.id === confirmOrderId)?.payment_status === "paid",
    cancelOrder,
  };
};

type UseOrders = ReturnType<typeof useOrders>;
