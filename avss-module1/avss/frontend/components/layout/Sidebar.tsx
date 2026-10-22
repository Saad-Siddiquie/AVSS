"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface NavItem { href: string; label: string; badge?: string }

const USER_NAV: NavItem[] = [
  { href: "/dashboard",  label: "Dashboard" },
  { href: "/pipeline",   label: "Search / Pipeline" },
  { href: "/cameras",    label: "Cameras" },
  { href: "/results",    label: "Clips Library" },
  { href: "/analytics",  label: "Analytics" },
  { href: "/settings",   label: "Settings" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/pipeline",  label: "Search / Pipeline" },
  { href: "/admin/cameras",   label: "Cameras" },
  { href: "/admin/jobs",      label: "All Jobs" },
  { href: "/admin/results",   label: "Clips Library" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/users",     label: "Users & Roles" },
  { href: "/admin/audit",     label: "Audit Log" },
  { href: "/admin/settings",  label: "Settings" },
];

export function Sidebar() {
  const { user, isAdmin, clearToken } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav   = isAdmin ? ADMIN_NAV : USER_NAV;
  const brand = isAdmin ? "AVSS Admin" : "AVSS";

  const initials = (user?.full_name || "?")
    .split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase();

  const accentClass = isAdmin ? "text-orange-500" : "text-emerald-500";
  const activeBg    = isAdmin
    ? "bg-orange-600/20 text-orange-400 font-semibold"
    : "bg-emerald-600/20 text-emerald-400 font-semibold";

  /* Stub pages — show coming-soon links in muted style */
  const STUB_HREFS = new Set([
    "/results", "/analytics", "/settings",
    "/admin/results", "/admin/analytics", "/admin/audit", "/admin/settings",
  ]);

  /* Role label — correct display per actual role */
  const roleLabel = user?.is_superuser
    ? "Super Admin"
    : user?.role === "admin"
    ? "Administrator"
    : "Operator";

  return (
    <>
      {/* ── Mobile top bar ────────────────────────────────────────── */}
      <header className="md:hidden flex items-center justify-between bg-slate-900 border-b border-slate-700 px-4 py-3">
        <span className={`font-bold font-display ${accentClass}`}>{brand}</span>
        <button className="btn-outline text-sm" aria-label="Open menu" onClick={() => setOpen(v => !v)}>
          Menu
        </button>
      </header>

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside
        className={`
          fixed md:static z-30 inset-y-0 left-0 w-64
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
          transition-transform bg-slate-900 border-r border-slate-700
          flex flex-col p-4
        `}
      >
        {/* Brand */}
        <div className={`text-xl font-bold font-display mb-0.5 ${accentClass}`}>{brand}</div>
        <div className="text-xs text-slate-500 mb-5">Autonomous Video Surveillance</div>

        {/* Nav */}
        <nav className="space-y-0.5 flex-1 overflow-y-auto">
          {nav.map(({ href, label }) => {
            const isStub   = STUB_HREFS.has(href);
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={isStub ? "#" : href}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? activeBg
                    : isStub
                    ? "text-slate-600 cursor-default"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
                aria-current={isActive ? "page" : undefined}
                tabIndex={isStub ? -1 : 0}
              >
                {label}
                {isStub && (
                  <span className="text-[10px] text-slate-600 border border-slate-700 px-1 rounded">
                    soon
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info — shows real role */}
        <div className="border-t border-slate-700 pt-3 flex items-center gap-2 mt-3">
          <div className={`w-9 h-9 rounded-full grid place-items-center text-sm font-bold flex-shrink-0 ${
            isAdmin ? "bg-orange-600 text-slate-950" : "bg-emerald-600 text-slate-950"
          }`}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm truncate font-medium">{user?.full_name || "Unknown"}</div>
            <div className="text-xs text-slate-400">{roleLabel}</div>
          </div>
        </div>

        <button onClick={clearToken} className="btn-outline mt-3 text-sm w-full">
          Log out
        </button>
      </aside>

      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setOpen(false)} />
      )}
    </>
  );
}
