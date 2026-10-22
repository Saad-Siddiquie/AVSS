"use client";

/**
 * /setup — First-run page to create the initial admin account.
 * Only works when no admin exists in the database.
 * After creation it logs in automatically and goes to /admin/dashboard.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";

export default function SetupPage() {
  const router = useRouter();
  const { saveToken } = useAuth();

  const [fullName,  setFullName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState(false);
  const [loading,   setLoading]   = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim())             { setError("Enter your full name."); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Enter a valid email."); return; }
    if (password.length < 8)          { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm)         { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/setup-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email, password }),
      });
      const data = await res.json();

      if (res.status === 409) {
        // Admin already exists — go straight to login
        setError("An admin account already exists. Please sign in.");
        setTimeout(() => router.replace("/login"), 2000);
        return;
      }
      if (!res.ok) throw new Error(data?.detail || "Setup failed.");

      // Auto-login with the new admin token
      saveToken({
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
        token_type:    data.token_type,
        user:          data.user,
      });

      setSuccess(true);
      setTimeout(() => router.replace("/admin/dashboard"), 1500);
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 grid place-items-center p-6"
         style={{
           backgroundImage: "linear-gradient(rgba(239,230,208,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(239,230,208,.035) 1px,transparent 1px)",
           backgroundSize: "32px 32px",
         }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black font-display text-orange-500 tracking-tight">AVSS</h1>
          <p className="text-slate-400 mt-2 text-sm">First-time Setup</p>
        </div>

        <div className="avss-card p-6">
          <h2 className="text-lg font-semibold font-display mb-1">Create Admin Account</h2>
          <p className="text-sm text-slate-400 mb-5">
            This runs only once. After setup, only admins can create more admin accounts.
          </p>

          {/* Info banner */}
          <div className="rounded border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-300 mb-4">
            <strong>Admin powers:</strong> add/edit/delete cameras, manage users, view all jobs, run searches.
          </div>

          {error && (
            <div className="rounded border border-rose-500/40 bg-rose-500/10 text-rose-200 px-3 py-2 text-sm mb-4">
              {error}
            </div>
          )}

          {success ? (
            <div className="rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 px-4 py-4 text-center">
              <div className="text-2xl mb-2">✓</div>
              <p className="font-semibold">Admin account created!</p>
              <p className="text-xs text-emerald-300 mt-1">Redirecting to admin dashboard…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <label className="block text-sm text-slate-300">
                Full Name
                <input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Alex Admin"
                  className="avss-input mt-1"
                  autoFocus
                />
              </label>

              <label className="block text-sm text-slate-300">
                Email Address
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@yourorg.com"
                  className="avss-input mt-1"
                />
              </label>

              <label className="block text-sm text-slate-300">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="8+ characters"
                  className="avss-input mt-1"
                />
              </label>

              <label className="block text-sm text-slate-300">
                Confirm Password
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className="avss-input mt-1"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="btn-admin w-full py-2.5 text-base"
                style={{ background: "#b89f5c", color: "#090c0b" }}
              >
                {loading ? "Creating admin account…" : "Create Admin & Enter Dashboard →"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          Already have an account?{" "}
          <a href="/login" className="text-orange-400 underline hover:text-orange-300">Sign in</a>
        </p>
      </div>
    </div>
  );
}
