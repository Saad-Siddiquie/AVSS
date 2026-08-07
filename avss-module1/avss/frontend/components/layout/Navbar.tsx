"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/cameras", label: "Cameras" },
  { href: "/detect", label: "Detection" },
  { href: "/persons", label: "Persons" },
  { href: "/search", label: "Search" },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn, clearToken, authHeaders, ready } = useAuth();
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Fetch logged-in user info
  useEffect(() => {
    if (!isLoggedIn) {
      setUserName(null);
      setUserEmail(null);
      return;
    }
    fetch("/api/backend/auth/me", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setUserName(d.full_name || null);
        setUserEmail(d.email || null);
      })
      .catch(() => null);
  }, [isLoggedIn]);

  const handleLogout = () => {
    clearToken();
    setUserName(null);
    setUserEmail(null);
    setMenuOpen(false);
    router.push("/login");
  };

  // Display name: full_name if available, otherwise the part before @ in email
  const displayName = userName || (userEmail ? userEmail.split("@")[0] : null);
  const initials = displayName ? getInitials(displayName) : "U";

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">

        {/* ── Brand ── */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-bold text-white tracking-widest">
            AVSS
          </span>
          <span className="hidden text-sm font-semibold text-slate-700 md:block">
            Surveillance System
          </span>
        </Link>

        {/* ── Nav links — only when logged in ── */}
        {ready && isLoggedIn && (
          <ul className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* ── Right side ── */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Logged IN — user info + logout */}
          {ready && isLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50 transition-colors"
              >
                {/* Avatar circle with initials */}
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white select-none">
                  {initials}
                </span>
                <span className="hidden text-sm font-medium text-slate-700 sm:block max-w-[120px] truncate">
                  {displayName}
                </span>
                {/* Chevron */}
                <svg
                  className={`h-4 w-4 text-slate-400 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown menu */}
              {menuOpen && (
                <>
                  {/* Backdrop to close on outside click */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-2 w-52 rounded-2xl border border-slate-200 bg-white py-2 shadow-lg">
                    {/* User info */}
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {displayName}
                      </p>
                      {userEmail && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{userEmail}</p>
                      )}
                    </div>

                    {/* Mobile nav links */}
                    <div className="md:hidden border-b border-slate-100 py-1">
                      {NAV_LINKS.map(({ href, label }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMenuOpen(false)}
                          className={`block px-4 py-2 text-sm transition-colors ${
                            pathname === href
                              ? "font-semibold text-slate-900"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {label}
                        </Link>
                      ))}
                    </div>

                    {/* Logout */}
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>

          ) : ready ? (
            /* Logged OUT — Login + Register buttons */
            <>
              <Link
                href="/login"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
              >
                Register
              </Link>
            </>
          ) : null}
        </div>

      </div>
    </nav>
  );
}
