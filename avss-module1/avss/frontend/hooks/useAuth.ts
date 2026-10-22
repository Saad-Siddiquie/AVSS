"use client";

import { useEffect, useState, useCallback } from "react";

const KEY_TOKEN   = "avss_token";
const KEY_REFRESH = "avss_refresh";
const KEY_USER    = "avss_user";

export interface AuthUser {
  id: number;
  email: string;
  full_name: string | null;
  role: "admin" | "user";
  is_active: boolean;
  is_superuser: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string | null;
  token_type: string;
  user?: AuthUser | null;
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [user,  setUser]  = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  // On mount: read from localStorage then verify with /auth/me
  useEffect(() => {
    const storedToken = (() => { try { return localStorage.getItem(KEY_TOKEN); } catch { return null; } })();
    const storedUser  = (() => {
      try {
        const s = localStorage.getItem(KEY_USER);
        return s ? (JSON.parse(s) as AuthUser) : null;
      } catch { return null; }
    })();

    if (!storedToken) {
      setReady(true);
      return;
    }

    // Have a token — set it immediately so pages don't flash login
    setToken(storedToken);
    setUser(storedUser);

    // Then verify and refresh user data (gets real role from backend)
    fetch("/api/backend/auth/me", {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(r => {
        if (r.status === 401) {
          // Token expired
          try { [KEY_TOKEN, KEY_REFRESH, KEY_USER].forEach(k => localStorage.removeItem(k)); } catch { /* */ }
          setToken(null);
          setUser(null);
        } else if (r.ok) {
          return r.json();
        }
      })
      .then(u => {
        if (u) {
          setUser(u as AuthUser);
          try { localStorage.setItem(KEY_USER, JSON.stringify(u)); } catch { /* */ }
        }
      })
      .catch(() => { /* network error — keep stored user */ })
      .finally(() => setReady(true));
  }, []);

  const saveToken = useCallback((tokens: AuthTokens) => {
    try {
      localStorage.setItem(KEY_TOKEN, tokens.access_token);
      if (tokens.refresh_token) localStorage.setItem(KEY_REFRESH, tokens.refresh_token);
      if (tokens.user)          localStorage.setItem(KEY_USER, JSON.stringify(tokens.user));
    } catch { /* */ }
    setToken(tokens.access_token);
    setUser(tokens.user ?? null);
  }, []);

  const clearToken = useCallback(() => {
    try { [KEY_TOKEN, KEY_REFRESH, KEY_USER].forEach(k => localStorage.removeItem(k)); } catch { /* */ }
    setToken(null);
    setUser(null);
    if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  const authFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let tok: string | null = null;
    try { tok = localStorage.getItem(KEY_TOKEN); } catch { /* */ }

    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string>),
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    };

    const res = await fetch(input, { ...init, headers });

    if (res.status === 401) {
      try { [KEY_TOKEN, KEY_REFRESH, KEY_USER].forEach(k => localStorage.removeItem(k)); } catch { /* */ }
      setToken(null);
      setUser(null);
      if (typeof window !== "undefined") window.location.href = "/login";
    }

    return res;
  }, []);

  const isLoggedIn = !!token;
  const isAdmin    = !!user && (user.role === "admin" || user.is_superuser === true);

  return { token, user, ready, isLoggedIn, isAdmin, saveToken, clearToken, authFetch };
}
