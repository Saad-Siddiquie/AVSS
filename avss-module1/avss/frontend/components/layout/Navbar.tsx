"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/cameras", label: "Cameras" },
  { href: "/detect", label: "Detection" },
  { href: "/persons", label: "Persons" },
  { href: "/search", label: "Search" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn, clearToken } = useAuth();

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-bold text-white tracking-widest">
            AVSS
          </span>
          <span className="hidden text-sm font-semibold text-slate-700 sm:block">
            Surveillance System
          </span>
        </Link>

        <ul className="flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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

          {isLoggedIn ? (
            <li>
              <button
                onClick={handleLogout}
                className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Logout
              </button>
            </li>
          ) : (
            <li>
              <Link
                href="/login"
                className="ml-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
              >
                Login
              </Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
