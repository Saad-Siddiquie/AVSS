"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import HeroArt from "@/components/art/HeroArt";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";

export default function LoginPage() {
  const router = useRouter();
  const { saveToken } = useAuth();
  const [show,    setShow]    = useState(false);
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const fieldCls = "flex items-center gap-2 rounded-lg border border-edge bg-panel-2 px-3 py-2.5 focus-within:border-accent transition-colors";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd    = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const pw    = String(fd.get("password") ?? "");
    if (!email || !pw) { setError("Enter your email and password."); return; }

    setLoading(true);
    try {
      const res  = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Login failed.");

      saveToken({
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
        token_type:    data.token_type,
        user:          data.user ?? null,
      });

      const isAdm = data.user?.role === "admin" || data.user?.is_superuser;
      router.replace(isAdm ? "/admin/dashboard" : "/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl min-h-screen grid place-items-center p-4 sm:p-6">
      <div className="glass w-full max-w-4xl grid overflow-hidden md:grid-cols-2">

        {/* ── Left: form ──────────────────────────────────────── */}
        <section className="p-8 md:p-12">
          <Logo subtitle/>
          <h1 className="mt-10 font-display text-2xl font-semibold">Welcome Back!</h1>
          <p className="text-sm text-mute">Sign in to continue to AVSS</p>

          <form onSubmit={submit} noValidate className="mt-6 space-y-3">
            <label className={fieldCls}>
              <Mail className="size-4 text-mute" aria-hidden/>
              <input name="email" type="email" autoComplete="username"
                placeholder="Email address" aria-label="Email"
                className="w-full bg-transparent text-sm outline-none"/>
            </label>

            <label className={fieldCls}>
              <Lock className="size-4 text-mute" aria-hidden/>
              <input name="password" type={show ? "text" : "password"}
                autoComplete="current-password" placeholder="Password" aria-label="Password"
                className="w-full bg-transparent text-sm outline-none"/>
              <button type="button" onClick={() => setShow(v => !v)}
                aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
                className="text-mute hover:text-white">
                {show ? <EyeOff className="size-4" aria-hidden/> : <Eye className="size-4" aria-hidden/>}
              </button>
            </label>

            {error && <p role="alert" className="text-xs text-danger">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? "Signing in…" : "Login"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-mute">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-accent hover:underline">Sign Up</Link>
          </p>
          <p className="mt-2 text-center text-xs text-mute">
            First time?{" "}
            <Link href="/setup" className="text-warn hover:underline">Create Admin →</Link>
          </p>
        </section>

        {/* ── Right: hero art ──────────────────────────────────── */}
        <section className="relative min-h-72 overflow-hidden hidden md:block">
          <div className="absolute inset-0"><HeroArt/></div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg/95 via-bg/70 to-transparent p-8 pt-24">
            <p className="font-display text-3xl font-semibold leading-tight">
              Smarter Surveillance,<br/>Safer Tomorrow
            </p>
            <p className="mt-2 text-sm text-mute">Find. Identify. Protect.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
