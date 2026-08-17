import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import useFetch from "../hooks/useFetch";
import { fetchBooks, type Book } from "../api/index";
import { useCart } from "../context/CartContext";
import { formatPrice } from "../utils/formatPrice";
import Loader from "../components/ui/Loader";

const resolveOrderId = (order: any): string => {
  const candidate =
    order?.orderNumber ??
    order?.order_number ??
    order?.id ??
    order?.order_id;
  const normalized = String(candidate ?? "").trim();
  return normalized || "N/A";
};

const Checkout = () => {
  const navigate = useNavigate();
  const { items, checkoutCart } = useCart(); 
  const { data: books, loading } = useFetch<Book[]>(() => fetchBooks(), []);

  const lineItems = useMemo(() => {
    return items
      .map((it) => ({ ...it, book: (books || []).find((b) => b.id === it.bookId) }))
      .filter((x) => x.book);
  }, [items, books]);

  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, it) => sum + (it.book as Book).price * it.qty, 0);
  }, [lineItems]);

  const shippingEstimate = subtotal > 0 ? 5.0 : 0;
  const estimatedTax = subtotal > 0 ? subtotal * 0.08 : 0;
  const total = subtotal + shippingEstimate + estimatedTax;

  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitted) return;
    setSubmitted(true);
    setError(null);

    try {
      const order = await checkoutCart(); 
      const nextOrderId = resolveOrderId(order);
      setOrderId(nextOrderId);
      setTimeout(() => {
        navigate("/home", { replace: true }); 
      }, 2200);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Checkout failed");
      setSubmitted(false);
    }
  };

  if (loading) {
    return (
      <div className="py-10">
        <Loader />
      </div>
    );
  }


  return (
    <div className="py-10">
      <h1 className="text-3xl font-extrabold text-booknest-navy">Checkout</h1>

      {submitted ? (
        <div className="mt-6 rounded-2xl border border-booknest-border bg-white p-8 shadow-booknest-card">
          <div className="mx-auto max-w-xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-bold text-booknest-navy">Order confirmed</h2>
            <p className="mt-2 text-sm text-booknest-muted">
              Thank you for your purchase! Your order has been received and is now being processed.
            </p>
            <p className="mt-4 text-sm font-semibold text-booknest-navy">
              Order ID: <span className="font-extrabold">{orderId ?? "Processing..."}</span>
            </p>
            <p className="mt-2 text-xs text-booknest-muted">Redirecting you to Home…</p>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          <form onSubmit={submit} className="rounded-2xl border border-booknest-border bg-white p-6 shadow-booknest-card">
            <div className="text-lg font-bold text-booknest-navy">Shipping</div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-booknest-navy">First name</label>
                <input className="mt-2 w-full rounded-lg border border-booknest-border px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="text-sm font-semibold text-booknest-navy">Last name</label>
                <input className="mt-2 w-full rounded-lg border border-booknest-border px-3 py-2 text-sm" required />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-semibold text-booknest-navy">Address</label>
                <input className="mt-2 w-full rounded-lg border border-booknest-border px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="text-sm font-semibold text-booknest-navy">City</label>
                <input className="mt-2 w-full rounded-lg border border-booknest-border px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="text-sm font-semibold text-booknest-navy">ZIP</label>
                <input className="mt-2 w-full rounded-lg border border-booknest-border px-3 py-2 text-sm" required />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-semibold text-booknest-navy">Email</label>
                <input
                  className="mt-2 w-full rounded-lg border border-booknest-border px-3 py-2 text-sm"
                  type="email"
                  required
                />
              </div>
            </div>

            <div className="mt-8 border-t border-booknest-border pt-6">
              <div className="text-lg font-bold text-booknest-navy">Payment</div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-sm font-semibold text-booknest-navy">Card number</label>
                  <input className="mt-2 w-full rounded-lg border border-booknest-border px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="text-sm font-semibold text-booknest-navy">Expiry</label>
                  <input className="mt-2 w-full rounded-lg border border-booknest-border px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="text-sm font-semibold text-booknest-navy">CVC</label>
                  <input className="mt-2 w-full rounded-lg border border-booknest-border px-3 py-2 text-sm" required />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="mt-6 w-full rounded-lg bg-booknest-purple py-3 text-sm font-semibold text-white hover:bg-booknest-purple-hover"
            >
              Place Order
            </button>

            <div className="mt-2 text-center text-xs text-booknest-muted">
              This is a UI scaffold; no real payment is processed.
            </div>
          </form>

          <aside className="rounded-2xl border border-booknest-border bg-white p-6 shadow-booknest-card">
            <div className="text-lg font-bold text-booknest-navy">Order Summary</div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-booknest-muted">Subtotal</span>
                <span className="font-semibold text-booknest-navy">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-booknest-muted">Shipping Estimate</span>
                <span className="font-semibold text-booknest-navy">
                  {formatPrice(shippingEstimate)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-booknest-muted">Estimated Tax</span>
                <span className="font-semibold text-booknest-navy">{formatPrice(estimatedTax)}</span>
              </div>
              <div className="border-t border-booknest-border pt-3 flex items-center justify-between">
                <span className="text-booknest-navy font-semibold">Total</span>
                <span className="text-booknest-navy text-xl font-extrabold">{formatPrice(total)}</span>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-booknest-lilac p-4 text-xs text-booknest-muted">
              Secure Checkout Guarantee.
              <div className="mt-1">Prices and taxes are estimates in this scaffold.</div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default Checkout;

