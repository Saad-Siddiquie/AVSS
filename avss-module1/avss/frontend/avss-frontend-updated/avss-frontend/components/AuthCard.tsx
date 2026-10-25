"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import Logo from "@/components/Logo";
import HeroArt from "@/components/art/HeroArt";

export default function AuthCard({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const signup = mode === "signup";

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const id = String(data.get("id") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!id || !password) return setError(signup ? "Enter your email and choose a password." : "Enter your email or username and password.");
    if (signup && password.length < 8) return setError("Use at least 8 characters for the password.");
    setError("");
    // Replace with a call to your FastAPI endpoint: POST /api/auth/login (or /api/auth/signup), then store the session.
    router.push("/dashboard");
  }

  const field = "flex items-center gap-2 rounded-lg border border-edge bg-panel-2 px-3 py-2.5 focus-within:border-accent";

  return (
    <div className="glass grid overflow-hidden md:grid-cols-[1.05fr_1fr]">
      <section className="p-8 md:p-12">
        <Logo subtitle />
        <h1 className="mt-12 font-display text-2xl font-semibold">{signup ? "Create your account" : "Welcome Back!"}</h1>
        <p className="text-sm text-mute">{signup ? "Set up access to the AVSS dashboard." : "Sign in to continue"}</p>
        <form onSubmit={submit} noValidate className="mt-6 space-y-3">
          {signup && (
            <label className={field}>
              <User className="size-4 text-mute" aria-hidden />
              <input name="name" type="text" autoComplete="name" placeholder="Full name" aria-label="Full name" className="w-full bg-transparent text-sm outline-none" />
            </label>
          )}
          <label className={field}>
            <Mail className="size-4 text-mute" aria-hidden />
            <input name="id" type="text" autoComplete="username" placeholder={signup ? "Email" : "Email / Username"} aria-label={signup ? "Email" : "Email or username"} className="w-full bg-transparent text-sm outline-none" />
          </label>
          <label className={field}>
            <Lock className="size-4 text-mute" aria-hidden />
            <input name="password" type={show ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} placeholder="Password" aria-label="Password" className="w-full bg-transparent text-sm outline-none" />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="text-mute hover:text-white">
              {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </label>
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
          <button type="submit" className="btn-primary w-full">{signup ? "Sign Up" : "Login"}</button>
        </form>
        <p className="mt-6 text-center text-xs text-mute">
          {signup ? "Already have an account? " : "Don't have an account? "}
          <Link href={signup ? "/" : "/signup"} className="text-accent hover:underline">{signup ? "Log in" : "Sign Up"}</Link>
        </p>
      </section>
      <section className="relative min-h-72 overflow-hidden">
        <div className="absolute inset-0"><HeroArt /></div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg/95 via-bg/70 to-transparent p-8 pt-24">
          <p className="font-display text-3xl font-semibold leading-tight">Smarter Surveillance,<br />Safer Tomorrow</p>
          <p className="mt-2 text-sm text-mute">Find. Identify. Protect.</p>
        </div>
      </section>
    </div>
  );
}
