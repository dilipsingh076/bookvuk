import { getBaseUrl } from "./index";

/** Addresses, cart totals, coupons, checkout, payment and reviews. */

export type Address = {
  id: string;
  full_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
};

export type AddressInput = Omit<Address, "id" | "is_default"> & { is_default?: boolean };

export type PaymentMethod = "online" | "cod";

export type CartTotals = {
  subtotal: string;
  discount: string;
  shipping: string;
  tax: string;
  total: string;
  coupon_code: string | null;
  /** Why an applied code did not price anything.
   *
   *  A cart asked for with a code that has since expired still comes back — the
   *  shopper must not lose the page over a discount — so the refusal is reported
   *  here instead of failing the request. `/cart/totals` still answers a direct
   *  "may I use this code" with a 400, because there that *is* the answer. */
  coupon_error: string | null;
  /** Whether cash on delivery may be chosen for *this* total — it depends on the
   *  amount, so it can change as the cart does. The server re-checks at
   *  checkout; this only decides whether the option is worth offering. */
  cod_available: boolean;
  cod_unavailable_reason: string | null;
};

type PaymentIntent = {
  enabled: boolean;
  provider?: string | null;
  key_id?: string | null;
  currency?: string | null;
  amount?: number | null;
  payment_order_id?: string | null;
  order_id: string;
};

export type Review = {
  id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  author_name: string;
  is_mine: boolean;
  /** This reviewer has a delivered order containing this book.
   *
   *  A label, not a gate: blocking unverified reviews loses the genuine ones
   *  from people who bought the book elsewhere. */
  verified_purchase?: boolean;
  created_at: string;
};

export type ReviewSummary = {
  average: number;
  count: number;
  breakdown: Record<string, number>;
  items: Review[];
};

/** Surface the API's own message: it is written to be shown to the customer. */
const readError = async (res: Response, fallback: string): Promise<string> => {
  const body = await res.json().catch(() => null);
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && (detail[0] as { msg?: string })?.msg) {
    return String((detail[0] as { msg?: string }).msg);
  }
  return fallback;
};

const authedFetch = async (
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<Response> => {
  if (!token) throw new Error("Please sign in to continue.");
  return fetch(getBaseUrl() + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
};

export const listAddresses = async (token: string | null): Promise<Address[]> => {
  const res = await authedFetch("/api/customer/addresses", token);
  if (!res.ok) throw new Error(await readError(res, "Could not load addresses"));
  return res.json();
};

type CheckoutPayload = {
  address_id?: string;
  address?: AddressInput;
  coupon_code?: string | null;
  save_address?: boolean;
  /** Store credit to put towards this order; the server caps it. */
  wallet_credit?: number;
  payment_method?: PaymentMethod;
};

export const placeOrder = async (token: string | null, payload: CheckoutPayload) => {
  const res = await authedFetch("/api/customer/checkout", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readError(res, "Checkout failed"));
  return res.json();
};

export const startPayment = async (token: string | null, orderId: string): Promise<PaymentIntent> => {
  const res = await authedFetch(`/api/customer/orders/${orderId}/payment`, token, { method: "POST" });
  if (!res.ok) throw new Error(await readError(res, "Could not start the payment"));
  return res.json();
};

export const confirmPayment = async (
  token: string | null,
  orderId: string,
  result: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
) => {
  const res = await authedFetch(`/api/customer/orders/${orderId}/payment/confirm`, token, {
    method: "POST",
    body: JSON.stringify(result),
  });
  if (!res.ok) throw new Error(await readError(res, "Payment could not be verified"));
  return res.json();
};

// ----- reviews (reading is public) -----

export const fetchReviews = async (bookId: string): Promise<ReviewSummary> => {
  const res = await fetch(`${getBaseUrl()}/api/catalog/books/${bookId}/reviews`);
  if (!res.ok) throw new Error(await readError(res, "Could not load reviews"));
  return res.json();
};

export const submitReview = async (
  token: string | null,
  bookId: string,
  review: { rating: number; title?: string; body?: string },
): Promise<Review> => {
  const res = await authedFetch(`/api/catalog/books/${bookId}/reviews`, token, {
    method: "PUT",
    body: JSON.stringify(review),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not save your review"));
  return res.json();
};

export const deleteReview = async (token: string | null, bookId: string): Promise<void> => {
  const res = await authedFetch(`/api/catalog/books/${bookId}/reviews`, token, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(await readError(res, "Could not remove your review"));
};

// ----- password reset -----

export const requestPasswordReset = async (email: string): Promise<string> => {
  const res = await fetch(`${getBaseUrl()}/auth/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(await readError(res, "Could not send the reset link"));
  return (body as { message?: string })?.message || "Check your inbox for a reset link.";
};

export const confirmPasswordReset = async (token: string, password: string): Promise<string> => {
  const res = await fetch(`${getBaseUrl()}/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(await readError(res, "Could not reset the password"));
  return (body as { message?: string })?.message || "Password updated.";
};

// ----- profile -----

type Profile = {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: string;
  created_at: string;
};

export const updateProfile = async (
  token: string | null,
  changes: { full_name?: string; username?: string },
): Promise<Profile> => {
  const res = await authedFetch("/api/profile", token, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not save your profile"));
  return res.json();
};

type PasswordChangeResult = {
  message: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export const changePassword = async (
  token: string | null,
  currentPassword: string,
  newPassword: string,
): Promise<PasswordChangeResult> => {
  const res = await authedFetch("/api/profile/password", token, {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not change your password"));
  return res.json();
};
