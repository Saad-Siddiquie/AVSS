"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthHero } from "@/components/layout/AuthHero";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";

const strength = (p: string) =>
  [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(p)).length;

const STRENGTH_LABEL = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLOR = [
  "text-rose-400", "text-rose-400", "text-yellow-300",
  "text-emerald-400", "text-emerald-400",
];

export default function RegisterPage() {
  const router = useRouter();
  const { saveToken } = useAuth();

  const [fullName, setFullName]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const pwStrength = strength(password);

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError("");

    if (!fullName.trim())                         { setError("Enter your full name."); return; }
    if (!/^\S+@\S+\.\S+$/.test(email))           { setError("Enter a valid email address."); return; }
    if (pwStrength < 2 || password.length < 8)   { setError("Choose a stronger password (8+ characters with mixed types)."); return; }
    if (password !== confirm)                     { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email, password, role: "user" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Registration failed.");

      saveToken({
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
        token_type:    data.token_type,
        user:          data.user ?? null,
      });
      router.replace("/dashboard");
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Left hero */}
      <div className="relative h-64 lg:h-auto overflow-hidden" style={{ background: "#efe6d0" }}>
        <AuthHero />
        <div className="relative p-8 text-black pointer-events-none">
          <h1 className="text-5xl font-black font-display tracking-[-0.04em]">AVSS</h1>
          <p className="mt-2 max-w-xs text-sm text-black/70">
            One face, hours of footage, a few minutes to find them.
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="grid place-items-center p-6">
        <div className="w-full max-w-md">
          <div className="avss-card p-6">
            <h2 className="text-xl font-semibold font-display">Create account</h2>
            <p className="text-sm text-slate-400 mb-5">Registers a standard user account.</p>

            {error && (
              <div className="rounded border border-rose-500/40 bg-rose-500/10 text-rose-200 px-4 py-3 text-sm mb-4" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <label className="block text-sm text-slate-300">
                Full name
                <input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="avss-input mt-1"
                />
              </label>

              <label className="block text-sm text-slate-300">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="avss-input mt-1"
                />
              </label>

              <div>
                <label className="block text-sm text-slate-300">
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="avss-input mt-1"
                  />
                </label>
                <span className={`text-xs mt-1 block ${password ? STRENGTH_COLOR[pwStrength] : "text-slate-500"}`}>
                  {password
                    ? STRENGTH_LABEL[pwStrength]
                    : "Use 8+ characters, a capital, a number and a symbol"}
                </span>
              </div>

              <label className="block text-sm text-slate-300">
                Confirm password
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="avss-input mt-1"
                />
              </label>

              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>

            <p className="text-sm mt-3 text-slate-400">
              Already registered?{" "}
              <Link href="/login" className="text-emerald-400 underline hover:text-emerald-300">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
