import { createContext, useContext, useMemo, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { getBaseUrl } from "../api/index";
import { useAuth } from "./AuthContext";

export type CartItem = { bookId: string; qty: number };
export type CartContextValue = {
  items: CartItem[];
  totalQty: number;
  addToCart: (book: { id: string }) => Promise<void>;
  removeFromCart: (bookId: string) => Promise<void>;
  setQty: (bookId: string, qty: number) => Promise<void>;
  clearCart: () => Promise<void>;
  checkoutCart: () => Promise<any>;
  loading: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);
type CartProviderProps = { children: ReactNode };

export const CartProvider = ({ children }: CartProviderProps) => {
  const { getToken, isAuthenticated, loading: authLoading, logout, user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const readErrorMessage = async (res: Response, fallback: string) => {
    const payload = await res.json().catch(() => null);
    if (payload && typeof payload === "object" && "detail" in payload) {
      return String((payload as { detail?: unknown }).detail || fallback);
    }
    return fallback;
  };

  const fetchCartApi = async (): Promise<CartItem[]> => {
    const token = getToken();
    if (!token) throw new Error("User not authenticated");

    const res = await fetch(`${getBaseUrl()}/api/customer/cart`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      logout();
      throw new Error("Session expired. Please sign in again.");
    }
    if (!res.ok) throw new Error("Failed to fetch cart");

    const data = await res.json();
    return data.items.map((i: any) => ({
      bookId: String(i.book_id),
      qty: Number(i.quantity),
    }));
  };

  const addToCartApi = async (bookId: string) => {
    const token = getToken();
    if (!token) throw new Error("User not authenticated");

    const res = await fetch(`${getBaseUrl()}/api/customer/cart/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ book_id: bookId, quantity: 1 }),
    });
    if (!res.ok)
      throw new Error(await readErrorMessage(res, "Failed to add to cart"));
  };

  const removeFromCartApi = async (bookId: string) => {
    const token = getToken();
    if (!token) throw new Error("User not authenticated");

    const res = await fetch(
      `${getBaseUrl()}/api/customer/cart/items/${bookId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok)
      throw new Error(
        await readErrorMessage(res, "Failed to remove from cart"),
      );
  };

  const setQtyApi = async (bookId: string, quantityChange: number) => {
    const token = getToken();
    if (!token) throw new Error("User not authenticated");

    const res = await fetch(
      `${getBaseUrl()}/api/customer/cart/items/${bookId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity_change: quantityChange }),
      },
    );
    if (!res.ok) throw new Error("Failed to update quantity");
  };

  const clearCartApi = async () => {
    const token = getToken();
    if (!token) throw new Error("User not authenticated");

    const res = await fetch(`${getBaseUrl()}/api/customer/cart/cartClear`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok)
      throw new Error(await readErrorMessage(res, "Failed to clear cart"));
  };

  const checkoutCartApi = async () => {
    const token = getToken();
    if (!token) throw new Error("User not authenticated");

    const res = await fetch(`${getBaseUrl()}/api/customer/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items: cartItems }),
    });

    if (!res.ok)
      throw new Error(await readErrorMessage(res, "Checkout failed"));

    const order = await res.json();
    await clearCart();
    return order;
  };

  useEffect(() => {
    if (authLoading) return;
    const isAdmin = user?.role === "admin";
    if (!isAuthenticated || isAdmin) {
      setCartItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const items = await fetchCartApi();
        if (!cancelled) setCartItems(items);
      } catch (e) {
        console.error("Cart fetch error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, user?.role]);

  useEffect(() => {
    if (!isAuthenticated) {
      setCartItems([]);
      setLoading(false);
    }
  }, [isAuthenticated]);

  const addToCart = async (book: { id: string }) => {
    const bookId = String(book?.id);
    if (!bookId) return;

    setCartItems((prev) => {
      const exists = prev.find((item) => item.bookId === bookId);
      return exists
        ? prev.map((item) =>
            item.bookId === bookId ? { ...item, qty: item.qty + 1 } : item,
          )
        : [...prev, { bookId, qty: 1 }];
    });

    try {
      await addToCartApi(bookId);
    } catch (e) {
      console.error(e);
      setCartItems((prev) =>
        prev
          .map((item) =>
            item.bookId === bookId
              ? { ...item, qty: Math.max(0, item.qty - 1) }
              : item,
          )
          .filter((item) => item.qty > 0),
      );
    }
  };

  const removeFromCart = async (bookId: string) => {
    const prevItem = cartItems.find((i) => i.bookId === bookId);
    setCartItems((prev) => prev.filter((i) => i.bookId !== bookId));

    try {
      await removeFromCartApi(bookId);
    } catch (e) {
      if (prevItem) setCartItems((prev) => [...prev, prevItem]);
    }
  };

  const setQty = async (bookId: string, qty: number) => {
    const prevItem = cartItems.find((i) => i.bookId === bookId);
    if (!prevItem) return;
    const change = qty - prevItem.qty;

    setCartItems((prev) =>
      prev
        .map((item) => (item.bookId === bookId ? { ...item, qty } : item))
        .filter((i) => i.qty > 0),
    );

    try {
      await setQtyApi(bookId, change);
    } catch (e) {
      if (prevItem)
        setCartItems((prev) =>
          prev
            .map((item) => (item.bookId === bookId ? prevItem : item))
            .filter((i) => i.qty > 0),
        );
    }
  };

  const clearCart = async () => {
    const prevItems = cartItems;
    setCartItems([]);
    try {
      await clearCartApi();
    } catch (e) {
      setCartItems(prevItems);
    }
  };

  const totalQty = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.qty, 0),
    [cartItems],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items: cartItems,
      totalQty,
      addToCart,
      removeFromCart,
      setQty,
      clearCart,
      checkoutCart: checkoutCartApi,
      loading,
    }),
    [cartItems, totalQty, loading],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
