"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthHero } from "@/components/layout/AuthHero";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";

export default function LoginPage() {
  const router = useRouter();
  const { saveToken } = useAuth();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const quickFill = (e: string, p: string) => { setEmail(e); setPassword(p); };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError("");

    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Enter a valid email address."); return; }
    if (!password) { setError("Enter your password."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Login failed.");

      saveToken({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type,
        user: data.user ?? null,
      });

      const role = data.user?.role;
      const isSuper = data.user?.is_superuser;
      router.replace(role === "admin" || isSuper ? "/admin/dashboard" : "/dashboard");
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* ── Left: hero ─────────────────────────────────────────────────── */}
      <div className="relative h-64 lg:h-auto overflow-hidden" style={{ background: "#efe6d0" }}>
        <AuthHero />
        <div className="relative p-8 text-black pointer-events-none">
          <h1 className="text-5xl font-black font-display tracking-[-0.04em]">AVSS</h1>
          <p className="mt-2 max-w-xs text-sm text-black/70">
            One face, hours of footage, a few minutes to find them.
          </p>
        </div>
      </div>

      {/* ── Right: form ────────────────────────────────────────────────── */}
      <div className="grid place-items-center p-6">
        <div className="w-full max-w-md">
          <div className="avss-card p-6">
            <h2 className="text-xl font-semibold font-display">Sign in</h2>
            <p className="text-sm text-slate-400 mb-5">Authorized security personnel only.</p>

            {error && (
              <div className="rounded border border-rose-500/40 bg-rose-500/10 text-rose-200 px-4 py-3 text-sm mb-4" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <label className="block text-sm text-slate-300">
                Email
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="avss-input mt-1"
                  required
                />
              </label>

              <label className="block text-sm text-slate-300">
                Password
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="avss-input mt-1 pr-16"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-3.5 text-xs text-slate-400 hover:text-slate-200"
                    onClick={() => setShowPw(v => !v)}
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-2.5"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            {/* Demo quick-fill */}
            <div className="mt-4 text-xs text-slate-400 border-t border-slate-700 pt-3">
              Demo accounts:{" "}
              <button className="underline hover:text-slate-200" onClick={() => quickFill("user@avss.demo", "user123")}>User</button>
              {" · "}
              <button className="underline hover:text-slate-200" onClick={() => quickFill("admin@avss.demo", "admin123")}>Admin</button>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <p className="text-slate-400">
                No account?{" "}
                <Link href="/register" className="text-emerald-400 underline hover:text-emerald-300">
                  Register
                </Link>
              </p>
              <Link href="/setup" className="text-orange-400 underline hover:text-orange-300 text-xs">
                First-time setup →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
