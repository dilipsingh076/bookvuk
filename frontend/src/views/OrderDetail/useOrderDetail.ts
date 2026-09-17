"use client";

/**
 * One order, and the one thing the customer can do to it.
 *
 * The API's snake_case payload is mapped to camelCase here rather than in the
 * markup, so the page reads in one convention and a field renamed on the server
 * is a one-line change in a single place.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getBaseUrl } from "../../api/index";
import { useAuth } from "../../context/AuthContext";
import { canCancelOrder } from "../../utils/orderBadges";
import type { Order, Step } from "./types";

const readError = async (res: Response, fallback: string) => {
  const payload = await res.json().catch(() => null);
  if (payload && typeof payload === "object" && "detail" in payload) {
    return String((payload as { detail?: unknown }).detail || fallback);
  }
  return fallback;
};

export const useOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { getToken } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      setLoading(true);
      setFetchError(null);
      const token = getToken();
      if (!token) {
        setFetchError("Not authenticated");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${getBaseUrl()}/api/customer/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch order");
        const data = await res.json();
        setOrder({
          id: data.id,
          orderNumber: data.order_number,
          status: data.status,
          placedAt: data.created_at || null,
          packedAt: data.packed_at || null,
          shippedAt: data.shipped_at || null,
          deliveredAt: data.delivered_at || null,
          cancelledAt: data.cancelled_at || null,
          items: data.items.map((i: any) => ({
            id: i.id,
            book_id: i.book_id,
            title_snapshot: i.title_snapshot,
            unit_price_snapshot: Number(i.unit_price_snapshot),
            quantity: Number(i.quantity),
          })),
          subtotal: Number(data.subtotal),
          shipping: Number(data.shipping),
          tax: Number(data.tax),
          total: Number(data.total),
          paymentStatus: data.payment_status || "pending",
          paidAt: data.paid_at || null,
          refundedAt: data.refunded_at || null,
          refundAmount: data.refund_amount == null ? null : Number(data.refund_amount),
          trackingCarrierLabel: data.tracking_carrier_label || null,
          trackingNumber: data.tracking_number || null,
          trackingUrl: data.tracking_url || null,
        });
      } catch (e: any) {
        setFetchError(e.message || "Error fetching order");
      } finally {
        setLoading(false);
      }
    };

    void fetchOrder();
  }, [orderId, getToken]);

  const steps: Step[] = useMemo(() => {
    if (!order) return [];

    // A cancelled order is not on its way anywhere, so listing Packed / Shipped /
    // Delivered as steps still to come would misrepresent what happens next.
    if (order.status === "cancelled") {
      return [
        { key: "placed", label: "Order placed", at: order.placedAt, done: true },
        { key: "cancelled", label: "Cancelled", at: order.cancelledAt, done: true },
      ];
    }

    return [
      { key: "placed", label: "Order placed", at: order.placedAt, done: Boolean(order.placedAt) },
      { key: "packed", label: "Packed", at: order.packedAt, done: Boolean(order.packedAt) },
      { key: "shipped", label: "Shipped", at: order.shippedAt, done: Boolean(order.shippedAt) },
      {
        key: "delivered",
        label: "Delivered",
        at: order.deliveredAt,
        done: Boolean(order.deliveredAt),
      },
    ];
  }, [order]);

  const cancelOrder = async () => {
    if (!order) return;
    const token = getToken();
    if (!token) {
      setActionError("Not authenticated");
      return;
    }

    setCancelling(true);
    setActionError(null);
    try {
      const res = await fetch(`${getBaseUrl()}/api/customer/orders/${order.id}/cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await readError(res, "Failed to cancel order"));
      const data = await res.json();
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              status: data.status ?? "cancelled",
              // Cancelling a paid order also changes the payment state, and the
              // badge has to follow it rather than keep saying "Paid".
              paymentStatus: data.payment_status ?? prev.paymentStatus,
              cancelledAt: data.cancelled_at ?? prev.cancelledAt,
              refundedAt: data.refunded_at ?? prev.refundedAt,
              refundAmount:
                data.refund_amount == null ? prev.refundAmount : Number(data.refund_amount),
            }
          : prev,
      );
    } catch (e: any) {
      setActionError(e.message || "Failed to cancel order");
    } finally {
      setCancelling(false);
      setConfirmOpen(false);
    }
  };

  return {
    order,
    loading,
    fetchError,
    actionError,
    steps,
    canCancel: order
      ? canCancelOrder({ status: order.status, payment_status: order.paymentStatus })
      : false,
    cancelling,
    confirmOpen,
    openConfirm: () => setConfirmOpen(true),
    closeConfirm: () => setConfirmOpen(false),
    cancelOrder,
  };
};

type UseOrderDetail = ReturnType<typeof useOrderDetail>;
