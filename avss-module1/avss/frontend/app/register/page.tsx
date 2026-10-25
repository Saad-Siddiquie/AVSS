"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import HeroArt from "@/components/art/HeroArt";
import { useAuth } from "@/hooks/useAuth";

const API = "/api/backend";

const strength = (p: string) =>
  [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(p)).length;

export default function RegisterPage() {
  const router = useRouter();
  const { saveToken } = useAuth();
  const [show,    setShow]    = useState(false);
  const [pw,      setPw]      = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const fieldCls = "flex items-center gap-2 rounded-lg border border-edge bg-panel-2 px-3 py-2.5 focus-within:border-accent transition-colors";
  const s = strength(pw);
  const pwColors = ["text-danger","text-danger","text-warn","text-ok","text-ok"];
  const pwLabels = ["Too weak","Weak","Fair","Good","Strong"];

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd      = new FormData(e.currentTarget);
    const name    = String(fd.get("name")    ?? "").trim();
    const email   = String(fd.get("email")   ?? "").trim();
    const confirm = String(fd.get("confirm") ?? "");
    if (!name)                             { setError("Enter your full name."); return; }
    if (!/^\S+@\S+\.\S+$/.test(email))    { setError("Enter a valid email."); return; }
    if (s < 2 || pw.length < 8)           { setError("Use a stronger password (8+ chars)."); return; }
    if (pw !== confirm)                    { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res  = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name, email, password: pw, role: "user" }),
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
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl min-h-screen grid place-items-center p-4 sm:p-6">
      <div className="glass w-full max-w-4xl grid overflow-hidden md:grid-cols-2">
        <section className="p-8 md:p-12">
          <Logo subtitle/>
          <h1 className="mt-10 font-display text-2xl font-semibold">Create your account</h1>
          <p className="text-sm text-mute">Set up access to the AVSS dashboard</p>

          <form onSubmit={submit} noValidate className="mt-6 space-y-3">
            <label className={fieldCls}>
              <User className="size-4 text-mute" aria-hidden/>
              <input name="name" type="text" autoComplete="name"
                placeholder="Full name" aria-label="Full name"
                className="w-full bg-transparent text-sm outline-none"/>
            </label>

            <label className={fieldCls}>
              <Mail className="size-4 text-mute" aria-hidden/>
              <input name="email" type="email" autoComplete="username"
                placeholder="Email" aria-label="Email"
                className="w-full bg-transparent text-sm outline-none"/>
            </label>

            <div>
              <label className={fieldCls}>
                <Lock className="size-4 text-mute" aria-hidden/>
                <input name="password" type={show ? "text" : "password"}
                  autoComplete="new-password" placeholder="Password"
                  value={pw} onChange={e => setPw(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none"/>
                <button type="button" onClick={() => setShow(v => !v)}
                  className="text-mute hover:text-white">
                  {show ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}
                </button>
              </label>
              {pw && <p className={`mt-1 text-xs ${pwColors[s]}`}>{pwLabels[s]}</p>}
            </div>

            <label className={fieldCls}>
              <Lock className="size-4 text-mute" aria-hidden/>
              <input name="confirm" type="password" autoComplete="new-password"
                placeholder="Confirm password"
                className="w-full bg-transparent text-sm outline-none"/>
            </label>

            {error && <p role="alert" className="text-xs text-danger">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? "Creating account…" : "Sign Up"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-mute">
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:underline">Log in</Link>
          </p>
        </section>

        <section className="relative min-h-72 overflow-hidden hidden md:block">
          <div className="absolute inset-0"><HeroArt/></div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg/95 via-bg/70 to-transparent p-8 pt-24">
            <p className="font-display text-3xl font-semibold leading-tight">
              AI Today<br/>Safer Tomorrow
            </p>
            <p className="mt-2 text-sm text-mute">Find. Identify. Protect.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
