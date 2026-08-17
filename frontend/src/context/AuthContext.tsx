import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getBaseUrl, type User } from "../api/index";
import type { ReactNode } from "react";

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (fullName: string, username: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  getToken: () => string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = { children: ReactNode };
const storageKey = "booknest_auth";

const safeParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } 
  catch { return null; }
};

type StoredAuth = { user: User; token: string };

const isJwtExpired = (token: string): boolean => {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return true;
    const payloadRaw = parts[1];
    const normalized = payloadRaw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (!payload.exp) return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const parsed = safeParse<StoredAuth>(localStorage.getItem(storageKey));
    if (parsed?.token && isJwtExpired(parsed.token)) {
      localStorage.removeItem(storageKey);
      setUser(null);
    } else {
      setUser(parsed?.user ?? null);
    }
    setLoading(false);
  }, []);

  const isAuthenticated = !!user;

  const login = async (email: string, password: string): Promise<User> => {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const res = await fetch(getBaseUrl() + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });

    if (!res.ok) throw new Error("Invalid credentials");
    const data = await res.json();

    const authData: StoredAuth = { user: data.user, token: data.access_token };
    localStorage.setItem(storageKey, JSON.stringify(authData));
    setUser(data.user);

    return data.user;
  };

  const register = async (fullName: string, username: string, email: string, password: string): Promise<User> => {
    const res = await fetch(getBaseUrl() + "/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, username, email, password }),
    });

    if (!res.ok) throw new Error("User registration failed");
    const data = await res.json();

    const authData: StoredAuth = { user: data.user, token: data.access_token };
    localStorage.setItem(storageKey, JSON.stringify(authData));
    setUser(data.user);

    return data.user;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(storageKey);
  };

  const getToken = () => {
    const parsed = safeParse<StoredAuth>(localStorage.getItem(storageKey));
    const token = parsed?.token ?? null;
    if (!token) return null;
    if (isJwtExpired(token)) {
      localStorage.removeItem(storageKey);
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
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export { AuthProvider, useAuth };
export type { User };