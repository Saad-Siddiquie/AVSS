"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function RegisterPage() {
  const router = useRouter();
  const { saveToken } = useAuth();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      // 1 — Register
      const regRes = await fetch("/api/backend/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });

      if (!regRes.ok) {
        const d = await regRes.json().catch(() => ({}));
        throw new Error(d?.detail ?? `Registration failed (${regRes.status})`);
      }

      // 2 — Auto-login
      const loginRes = await fetch("/api/backend/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim(), password: form.password }),
      });

      if (!loginRes.ok) {
        // Registration succeeded but login failed — redirect to login page
        router.push("/login");
        return;
      }

      const { access_token } = await loginRes.json();
      saveToken(access_token);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* Brand */}
        <div className="mb-6 text-center">
          <span className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-bold text-white tracking-widest">
            AVSS
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Create account</h1>
          <p className="mt-1 text-sm text-slate-500">Autonomous Video Surveillance System</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Full name */}
          <label className="text-sm font-medium text-slate-700">
            Full Name
            <input
              name="full_name"
              type="text"
              value={form.full_name}
              onChange={handleChange}
              autoComplete="name"
              placeholder="Ahmed Ali"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </label>

          {/* Email */}
          <label className="text-sm font-medium text-slate-700">
            Email *
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </label>

          {/* Password */}
          <label className="text-sm font-medium text-slate-700">
            Password *
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </label>

          {/* Confirm password */}
          <label className="text-sm font-medium text-slate-700">
            Confirm Password *
            <input
              name="confirm_password"
              type="password"
              value={form.confirm_password}
              onChange={handleChange}
              required
              autoComplete="new-password"
              placeholder="Re-enter password"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 ${
                form.confirm_password && form.password !== form.confirm_password
                  ? "border-rose-400 bg-rose-50"
                  : "border-slate-300"
              }`}
            />
            {form.confirm_password && form.password !== form.confirm_password && (
              <span className="mt-1 block text-xs text-rose-600">Passwords do not match</span>
            )}
          </label>

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-slate-900 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
