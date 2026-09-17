"use client";

/**
 * Everything checkout decides, kept away from what it draws.
 *
 * Checkout is the page with the most moving parts on the site — saved
 * addresses, a coupon, store credit, two payment methods, and a gateway window
 * that can be dismissed halfway — and the order of those steps matters: the
 * order is created *before* payment is attempted, so a failure at the gateway
 * must not lose it. Holding that sequence in one file makes it reviewable
 * without scrolling past 250 lines of form markup.
 */

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  confirmPayment,
  listAddresses,
  placeOrder,
  startPayment,
  type Address,
  type AddressInput,
  type PaymentMethod,
} from "../../api/commerce";
import { fetchWallet, type Wallet } from "../../api/buyback";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { EMPTY_ADDRESS, type CheckoutLine, type PlacedOrder } from "./types";

const RAZORPAY_SDK = "https://checkout.razorpay.com/v1/checkout.js";

/** Load the gateway widget on demand, so the SDK is not pulled on every page. */
const loadRazorpay = (): Promise<boolean> =>
  new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = RAZORPAY_SDK;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export const useCheckout = () => {
  const { getToken } = useAuth();
  const {
    items, clearCart, loading: cartLoading, coupon, setCoupon, serverTotals: cartTotals,
  } = useCart();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [form, setForm] = useState<AddressInput>(EMPTY_ADDRESS);
  const [saveAddress, setSaveAddress] = useState(true);

  /* Seeded from the cart, so a code entered a page earlier is still applied here
     instead of having to be typed again — and so the total on the two pages
     agrees. The applied code lives on the cart context; this mirrors it into the
     input for editing. */
  const [couponInput, setCouponInput] = useState(coupon ?? "");
  const appliedCoupon = coupon;
  const setAppliedCoupon = setCoupon;
  const [couponError, setCouponError] = useState<string | null>(null);

  /* The cart's own price, discount and all. Nothing is fetched here. */
  const totals = cartTotals;
  /* Online unless the shopper says otherwise. Defaulting to COD would quietly
     move every order off the gateway the day it is switched on. */
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("online");
  // Store credit, and how much of *this* order it may cover. Asked for against the
  // order total rather than the cart subtotal so the figure matches what is charged.
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [useCredit, setUseCredit] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  // Lines carry their own book (embedded by the cart API), so the catalogue is
  // never downloaded to render a summary.
  const lineItems = useMemo(
    () => items.filter((it): it is CheckoutLine => Boolean(it.book)),
    [items],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await listAddresses(getToken());
        if (cancelled) return;
        setAddresses(saved);
        const preferred = saved.find((a) => a.is_default) || saved[0];
        if (preferred) setSelectedAddressId(preferred.id);
      } catch {
        // No saved addresses is a normal first-order state, not an error.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  /* Totals come from the server so the number shown is the number charged —
     and they arrive with the cart, discount included. The cart context carries
     the applied code on every cart request, so this page asks for nothing: it
     used to fetch `/cart/totals` on load and again whenever the code changed.

     A code that stopped working between the cart and here is reported rather
     than raised, so the checkout still renders; the message is shown and the
     code dropped, leaving the undiscounted figures from the same response. */
  const couponError_ = totals?.coupon_error ?? null;
  useEffect(() => {
    if (!couponError_) return;
    setAppliedCoupon(null);
    setCouponError(couponError_);
  }, [couponError_, setAppliedCoupon]);

  // Asked for against the order total, not the cart subtotal, so the cap is
  // computed from the figure the customer is actually being charged.
  useEffect(() => {
    if (!totals) return;
    let cancelled = false;
    fetchWallet(getToken(), Number(totals.total))
      .then((w) => {
        if (!cancelled) setWallet(w);
      })
      .catch(() => {
        // No credit is the normal case; it must not break checkout.
        if (!cancelled) setWallet(null);
      });
    return () => {
      cancelled = true;
    };
  }, [totals, getToken]);

  // Never more than the server would allow, so the summary cannot promise a
  // discount the checkout then refuses.
  const creditToApply = useCredit && wallet ? wallet.maxRedeemableNow : 0;

  const usingSaved = selectedAddressId !== "";

  /* The option can disappear under the shopper — adding a book can push the
     total past the ceiling — so this is derived rather than trusted from state. */
  const codOffered = totals?.cod_available ?? false;
  const codChosen = paymentMethod === "cod" && codOffered;

  const applyCoupon = async () => {
    const code = couponInput.trim();
    setCouponError(null);
    if (!code) {
      setAppliedCoupon(null);
      return;
    }
    /* Applying it re-reads the cart with the code, which prices and validates
       it in one request. This used to ask `/cart/totals` first and then commit
       the code — two requests for one question. */
    setAppliedCoupon(code);
  };

  /** Set one field of the new-address form. */
  const setAddressField = (key: keyof AddressInput, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const payForOrder = async (orderId: string) => {
    const intent = await startPayment(getToken(), orderId);

    if (!intent.enabled) {
      setPaymentNotice(
        "Online payment is not configured yet, so the order is recorded as unpaid. " +
          "Add the gateway keys to collect payment.",
      );
      return false;
    }

    const ready = await loadRazorpay();
    if (!ready) {
      setPaymentNotice("Could not load the payment window. The order is saved as unpaid.");
      return false;
    }

    return new Promise<boolean>((resolve) => {
      const checkout = new (window as any).Razorpay({
        key: intent.key_id,
        order_id: intent.payment_order_id,
        amount: intent.amount,
        currency: intent.currency,
        name: "BookVuk",
        description: `Order ${orderId}`,
        handler: async (response: any) => {
          try {
            // The browser cannot be trusted to declare success; the server
            // verifies the gateway signature before marking the order paid.
            await confirmPayment(getToken(), orderId, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            resolve(true);
          } catch (err: any) {
            setPaymentNotice(err?.message || "Payment could not be verified.");
            resolve(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentNotice("Payment was cancelled. The order is saved as unpaid.");
            resolve(false);
          },
        },
      });
      checkout.open();
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (placing) return;
    setPlacing(true);
    setError(null);
    setPaymentNotice(null);

    try {
      const order = await placeOrder(getToken(), {
        ...(usingSaved ? { address_id: selectedAddressId } : { address: form, save_address: saveAddress }),
        coupon_code: appliedCoupon,
        // The server re-checks this against the balance and the cap; sending the
        // figure it just quoted keeps the two in step.
        wallet_credit: creditToApply > 0 ? creditToApply : undefined,
        payment_method: codChosen ? "cod" : "online",
      });

      // The order exists from here on, so failures below must not lose it.
      // A cash order has nothing to pay now — opening the gateway would ask for
      // money the customer has already said they will hand over at the door.
      const paid = codChosen
        ? false
        : await payForOrder(order.id).catch((err) => {
            setPaymentNotice(err?.message || "Payment could not be started.");
            return false;
          });

      setPlacedOrder({ id: order.id, paid, cod: codChosen });
      await clearCart().catch(() => {});
    } catch (err: any) {
      setError(err?.message || "Checkout failed");
    } finally {
      setPlacing(false);
    }
  };

  return {
    // Delivery
    addresses,
    selectedAddressId,
    selectAddress: setSelectedAddressId,
    usingSaved,
    form,
    setAddressField,
    saveAddress,
    setSaveAddress,
    // Payment
    paymentMethod,
    setPaymentMethod,
    codOffered,
    codChosen,
    codUnavailableReason: totals?.cod_unavailable_reason ?? null,
    // Money
    lineItems,
    totals,
    couponInput,
    setCouponInput,
    appliedCoupon,
    applyCoupon,
    couponError,
    wallet,
    useCredit,
    setUseCredit,
    creditToApply,
    // Lifecycle
    cartLoading,
    placing,
    error,
    placedOrder,
    paymentNotice,
    submit,
  };
};

type UseCheckout = ReturnType<typeof useCheckout>;
