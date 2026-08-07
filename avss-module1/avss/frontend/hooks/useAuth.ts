"use client";

import { useEffect, useState } from "react";

const TOKEN_KEY = "avss_access_token";

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Read from localStorage only on the client (avoids SSR mismatch)
    const stored = localStorage.getItem(TOKEN_KEY);
    setToken(stored);
    setReady(true);
  }, []);

  const saveToken = (t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
  };

  const clearToken = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  /** Returns headers with Bearer token for authenticated fetch calls */
  const authHeaders = (): Record<string, string> =>
    token ? { Authorization: `Bearer ${token}` } : {};

  return { token, ready, saveToken, clearToken, authHeaders, isLoggedIn: !!token };
}

/** Standalone helper — read token once without React state (for non-hook contexts) */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
