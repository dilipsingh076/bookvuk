"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getBaseUrl, type User } from "../api/index";
import type { ReactNode } from "react";

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  /**
   * @param remember Keep the session after the browser closes. Defaults to true,
   *   which is what every existing caller expected when it was the only option.
   */
  login: (email: string, password: string, remember?: boolean) => Promise<User>;
  register: (fullName: string, username: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  getToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  /** Replace the stored tokens — used after a password change revokes every session. */
  adoptSession: (tokens: { access_token: string; refresh_token: string }) => void;
  /** Update the cached user (e.g. after a rename) without a re-login. */
  updateStoredUser: (changes: Partial<User>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = { children: ReactNode };
const storageKey = "bookvuk_auth";

// Refresh this long before the access token expires, so in-flight requests never
// race the expiry.
const REFRESH_LEAD_MS = 2 * 60 * 1000;

const safeParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; }
  catch { return null; }
};

type StoredAuth = { user: User; token: string; refreshToken?: string };

const jwtExpiryMs = (token: string): number | null => {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

const isJwtExpired = (token: string): boolean => {
  const expMs = jwtExpiryMs(token);
  if (expMs === null) return token.split(".").length < 2;
  return expMs <= Date.now();
};

/* Where the session lives, and why there are two answers.
 *
 * "Remember me" on the sign-in form was a checkbox with `defaultChecked` and no
 * handler: whatever the visitor chose, the session went to `localStorage` and
 * outlived the browser. On a shared or public machine that is the opposite of
 * what unticking it asks for, and the control said otherwise.
 *
 * Unticked now means `sessionStorage`, which the browser discards when the tab
 * closes. Reads try both so a session saved before this change still works, and
 * writes clear the other store so one choice cannot leave a stale copy behind. */
const stores = () => [localStorage, sessionStorage] as const;

const readStored = (): StoredAuth | null => {
  for (const store of stores()) {
    const found = safeParse<StoredAuth>(store.getItem(storageKey));
    if (found) return found;
  }
  return null;
};

/** Which store currently holds the session, so a refresh stays where it was. */
const currentStore = (): Storage =>
  localStorage.getItem(storageKey) !== null ? localStorage : sessionStorage;

const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<number | null>(null);
  // Collapses concurrent refreshes into one network call.
  const inFlightRefresh = useRef<Promise<string | null> | null>(null);

  const clearRefreshTimer = () => {
    if (refreshTimer.current !== null) {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  };

  const logout = useCallback(() => {
    clearRefreshTimer();
    const stored = readStored();

    // Clear locally first so the UI never appears stuck if the network is down;
    // the server call revokes the refresh token so it cannot be reused.
    setUser(null);
    localStorage.removeItem(storageKey);
    sessionStorage.removeItem(storageKey);

    if (stored?.refreshToken) {
      void fetch(getBaseUrl() + "/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: stored.refreshToken }),
        keepalive: true,
      }).catch(() => {
        // Best effort: the token still expires on its own.
      });
    }
  }, []);

  /* `remember` is only given at sign-in. Every later write — a token refresh, a
     profile edit — passes nothing and stays in whichever store the session
     already occupies, so a refresh cannot silently promote a session-only login
     to a permanent one. */
  const persist = useCallback((data: StoredAuth, remember?: boolean) => {
    const target =
      remember === undefined ? currentStore() : remember ? localStorage : sessionStorage;
    const other = target === localStorage ? sessionStorage : localStorage;
    other.removeItem(storageKey);
    target.setItem(storageKey, JSON.stringify(data));
  }, []);

  const refreshAccessToken = useCallback((): Promise<string | null> => {
    if (inFlightRefresh.current) return inFlightRefresh.current;

    const stored = readStored();
    if (!stored?.refreshToken) return Promise.resolve(null);

    const request = (async () => {
      try {
        const res = await fetch(getBaseUrl() + "/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: stored.refreshToken }),
        });
        if (!res.ok) {
          // Refresh token expired or revoked - the session is genuinely over.
          logout();
          return null;
        }
        const data = await res.json();
        persist({ ...stored, token: data.access_token });
        return data.access_token as string;
      } catch {
        // Network failure: keep the session and let the next attempt retry.
        return null;
      } finally {
        inFlightRefresh.current = null;
      }
    })();

    inFlightRefresh.current = request;
    return request;
  }, [logout, persist]);

  // Keep the access token fresh in the background. Call sites use the
  // synchronous getToken(), so the token must already be valid by the time they
  // ask for it.
  const scheduleRefresh = useCallback((token: string) => {
    clearRefreshTimer();
    const expMs = jwtExpiryMs(token);
    if (expMs === null) return;
    const delay = Math.max(0, expMs - Date.now() - REFRESH_LEAD_MS);
    refreshTimer.current = window.setTimeout(() => {
      void refreshAccessToken().then((next) => {
        if (next) scheduleRefresh(next);
      });
    }, delay);
  }, [refreshAccessToken]);

  useEffect(() => {
    const stored = readStored();

    if (!stored?.token) {
      setUser(null);
      setLoading(false);
      return;
    }

    if (isJwtExpired(stored.token)) {
      if (stored.refreshToken && !isJwtExpired(stored.refreshToken)) {
        // Reload after the access token lapsed: recover the session instead of
        // dumping the user back to the landing page.
        setUser(stored.user ?? null);
        void refreshAccessToken().then((next) => {
          if (next) scheduleRefresh(next);
          setLoading(false);
        });
        return;
      }
      localStorage.removeItem(storageKey);
      sessionStorage.removeItem(storageKey);
      setUser(null);
      setLoading(false);
      return;
    }

    setUser(stored.user ?? null);
    scheduleRefresh(stored.token);
    setLoading(false);
  }, [refreshAccessToken, scheduleRefresh]);

  useEffect(() => clearRefreshTimer, []);

  const adoptSession = useCallback(
    (tokens: { access_token: string; refresh_token: string }) => {
      const stored = readStored();
      if (!stored) return;
      persist({ ...stored, token: tokens.access_token, refreshToken: tokens.refresh_token });
      scheduleRefresh(tokens.access_token);
    },
    [persist, scheduleRefresh],
  );

  const updateStoredUser = useCallback(
    (changes: Partial<User>) => {
      const stored = readStored();
      if (!stored) return;
      const nextUser = { ...stored.user, ...changes } as User;
      persist({ ...stored, user: nextUser });
      setUser(nextUser);
    },
    [persist],
  );

  const isAuthenticated = !!user;

  const login = async (email: string, password: string, remember = true): Promise<User> => {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const res = await fetch(getBaseUrl() + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });

    if (!res.ok) {
      if (res.status === 429) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Too many login attempts. Try again later.");
      }
      /* A 403 here means the password was right and the account is disabled.
         Flattening it into "Invalid credentials" — which is what this did —
         sends somebody round the password reset for a problem no new password
         can fix. A 401 stays generic on purpose: it must not reveal whether the
         address has an account. */
      if (res.status === 403) {
        const body = await res.json().catch(() => null);
        throw new Error(
          typeof body?.detail === "string" ? body.detail : "This account has been disabled.",
        );
      }
      throw new Error("Invalid credentials");
    }
    const data = await res.json();

    persist(
      { user: data.user, token: data.access_token, refreshToken: data.refresh_token },
      remember,
    );
    setUser(data.user);
    scheduleRefresh(data.access_token);

    return data.user;
  };

  const register = async (fullName: string, username: string, email: string, password: string): Promise<User> => {
    const res = await fetch(getBaseUrl() + "/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, username, email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const detail = body?.detail;
      if (typeof detail === "string") throw new Error(detail);
      // Pydantic validation errors arrive as a list of objects.
      if (Array.isArray(detail) && detail[0]?.msg) throw new Error(detail[0].msg);
      throw new Error("User registration failed");
    }
    const data = await res.json();

    persist({ user: data.user, token: data.access_token, refreshToken: data.refresh_token });
    setUser(data.user);
    scheduleRefresh(data.access_token);

    return data.user;
  };

  const getToken = () => {
    const stored = readStored();
    const token = stored?.token ?? null;
    if (!token) return null;
    if (isJwtExpired(token)) {
      if (stored?.refreshToken && !isJwtExpired(stored.refreshToken)) {
        // Background refresh; this call still returns null so the caller retries.
        void refreshAccessToken().then((next) => {
          if (next) scheduleRefresh(next);
        });
        return null;
      }
      localStorage.removeItem(storageKey);
      sessionStorage.removeItem(storageKey);
      setUser(null);
      return null;
    }
    return token;
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    getToken,
    refreshAccessToken,
    adoptSession,
    updateStoredUser,
  }),
    /* The handlers are deliberately absent: they are plain functions rebuilt on
       every render, so listing them would make this memo return a new object
       every render and re-render every consumer — the opposite of its purpose.
       Sound because their only meaningful dependency is already listed, so the
       memo recomputes and re-captures them whenever that state moves. Fixing it
       "properly" means useCallback on each handler with hand-written dependency
       lists, which is a real refactor rather than a lint cleanup. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  [user, loading, logout, refreshAccessToken, adoptSession, updateStoredUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export { AuthProvider, useAuth };
